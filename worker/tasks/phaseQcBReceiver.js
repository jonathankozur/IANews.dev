const supabase = require('../supabaseClient');

module.exports = {
    // Frecuencia muy corta, los booleanos son rápidos de parsear
    delayMs: 10000,

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[📥 QC B Receiver] Leyendo veredictos del Fallo Editorial...`);

        // 1. Buscar tickets de Juicio completados
        const { data: tickets, error: fetchError } = await supabase
            .from('ia_request_queue')
            .select('id, article_id, result')
            .eq('status', 'DONE')
            .eq('task_type', 'QC_B_JUDGE')
            .limit(10);

        if (fetchError) {
            console.error(`[X] Error buscando veredictos:`, fetchError.message);
            return;
        }

        if (!tickets || tickets.length === 0) {
            console.log(`[✔] No hay veredictos editoriales en la cola.`);
            return;
        }

        let processed = 0;

        for (const ticket of tickets) {
            try {
                // El prompt de QC B instruye a devolver exactamente la palabra "TRUE" o "FALSE"
                const verdictString = ticket.result.trim().toUpperCase();

                // Si la IA divagó y metió texto extra, buscamos la palabra clave, sino false por seguridad
                const isApproved = verdictString.includes("TRUE");

                console.log(`  [📥] Veredicto para Artículo ${ticket.article_id}: ${isApproved ? 'APROBADO ✅' : 'RECHAZADO ❌ (Redactar de nuevo)'}`);

                if (isApproved) {
                    // 1. Mover el artículo a la Fase 3 (Twitter)
                    const { error: updateError } = await supabase
                        .from('raw_articles')
                        .update({ process_status: 'PENDING_TWITTER' })
                        .eq('id', ticket.article_id);

                    if (updateError) throw updateError;

                } else {
                    // Rechazado: 
                    // 1. Borrar el borrador malo para que no ensucie la DB
                    await supabase
                        .from('neutral_news')
                        .delete()
                        .eq('raw_article_id', ticket.article_id);

                    // 2. Devolver el artículo crudo a la pila de PENDING_NEUTRAL para que Phase 2 Submitter intente redactar OTRA VEZ
                    const { error: retryError } = await supabase
                        .from('raw_articles')
                        .update({ process_status: 'PENDING_NEUTRAL' })
                        .eq('id', ticket.article_id);

                    if (retryError) throw retryError;
                }

                // Limpiar la cola
                await supabase.from('ia_request_queue').delete().eq('id', ticket.id);
                processed++;

            } catch (err) {
                console.error(`  [X] Falló al aplicar veredicto del ticket ${ticket.id}:`, err.message);
                await supabase.from('ia_request_queue').update({ status: 'FAILED', error_msg: err.message }).eq('id', ticket.id);
            }
        }

        console.log(`[✔] QC B Receiver finalizado: ${processed} veredictos acatados.`);
    }
};
