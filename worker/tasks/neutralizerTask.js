const supabase = require('../supabaseClient');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateSlug(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

module.exports = {
    // 2 minutos
    delayMs: 2 * 60 * 1000,

    execute: async function ({ useOllama }) {
        console.log(`\n======================================`);
        console.log(`[⚖️ Tarea: Neutralizer] Buscando notas pendientes de análisis...`);

        // Importamos dinámicamente el servicio de IA según corresponda
        const aiService = useOllama ? require('../ollamaService') : require('../aiService');

        // Fetch up to 5 pending articles
        const { data: rawArticles, error: fetchError } = await supabase
            .from('raw_articles')
            .select('*')
            .eq('process_status', 'PENDING_ANALYSIS')
            .order('published_at', { ascending: true }) // Oldest first
            .limit(5);

        if (fetchError) {
            console.error("[X] Error fetching raw articles:", fetchError.message);
            return;
        }

        if (!rawArticles || rawArticles.length === 0) {
            console.log(`[!] No hay artículos crudos pendientes de procesar.`);
            return;
        }

        console.log(`[📥] Encontrados ${rawArticles.length} artículos pendientes. Procesando...`);

        let processed = 0;

        for (const article of rawArticles) {
            console.log(`\n  -> Analizando: "${article.title.substring(0, 50)}..."`);

            try {
                const analysis = await aiService.analizarYExtraerCrudo(article.raw_text, article.title);

                if (!analysis || !analysis.objective_summary) {
                    console.warn(`  [⚠️] La IA no pudo devolver un análisis válido. Marcando como ERROR.`);
                    await supabase.from('raw_articles').update({ process_status: 'ERROR' }).eq('id', article.id);
                    continue;
                }

                // Create base slug from neutral_title (or original if not available)
                const titleForSlug = analysis.neutral_title || article.title;
                const slug = generateSlug(titleForSlug) + '-' + Math.random().toString(36).substring(2, 7);

                // Insert into neutral_news — use AI-generated neutral title if available
                const { error: insertError } = await supabase
                    .from('neutral_news')
                    .insert([{
                        raw_article_id: article.id,
                        title: analysis.neutral_title || article.title,
                        slug: slug,
                        objective_summary: analysis.objective_summary,
                        original_bias_direction: analysis.original_bias_direction || 'Centro',
                        original_bias_score: analysis.original_bias_score || 0,
                        process_status: 'PENDING_GENERATION'
                    }]);

                if (insertError) {
                    console.error(`  [X] Error insertando neutral_news:`, insertError.message);
                    await supabase.from('raw_articles').update({ process_status: 'ERROR' }).eq('id', article.id);
                } else {
                    console.log(`  [+] Artículo neutralizado y clasificado (${analysis.original_bias_direction} ${analysis.original_bias_score}%).`);

                    // Mark raw_article as PROCESSED
                    await supabase.from('raw_articles').update({ process_status: 'PROCESSED' }).eq('id', article.id);
                    processed++;
                }
            } catch (err) {
                console.error(`  [X] Excepción crítica procesando artículo ${article.id}:`, err);
                await supabase.from('raw_articles').update({ process_status: 'ERROR' }).eq('id', article.id);
            }

            // Respect API rate limits
            await wait(2000);
        }

        console.log(`\n[✔] Resumen Neutralizer: ${processed}/${rawArticles.length} artículos procesados exitosamente.`);
    }
};
