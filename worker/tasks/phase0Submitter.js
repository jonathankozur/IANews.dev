const supabase = require('../supabaseClient');
const aiService = process.env.AI_PROVIDER === 'groq' ? require('../aiService') : require('../ollamaService');

module.exports = {
    // Escaneo rápido ya que solo encola
    delayMs: 30000, // 30 segundos

    execute: async function ({ prompts }) {
        console.log(`\n======================================`);
        console.log(`[📤 Phase 0 Submitter] Buscando artículos NEW para filtro temático...`);

        // 1. Buscar artículos recién scrapeados (PENDING_RELEVANCE)
        const { data: articles, error } = await supabase
            .from('raw_articles')
            .select('id, title, raw_text')
            .eq('process_status', 'PENDING_RELEVANCE')
            .order('scraped_at', { ascending: true })
            .limit(10); // Batch de a 10 para no saturar la API insertando

        if (error) {
            console.error(`[X] Error buscando artículos PENDING_RELEVANCE:`, error.message);
            return;
        }

        if (!articles || articles.length === 0) {
            console.log(`[✔] No hay artículos nuevos para filtrar.`);
            return;
        }

        let enqueued = 0;

        // 2. Por cada artículo, encolar tarea a IA y cambiar estado a PROCESSING
        for (const article of articles) {
            const promptName = prompts?.relevance || 'analyzer_relevance';

            try {
                // Encolamos (esto es asíncrono e instantáneo, no espera resultado)
                console.log(`  [+] Encolando Filtro para: "${article.title.substring(0, 40)}..."`);
                await aiService.submitFiltroTematico(article.id, article.title, article.raw_text, promptName);

                // Marcamos el artículo diciendo que está esperando que la IA lo filtre
                const { error: updateError } = await supabase
                    .from('raw_articles')
                    .update({ process_status: 'PROCESSING_RELEVANCE', locked_at: new Date().toISOString() })
                    .eq('id', article.id);

                if (updateError) throw updateError;
                enqueued++;

            } catch (err) {
                console.error(`  [X] Falló encolar artículo ${article.id}:`, err.message);
            }
        }

        console.log(`[✔] Phase 0 Submitter finalizado: ${enqueued} artículos encolados a la IA.`);
    }
};
