const supabase = require('../supabaseClient');

const PROD_URL = 'https://neutra-ashy.vercel.app';

// --- ANTI-BAN CONFIG ---
const MIN_DELAY_MS = 45 * 60 * 1000;   // 45 min minimum
const MAX_DELAY_MS = 90 * 60 * 1000;   // 90 min maximum
const QUIET_HOUR_START = 7;             // 7am Argentina (UTC-3)
const QUIET_HOUR_END = 23;             // 11pm Argentina
const MAX_DAILY_TWEETS = 12;

// Rotated tweet formats for variety
const TWEET_TEMPLATES = [
    ({ orig, origTrunc, neutTrunc, sourceTag, biasLine, url }) =>
        `⚖️ MISMO HECHO, DOS ENFOQUES:\n\n🔴 Original ${sourceTag}:\n"${origTrunc}"\n\n✅ Neutra:\n"${neutTrunc}"${biasLine}\n\n👉 ${url}`,

    ({ orig, origTrunc, neutTrunc, sourceTag, biasLine, url }) =>
        `🧐 ¿Titular objetivo o manipulado?\n\n📰 ${sourceTag} publica:\n"${origTrunc}"\n\n🤖 La IA lo reformula:\n"${neutTrunc}"${biasLine}\n\n🔎 ${url}`,

    ({ orig, origTrunc, neutTrunc, sourceTag, biasLine, url }) =>
        `🔍 Auditoría Periodística:\n\n❌ Con sesgo ${sourceTag}:\n"${origTrunc}"\n\n✅ Sin sesgo:\n"${neutTrunc}"${biasLine}\n\n↗️ ${url}`,
];

function buildTweetText({ originalTitle, neutralTitle, biasScore, biasDirection, sourceName, slug }) {
    const url = `${PROD_URL}/auditoria/${slug}`;
    const maxLen = 80;
    const origTrunc = originalTitle.length > maxLen ? originalTitle.substring(0, maxLen - 1) + '…' : originalTitle;
    const neutTrunc = neutralTitle.length > maxLen ? neutralTitle.substring(0, maxLen - 1) + '…' : neutralTitle;
    const sourceTag = sourceName ? `(${sourceName})` : '';
    const biasLine = biasScore > 0 ? `\n🔥 Sesgo: ${biasScore}% ${biasDirection}` : '';

    // Pick a random template
    const template = TWEET_TEMPLATES[Math.floor(Math.random() * TWEET_TEMPLATES.length)];
    return template({ origTrunc, neutTrunc, sourceTag, biasLine, url });
}

function getArgentineHour() {
    const now = new Date();
    // UTC-3 for Argentina
    const arHour = (now.getUTCHours() - 3 + 24) % 24;
    return arHour;
}

function isQuietHours() {
    const hour = getArgentineHour();
    return hour < QUIET_HOUR_START || hour >= QUIET_HOUR_END;
}

async function getTodayTweetCount() {
    const todayStart = new Date();
    todayStart.setUTCHours(todayStart.getUTCHours() - 3); // AR offset
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
        .from('neutral_news')
        .select('id', { count: 'exact', head: true })
        .not('tweeted_at', 'is', null)
        .gte('tweeted_at', todayStart.toISOString());

    return count || 0;
}

// Shared scraper session instance
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
    delayMs: MIN_DELAY_MS, // Base — randomized via getNextDelay()

    // Runner calls this to get the NEXT sleep time (with jitter)
    getNextDelay: function () {
        const jitter = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
        return MIN_DELAY_MS + jitter;
    },

    execute: async function ({ dryRun }) {
        console.log(`\n======================================`);
        console.log(`[🐦 Tarea: Twitter] Verificando condiciones...${dryRun ? ' [DRY RUN]' : ''}`);

        // 1. Check quiet hours
        if (isQuietHours()) {
            const hour = getArgentineHour();
            console.log(`[😴 Twitter] Son las ${hour}hs en Argentina. Fuera del horario de publicación (${QUIET_HOUR_START}hs-${QUIET_HOUR_END}hs). Saltando.`);
            return;
        }

        // 2. Check daily cap
        const todayCount = await getTodayTweetCount();
        if (todayCount >= MAX_DAILY_TWEETS) {
            console.log(`[🚫 Twitter] Límite diario alcanzado (${todayCount}/${MAX_DAILY_TWEETS} tweets). Saltando.`);
            return;
        }

        console.log(`[📊 Twitter] Tweets hoy: ${todayCount}/${MAX_DAILY_TWEETS}`);

        // 3. Find next complete article to post
        const { data: candidates, error: fetchError } = await supabase
            .from('neutral_news')
            .select(`
                id, slug, title, original_bias_score, original_bias_direction,
                raw_articles!inner ( title, source_name )
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
            console.log(`[!] No hay noticias completas pendientes de publicar.`);
            return;
        }

        const news = candidates[0];

        // Verify variants exist
        const { count: variantCount } = await supabase
            .from('news_variants')
            .select('id', { count: 'exact', head: true })
            .eq('neutral_news_id', news.id);

        if (!variantCount || variantCount === 0) {
            console.warn(`[⚠️ Twitter] Noticia sin variantes todavía. Saltando.`);
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

        console.log(`\n--- ${dryRun ? '🧪 DRY RUN - ' : ''}Tweet Preview (${tweetText.length} chars) ---`);
        console.log(tweetText);
        console.log(`---\n`);

        if (dryRun) {
            console.log(`[🧪 DRY RUN] Tweet NO publicado. Remové --dryRun para publicar de verdad.`);
            return;
        }

        // 4. Human-like pre-tweet pause (5-30 seconds)
        const pauseSec = 5 + Math.floor(Math.random() * 25);
        console.log(`[⏸️ Twitter] Pausa humana de ${pauseSec}s antes de publicar...`);
        await new Promise(r => setTimeout(r, pauseSec * 1000));

        // 5. Post tweet
        try {
            const scraper = await getScraper();
            await scraper.sendTweet(tweetText);
            console.log(`[✅ Twitter] Tweet publicado exitosamente!`);

            await supabase
                .from('neutral_news')
                .update({ tweeted_at: new Date().toISOString() })
                .eq('id', news.id);

            console.log(`[✔] tweeted_at guardado para noticia ${news.id.substring(0, 8)}`);

        } catch (tweetError) {
            scraperInstance = null; // Reset session on error
            console.error(`[X Twitter] Error publicando tweet:`, tweetError.message || tweetError);
        }
    }
};
