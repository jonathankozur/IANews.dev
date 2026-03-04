const supabase = require('../supabaseClient');

module.exports = {
    // Frecuencia corta de Receiver, ya que debe despachar lo procesado rápido
    delayMs: 15000, // 15 segundos

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[📥 Phase 0 Receiver] Buscando resultados del Filtro Temático en ia_request_queue...`);

        // 1. Buscar tickets completados de la Tarea 0
        const { data: tickets, error: fetchError } = await supabase
            .from('ia_request_queue')
            .select('id, article_id, result')
            .eq('status', 'DONE')
            .eq('task_type', 'PHASE_0_RELEVANCE')
            .limit(10); // Batch procesamiento

        if (fetchError) {
            console.error(`[X] Error buscando resultados terminados:`, fetchError.message);
            return;
        }

        if (!tickets || tickets.length === 0) {
            console.log(`[✔] No hay filtros (Phase 0) terminados por la IA en la cola.`);
            return;
        }

        let processed = 0;

        // 2. Por cada resultado, aplicarlo al raw_articles
        for (const ticket of tickets) {
            try {
                // Analizar el JSON final que dejó Local AI (Result == {"es_relevante": true})
                const jsonResponse = JSON.parse(ticket.result);
                const isRelevant = jsonResponse.es_relevante === true;

                // Si la IA dice OK, pasa a Phase 1 (Forense). Sino, a la basura (DISCARDED).
                const newStatus = isRelevant ? 'PENDING_ANALYSIS' : 'DISCARDED_THEME';

                console.log(`  [📥] Recibiendo decisión: Artículo ${ticket.article_id} -> ${isRelevant ? 'RELEVANTE ✅' : 'DESCARTADO ⛔'}`);

                // Guardarlo nativamente en el artículo
                const { error: updateError } = await supabase
                    .from('raw_articles')
                    .update({ process_status: newStatus })
                    .eq('id', ticket.article_id);

                if (updateError) throw updateError;

                // Destruir el ticket procesado para no inflar la base de datos (Garbage Collection sana)
                await supabase.from('ia_request_queue').delete().eq('id', ticket.id);

                processed++;
            } catch (err) {
                console.error(`  [X] Falló al aplicar resultado del ticket ${ticket.id}:`, err.message);
            }
        }

        console.log(`[✔] Phase 0 Receiver finalizado: ${processed} artículos decididos y tickets destruidos.`);
    }
};
