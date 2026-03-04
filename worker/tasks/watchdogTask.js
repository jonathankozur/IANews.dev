const supabase = require('../supabaseClient');

// How many minutes a ticket can be in PROCESSING before considered a deadlock
const STUCK_THRESHOLD_MINUTES = parseInt(process.env.WATCHDOG_STUCK_THRESHOLD_MINUTES || '5', 10);
// Max retries for domain-level errors before giving up permanently
const DOMAIN_MAX_RETRIES = parseInt(process.env.WATCHDOG_DOMAIN_MAX_RETRIES || '3', 10);
// Delete FAILED queue tickets older than this many hours
const QUEUE_CLEANUP_HOURS = parseInt(process.env.WATCHDOG_QUEUE_CLEANUP_HOURS || '1', 10);

module.exports = {
    delayMs: 60000, // Check every 60 seconds

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[🐕 Watchdog] Iniciando ciclo de supervisión...`);

        await rescueStuckProcessingTickets();
        await retryFailedRawArticles();
        await rescueStuckOrchestrators();
        await cleanupOrphanedQueueTickets();

        console.log(`[🐕 Watchdog] Ciclo completado.`);
    }
};

// ──────────────────────────────────────────────────────────
// 1. Rescatar tickets PROCESSING colgados (comportamiento original)
// ──────────────────────────────────────────────────────────
async function rescueStuckProcessingTickets() {
    const thresholdDate = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    const { data: stuckTickets, error: fetchError } = await supabase
        .from('ia_request_queue')
        .select('id, created_at, updated_at')
        .eq('status', 'PROCESSING')
        .lt('updated_at', thresholdDate);

    if (fetchError) {
        console.error('[Watchdog] Error querying stuck tickets:', fetchError.message);
        return;
    }

    if (!stuckTickets || stuckTickets.length === 0) {
        console.log(`[Watchdog] ✅ Queue limpia, no hay tickets colgados en PROCESSING.`);
        return;
    }

    console.log(`[Watchdog] ⚠️ ${stuckTickets.length} ticket(s) colgado(s) en PROCESSING. Rescatando...`);

    for (const ticket of stuckTickets) {
        const { error: resetError } = await supabase
            .from('ia_request_queue')
            .update({
                status: 'PENDING',
                error_msg: `[AUTO-RESET by Watchdog] Estaba colgado en PROCESSING por más de ${STUCK_THRESHOLD_MINUTES} minutos al ${new Date().toISOString()}`,
                updated_at: new Date()
            })
            .eq('id', ticket.id)
            .eq('status', 'PROCESSING'); // Safe guard

        if (resetError) {
            console.error(`[Watchdog] Error rescatando ticket ${ticket.id}:`, resetError.message);
        } else {
            console.log(`[Watchdog] 🔄 Ticket ${ticket.id.substring(0, 8)} rescatado → PENDING`);
        }
    }
}

// ──────────────────────────────────────────────────────────
// 2. Reintentar artículos crudos fallidos (raw_articles ERROR → PENDING_ANALYSIS)
// ──────────────────────────────────────────────────────────
async function retryFailedRawArticles() {
    const { data: failedArticles, error } = await supabase
        .from('raw_articles')
        .select('id, title, retry_count')
        .eq('process_status', 'ERROR')
        .lt('retry_count', DOMAIN_MAX_RETRIES);

    if (error) {
        console.error('[Watchdog] Error buscando raw_articles fallidos:', error.message);
        return;
    }

    if (!failedArticles || failedArticles.length === 0) {
        console.log(`[Watchdog] ✅ No hay raw_articles en ERROR pendientes de reintento.`);
        return;
    }

    console.log(`[Watchdog] ♻️  ${failedArticles.length} raw_article(s) en ERROR para reintentar.`);

    for (const article of failedArticles) {
        const newRetryCount = (article.retry_count || 0) + 1;
        const { error: updateError } = await supabase
            .from('raw_articles')
            .update({
                process_status: 'PENDING_ANALYSIS',
                retry_count: newRetryCount
            })
            .eq('id', article.id)
            .eq('process_status', 'ERROR'); // Safe guard

        if (updateError) {
            console.error(`[Watchdog] Error reintentando article ${article.id}:`, updateError.message);
        } else {
            console.log(`[Watchdog] 🔄 "${(article.title || '').substring(0, 40)}..." → PENDING_ANALYSIS (intento ${newRetryCount}/${DOMAIN_MAX_RETRIES})`);
        }
    }
}

// ──────────────────────────────────────────────────────────
// 3. Rescatar Colapsos del Orquestador (Saga Recovery)
// ──────────────────────────────────────────────────────────
async function rescueStuckOrchestrators() {
    // Si un worker tomó una noticia hace más de 30 minutos y sigue en PROCESSING, crasheó o lo mataron.
    const ORCHESTRATOR_TIMEOUT_MINS = 30;
    const thresholdDate = new Date(Date.now() - ORCHESTRATOR_TIMEOUT_MINS * 60 * 1000).toISOString();

    const processingStates = [
        'PROCESSING_RELEVANCE', 'PROCESSING_ANALYSIS',
        'PROCESSING_NEUTRAL', 'PROCESSING_QC_B', 'PROCESSING_TWITTER'
    ];

    const { data: stuckArticles, error } = await supabase
        .from('raw_articles')
        .select('id, title, retry_count, process_status')
        .in('process_status', processingStates)
        .lt('locked_at', thresholdDate);

    if (error) {
        console.error('[Watchdog] Error buscando orquestadores colgados:', error.message);
        return;
    }

    if (!stuckArticles || stuckArticles.length === 0) {
        console.log(`[Watchdog] ✅ No hay noticias colgadas en el Orquestador.`);
        return;
    }

    console.log(`[Watchdog] ♻️  ${stuckArticles.length} noticia(s) colapsada(s) en la pipeline para rescatar.`);

    for (const article of stuckArticles) {
        const newRetryCount = (article.retry_count || 0) + 1;

        let fallbackStatus = 'DEAD_ERROR';
        if (newRetryCount < DOMAIN_MAX_RETRIES) {
            // Revertir dinámicamente según la fase donde crasheó
            if (article.process_status === 'PROCESSING_RELEVANCE') fallbackStatus = 'NEW';
            else if (article.process_status === 'PROCESSING_ANALYSIS') fallbackStatus = 'PENDING_ANALYSIS';
            else if (article.process_status === 'PROCESSING_NEUTRAL') fallbackStatus = 'PENDING_NEUTRAL';
            else if (article.process_status === 'PROCESSING_QC_B') fallbackStatus = 'PENDING_QC_B';
            else if (article.process_status === 'PROCESSING_TWITTER') fallbackStatus = 'PENDING_TWITTER';
        }

        const { error: updateError } = await supabase
            .from('raw_articles')
            .update({
                process_status: fallbackStatus,
                worker_id: null,
                locked_at: null,
                retry_count: newRetryCount,
                last_error: fallbackStatus === 'DEAD_ERROR' ? 'Superado límite de reintentos por crasheo del Worker de Fase.' : `Rescatado tras Timeout del Worker (Intento ${newRetryCount})`
            })
            .eq('id', article.id)
            .eq('process_status', article.process_status); // Safe guard

        if (updateError) {
            console.error(`[Watchdog] Error rescatando noticia del Orquestador ${article.id}:`, updateError.message);
        } else {
            console.log(`[Watchdog] 🔄 "${(article.title || '').substring(0, 40)}..." → ${fallbackStatus} (intento ${newRetryCount}/${DOMAIN_MAX_RETRIES})`);
        }
    }
}

// ──────────────────────────────────────────────────────────
// 4. Limpieza Global de la Cola (Zombie/Orphan Tickets)
// ──────────────────────────────────────────────────────────
async function cleanupOrphanedQueueTickets() {
    // Si un ticket sobrevive más de X horas sin ser borrado por su Receiver respectivo, 
    // asumimos que el Receiver falló permanentemente o el ticket se quedó huérfano.
    const cutoffDate = new Date(Date.now() - QUEUE_CLEANUP_HOURS * 60 * 60 * 1000).toISOString();

    const { error, count } = await supabase
        .from('ia_request_queue')
        .delete()
        .lt('updated_at', cutoffDate); // Borra CUALQUIER estado viejo

    if (error) {
        console.error('[Watchdog] Error limpiando zombies de ia_request_queue:', error.message);
        return;
    }

    if (count && count > 0) {
        console.log(`[Watchdog] 🗑️  ${count} ticket(s) Zombie eliminados de la cola.`);
    } else {
        console.log(`[Watchdog] ✅ No hay tickets Zombie viejos en ia_request_queue.`);
    }
}
