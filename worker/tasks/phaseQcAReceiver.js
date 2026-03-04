const supabase = require('../supabaseClient');

module.exports = {
    // Escaneo rápido para curar la línea de ensamblaje lo antes posible
    delayMs: 15000,

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[📥 QC A Receiver] Buscando parches de traducción terminados por la IA...`);

        // 1. Buscar tickets de Juicio completados (pueden venir de Fase 1 o Fase 2)
        const { data: tickets, error: fetchError } = await supabase
            .from('ia_request_queue')
            .select('id, article_id, result, task_type')
            .eq('status', 'DONE')
            .like('task_type', 'QC_A_TRANSLATE_%') // Toma Phase 1 y Phase 2 Translations
            .limit(10);

        if (fetchError) {
            console.error(`[X] Error buscando traducciones:`, fetchError.message);
            return;
        }

        if (!tickets || tickets.length === 0) {
            console.log(`[✔] No hay traducciones pendientes en la cola.`);
            return;
        }

        let processed = 0;

        for (const ticket of tickets) {
            try {
                // Determinar a qué fase original pertenece este artículo saneado
                const originPhase = ticket.task_type.replace('QC_A_TRANSLATE_', ''); // Queda "PHASE_1" o "PHASE_2"

                console.log(`  [📥] Recibiendo Sanador de Idioma para Artículo ${ticket.article_id} (Origen: ${originPhase})...`);

                // En lugar de procesarlo nosotros, inyectamos el ticket original *ficticio* de nuevo en la cola
                // para que el Receiver original (phase1Receiver o phase2Receiver) lo agarre arreglado.
                // Es un truco brillante de arquitectura orientada a eventos.

                const targetTaskType = originPhase === 'PHASE_1' ? 'PHASE_1_FORENSIC' : 'PHASE_2_NEUTRAL';

                const { error: insertSanaError } = await supabase
                    .from('ia_request_queue')
                    .insert([{
                        article_id: ticket.article_id,
                        task_type: targetTaskType,
                        prompt_name: 'RECOVERED_BY_QC_A',
                        prompt: 'Bypassed by Healer',
                        is_json: true,
                        model_tier: 0,
                        status: 'DONE', // ¡Lo metemos directo a la bandeja de salida!
                        result: ticket.result // Pasamos el JSON traducido
                    }]);

                if (insertSanaError) throw insertSanaError;

                // Destruimos el ticket de traducción original
                await supabase.from('ia_request_queue').delete().eq('id', ticket.id);
                processed++;

            } catch (err) {
                console.error(`  [X] Falló al inyectar resultado curado del ticket ${ticket.id}:`, err.message);
                await supabase.from('ia_request_queue').update({ status: 'FAILED', error_msg: err.message }).eq('id', ticket.id);
            }
        }

        console.log(`[✔] QC A Receiver finalizado: ${processed} artículos sanados reingresados a su línea original.`);
    }
};
