require('dotenv').config({ path: require('path').join(__dirname, '../worker/.env') });
const supabase = require('./config/supabase');
const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2');

const PROD_URL = 'https://neutra-ashy.vercel.app';

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

    twitterClient = new TwitterApi({
        appKey: TWITTER_API_KEY,
        appSecret: TWITTER_API_SECRET,
        accessToken: TWITTER_ACCESS_TOKEN,
        accessSecret: TWITTER_ACCESS_SECRET,
    });

    return twitterClient;
}

/**
 * Función principal para publicar en Twitter
 */
async function runTwitterPublisher(articleId, isDryRun = false) {
    console.log(`\n======================================================`);
    console.log(`🐦 Iniciando Publicador V2: Intentando publicar artículo ID: ${articleId || 'N/A'}`);
    console.log(`======================================================`);

    if (!articleId && !isDryRun) {
        console.error("❌ Error: Se requiere un articleId obligatorio para ejecutar la publicación puntual en V2.");
        process.exit(1);
    }

    try {
        // 1. Fetch de la DB
        let query = supabase.from('v2_articles').select('*')
            .eq('status', 'READY_TO_PUBLISH');

        if (articleId) {
            query = query.eq('id', articleId);
        } else {
            // Si es DryRun y no pasó ID, agarramos el último
            query = query.order('created_at', { ascending: false }).limit(1);
        }

        const { data: articles, error: fetchError } = await query;

        if (fetchError) throw new Error(`Error BD: ${fetchError.message}`);
        if (!articles || articles.length === 0) {
            console.log("💤 No hay artículos READY_TO_PUBLISH con este ID o pendientes general.");
            process.exit(0);
        }

        const article = articles[0];

        // Extraer y validar el hilo
        if (!article.social_thread || !Array.isArray(article.social_thread) || article.social_thread.length === 0) {
            throw new Error(`El artículo no tiene un social_thread válido generado por la Fase 3.`);
        }

        let tweets = [...article.social_thread].map(t => t.replace(/\r/g, ''));

        const title = article.clean_title || article.raw_title;
        console.log(`  [🎯] Preparando publicación para: ${title}`);

        // 2. Inyectar URL al FINAL del hilo
        if (!article.slug) {
            console.warn(`  [⚠️] El artículo no tiene slug. La URL generada será incompleta.`);
        }

        const url = `${PROD_URL}/auditoria/${article.slug || article.id}?utm_source=twitter&utm_medium=social&utm_campaign=auto_hilos`;

        // Agregar URL al último tweet
        tweets[tweets.length - 1] += `\n\n${url}`;

        // 3. Previsualizar Hilo
        console.log(`\n--- ${isDryRun ? '🧪 DRY RUN - ' : ''}Thread Preview ---`);
        tweets.forEach((t, i) => console.log(`[Tweet ${i + 1}/${tweets.length}]\n${t}\n`));
        console.log(`---\n`);

        // 4. Procesamiento de Imagen (Solo primer tweet)
        let mediaId = null;
        if (article.image_url && article.image_url !== 'NO_IMAGE') {
            try {
                console.log(`  [🔗] Descargando imagen original: ${article.image_url.substring(0, 60)}...`);
                const imageResponse = await axios.get(article.image_url, { responseType: 'arraybuffer', timeout: 15000 });
                const imageBuffer = Buffer.from(imageResponse.data);

                if (isDryRun) {
                    console.log(`  [⬆️] [DRY RUN] Simulación de subida de media a Twitter ok.`);
                    mediaId = "mock_media_12345";
                } else {
                    console.log(`  [⬆️] Subiendo media a Twitter v1.1...`);
                    const client = getClient();
                    mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });
                    console.log(`  [✅] Media subida: ${mediaId}`);
                }
            } catch (err) {
                console.error(`  [⚠️] Error descargando o subiendo imagen. Se publicará SIN imagen. Detalles: ${err.message}`);
            }
        }

        if (isDryRun) {
            console.log(`\n[🧪 DRY RUN] Simulación completada con éxito. Terminando ejecución.`);
            process.exit(0);
        }

        // 4.5. Pausa esencial para propagación de Media en Twitter (5-10s)
        if (mediaId) {
            console.log(`  [⏸️] Dando tiempo a Twitter para procesar la imagen (8s)...`);
            await new Promise(r => setTimeout(r, 8000));
        }

        // 5. Publicación en Twitter API v2
        console.log(`  [🐦] Publicando Hilo en Twitter...`);
        const client = getClient();
        const threadPayload = tweets.map((text, idx) => {
            const tweetObj = { text };
            // Adjuntamos la imagen SOLAMENTE al primer tweet del hilo (índice 0)
            if (idx === 0 && mediaId) {
                // DESACTIVADO PARA PRUEBA DE 503
                // tweetObj.media = { media_ids: [mediaId] };
            }
            return tweetObj;
        });

        const response = [];
        let previousId = null;
        for (let i = 0; i < threadPayload.length; i++) {
            const payload = threadPayload[i];

            // Truncar preventivamente a 280 caracteres máximo oficial de X
            if (payload.text.length > 280) {
                console.warn(`  [⚠️] Tweet ${i + 1} excede 280 caracteres (${payload.text.length}). Truncando...`);
                payload.text = payload.text.substring(0, 277) + '...';
            }

            if (previousId) {
                payload.reply = { in_reply_to_tweet_id: previousId };
            }

            let tw = null;
            let success = false;
            let retries = 0;

            while (!success && retries < 3) {
                try {
                    tw = await client.v2.tweet(payload);
                    success = true;
                } catch (apiErr) {
                    const status = apiErr.code || apiErr.status;
                    const msg = apiErr?.data?.detail || apiErr.message;
                    console.warn(`  [⚠️] Intento ${retries + 1} falló para Tweet ${i + 1}. Error: ${status} - ${msg}`);

                    if (status === 503 || status === 500) {
                        retries++;
                        console.log(`  [⏳] Reintentando en 5 segundos...`);
                        await new Promise(r => setTimeout(r, 5000));
                    } else {
                        // Errores no recuperables (ej. 400 Bad Request, 401 Auth)
                        throw apiErr;
                    }
                }
            }

            if (!success) {
                throw new Error(`Se agotaron los retries (503) para el Tweet ${i + 1}`);
            }

            response.push(tw);
            previousId = tw.data.id;

            // Pausa de 3s entre tweets (anti rate-limit)
            if (i < threadPayload.length - 1) {
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        const link = `https://twitter.com/user/status/${response[0].data.id}`;
        console.log(`\n🎉 ¡Hilo publicado con éxito! (${response.length} tweets)`);
        console.log(`🔗 Link al primer tweet: ${link}`);

        // 6. Actualizar Base de Datos V2
        const { error: updateError } = await supabase
            .from('v2_articles')
            .update({
                status: 'PUBLISHED',
                last_error_log: `Publicado OK: ${link}`,
                retries_count: 0
            })
            .eq('id', article.id);

        if (updateError) {
            console.error(`  [❌] Error crítico: El tweet se publicó, pero falló el UPDATE a PUBLISHED en Supabase:`, updateError.message);
        } else {
            console.log(`  💾 Artículo V2 marcado como PUBLISHED.`);
        }

        process.exit(0);

    } catch (error) {
        console.error(`\n[❌] Fatal Error en Publicador V2:`, error.message);

        if (articleId && !isDryRun) {
            // Intentar marcar fallo
            await supabase.from('v2_articles').update({
                status: 'PUBLISH_FAILED',
                last_error_log: error.message
            }).eq('id', articleId);
        }
        process.exit(1);
    }
}

// Interfaz CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dryRun');
    let articleId = null;

    const idArg = args.find(a => a.startsWith('--id='));
    if (idArg) {
        articleId = idArg.split('=')[1];
    }

    runTwitterPublisher(articleId, isDryRun);
}

module.exports = { runTwitterPublisher };
