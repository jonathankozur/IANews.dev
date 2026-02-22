require('dotenv').config();
const supabase = require('./supabaseClient');

const args = process.argv.slice(2);
const useOllama = args.includes('--ai=ollama') || process.env.AI_PROVIDER === 'ollama';
const aiService = useOllama ? require('./ollamaService') : require('./aiService');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateSlug(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function runNeutralizerWorker() {
    console.log(`\n======================================`);
    console.log(`[⚖️ Worker 2: Neutralizer] Buscando notas pendientes de análisis...`);
    console.log(`[🧠 IA Motor] ${useOllama ? 'OLLAMA (Local)' : 'GEMINI (Nube)'}`);

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

            // Create base slug, attach a random string to guarantee uniqueness
            const slug = generateSlug(article.title) + '-' + Math.random().toString(36).substring(2, 7);

            // Insert into neutral_news
            const { error: insertError } = await supabase
                .from('neutral_news')
                .insert([{
                    raw_article_id: article.id,
                    title: article.title,
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

async function start() {
    const args = process.argv.slice(2);
    const isContinuous = args.includes('--mode=continuous');

    if (isContinuous) {
        console.log("♾️ [Worker 2] Modo Continuo Activado.");
        while (true) {
            await runNeutralizerWorker();
            console.log("⏳ Durmiendo 2 minutos...");
            await wait(2 * 60 * 1000);
        }
    } else {
        await runNeutralizerWorker();
        console.log("🎉 [Worker 2] Finalizado.");
    }
}

start();
