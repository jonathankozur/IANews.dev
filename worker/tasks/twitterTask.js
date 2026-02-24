const supabase = require('../supabaseClient');

const PROD_URL = 'https://neutra-ashy.vercel.app';

// --- ANTI-BAN CONFIG ---
const MIN_DELAY_MS = 45 * 60 * 1000;
const MAX_DELAY_MS = 90 * 60 * 1000;
const QUIET_HOUR_START = 7;
const QUIET_HOUR_END = 23;
const MAX_DAILY_TWEETS = 12;

const TWEET_TEMPLATES = [
    ({ origTrunc, neutTrunc, sourceTag, biasLine, url }) =>
        `⚖️ DOS VERSIONES:\n\n🔴 ${sourceTag}:\n"${origTrunc}"\n\n✅ Neutra:\n"${neutTrunc}"${biasLine}\n\n👉 ${url}`,

    ({ origTrunc, neutTrunc, sourceTag, biasLine, url }) =>
        `🧐 ¿Manipulado o neutral?\n\n📰 ${sourceTag}:\n"${origTrunc}"\n\n🤖 IA:\n"${neutTrunc}"${biasLine}\n\n🔎 ${url}`,

    ({ origTrunc, neutTrunc, sourceTag, biasLine, url }) =>
        `🔍 Auditoría:\n\n❌ ${sourceTag}:\n"${origTrunc}"\n\n✅:\n"${neutTrunc}"${biasLine}\n\n↗️ ${url}`,
];

const TWITTER_URL_LENGTH = 23; // Twitter wraps all URLs to t.co (~23 chars)
const TWITTER_MAX_CHARS = 280;

function buildTweetText({ originalTitle, neutralTitle, biasScore, biasDirection, sourceName, slug }) {
    const url = `${PROD_URL}/auditoria/${slug}`;
    const sourceTag = sourceName ? `(${sourceName})` : '';
    const biasLine = biasScore > 0 ? `\n🔥 Sesgo: ${biasScore}% ${biasDirection}` : '';

    // Calculate available chars dynamically (Twitter counts URLs as ~23 chars)
    const template = TWEET_TEMPLATES[Math.floor(Math.random() * TWEET_TEMPLATES.length)];
    const overhead = template({ origTrunc: '', neutTrunc: '', sourceTag, biasLine, url: 'x'.repeat(TWITTER_URL_LENGTH) }).length;
    const maxLen = Math.max(20, Math.floor((TWITTER_MAX_CHARS - overhead) / 2) - 2);

    const origTrunc = originalTitle.length > maxLen ? originalTitle.substring(0, maxLen - 1) + '…' : originalTitle;
    const neutTrunc = neutralTitle.length > maxLen ? neutralTitle.substring(0, maxLen - 1) + '…' : neutralTitle;

    return template({ origTrunc, neutTrunc, sourceTag, biasLine, url });
}

function getArgentineHour() {
    return (new Date().getUTCHours() - 3 + 24) % 24;
}

function isQuietHours() {
    const h = getArgentineHour();
    return h < QUIET_HOUR_START || h >= QUIET_HOUR_END;
}

async function getTodayTweetCount() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
        .from('neutral_news')
        .select('id', { count: 'exact', head: true })
        .not('tweeted_at', 'is', null)
        .gte('tweeted_at', todayStart.toISOString());
    return count || 0;
}

// Cached Twitter client (reused across cycles)
let twitterClient = null;

function getClient() {
    if (twitterClient) return twitterClient;

    const {
        TWITTER_API_KEY,
        TWITTER_API_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_SECRET,
    } = process.env;

    const missing = ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET']
        .filter(k => !process.env[k]);

    if (missing.length > 0) {
        throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
    }

    const { TwitterApi } = require('twitter-api-v2');
    twitterClient = new TwitterApi({
        appKey: TWITTER_API_KEY,
        appSecret: TWITTER_API_SECRET,
        accessToken: TWITTER_ACCESS_TOKEN,
        accessSecret: TWITTER_ACCESS_SECRET,
    });

    return twitterClient;
}

