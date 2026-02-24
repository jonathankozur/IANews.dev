const supabase = require('../supabaseClient');
const aiCore = require('../aiCore');
// ollamaCore se importa de forma lazy para evitar logs de inicialización innecesarios

module.exports = {
    // 2 segundos (es el más crítico)
    delayMs: 2000,

    execute: async function ({ useOllama, instanceId }) {
        // En worker 0 el motor SÍ importa

        // 1. Obtener la fila PENDING más vieja
        const { data: tickets, error: fetchError } = await supabase
            .from('ia_request_queue')
            .select('*')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true })
            .limit(1);

        if (fetchError) {
            console.error("[X] Error buscando en DB:", fetchError.message);
            return;
        }

        if (tickets && tickets.length > 0) {
            const ticket = tickets[0];

            // 2. Lock optimista: Tratar de pasarlo a PROCESSING
            const { data: updateData, error: updateError } = await supabase
                .from('ia_request_queue')
                .update({ status: 'PROCESSING', updated_at: new Date() })
                .eq('id', ticket.id)
                .eq('status', 'PENDING')
                .select();

            if (updateError) {
                console.error(`[X] Error marcando como PROCESSING: ${updateError.message}`);
                return;
            }

            // Si no se actualizó ninguna fila, significa que otro proceso ya lo tomó
            if (!updateData || updateData.length === 0) {
                return;
            }

            console.log(`\n======================================`);
            console.log(`[📥 Processor] Procesando Ticket ${ticket.id.substring(0, 8)}... (Motor: ${useOllama ? 'OLLAMA' : 'GEMINI'})`);

            // 3. Procesar via aiCore o OllamaCore
            try {
                let resultText;
                if (useOllama) {
                    // Importacion lazy: solo si realmente se usa Ollama
                    const { callOllama } = require('../ollamaCore');
                    resultText = await callOllama(ticket.prompt, ticket.is_json);
                } else {
                    resultText = await aiCore.callGeminiWithRetry(ticket.prompt, ticket.is_json, ticket.model_tier, 0);
                }

                // 4. Marcar como DONE
                const { error: doneError } = await supabase
                    .from('ia_request_queue')
                    .update({
                        status: 'DONE',
                        result: resultText,
                        updated_at: new Date()
                    })
                    .eq('id', ticket.id);

                if (doneError) {
                    console.error(`  [X] Error marcando DONE el ticket ${ticket.id}:`, doneError.message);
                } else {
                    console.log(`  [+] Ticket ${ticket.id.substring(0, 8)} completado exitosamente.`);
                }

            } catch (iaError) {
                console.error(`  [X] Error crítico procesando ticket ${ticket.id}:`, iaError.message);

                // Marcar como FAILED
                await supabase
                    .from('ia_request_queue')
                    .update({
                        status: 'FAILED',
                        error_msg: iaError.message,
                        updated_at: new Date()
                    })
                    .eq('id', ticket.id);
            }

        } else {
            // No hay tickets, no lo logeamos para no ahogar la terminal
        }
    }
};
