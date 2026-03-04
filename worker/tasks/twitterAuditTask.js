const supabase = require('../supabaseClient');
const aiService = require('../aiService');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const LOCK_FILE = path.join(__dirname, '..', 'audit_lock.json');

const PROD_URL = 'https://neutra-ashy.vercel.app';
const AUDIT_HOUR = 21; // Hora local argentina para ejecutar el reporte
const MIN_ARTICLES_THRESHOLD = 15; // Mínimo de noticias en el día para justificar un reporte
const MAX_FAILURES = 3;

let twitterClient = null;

function getClient() {
    if (twitterClient) return twitterClient;

    const {
        TWITTER_API_KEY,
        TWITTER_API_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_SECRET,
    } = process.env;

    if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
        throw new Error("Faltan variables de entorno de Twitter API.");
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

function getArgentineHour() {
    return (new Date().getUTCHours() - 3 + 24) % 24;
}

function getArgentineDateString() {
    const now = new Date();
    const argentineDate = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    return argentineDate.toISOString().split('T')[0];
}

async function getStatsForToday() {
    const todayStr = getArgentineDateString();

    // Obtener todas las noticias procesadas hoy
    const { data: news, error } = await supabase
        .from('neutral_news')
        .select(`
            id,
            original_bias_score,
            original_bias_direction,
            raw_articles ( source_name )
        `)
        .eq('process_status', 'PUBLISHED')
        .gte('created_at', `${todayStr}T00:00:00Z`)
        .lte('created_at', `${todayStr}T23:59:59Z`);

    if (error) {
        throw new Error(`Error fetching stats: ${error.message}`);
    }

    if (!news || news.length < MIN_ARTICLES_THRESHOLD) {
        return null; // No hay suficientes datos para un buen reporte
    }

    // Calcular promedios por fuente
    const sourceStats = {};
    let totalScore = 0;
    let totalLeft = 0;
    let totalRight = 0;

    news.forEach(n => {
        const source = n.raw_articles?.source_name || 'Desconocido';
        if (!sourceStats[source]) {
            sourceStats[source] = { count: 0, sumScore: 0, leftCount: 0, rightCount: 0 };
        }

        sourceStats[source].count++;
        sourceStats[source].sumScore += n.original_bias_score;
        totalScore += n.original_bias_score;

        if (n.original_bias_direction === 'Izquierda') {
            sourceStats[source].leftCount++;
            totalLeft++;
        } else if (n.original_bias_direction === 'Derecha') {
            sourceStats[source].rightCount++;
            totalRight++;
        }
    });

    // Formatear promedios
    const medias = Object.keys(sourceStats).map(s => {
        const stats = sourceStats[s];
        const primaryDir = stats.leftCount > stats.rightCount ? 'Izquierda' : (stats.rightCount > stats.leftCount ? 'Derecha' : 'Centro');
        return {
            medio: s,
            noticiasAnalizadas: stats.count,
            sesgoPromedio: Math.round(stats.sumScore / stats.count),
            direccionPrincipal: primaryDir
        };
    }).sort((a, b) => b.sesgoPromedio - a.sesgoPromedio); // Ordenado por más sesgado

    const mediaPrincipalObj = medias.length > 0
        ? medias.reduce((prev, current) => (prev.noticiasAnalizadas > current.noticiasAnalizadas) ? prev : current, medias[0])
        : { medio: 'Desconocido' };

    return {
        totalNoticias: news.length,
        sesgoPromedioGlobal: Math.round(totalScore / news.length),
        tendenciaGlobal: totalLeft > totalRight ? 'Izquierda' : (totalRight > totalLeft ? 'Derecha' : 'Equilibrado'),
        rankingMediosMasSesgados: medias.slice(0, 3), // Top 3
        medioQueMasPublico: mediaPrincipalObj.medio || 'Desconocido'
    };
}

function isAuditDoneToday() {
    if (!fs.existsSync(LOCK_FILE)) return false;
    try {
        const data = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
        const todayStr = getArgentineDateString();
        return data.last_run_date === todayStr;
    } catch (e) {
        return false;
    }
}

function markAuditDoneToday() {
    const todayStr = getArgentineDateString();
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ last_run_date: todayStr }));
}

