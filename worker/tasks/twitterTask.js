const supabase = require('../supabaseClient');

const PROD_URL = 'https://neutra-ashy.vercel.app';

// Build tweet text (must be <= 280 chars including the URL)
function buildTweetText({ originalTitle, neutralTitle, biasScore, biasDirection, sourceName, slug }) {
    const url = `${PROD_URL}/auditoria/${slug}`;

    const maxOrigLen = 80;
    const maxNeutLen = 80;
    const origTrunc = originalTitle.length > maxOrigLen
        ? originalTitle.substring(0, maxOrigLen - 1) + '…'
        : originalTitle;
    const neutTrunc = neutralTitle.length > maxNeutLen
        ? neutralTitle.substring(0, maxNeutLen - 1) + '…'
        : neutralTitle;

    const sourceTag = sourceName ? `(${sourceName})` : '';
    const biasLine = biasScore > 0 ? `\n🔥 Sesgo detectado: ${biasScore}% ${biasDirection}` : '';

    return `⚖️ MISMO HECHO, DOS ENFOQUES:\n\n🔴 Original ${sourceTag}:\n"${origTrunc}"\n\n✅ Neutra:\n"${neutTrunc}"${biasLine}\n\n👉 ${url}`;
}

// Shared scraper instance (keeps session alive between cycles)
let scraperInstance = null;

async function getScraper() {
    const { Scraper } = require('agent-twitter-client');

    const { TWITTER_USERNAME, TWITTER_PASSWORD, TWITTER_EMAIL } = process.env;

    if (!TWITTER_USERNAME || !TWITTER_PASSWORD) {
        throw new Error('Faltan TWITTER_USERNAME o TWITTER_PASSWORD en el .env');
    }

    if (!scraperInstance) {
        console.log(`[🐦 Twitter] Iniciando sesión como @${TWITTER_USERNAME}...`);
        scraperInstance = new Scraper();
        await scraperInstance.login(TWITTER_USERNAME, TWITTER_PASSWORD, TWITTER_EMAIL);
        const loggedIn = await scraperInstance.isLoggedIn();
        if (!loggedIn) {
            scraperInstance = null;
            throw new Error('Login en Twitter fallido. Verificá las credenciales.');
        }
        console.log(`[✅ Twitter] Sesión iniciada correctamente.`);
    }

    return scraperInstance;
}

module.exports = {
    // Check every 15 minutes
    delayMs: 15 * 60 * 1000,

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[🐦 Tarea: Twitter] Buscando noticias listas para publicar...`);

        // --- COMPLETENESS CHECK ---
        // A news item is "complete" if:
        //   1. process_status = 'PUBLISHED'
        //   2. Has at least 1 news_variant
        //   3. tweeted_at IS NULL
        const { data: candidates, error: fetchError } = await supabase
            .from('neutral_news')
            .select(`
                id,
                slug,
                title,
                original_bias_score,
                original_bias_direction,
                raw_articles!inner (
                    title,
                    source_name
                )
            `)
            .eq('process_status', 'PUBLISHED')
            .is('tweeted_at', null)
            .order('created_at', { ascending: true })
            .limit(1);

        if (fetchError) {
            console.error(`[X Twitter] Error consultando noticias: ${fetchError.message}`);
            return;
        }

        if (!candidates || candidates.length === 0) {
            console.log(`[!] No hay noticias completas pendientes de publicar en Twitter.`);
            return;
        }

        const news = candidates[0];

        // Verify variants exist (second completeness gate)
        const { count: variantCount, error: variantError } = await supabase
            .from('news_variants')
            .select('id', { count: 'exact', head: true })
            .eq('neutral_news_id', news.id);

        if (variantError || !variantCount || variantCount === 0) {
            console.warn(`[⚠️ Twitter] Noticia ${news.id} sin variantes generadas todavía. Saltando.`);
            return;
        }

        const tweetText = buildTweetText({
            originalTitle: news.raw_articles.title,
            neutralTitle: news.title,
            biasScore: news.original_bias_score,
            biasDirection: news.original_bias_direction,
            sourceName: news.raw_articles.source_name,
            slug: news.slug,
        });

        console.log(`[📤 Twitter] Publicando noticia: "${news.title.substring(0, 50)}..."`);
        console.log(`\n--- Tweet Preview (${tweetText.length} chars) ---\n${tweetText}\n---\n`);

        try {
            const scraper = await getScraper();
            await scraper.sendTweet(tweetText);
            console.log(`[✅ Twitter] Tweet publicado exitosamente!`);

            // Mark as tweeted
            const { error: updateError } = await supabase
                .from('neutral_news')
                .update({ tweeted_at: new Date().toISOString() })
                .eq('id', news.id);

            if (updateError) {
                console.error(`[X Twitter] Error actualizando tweeted_at: ${updateError.message}`);
            } else {
                console.log(`[✔] tweeted_at guardado para noticia ${news.id.substring(0, 8)}`);
            }

        } catch (tweetError) {
            // Reset session on error so it re-logs on next cycle
            scraperInstance = null;
            console.error(`[X Twitter] Error publicando tweet:`, tweetError.message || tweetError);
        }
    }
};
