require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const supabase = require('./supabaseClient');
const aiService = require('./aiService'); // We will add a new method here to generate the tweet

// Twitter Client setup (requires API keys in .env)
let twitterClient;
try {
    if (process.env.TWITTER_API_KEY) {
        twitterClient = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
        });
        console.log("[🐦 Social] Cliente de Twitter (X) inicializado correctamente.");
    } else {
        console.warn("⚠️ [🐦 Social] API Keys de Twitter no configuradas en .env. El worker funcionará en modo simulado (Dry Run).");
    }
} catch (e) {
    console.error("Error inicializando Twitter API:", e);
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function obtenerNoticiaParaPublicar() {
    // Buscar 1 noticia en español que no haya sido publicada en redes, ordenando por las más recientes
    const { data, error } = await supabase
        .from('news_events')
        .select(`
            id, 
            title, 
            slug, 
            objective_summary, 
            source_name,
            variants:news_variants(policy_type, title, content)
        `)
        .eq('language', 'es')
        .is('social_published_at', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Error buscando noticia para publicar:", error);
        return null;
    }

    return data;
}

async function publicarEnRedes() {
    console.log("\n======================================");
    console.log("[🐦 Social Worker] Iniciando ciclo de publicación...");

    const noticia = await obtenerNoticiaParaPublicar();

    if (!noticia) {
        console.log("[!] No hay noticias pendientes de publicación en la base de datos.");
        return;
    }

    console.log(`[1] Noticia seleccionada: "${noticia.title}"`);

    // Prepare content for the AI to generate the tweet
    const noticiaParaIA = {
        tituloOriginal: noticia.title,
        resumen: noticia.objective_summary,
        izquierda: noticia.variants.find(v => v.policy_type === 'left')?.title || "",
        derecha: noticia.variants.find(v => v.policy_type === 'right')?.title || ""
    };

    console.log(`[2] Solicitando a Gemini que redacte el Tweet viral...`);
    const tweetText = await aiService.generarTweetViral(noticiaParaIA);

    if (!tweetText) {
        console.error("[X] Falló la generación del Tweet.");
        return;
    }

    // Prepare final tweet with Link
    // Need to configure the base URL of the production frontend
    const baseUrl = process.env.FRONTEND_URL || 'https://ianews.dev';
    const link = `${baseUrl}/article/${noticia.slug}`; // Assuming a route like this exists or will exist

    const finalTweet = `${tweetText}\n\n👇 Leelo completo desde 3 perspectivas distintas y salí de tu termo:\n${link}`;

    console.log(`\n[3] Tweet generado (${finalTweet.length} caracteres):\n--------------------\n${finalTweet}\n--------------------`);

    if (finalTweet.length > 280) {
        console.warn("⚠️ [ATENCIÓN] El Tweet supera los 280 caracteres. Considera ajustar el prompt.");
    }

    // Publish to X / Twitter
    if (twitterClient) {
        try {
            console.log("[4] Publicando en X (Twitter)...");
            const response = await twitterClient.v2.tweet(finalTweet);
            console.log(`[✔] Tweet publicado con éxito! ID: ${response.data.id}`);

            // Mark as published in DB
            const { error: updateError } = await supabase
                .from('news_events')
                .update({ social_published_at: new Date().toISOString() })
                .eq('id', noticia.id);

            if (updateError) {
                console.error("[!] Error marcando la noticia como publicada en DB:", updateError);
            } else {
                console.log("[✔] Base de datos actualizada.");
            }

        } catch (error) {
            console.error("[X] Error publicando en Twitter API:", error.data || error.message);
        }
    } else {
        console.log("[4] (Modo Simulado) Simulando publicación exitosa y guardado en DB...");
        // Simulamos el guardado para pruebas locales si queremos
        /*
        await supabase
            .from('news_events')
            .update({ social_published_at: new Date().toISOString() })
            .eq('id', noticia.id);
        */
    }
}

async function startSocialWorker() {
    const args = process.argv.slice(2);
    const isContinuous = args.includes('--mode=continuous');

    console.log(`Iniciando Social Media Worker... (Modo: ${isContinuous ? 'CONTINUO' : 'ÚNICO'})`);

    if (isContinuous) {
        console.log("♾️ El worker correrá indefinidamente.");
        while (true) {
            await publicarEnRedes();
            // Publish every 2 hours to spread them out (50 tweets per day limit on Free Tier)
            console.log("⏳ Durmiendo 2 horas antes del próximo tweet...");
            await wait(2 * 60 * 60 * 1000);
        }
    } else {
        await publicarEnRedes();
        console.log(`\n🎉 Worker finalizado.`);
    }
}

startSocialWorker();