module.exports = {
    // Como corre seguido, lo bloqueamos internamente.
    execute: async function ({ dryRun, assignedPrompt }) {
        console.log(`\n======================================`);
        console.log(`[📊 Tarea: Auditoría X] Verificando...${dryRun ? ' [DRY RUN]' : ''}`);

        const currentHour = getArgentineHour();
        if (currentHour !== AUDIT_HOUR && !dryRun) {
            console.log(`[🕒] No es hora de auditoría (Hora actual: ${currentHour}hs, Hora config: ${AUDIT_HOUR}hs). Saltando.`);
            return;
        }

        if (dryRun && currentHour !== AUDIT_HOUR) {
            console.log(`[🚀] [DRY RUN] Forzando ejecución fuera de hora (Hora actual: ${currentHour}hs).`);
        } else {
            console.log(`[🚀] ¡Es hora del reporte diario de auditoría! Extrañando métricas...`);
        }

        if (!dryRun && isAuditDoneToday()) {
            console.log(`[✅] La auditoría de hoy ya fue publicada. Saltando.`);
            return;
        }

        // 1. Obtener Estadísticas
        let stats;
        try {
            stats = await getStatsForToday();
        } catch (e) {
            console.error(`[❌] Error obteniendo métricas diarias:`, e);
            return;
        }

        if (!stats) {
            console.log(`[⚠️] Datos insuficientes hoy (menos de ${MIN_ARTICLES_THRESHOLD} notas). Se cancela la auditoría nocturna para no quemar la API con datos pobres.`);
            return;
        }

        console.log(`[📝] Estadísticas del día extraídas:`, JSON.stringify(stats));

        // 2. Pedir Hilo a la IA
        let tweets = await aiService.generarHiloAuditoriaDiaria(stats, assignedPrompt || 'twitter_audit_daily');

        if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
            console.error(`[❌] La IA falló al redactar el hilo de auditoría.`);
            return;
        }

        // 3. Preparar Hilo
        const finalUrl = `${PROD_URL}/?utm_source=twitter&utm_medium=social&utm_campaign=audit_diaria`;
        tweets[tweets.length - 1] += `\n\n${finalUrl}`;

        console.log(`\n--- ${dryRun ? '🧪 DRY RUN - ' : ''}Thread de Auditoría Preview ---`);
        tweets.forEach((t, i) => console.log(`[Tweet ${i + 1}/${tweets.length}]\n${t}\n`));
        console.log(`---\n`);

        if (dryRun) {
            console.log(`[🧪 DRY RUN] Hilo de auditoría NO publicado.`);
            return;
        }

        // 4. Publicar en X
        try {
            const client = getClient();

            let mediaId = null;
            // Descargamos una imagen genérica para la auditoría (o un placeholder estéticamente agradable para periodismo de datos)
            const genericAuditImageUrl = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80'; // Gráfico/Data genérico

            try {
                console.log(`[🔗] ${dryRun ? '[DRY RUN] ' : ''}Descargando imagen genérica de auditoría...`);
                const imageResponse = await axios.get(genericAuditImageUrl, { responseType: 'arraybuffer', timeout: 15000 });
                const imageBuffer = Buffer.from(imageResponse.data);

                if (dryRun) {
                    console.log(`[⬆️] [DRY RUN] Simulación de subida de media a Twitter v1.1.`);
                    mediaId = "mock_media_audit";
                } else {
                    console.log(`[⬆️] Subiendo media a Twitter v1.1...`);
                    mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });
                    console.log(`[✅] Media subida: ${mediaId}`);
                }
            } catch (imgErr) {
                console.warn(`[⚠️ Twitter Audit] No se pudo adjuntar imagen de auditoría: ${imgErr.message}`);
            }

            const threadPayload = tweets.map((text, idx) => {
                const tweetObj = { text: text.substring(0, 280) };
                if (idx === 0 && mediaId) {
                    tweetObj.media = { media_ids: [mediaId] };
                }
                return tweetObj;
            });

            console.log(`[🔎] Subiendo Thread Payload:`, JSON.stringify(threadPayload, null, 2));

            // Enviar Hilo (Manual para evitar Rate Limits de ráfaga)
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

                // Pausa de 3 segundos entre tweets
                if (i < threadPayload.length - 1) {
                    await new Promise(r => setTimeout(r, 3000));
                }
            }

            console.log(`[✅ Twitter Audit] ¡Hilo publicado con éxito! (${response.length} tweets)`);
            console.log(`[🔗] Link al primer tweet: https://twitter.com/user/status/${response[0].data.id}`);

            if (!dryRun) {
                markAuditDoneToday();
                console.log(`[✔] Lock diario de auditoría establecido.`);
            }

        } catch (err) {
            twitterClient = null;
            const msg = err?.data?.detail || err?.message || JSON.stringify(err);
            console.error(`[X Twitter Audit] Error publicando hilo de auditoría: ${msg}`);
            if (err?.data) console.error(`[🔎] Detalles API:`, JSON.stringify(err.data, null, 2));
        }
    }
};
