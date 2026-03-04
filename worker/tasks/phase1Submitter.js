const supabase = require('../supabaseClient');
const aiService = process.env.AI_PROVIDER === 'groq' ? require('../aiService') : require('../ollamaService');

module.exports = {
    // Escaneo recurrente pero descansado
    delayMs: 30000, // 30 segundos

    execute: async function ({ prompts }) {
        console.log(`\n======================================`);
        console.log(`[📤 Phase 1 Submitter] Buscando artículos aprobados para Análisis Forense...`);

        // 1. Buscar artículos validados por la Fase 0 (PENDING_ANALYSIS)
        const { data: articles, error } = await supabase
            .from('raw_articles')
            .select('id, title, raw_text')
            .eq('process_status', 'PENDING_ANALYSIS')
            .order('scraped_at', { ascending: true })
            .limit(10); // Batch de a 10

        if (error) {
            console.error(`[X] Error buscando noticias para Análisis Forense:`, error.message);
            return;
        }

        if (!articles || articles.length === 0) {
            console.log(`[✔] No hay noticias en la cola de Análisis Forense.`);
            return;
        }

        let enqueued = 0;

        // 2. Por cada artículo, encolar análisis profundo y cambiar a PROCESSING_ANALYSIS
        for (const article of articles) {
            const promptName = prompts?.audit || 'analyzer_audit';

            try {
                // Encolamos (esto es asíncrono e instantáneo, no espera resultado)
                console.log(`  [+] Encolando Ojos Forenses para: "${article.title.substring(0, 40)}..."`);
                await aiService.submitAuditoriaForense(article.id, article.raw_text, promptName);

                // Lock the article
                const { error: updateError } = await supabase
                    .from('raw_articles')
                    .update({ process_status: 'PROCESSING_ANALYSIS', locked_at: new Date().toISOString() })
                    .eq('id', article.id);

                if (updateError) throw updateError;
                enqueued++;

            } catch (err) {
                console.error(`  [X] Falló encolar artículo forense ${article.id}:`, err.message);
            }
        }

        console.log(`[✔] Phase 1 Submitter finalizado: ${enqueued} análisis encolados a la IA.`);
    }
};
