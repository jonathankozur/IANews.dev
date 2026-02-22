require('dotenv').config();
const supabase = require('./supabaseClient');
const RssScraperProvider = require('./providers/RssScraperProvider');

const globalArgs = process.argv.slice(2);
const useOllama = globalArgs.includes('--ai=ollama') || process.env.AI_PROVIDER === 'ollama';

let aiService;
if (useOllama) {
    aiService = require('./ollamaService');
    console.log(`[🔧 CONFIG] Usando OLLAMA local como motor de IA principal.`);
} else {
    aiService = require('./aiService');
    console.log(`[🔧 CONFIG] Usando GEMINI como motor de IA principal.`);
}

async function procesarNoticiaCruda(articleData) {
    console.log(`\n======================================`);
    console.log(`[▶] Iniciando pipeline de procesamiento: ${articleData.title}`);

    try {
        const slug = articleData.title.toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-') + '-' + Math.random().toString(36).substring(2, 7);

        // 1. Check if we already processed a similar title recently
        const { data: existing } = await supabase
            .from('news_events')
            .select('id')
            .ilike('title', articleData.title) // ilike for case-insensitive
            .maybeSingle();

        if (existing) {
            console.log(`[!] Noticia ya existente en BD. Saltando...`);
            return false; // Return false to indicate it was skipped
        }

        console.log(`[1] Limpiando sesgo periodístico de la fuente original...`);
        const hechosResumen = await aiService.extraerHechosObjetivos(articleData.content);

        console.log(`[2] Solicitando a la IA las posturas ideológicas personalizadas...`);
        const variantes = await aiService.generarVariantesDeNoticia(hechosResumen);

        console.log(`[3] Guardando Evento Raíz y Variantes en DB (Categoría: ${variantes.category}, Geo: ${variantes.geo_target || 'GLOBAL'})...`);

        // Ensure translations exist
        const translations = variantes.translations || [];

        for (const trans of translations) {
            // Uniquify slug by language to avoid constraint collision on dual inserts
            const langSlug = `${slug}-${trans.language}`;

            const { data: eventData, error: eventError } = await supabase
                .from('news_events')
                .insert([{
                    title: articleData.title,
                    objective_summary: trans.objective_summary || hechosResumen, // Fallback to raw summary if missing from translation
                    slug: langSlug,
                    category: variantes.category || 'General',
                    source_name: articleData.source_name,
                    source_url: articleData.source_url,
                    language: trans.language || 'es',
                    geo_target: variantes.geo_target || 'GLOBAL',
                    image_url: articleData.image_url,
                    tags: ['ia', 'noticias', trans.language, articleData.source_name.toLowerCase()]
                }])
                .select()
                .single();

            if (eventError) throw eventError;

            const eventId = eventData.id;
            console.log(`[✓] Evento guardado [${trans.language}] ID: ${eventId} (Slug: ${langSlug})`);

            console.log(`[4] Guardando Variantes [${trans.language}] en DB...`);
            const variantsToInsert = [
                { event_id: eventId, policy_type: 'left', policy_label: trans.left.label, title: trans.left.title, content: trans.left.content, sentiment_score: trans.left.sentiment },
                { event_id: eventId, policy_type: 'center', policy_label: trans.center.label, title: trans.center.title, content: trans.center.content, sentiment_score: trans.center.sentiment },
                { event_id: eventId, policy_type: 'right', policy_label: trans.right.label, title: trans.right.title, content: trans.right.content, sentiment_score: trans.right.sentiment },
            ];

            const { error: variantError } = await supabase
                .from('news_variants')
                .insert(variantsToInsert);

            if (variantError) throw variantError;
            console.log(`[✓] 3 Variantes guardadas correctamente para idioma ${trans.language}.`);
        }

        console.log(`[✔] Procesamiento multi-idioma exitoso para: ${articleData.title}\n`);
        return true; // Indicates success

    } catch (error) {
        console.error(`[X] Error crítico procesando la noticia:`, error);
        return false;
    }
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAndProcessCycle(provider) {
    const noticiasTendencia = await provider.fetchTrendingNews();

    if (noticiasTendencia.length === 0) {
        console.log("No se devolvió ninguna noticia válida del Scraper RSS.");
        return 0;
    }

    let procesadas = 0;
    for (const article of noticiasTendencia) {
        const exitoso = await procesarNoticiaCruda(article);
        if (exitoso) {
            procesadas++;
            // Rate Limit respect: Esperamos 10 segundos entre cada noticia procesada exitosamente con Gemini
            console.log("⏳ Esperando 10 segundos por Rate Limit de Gemini API antes de la siguiente noticia...");
            await wait(10000);
        }
    }
    return procesadas;
}

// Inicialización del agregador
async function startWorker() {
    const args = process.argv.slice(2);
    const isContinuous = args.includes('--mode=continuous');

    console.log(`Iniciando News Aggregator Worker con RSS Scraper... (Modo: ${isContinuous ? 'CONTINUO' : 'ÚNICO'})`);

    const provider = new RssScraperProvider();

    if (isContinuous) {
        console.log("♾️ El worker correrá indefinidamente. Presiona Ctrl+C para detenerlo.");
        while (true) {
            console.log("\n📡 --- Iniciando nuevo ciclo de escaneo ---");
            const procesadas = await fetchAndProcessCycle(provider);
            console.log(`\n🛑 Ciclo finalizado. Se procesaron ${procesadas} noticias nuevas.`);
            console.log("⏳ Durmiendo 30 minutos antes de buscar más novedades en los RSS...");
            await wait(30 * 60 * 1000); // RSS don't update as fast, 30 min is safer
        }
    } else {
        console.log("\n📡 --- Iniciando escaneo único ---");
        const procesadas = await fetchAndProcessCycle(provider);
        console.log(`\n🎉 Worker finalizado. Se procesaron ${procesadas} noticias nuevas en esta pasada.`);
    }
}

startWorker();
