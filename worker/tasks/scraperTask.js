const supabase = require('../supabaseClient');
const RssScraperProvider = require('../providers/RssScraperProvider');

module.exports = {
    // 30 minutos
    delayMs: 30 * 60 * 1000,

    execute: async function ({ useOllama }) {
        console.log(`\n======================================`);
        console.log(`[🕷️ Tarea: Scraper] Iniciando extracción de noticias crudas...`);

        const provider = new RssScraperProvider();

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
                    image_url: article.image_url,
                    process_status: 'PENDING_RELEVANCE'
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
};
