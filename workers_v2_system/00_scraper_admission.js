require('dotenv').config({ path: require('path').join(__dirname, '../worker/.env') }); // Reusing root / worker .env
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const supabase = require('./config/supabase');
const { generateContent } = require('./core/ai_service');

const FETCH_TIMEOUT = 15000;

/**
 * Fase 0 - Filtro Temático IA
 * Valida si la noticia es estrictamente sobre Política o Economía de Argentina.
 */
async function validarRelevanciaTematica(titulo, texto, aiProvider) {
    try {
        const prompt = `
Sos un clasificador estricto de noticias para un portal de Argentina.
Debes determinar si la siguiente noticia trata ESPECÍFICAMENTE sobre:
- Política Argentina (partidos, gobierno, leyes, elecciones, declaraciones políticas)
- Economía Argentina (inflación, dólar, FMI, medidas macroeconómicas, paritarias)

Título: ${titulo}
Resumen: ${texto.substring(0, 500)}

Si el tema principal es policiales, deportes, farándula, horóscopo, o noticias internacionales sin impacto directo, responde exactamente "NO".
Si la noticia es de Política o Economía Argentina, responde exactamente "SI".
No des explicaciones, solo SI o NO.
`;

        const responseText = await generateContent(prompt, { provider: aiProvider, isJson: false, temperature: 0.1 });
        console.log(`Respuesta cruda: ${JSON.stringify(responseText, null, 2)}`);
        return responseText.toUpperCase().includes("SI");
    } catch (error) {
        console.error(`❌ Error en Filtro Temático IA (${aiProvider}). Permitiendo avance por seguridad.`, error.message);
        return true;
    }
}

/**
 * Función Principal del Scraper usando GNews API o URL Directa
 */
