const supabase = require('../supabaseClient');

const PROD_URL = 'https://neutra-ashy.vercel.app';

// --- ANTI-BAN CONFIG ---
const MIN_DELAY_MS = 45 * 60 * 1000;
const MAX_DELAY_MS = 90 * 60 * 1000;
const QUIET_HOUR_START = 7;
const QUIET_HOUR_END = 23;
const MAX_DAILY_TWEETS = 12;

// Templates eliminados: El Publisher ya no toma decisiones editoriales ni usa fallbacks.
// Toma el contenido 100% curado desde 'twitter_audit' (QC B validado).

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

    execute: async function ({ dryRun, assignedPrompt }) {
        console.log(`\n======================================`);
        console.log(`[🐦 Tarea: Twitter Hilos] Verificando condiciones...${dryRun ? ' [DRY RUN]' : ''}`);

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
        console.log(`[📊 Twitter] Hilos hoy: ${todayCount}/${MAX_DAILY_TWEETS}`);

        // 3. Find the most impactful READY_TO_PUBLISH article
        const { data: candidates, error: fetchError } = await supabase
            .from('neutral_news')
            .select(`
                id, slug, title,
                original_bias_score, original_bias_direction,
                raw_articles!inner ( 
                    id, title, source_name, image_url,
                    twitter_audit ( thread_content, status )
                )
            `)
            .eq('process_status', 'READY_TO_PUBLISH')
            .is('tweeted_at', null)
            .order('original_bias_score', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError) {
            console.error(`[X Twitter] Error consultando DB: ${fetchError.message}`);
            return;
        }

        if (!candidates || candidates.length === 0) {
            console.log(`[!] No hay noticias READY_TO_PUBLISH pendientes hoy.`);
            return;
        }

        const news = candidates[0];

        // Validar que el thread exista (generado en Orquestador Fase 3)
        const twitterAudit = Array.isArray(news.raw_articles.twitter_audit) ? news.raw_articles.twitter_audit[0] : news.raw_articles.twitter_audit;

        if (!twitterAudit || !twitterAudit.thread_content) {
            console.warn(`[⚠️ Twitter] Noticia ${news.id.substring(0, 8)} no tiene thread_content de auditoría listos. Saltando (o error del pipeline).`);
            return;
        }

        let tweets = [];
        try {
            tweets = JSON.parse(twitterAudit.thread_content);
        } catch (e) {
            console.error(`[X Twitter] El thread_content no es un JSON Array válido.`);
            return;
        }

        console.log(`[🎯] Publicando: sesgo ${news.original_bias_score}% ${news.original_bias_direction} (${news.raw_articles.source_name})`);

        // Inyectar URL con UTM al último tweet
        const url = `${PROD_URL}/auditoria/${news.slug}?utm_source=twitter&utm_medium=social&utm_campaign=auto_hilos`;
        tweets[tweets.length - 1] += `\n\n${url}`;

        console.log(`\n--- ${dryRun ? '🧪 DRY RUN - ' : ''}Thread Preview ---`);
        tweets.forEach((t, i) => console.log(`[Tweet ${i + 1}/${tweets.length}]\n${t}\n`));
        console.log(`---\n`);

        let mediaId = null;
        const imageUrl = news.raw_articles.image_url; // Imagen original procesada y validada en Fase 0
        if (imageUrl) {
            try {
                console.log(`[🔗] ${dryRun ? '[DRY RUN] ' : ''}Descargando imagen para Twitter: ${imageUrl}`);
                const axios = require('axios');
                const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
                const imageBuffer = Buffer.from(imageResponse.data);

                if (dryRun) {
                    console.log(`[⬆️] [DRY RUN] Simulación de subida de media a Twitter v1.1.`);
                    mediaId = "mock_media_12345";
                } else {
                    console.log(`[⬆️] Subiendo media a Twitter v1.1...`);
                    const client = getClient();
                    mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });
                    console.log(`[✅] Media subida: ${mediaId}`);
                }
            } catch (err) {
                console.error(`[⚠️ Twitter] Error procesando imagen: ${err.message}`);
            }
        }

        if (dryRun) {
            console.log(`[🧪 DRY RUN] Hilo NO publicado. Quitá --dryRun para publicar.`);
            return;
        }

        // 5. Human-like pre-tweet pause (5-30s)
        const pauseSec = 5 + Math.floor(Math.random() * 25);
        console.log(`[⏸️ Twitter] Pausa de ${pauseSec}s antes de publicar...`);
        await new Promise(r => setTimeout(r, pauseSec * 1000));

        // 6. Post thread via official API v2 (Free Tier - OAuth 1.0a)
        try {
            const client = getClient();

            // Formato esperado de tweetThread: [{ text: "p1", media: {media_ids: [id]} }, { text: "p2" }, ...]
            const threadPayload = tweets.map((text, idx) => {
                const tweetObj = { text };
                // Adjuntamos la imagen SOLAMENTE al primer tweet del hilo (índice 0)
                if (idx === 0 && mediaId) {
                    tweetObj.media = { media_ids: [mediaId] };
                }
                return tweetObj;
            });

            // Enviar Hilo (Manual para evitar Rate Limits de ráfaga y mejorar estabilidad)
            const response = [];
            let previousId = null;
            for (let i = 0; i < threadPayload.length; i++) {
                const payload = threadPayload[i];
                if (previousId) {
                    payload.reply = { in_reply_to_tweet_id: previousId };
                }
                const tw = await client.v2.tweet(payload);
                response.push(tw);
                previousId = tw.data.id;

                // Pausa de 3 segundos entre tweets del mismo hilo
                if (i < threadPayload.length - 1) {
                    await new Promise(r => setTimeout(r, 3000));
                }
            }

            console.log(`[✅ Twitter] ¡Hilo publicado con éxito! (${response.length} tweets)`);
            console.log(`[🔗] Link al primer tweet: https://twitter.com/user/status/${response[0].data.id}`);

            await supabase
                .from('neutral_news')
                .update({
                    tweeted_at: new Date().toISOString(),
                    process_status: 'PUBLISHED' // Marcado como 100% finalizado
                })
                .eq('id', news.id);

            await supabase
                .from('twitter_audit')
                .update({ status: 'PUBLISHED' })
                .eq('raw_article_id', news.raw_articles.id);

            console.log(`[✔] Registros DB actualizados a PUBLISHED para la noticia ${news.id.substring(0, 8)}`);

        } catch (err) {
            twitterClient = null; // Reset client on error
            const msg = err?.data?.detail || err?.message || JSON.stringify(err);
            console.error(`[X Twitter] Error publicando hilo: ${msg}`);
        }
    }
};