module.exports = {
    delayMs: MIN_DELAY_MS,

    // Random delay between 45 and 90 minutes (anti-ban)
    getNextDelay: function () {
        return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
    },

    execute: async function ({ dryRun }) {
        console.log(`\n======================================`);
        console.log(`[🐦 Tarea: Twitter] Verificando condiciones...${dryRun ? ' [DRY RUN]' : ''}`);

        // 1. Quiet hours check (7am-11pm Argentina)
        if (isQuietHours()) {
            console.log(`[😴 Twitter] Son las ${getArgentineHour()}hs AR. Fuera del horario (${QUIET_HOUR_START}-${QUIET_HOUR_END}hs). Saltando.`);
            return;
        }

        // 2. Daily cap check
        const todayCount = await getTodayTweetCount();
        if (todayCount >= MAX_DAILY_TWEETS) {
            console.log(`[🚫 Twitter] Límite diario alcanzado (${todayCount}/${MAX_DAILY_TWEETS}). Saltando.`);
            return;
        }
        console.log(`[📊 Twitter] Tweets hoy: ${todayCount}/${MAX_DAILY_TWEETS}`);

        // 3. Find the most impactful untweeted article (highest bias score first)
        //    "Complete" = PUBLISHED + has news_variants + tweeted_at IS NULL + bias >= 15
        const { data: candidates, error: fetchError } = await supabase
            .from('neutral_news')
            .select(`
                id, slug, title, objective_summary,
                original_bias_score, original_bias_direction,
                raw_articles!inner ( title, source_name ),
                news_variants ( language, policy_type, title )
            `)
            .eq('process_status', 'PUBLISHED')
            .is('tweeted_at', null)
            .gte('original_bias_score', 15)
            .order('original_bias_score', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError) {
            console.error(`[X Twitter] Error consultando DB: ${fetchError.message}`);
            return;
        }

        if (!candidates || candidates.length === 0) {
            console.log(`[!] No hay noticias completas pendientes de publicar.`);
            return;
        }

        const news = candidates[0];

        // Completeness gate + extract Spanish left/right titles for AI tweet
        const allVariants = news.news_variants || [];
        if (allVariants.length === 0) {
            console.warn(`[⚠️ Twitter] Noticia ${news.id.substring(0, 8)} sin variantes. Sesgo: ${news.original_bias_score}%. Saltando.`);
            return;
        }
        const esVariants = allVariants.filter(v => v.language === 'es');
        const leftTitle = esVariants.find(v => v.policy_type === 'left')?.title || '';
        const rightTitle = esVariants.find(v => v.policy_type === 'right')?.title || '';

        console.log(`[🎯] Noticia elegida: sesgo ${news.original_bias_score}% ${news.original_bias_direction} (${news.raw_articles.source_name})`);

        // Try AI-generated viral tweet first, fall back to template
        let tweetText = null;
        try {
            const aiService = require('../aiService');
            tweetText = await aiService.generarTweetViral({
                tituloOriginal: news.raw_articles.title,
                resumen: news.objective_summary || '',
                izquierda: leftTitle,
                derecha: rightTitle,
            });
            if (tweetText) {
                // Append the audit URL (AI leaves space for it)
                const url = `${PROD_URL}/auditoria/${news.slug}`;
                tweetText = `${tweetText}\n\n${url}`;
                console.log(`[🤖] Tweet generado por IA.`);
            }
        } catch (aiErr) {
            console.warn(`[⚠️] IA tweet generation failed, usando template: ${aiErr.message}`);
        }

        // Fallback: use comparison template
        if (!tweetText) {
            tweetText = buildTweetText({
                originalTitle: news.raw_articles.title,
                neutralTitle: news.title,
                biasScore: news.original_bias_score,
                biasDirection: news.original_bias_direction,
                sourceName: news.raw_articles.source_name,
                slug: news.slug,
            });
        }

        console.log(`\n--- ${dryRun ? '🧪 DRY RUN - ' : ''}Tweet Preview (${tweetText.length} chars shown) ---`);
        console.log(tweetText);
        console.log(`---\n`);

        if (dryRun) {
            console.log(`[🧪 DRY RUN] Tweet NO publicado. Quitá --dryRun para publicar.`);
            return;
        }

        // 4. Human-like pre-tweet pause (5-30s)
        const pauseSec = 5 + Math.floor(Math.random() * 25);
        console.log(`[⏸️ Twitter] Pausa de ${pauseSec}s antes de publicar...`);
        await new Promise(r => setTimeout(r, pauseSec * 1000));

        // 5. Post tweet via official API v2 (Free Tier - OAuth 1.0a)
        try {
            const client = getClient();
            const { data: tweet } = await client.v2.tweet(tweetText);

            console.log(`[✅ Twitter] ¡Tweet publicado! ID: ${tweet.id}`);

            await supabase
                .from('neutral_news')
                .update({ tweeted_at: new Date().toISOString() })
                .eq('id', news.id);

            console.log(`[✔] tweeted_at guardado para noticia ${news.id.substring(0, 8)}`);

        } catch (err) {
            twitterClient = null; // Reset client on error
            const msg = err?.data?.detail || err?.message || JSON.stringify(err);
            console.error(`[X Twitter] Error publicando tweet: ${msg}`);
        }
    }
};
