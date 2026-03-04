const supabase = require('../supabaseClient');
const aiService = process.env.AI_PROVIDER === 'groq' ? require('../aiService') : require('../ollamaService');
const QcService = require('../utils/QcService');

module.exports = {
    // Frecuencia corta de Receiver
    delayMs: 15000, // 15 segundos

    execute: async function ({ prompts }) {
        console.log(`\n======================================`);
        console.log(`[📥 Phase 2 Receiver] Buscando Borradores Neutrales terminados...`);

        // 1. Buscar tickets completados
        const { data: tickets, error: fetchError } = await supabase
            .from('ia_request_queue')
            .select('id, article_id, result')
            .eq('status', 'DONE')
            .eq('task_type', 'PHASE_2_NEUTRAL')
            .limit(10);

        if (fetchError) {
            console.error(`[X] Error buscando redacciones terminadas:`, fetchError.message);
            return;
        }

        if (!tickets || tickets.length === 0) {
            console.log(`[✔] No hay borradores neutrales (Phase 2) completos en la cola.`);
            return;
        }

        let processed = 0;

        for (const ticket of tickets) {
            try {
                console.log(`  [📥] Recibiendo Borrador para Artículo ${ticket.article_id}...`);

                // Parse 
                let neutralObj = null;
                try {
                    neutralObj = JSON.parse(ticket.result);
                } catch (parseErr) {
                    console.error(`  [!] Error parseando JSON de Phase 2. Módulo de Redacción Roto.`);
                    const match = ticket.result.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                    if (match) {
                        neutralObj = JSON.parse(match[1]);
                    } else throw new Error("JSON Inválido de Redactor.");
                }

                // -----------------------------------------------------
                // Fase Asíncrona Interna: QC A (Traducción Sanadora)
                // -----------------------------------------------------
                const qcPrompt = prompts?.correction || 'translator_correction';
                const hadEnglish = await QcService.detectEnglish(neutralObj);

                if (hadEnglish) {
                    console.log(`  [QC A] Borrador falló prueba de Español nativo. Encolando Trandución...`);
                    await aiService.submitTraduccionSanadora(ticket.article_id, JSON.stringify(neutralObj), 'PHASE_2', qcPrompt);

                    const { error: bridgeUpdate } = await supabase
                        .from('raw_articles')
                        .update({ process_status: 'PROCESSING_QC_A' })
                        .eq('id', ticket.article_id);

                    if (bridgeUpdate) throw bridgeUpdate;

                    await supabase.from('ia_request_queue').delete().eq('id', ticket.id);
                    continue;
                }

                // Guardar borrador NO aprobado todavía
                const { error: insertError } = await supabase
                    .from('neutral_news')
                    .insert([{
                        raw_article_id: ticket.article_id,
                        title: neutralObj.neutral_title || "Título Pendiente",
                        content: neutralObj.neutral_content || "Contenido Pendiente",
                        category: neutralObj.category || "General"
                    }]);

                if (insertError) {
                    console.error(`  [X] Falló al insertar Borrador Neutral DB:`, insertError.message);
                } else {
                    const { error: updateError } = await supabase
                        .from('raw_articles')
                        .update({ process_status: 'PENDING_QC_B' }) // <- Pasa al Juez, no a Twitter directo
                        .eq('id', ticket.article_id);

                    if (updateError) throw updateError;
                }

                await supabase.from('ia_request_queue').delete().eq('id', ticket.id);
                processed++;

            } catch (err) {
                console.error(`  [X] Falló al aplicar resultado del ticket ${ticket.id}:`, err.message);
                await supabase.from('ia_request_queue').update({ status: 'FAILED', error_msg: err.message }).eq('id', ticket.id);
            }
        }

        console.log(`[✔] Phase 2 Receiver finalizado: ${processed} borradores a revisión (PENDING_QC_B).`);
    }
};
