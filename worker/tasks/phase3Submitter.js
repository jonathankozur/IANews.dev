const supabase = require('../supabaseClient');
const aiService = process.env.AI_PROVIDER === 'groq' ? require('../aiService') : require('../ollamaService');

module.exports = {
    // Escaneo recurrente pero descansado
    delayMs: 30000, // 30 segundos

    execute: async function ({ prompts }) {
        console.log(`\n======================================`);
        console.log(`[📤 Phase 3 Submitter] Buscando artículos listos para Generación de Hilo en X...`);

        // 1. Buscar artículos validados por el Juez (PENDING_TWITTER)
        const { data: articles, error } = await supabase
            .from('neutral_news')
            .select(`
                id,
                title,
                objective_summary,
                raw_articles!inner ( id, title, process_status )
            `)
            .eq('raw_articles.process_status', 'PENDING_TWITTER')
            .order('created_at', { ascending: true })
            .limit(10);

        if (error) {
            console.error(`[X] Error buscando noticias para Hilo de X:`, error.message);
            return;
        }

        if (!articles || articles.length === 0) {
            console.log(`[✔] No hay noticias listas para tuitear.`);
            return;
        }

        let enqueued = 0;

        for (const article of articles) {
            const promptName = prompts?.twitter || 'twitter_thread';

            try {
                // Preparamos el Payload "Noticia" que el Prompt de Twitter espera
                const facts = article.objective_summary || '';
                const noticiaEstructurada = {
                    tituloOriginal: article.raw_articles.title || article.title,
                    resumen: facts,
                    izquierda: facts,
                    derecha: facts
                };

                console.log(`  [+] Encolando Hilo Viral para: "${noticiaEstructurada.tituloOriginal.substring(0, 40)}..."`);
                await aiService.submitHiloX(article.raw_articles.id, noticiaEstructurada, promptName);

                // Lock the article
                const { error: updateError } = await supabase
                    .from('raw_articles')
                    .update({ process_status: 'PROCESSING_TWITTER', locked_at: new Date().toISOString() })
                    .eq('id', article.raw_articles.id);

                if (updateError) throw updateError;
                enqueued++;

            } catch (err) {
                console.error(`  [X] Falló encolar hilo de twitter ${article.id}:`, err.message);
            }
        }

        console.log(`[✔] Phase 3 Submitter finalizado: ${enqueued} Hilos encolados a la IA.`);
    }
};