async function runScraper(isTestMode = false, aiProvider = 'ollama', specificUrl = null) {
    console.log(`🚀 Iniciando Fase 0: Admisión y Scraper V2 (Motor IA: ${aiProvider.toUpperCase()}) ...`);

    let itemsProcessed = 0;

    // Función auxiliar para procesar un único artículo
    const processItem = async (item) => {
        const originalUrl = item.url;
        let sourceDomain;
        try {
            sourceDomain = new URL(originalUrl).hostname.replace(/^www\./i, '');
        } catch (e) {
            sourceDomain = 'desconocido';
        }

        // 1. Verificar unicidad
        const { data: existing } = await supabase
            .from('v2_articles')
            .select('id')
            .eq('original_url', originalUrl)
            .single();

        if (existing) {
            console.log(`⏩ [Saltado] La noticia ya existe en BD: ${item.title?.substring(0, 50)}...`);
            return false;
        }

        console.log(`\n🔍 Evaluando [${sourceDomain}]: ${item.title}`);

        // 2. Extraer Contenido e Imagen
        let html;
        try {
            const response = await axios.get(originalUrl, {
                timeout: FETCH_TIMEOUT,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                }
            });
            html = response.data.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        } catch (e) {
            console.error(`❌ Error descargando HTML de ${originalUrl}`, e.message);
            return false;
        }

        const dom = new JSDOM(html, { url: originalUrl });
        const doc = dom.window.document;
        const reader = new Readability(doc);
        const article = reader.parse();

        if (!article || !article.textContent || article.textContent.trim().length < 200) {
            console.log(`🚫 Texto muy corto o paywall estricto. Descartando.`);
            return false;
        }

        let finalTitle = item.title;
        if (!finalTitle) {
            finalTitle = doc.querySelector('meta[property="og:title"]')?.content
                || doc.querySelector('title')?.textContent
                || article.title;
        }

        let imageUrl = doc.querySelector('meta[property="og:image"]')?.content;
        if (!imageUrl) imageUrl = doc.querySelector('meta[name="twitter:image"]')?.content;
        if (!imageUrl) {
            const imgTag = doc.querySelector('article img') || doc.querySelector('img');
            imageUrl = imgTag ? imgTag.src : null;
        }

        // 3. Filtro Temático IA
        const esRelevante = await validarRelevanciaTematica(finalTitle, article.textContent, aiProvider);

        if (!esRelevante) {
            console.log(`🚮 IA descartó la noticia por no ser de Política/Economía. Guardando como DISCARDED_RAW.`);
            await supabase.from('v2_articles').insert([{
                original_url: originalUrl,
                source_domain: sourceDomain,
                status: 'DISCARDED_RAW',
                raw_title: finalTitle,
                raw_body: article.textContent.trim()
            }]);
            return true;
        }

        // 4. Inserción Definitiva 
        console.log(`✅ Aprobada por IA. Guardando como PENDING_ANALYSIS (Imagen: ${imageUrl || 'N/A'})`);
        const { error: insertError } = await supabase.from('v2_articles').insert([{
            original_url: originalUrl,
            source_domain: sourceDomain,
            category: 'Política/Economía',
            status: 'PENDING_ANALYSIS',
            image_url: imageUrl,
            raw_title: finalTitle,
            raw_body: article.textContent.trim()
        }]);

        if (insertError) {
            console.error(`❌ Error guardando en BD (Supabase):`, insertError.message);
            return false;
        } else {
            console.log(`💾 ¡Guardada exitosamente en v2_articles!`);
            itemsProcessed++;
            return true;
        }
    };

    if (specificUrl) {
        console.log(`\n🔗 Modo URL Directa: Omitiendo búsqueda general. Procesando: ${specificUrl}`);
        await processItem({ url: specificUrl, source: { name: null }, title: null });
    } else {
        const gnewsApiKey = process.env.GNEWS_API_KEY;
        if (!gnewsApiKey) {
            console.error("❌ FALTA GNEWS_API_KEY en .env. El Scraper fallará.");
            process.exit(1);
        }

        console.log(`\n📡 Buscando últimas noticias de Argentina en GNews API...`);
        try {
            // 1. Obtener última fecha de scrapeo
            let lastScrapeTime = null;
            const { data: configData, error: configErr } = await supabase
                .from('v2_system_config')
                .select('value')
                .eq('key', 'scraper')
                .single();

            if (!configErr && configData && configData.value && configData.value.last_scrape_time) {
                lastScrapeTime = configData.value.last_scrape_time;
            }

            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            let lastScrapeDate = lastScrapeTime ? new Date(lastScrapeTime) : null;

            if (!lastScrapeDate || lastScrapeDate < startOfToday) {
                lastScrapeDate = startOfToday;
                console.log(`🔄 Reiniciando ventana de escaneo al comienzo del día: ${startOfToday.toISOString()}`);
            }

            let ventanasProcesadas = 0;

            // 2. Loop de Catch-up (Ponerse al día)
            while (true) {
                const startWindow = new Date(lastScrapeDate);
                const endWindow = new Date(startWindow.getTime() + 30 * 60000); // +30 minutos

                if (endWindow > now) {
                    console.log(`\n⏳ Ventana actual (${startWindow.toLocaleTimeString()} a ${endWindow.toLocaleTimeString()}) aún no ha cerrado. Se consultará más tarde.`);
                    break;
                }

                console.log(`\n⏱️ [Bloque ${ventanasProcesadas + 1}] Scrapeo Quirúrgico: ${startWindow.toISOString()} a ${endWindow.toISOString()}`);

                const url = `https://gnews.io/api/v4/search?q=política OR economía OR argentina&country=ar&lang=es&max=100&sortBy=publishedAt&from=${startWindow.toISOString()}&to=${endWindow.toISOString()}&apikey=${gnewsApiKey}`;
                console.log(`URL: ${url}`);
                const response = await axios.get(url, { timeout: FETCH_TIMEOUT });
                console.log(`Respuesta cruda: ${JSON.stringify(response.data, null, 2)}`);
                if (response.data && response.data.articles) {
                    const blockArticles = response.data.articles;
                    console.log(`✅ Obtenidas ${blockArticles.length} noticias en este bloque. Procesando ahora...`);

                    for (const item of blockArticles) {
                        await processItem(item);
                        if (isTestMode && itemsProcessed >= 1) break;
                    }
                }

                if (isTestMode && itemsProcessed >= 1) {
                    console.log(`\n🛑 Modo test completado.`);
                    break;
                }

                // 3. Avanzar tiempo y guardar Checkpoint individualmente (SOLO si terminamos el bloque)
                lastScrapeDate = endWindow;
                ventanasProcesadas++;

                const updatedIso = endWindow.toISOString();
                await supabase.from('v2_system_config')
                    .update({ value: { last_scrape_time: updatedIso }, updated_at: new Date().toISOString() })
                    .eq('key', 'scraper');
                console.log(`🕒 Timestamp guardado en DB: ${updatedIso}`);

                // 4. Pausa de cortesía para no saturar la API
                console.log(`💤 Esperando 5 segundos antes del siguiente bloque...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        } catch (error) {
            console.error(`❌ Error llamando a GNews API:`, error.message);
            process.exit(1);
        }
    }

    console.log(`\n🏁 Finish: Proceso scraper finalizado. ${itemsProcessed} items insertados.`);
    process.exit(0);
}

// Interfaz CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const isTestMode = args.includes('--test');

    let provider = 'ollama';
    const aiArg = args.find(a => a.startsWith('--ai='));
    if (aiArg) {
        provider = aiArg.split('=')[1].toLowerCase();
    }

    let specificUrl = null;
    const urlArg = args.find(a => a.startsWith('--url='));
    if (urlArg) {
        specificUrl = urlArg.split('=')[1];
    }

    runScraper(isTestMode, provider, specificUrl);
}

module.exports = { runScraper };
