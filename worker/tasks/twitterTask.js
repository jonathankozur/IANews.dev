const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, '..', '.twitter_session.json');

/**
 * Load cookies from the .twitter_session.json file exported by Cookie-Editor.
 * Returns the ct0 value (CSRF token) and a full Cookie header string.
 */
function loadSession() {
    if (!fs.existsSync(SESSION_FILE)) {
        throw new Error(`No se encontró ${SESSION_FILE}. Exportá las cookies de x.com con Cookie-Editor y guardá el JSON ahí.`);
    }

    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));

    // Build full Cookie header like a real browser would send
    const cookieHeader = cookies
        .map(c => `${c.name}=${c.value}`)
        .join('; ');

    // Extract ct0 for CSRF token header
    const ct0Cookie = cookies.find(c => c.name === 'ct0');
    if (!ct0Cookie) {
        throw new Error('No se encontró la cookie ct0 en el archivo de sesión. Renová las cookies.');
    }

    return { cookieHeader, ct0: ct0Cookie.value };
}

/**
 * Post a tweet using Twitter's internal GraphQL API.
 * Uses the full exported browser session to bypass bot detection.
 */
async function postTweet(text) {
    const { cookieHeader, ct0 } = loadSession();

    const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

    const variables = {
        tweet_text: text,
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
    };

    const features = {
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        tweetypie_unmention_optimization_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: false,
        tweet_awards_web_tipping_enabled: false,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        rweb_video_timestamps_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false,
        responsive_web_media_download_video_enabled: false,
        hidden_profile_loves_inTimeline_enabled: true,
        highlights_tweets_tab_ui_enabled: true,
        creator_subscriptions_tweet_preview_api_enabled: true,
    };

    const body = JSON.stringify({ variables, features });

    const options = {
        hostname: 'x.com',
        path: '/i/api/graphql/SoVnbfCycZ7fERGCwpZkYA/CreateTweet',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'Cookie': cookieHeader,
            'x-csrf-token': ct0,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'x-twitter-active-user': 'yes',
            'x-twitter-auth-type': 'OAuth2Session',
            'x-twitter-client-language': 'es',
            'Accept': '*/*',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Origin': 'https://x.com',
            'Referer': 'https://x.com/compose/tweet',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.errors) {
                        reject(new Error(JSON.stringify(parsed.errors)));
                    } else if (parsed.data?.create_tweet?.tweet_results?.result) {
                        resolve(parsed.data.create_tweet.tweet_results.result);
                    } else {
                        reject(new Error(`Respuesta inesperada: ${data.substring(0, 300)}`));
                    }
                } catch (e) {
                    reject(new Error(`Error parseando respuesta: ${data.substring(0, 300)}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

const supabase = require('../supabaseClient');
const https = require('https');
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

const TWITTER_URL_LENGTH = 23; // Twitter shortens all URLs to t.co (~23 chars)
const TWITTER_MAX_CHARS = 280;

function buildTweetText({ originalTitle, neutralTitle, biasScore, biasDirection, sourceName, slug }) {
    const url = `${PROD_URL}/auditoria/${slug}`;
    const sourceTag = sourceName ? `(${sourceName})` : '';
    const biasLine = biasScore > 0 ? `\n🔥 Sesgo: ${biasScore}% ${biasDirection}` : '';

    // Measure template overhead with empty titles to calculate available space
    const template = TWEET_TEMPLATES[Math.floor(Math.random() * TWEET_TEMPLATES.length)];
    const emptyTweet = template({ origTrunc: '', neutTrunc: '', sourceTag, biasLine, url: 'x'.repeat(TWITTER_URL_LENGTH) });
    const overhead = emptyTweet.length;

    // Split remaining chars equally between the two titles
    const available = Math.floor((TWITTER_MAX_CHARS - overhead) / 2) - 2; // -2 for safety margin
    const maxLen = Math.max(20, available); // minimum 20 chars

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

/**
 * Post a tweet using Twitter's internal GraphQL API.
 * This uses the same endpoint the Twitter web app calls — no official API key needed.
 * Authentication is via browser cookies (auth_token + ct0 as CSRF token).
 */
async function postTweet(text) {
    const { TWITTER_AUTH_TOKEN, TWITTER_CT0 } = process.env;

    if (!TWITTER_AUTH_TOKEN || !TWITTER_CT0) {
        throw new Error('Faltan TWITTER_AUTH_TOKEN o TWITTER_CT0 en el .env.');
    }

    const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

    const variables = {
        tweet_text: text,
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
    };

    const features = {
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        tweetypie_unmention_optimization_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: false,
        tweet_awards_web_tipping_enabled: false,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        rweb_video_timestamps_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false,
        responsive_web_media_download_video_enabled: false,
        hidden_profile_loves_inTimeline_enabled: true,
        highlights_tweets_tab_ui_enabled: true,
        creator_subscriptions_tweet_preview_api_enabled: true,
    };

    const body = JSON.stringify({ variables, features });

    const cookieHeader = `auth_token=${TWITTER_AUTH_TOKEN}; ct0=${TWITTER_CT0}`;

    const options = {
        hostname: 'x.com',
        path: '/i/api/graphql/SoVnbfCycZ7fERGCwpZkYA/CreateTweet',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
            'x-csrf-token': TWITTER_CT0,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'x-twitter-active-user': 'yes',
            'x-twitter-auth-type': 'OAuth2Session',
            'x-twitter-client-language': 'es',
            'Origin': 'https://x.com',
            'Referer': 'https://x.com/compose/tweet',
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.errors) {
                        reject(new Error(JSON.stringify(parsed.errors)));
                    } else if (parsed.data?.create_tweet?.tweet_results?.result) {
                        resolve(parsed.data.create_tweet.tweet_results.result);
                    } else {
                        reject(new Error(`Respuesta inesperada: ${data.substring(0, 200)}`));
                    }
                } catch (e) {
                    reject(new Error(`Error parseando respuesta: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

module.exports = {
    delayMs: MIN_DELAY_MS,

    getNextDelay: function () {
        const jitter = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
        return MIN_DELAY_MS + jitter;
    },

    execute: async function ({ dryRun }) {
        console.log(`\n======================================`);
        console.log(`[🐦 Tarea: Twitter] Verificando condiciones...${dryRun ? ' [DRY RUN]' : ''}`);

        if (isQuietHours()) {
            console.log(`[😴 Twitter] Son las ${getArgentineHour()}hs en Argentina. Fuera del horario (${QUIET_HOUR_START}hs-${QUIET_HOUR_END}hs). Saltando.`);
            return;
        }

        const todayCount = await getTodayTweetCount();
        if (todayCount >= MAX_DAILY_TWEETS) {
            console.log(`[🚫 Twitter] Límite diario alcanzado (${todayCount}/${MAX_DAILY_TWEETS}). Saltando.`);
            return;
        }
        console.log(`[📊 Twitter] Tweets hoy: ${todayCount}/${MAX_DAILY_TWEETS}`);

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
            console.log(`[!] No hay noticias pendientes de publicar.`);
            return;
        }

        const news = candidates[0];

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
            console.log(`[🧪 DRY RUN] Tweet NO publicado.`);
            return;
        }

        const pauseSec = 5 + Math.floor(Math.random() * 25);
        console.log(`[⏸️ Twitter] Pausa de ${pauseSec}s antes de publicar...`);
        await new Promise(r => setTimeout(r, pauseSec * 1000));

        try {
            const result = await postTweet(tweetText);
            const tweetId = result?.rest_id || result?.id;
            console.log(`[✅ Twitter] ¡Tweet publicado! ID: ${tweetId}`);

            await supabase
                .from('neutral_news')
                .update({ tweeted_at: new Date().toISOString() })
                .eq('id', news.id);

            console.log(`[✔] tweeted_at guardado para noticia ${news.id.substring(0, 8)}`);
        } catch (err) {
            console.error(`[X Twitter] Error publicando tweet:`, err.message || err);
        }
    }
};
