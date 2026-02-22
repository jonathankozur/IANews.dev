require('dotenv').config();
const supabase = require('./supabaseClient');
const RssScraperProvider = require('./providers/RssScraperProvider');

const args = process.argv.slice(2);
const useOllama = args.includes('--ai=ollama') || process.env.AI_PROVIDER === 'ollama';
const aiService = useOllama ? require('./ollamaService') : require('./aiService');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runScraperWorker() {
    console.log(`\n======================================`);
    console.log(`[🕷️ Worker 1: Scraper] Iniciando extracción de noticias crudas...`);
    console.log(`[🧠 IA Motor] ${useOllama ? 'OLLAMA (Local)' : 'GEMINI (Nube)'}`);

    // Pass the selected aiService instance
    const provider = new RssScraperProvider(aiService);

    const articles = await provider.fetchTrendingNews();

    if (articles.length === 0) {
        console.log(`[!] No se encontraron noticias relevantes en esta pasada.`);
        return;
    }

    let inserted = 0;
    let skipped = 0;

    for (const article of articles) {
        const { error } = await supabase
            .from('raw_articles')
            .insert([{
                source_name: article.source_name,
                source_url: article.source_url,
                title: article.title,
                raw_text: article.content,
                process_status: 'PENDING_ANALYSIS'
            }]);

        if (error) {
            if (error.code === '23505') { // Postgres UNIQUE constraint violation code
                console.log(`  [-] Saltando duplicado: ${article.title.substring(0, 40)}...`);
                skipped++;
            } else {
                console.error(`  [X] Error insertando artículo:`, error.message);
            }
        } else {
            console.log(`  [+] Nueva noticia cruda guardada: ${article.title.substring(0, 40)}...`);
            inserted++;
        }
    }

    console.log(`[✔] Resumen Scraper: ${inserted} nuevas guardadas, ${skipped} omitidas por ser duplicadas.`);
}

async function start() {
    const isContinuous = args.includes('--mode=continuous');

    if (isContinuous) {
        console.log("♾️ [Worker 1] Modo Continuo Activado.");
        while (true) {
            await runScraperWorker();
            console.log("⏳ Durmiendo 30 minutos...");
            await wait(30 * 60 * 1000);
        }
    } else {
        await runScraperWorker();
        console.log("🎉 [Worker 1] Finalizado.");
    }
}

start();
