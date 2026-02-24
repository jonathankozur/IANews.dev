const supabase = require('../supabaseClient');

const PROD_URL = 'https://neutra-ashy.vercel.app';

// Build tweet text (must be <= 280 chars including the URL)
function buildTweetText({ originalTitle, neutralTitle, biasScore, biasDirection, sourceName, slug }) {
    const url = `${PROD_URL}/auditoria/${slug}`;

    // Truncate titles if needed to fit in 280 chars
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

    const tweet = `⚖️ MISMO HECHO, DOS ENFOQUES:\n\n🔴 Original ${sourceTag}:\n"${origTrunc}"\n\n✅ Neutra:\n"${neutTrunc}"${biasLine}\n\n👉 ${url}`;

    return tweet;
}

module.exports = {
    // Check every 15 minutes
    delayMs: 15 * 60 * 1000,

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[🐦 Tarea: Twitter] Buscando noticias listas para publicar...`);

        // Load Twitter credentials from env
        const {
            TWITTER_API_KEY,
            TWITTER_API_SECRET,
            TWITTER_ACCESS_TOKEN,
            TWITTER_ACCESS_SECRET,
        } = process.env;

        if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
            console.warn(`[⚠️ Twitter] Credenciales incompletas. Verifica TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET en el .env`);
            return;
        }

        // Lazy-load the Twitter client (only if credentials are present)
        const { TwitterApi } = require('twitter-api-v2');
        const client = new TwitterApi({
            appKey: TWITTER_API_KEY,
            appSecret: TWITTER_API_SECRET,
            accessToken: TWITTER_ACCESS_TOKEN,
            accessSecret: TWITTER_ACCESS_SECRET,
        });
        const rwClient = client.readWrite;

        // --- COMPLETENESS CHECK ---
        // A news item is "complete" if:
        //   1. neutral_news.process_status = 'PUBLISHED' (generator finished)
        //   2. At least one news_variant exists for this neutral_news
        //   3. tweeted_at IS NULL (not yet tweeted)
        const { data: candidates, error: fetchError } = await supabase
            .from('neutral_news')
            .select(`
                id,
                slug,
                title,
                objective_summary,
                original_bias_score,
                original_bias_direction,
                raw_article_id,
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

        // COMPLETENESS CHECK: Verify that news_variants exists for this item
        const { count: variantCount, error: variantError } = await supabase
            .from('news_variants')
            .select('id', { count: 'exact', head: true })
            .eq('neutral_news_id', news.id);

        if (variantError) {
            console.error(`[X Twitter] Error verificando variantes: ${variantError.message}`);
            return;
        }

        if (!variantCount || variantCount === 0) {
            console.warn(`[⚠️ Twitter] Noticia ${news.id} marcada como PUBLISHED pero sin variantes generadas. Saltando.`);
            return;
        }

        console.log(`[📤 Twitter] Publicando: "${news.title.substring(0, 50)}..."`);

        const tweetText = buildTweetText({
            originalTitle: news.raw_articles.title,
            neutralTitle: news.title,
            biasScore: news.original_bias_score,
            biasDirection: news.original_bias_direction,
            sourceName: news.raw_articles.source_name,
            slug: news.slug,
        });

        console.log(`\n--- Tweet Preview ---\n${tweetText}\n--- (${tweetText.length} chars) ---\n`);

        try {
            const { data: tweet } = await rwClient.v2.tweet(tweetText);
            console.log(`[✅ Twitter] Tweet publicado! ID: ${tweet.id}`);

            // Mark as tweeted in DB
            const { error: updateError } = await supabase
                .from('neutral_news')
                .update({ tweeted_at: new Date().toISOString() })
                .eq('id', news.id);

            if (updateError) {
                console.error(`[X Twitter] Error actualizando tweeted_at: ${updateError.message}`);
            } else {
                console.log(`[✔] tweeted_at actualizado para noticia ${news.id.substring(0, 8)}`);
            }

        } catch (tweetError) {
            console.error(`[X Twitter] Error publicando tweet:`, tweetError.message || tweetError);
        }
    }
};
