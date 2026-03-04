require('dotenv').config();
const supabase = require('./supabaseClient');

/**
 * Script de uso único para resetear los errores históricos de dominio.
 * Resetea raw_articles ERROR → PENDING_ANALYSIS
 * Resetea neutral_news ERROR/ERROR_DB → PENDING_GENERATION
 * NO toca ia_request_queue (esos tickets son basura, el watchdog los limpiará).
 */
async function retryDomainErrors() {
    console.log(`\n========================================`);
    console.log(`[♻️  Retry Domain Errors] Iniciando reset masivo...`);
    console.log(`Esto resetea los registros en ERROR para que los workers los re-procesen.`);
    console.log(`Los tickets FAILED en la queue se ignoran (son basura de sesiones anteriores).`);
    console.log(`\nEjecutando en 3 segundos... Ctrl+C para cancelar.`);
    await new Promise(r => setTimeout(r, 3000));

    // ── 1. raw_articles: ERROR → PENDING_ANALYSIS ──────────────────
    console.log(`\n[1/2] Buscando raw_articles en ERROR...`);

    const { count: rawCount, error: rawCountError } = await supabase
        .from('raw_articles')
        .select('*', { count: 'exact', head: true })
        .eq('process_status', 'ERROR');

    if (rawCountError) {
        console.error('Error contando raw_articles:', rawCountError.message);
    } else {
        console.log(`  Encontrados: ${rawCount} artículos en ERROR.`);
    }

    const { error: rawUpdateError } = await supabase
        .from('raw_articles')
        .update({
            process_status: 'PENDING_ANALYSIS',
            retry_count: 0
        })
        .eq('process_status', 'ERROR');

    if (rawUpdateError) {
        console.error('  [X] Error reseteando raw_articles:', rawUpdateError.message);
    } else {
        console.log(`  [✅] raw_articles reseteados → PENDING_ANALYSIS (retry_count = 0)`);
    }

    // ── 2. neutral_news: ERROR/ERROR_DB → PENDING_GENERATION ───────
    console.log(`\n[2/2] Buscando neutral_news en ERROR/ERROR_DB...`);

    const { count: newsCount, error: newsCountError } = await supabase
        .from('neutral_news')
        .select('*', { count: 'exact', head: true })
        .in('process_status', ['ERROR', 'ERROR_DB']);

    if (newsCountError) {
        console.error('Error contando neutral_news:', newsCountError.message);
    } else {
        console.log(`  Encontradas: ${newsCount} noticias en ERROR/ERROR_DB.`);
    }

    const { error: newsUpdateError } = await supabase
        .from('neutral_news')
        .update({
            process_status: 'PENDING_GENERATION',
            retry_count: 0
        })
        .in('process_status', ['ERROR', 'ERROR_DB']);

    if (newsUpdateError) {
        console.error('  [X] Error reseteando neutral_news:', newsUpdateError.message);
    } else {
        console.log(`  [✅] neutral_news reseteadas → PENDING_GENERATION (retry_count = 0)`);
    }

    console.log(`\n========================================`);
    console.log(`[♻️  Retry Domain Errors] Listo.`);
    console.log(`Los workers (neutralizer, generator) procesarán estos registros en su próximo ciclo.`);
    console.log(`El watchdog manejará futuros errores automáticamente (máx ${process.env.WATCHDOG_DOMAIN_MAX_RETRIES || 3} reintentos).`);
    console.log(`========================================\n`);

    process.exit(0);
}

retryDomainErrors();
