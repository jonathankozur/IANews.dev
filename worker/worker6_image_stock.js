require('dotenv').config();
const supabase = require('./supabaseClient');
const axios = require('axios');
const { uploadImageToSupabase, saveImageUrlToDatabase } = require('./imageUploadService');

async function processStockImages() {
    // console.log('[Worker 6] Buscando notas sin imagen Stock...');

    const { data: articles, error } = await supabase
        .from('raw_articles')
        .select('id, title')
        .is('image_url_stock', null)
        .limit(5);

    if (error) {
        console.error('[Worker 6] DB Error:', error.message);
        return;
    }

    if (!articles || articles.length === 0) {
        return;
    }

    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
        console.error('[Worker 6] PEXELS_API_KEY no definida en .env');
        return;
    }

    for (const article of articles) {
        try {
            console.log(`[Worker 6] Buscando Pexels para: ${article.title.substring(0, 40)}...`);

            // Limpieza básica y extracción de las 2 palabras más largas para tener matching en Pexels
            let words = article.title.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ]/g, '').split(' ');
            let keywords = words.filter(w => w.length > 4).slice(0, 2).join(' ') || 'news global';

            // 1. Call Pexels API
            const pexelsSearchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape`;
            const searchResponse = await axios.get(pexelsSearchUrl, {
                headers: { 'Authorization': apiKey },
                validateStatus: null
            });

            if (searchResponse.status !== 200 || !searchResponse.data.photos || searchResponse.data.photos.length === 0) {
                console.log(`[Worker 6] Cero resultados en Pexels para: "${keywords}".`);
                await saveImageUrlToDatabase(article.id, 'image_url_stock', 'NO_IMAGE');
                continue;
            }

            const bestPhotoUrl = searchResponse.data.photos[0].src.large2x || searchResponse.data.photos[0].src.large;

            // 2. Download Image Buffer
            console.log(`[Worker 6] Descargando foto Stock...`);
            const imageResponse = await axios.get(bestPhotoUrl, { responseType: 'arraybuffer', timeout: 20000 });
            const imageBuffer = Buffer.from(imageResponse.data);

            // 3. Upload to Supabase
            const filename = `${article.id}_stock.jpg`;
            const publicUrl = await uploadImageToSupabase(imageBuffer, filename);

            if (publicUrl) {
                await saveImageUrlToDatabase(article.id, 'image_url_stock', publicUrl);
            } else {
                await saveImageUrlToDatabase(article.id, 'image_url_stock', 'ERROR_UPLOADING');
            }

        } catch (err) {
            console.error(`[Worker 6] Error en ${article.id}:`, err.message);
            await saveImageUrlToDatabase(article.id, 'image_url_stock', 'ERROR');
        }
    }
}

async function startWorker() {
    console.log('🚀 Iniciando Worker 6 (Pexels Stock Images)');
    while (true) {
        await processStockImages();
        await new Promise(r => setTimeout(r, 60000)); // Limite de Pexels: 200 req/hour (No saturar)
    }
}

startWorker();
