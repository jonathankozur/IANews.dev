const supabase = require('../supabaseClient');

module.exports = {
    delayMs: 15000,

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[📥 Phase 3 Receiver] Recopilando Hilos virales nacidos de la GPU...`);

        // 1. Buscar tickets de Juicio completados
        const { data: tickets, error: fetchError } = await supabase
            .from('ia_request_queue')
            .select('id, article_id, result')
            .eq('status', 'DONE')
            .eq('task_type', 'PHASE_3_TWITTER')
            .limit(10);

        if (fetchError) {
            console.error(`[X] Error buscando hilos generados:`, fetchError.message);
            return;
        }

        if (!tickets || tickets.length === 0) {
            console.log(`[✔] No hay tuits en la cola de recolección.`);
            return;
        }

        let processed = 0;

        for (const ticket of tickets) {
            try {
                // El prompt de Twitter Thread debería devolver JSON o un texto rudo
                // Mantenemos la lógica de limpieza de markdown por si falla
                let generatedThreadContext = null;
                try {
                    generatedThreadContext = JSON.parse(ticket.result);
                } catch (e) {
                    const match = ticket.result.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                    if (match) {
                        generatedThreadContext = JSON.parse(match[1]);
                    } else {
                        // Fallback rudo si la IA solo escupió texto
                        generatedThreadContext = { thread_text: ticket.result };
                    }
                }

                // Asegurar que hay texto
                const finalThreadContent = generatedThreadContext.thread_text || generatedThreadContext.tweet || ticket.result;

                console.log(`  [📥] Hilo para Artículo ${ticket.article_id} Recibido y Listo para publicarse.`);

                // 1. Insertamos en twitter_audit (registro de tuits pendientes)
                // Simulamos la estructura vieja que guardaba "original_title" a modo de recordatorio
                const { error: insertError } = await supabase
                    .from('twitter_audit')
                    .insert([{
                        raw_article_id: ticket.article_id,
                        original_title: "Ver en Neutral News",
                        generated_thread: finalThreadContent,
                        status: 'PENDING'
                    }]);

                if (insertError) {
                    console.error(`  [X] Falló insertar Hilo en la tabla de auditoría:`, insertError.message);
                } else {
                    // 2. Mover la Noticia a READY_TO_PUBLISH general (¡Llegó a la meta final del sistema multi-fase!)
                    const { error: updateError } = await supabase
                        .from('raw_articles')
                        .update({ process_status: 'READY_TO_PUBLISH' })
                        .eq('id', ticket.article_id);

                    if (updateError) throw updateError;
                }

                // Limpiar la cola
                await supabase.from('ia_request_queue').delete().eq('id', ticket.id);
                processed++;

            } catch (err) {
                console.error(`  [X] Falló al aplicar hilo del ticket ${ticket.id}:`, err.message);
                await supabase.from('ia_request_queue').update({ status: 'FAILED', error_msg: err.message }).eq('id', ticket.id);
            }
        }

        console.log(`[✔] Phase 3 Receiver finalizado: ${processed} artículos listos para Publicación (Línea de Meta).`);
    }
};
