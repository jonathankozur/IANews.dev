const supabase = require('../supabaseClient');
const aiService = process.env.AI_PROVIDER === 'groq' ? require('../aiService') : require('../ollamaService');
const QcService = require('../utils/QcService');

module.exports = {
    // Frecuencia corta de Receiver
    delayMs: 15000, // 15 segundos

    execute: async function ({ prompts }) {
        console.log(`\n======================================`);
        console.log(`[📥 Phase 1 Receiver] Buscando Análisis Forenses terminados en la cola...`);

        // 1. Buscar tickets completados de la Tarea 1
        const { data: tickets, error: fetchError } = await supabase
            .from('ia_request_queue')
            .select('id, article_id, result')
            .eq('status', 'DONE')
            .eq('task_type', 'PHASE_1_FORENSIC')
            .limit(10); // Batch procesamiento

        if (fetchError) {
            console.error(`[X] Error buscando análisis terminados:`, fetchError.message);
            return;
        }

        if (!tickets || tickets.length === 0) {
            console.log(`[✔] No hay análisis (Phase 1) terminados por la IA en la cola.`);
            return;
        }

        let processed = 0;

        // 2. Por cada resultado, aplicarlo al news_analysis
        for (const ticket of tickets) {
            try {
                console.log(`  [📥] Recibiendo Análisis para Artículo ${ticket.article_id}...`);

                // Intentar parsear el JSON rudo de la IA
                let forensicObj = null;
                try {
                    forensicObj = JSON.parse(ticket.result);
                } catch (parseErr) {
                    console.error(`  [!] Error parseando JSON de Phase 1. Intentando limpiar string...`);
                    // Intentar extraer de bloques de código markdown si los hay
                    const match = ticket.result.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                    if (match) {
                        try {
                            forensicObj = JSON.parse(match[1]);
                        } catch (e) {
                            throw new Error("El resultado de la IA no fue un JSON válido ni siquiera intentando limpiarlo.");
                        }
                    } else {
                        throw new Error("El resultado original no era JSON y no se encontraron bloques de código estructurado.");
                    }
                }

                // -----------------------------------------------------
                // Fase Asíncrona Interna: Control de Calidad QC A
                // ¿La IA alucino y respondió atributos en inglés?
                // -----------------------------------------------------
                const qcPrompt = prompts?.correction || 'translator_correction';
                const hadEnglish = await QcService.detectEnglish(forensicObj);

                if (hadEnglish) {
                    console.log(`  [QC A] Detetado posible texto en inglés. Encolando Sub-Tarea Translacional...`);

                    // Encolamos sub-tarea especial y metemos Article en un status puente.
                    await aiService.submitTraduccionSanadora(ticket.article_id, JSON.stringify(forensicObj), 'PHASE_1', qcPrompt);

                    const { error: bridgeUpdate } = await supabase
                        .from('raw_articles')
                        .update({ process_status: 'PROCESSING_QC_A' })
                        .eq('id', ticket.article_id);

                    if (bridgeUpdate) throw bridgeUpdate;

                    // Borramos ticket local
                    await supabase.from('ia_request_queue').delete().eq('id', ticket.id);
                    continue; // Pasamos al siguiente ticket, el Receiver de QC A lo continuará después.
                }

                // -----------------------------------------------------
                // Continuación Normal (No hubo inglés, o ya salió de QC A)
                // -----------------------------------------------------

                // Guardarlo nativamente en el artículo
                const { error: insertError } = await supabase
                    .from('news_analysis')
                    .insert([{
                        article_id: ticket.article_id,
                        detected_bias: forensicObj.detected_bias || forensicObj.bias || forensicObj.sentiment || 'No se pudo determinar',
                        manipulation_tactics: forensicObj.manipulation_tactics || forensicObj.manipulation || forensicObj.objective_facts || '',
                        omitted_context: forensicObj.omitted_context || forensicObj.context || '',
                        fact_checks: forensicObj.fact_checks || forensicObj.key_actors || ''
                    }]);

                if (insertError) {
                    // Si falla por foreign key (ej. articulo fue borrado en el medio), ignoramos
                    console.error(`  [X] Falló al insertar Forensic DB:`, insertError.message);
                } else {
                    // Update principal
                    const { error: updateError } = await supabase
                        .from('raw_articles')
                        .update({ process_status: 'PENDING_NEUTRAL' })
                        .eq('id', ticket.article_id);

                    if (updateError) throw updateError;
                }

                // Destruir el ticket procesado 
                await supabase.from('ia_request_queue').delete().eq('id', ticket.id);

                processed++;
            } catch (err) {
                console.error(`  [X] Falló al aplicar resultado del ticket ${ticket.id}:`, err.message);

                // Devolvemos el ticket a FAILED en la cola para log, el Watchdog lo barrerá y reiniciará el raw_article en un Retry
                await supabase.from('ia_request_queue').update({ status: 'FAILED', error_msg: err.message }).eq('id', ticket.id);
            }
        }

        console.log(`[✔] Phase 1 Receiver finalizado: ${processed} artículos llevados a PENDING_NEUTRAL.`);
    }
};
