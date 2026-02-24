const supabase = require('../supabaseClient');
const axios = require('axios');
const { uploadImageToSupabase, saveImageUrlToDatabase } = require('../imageUploadService');

module.exports = {
    // 1 minuto
    delayMs: 60000,

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[📸 Tarea: Image Stock] Buscando notas sin imagen Stock...`);

        const { data: articles, error } = await supabase
            .from('raw_articles')
            .select('id, title')
            .is('image_url_stock', null)
            .limit(5);

        if (error) {
            console.error('[X] DB Error:', error.message);
            return;
        }

        if (!articles || articles.length === 0) {
            console.log(`[!] No hay artículos sin procesar imagen stock.`);
            return;
        }

        const apiKey = process.env.PEXELS_API_KEY;
        if (!apiKey) {
            console.error('[X] PEXELS_API_KEY no definida en .env');
            return;
        }

        for (const article of articles) {
            try {
                console.log(`\n  -> Buscando Pexels para: "${article.title.substring(0, 40)}..."`);

                // Limpieza básica y extracción de las 2 palabras más largas para tener matching en Pexels
                let words = article.title.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ]/g, '').split(' ');
                // Seleccionar hasta 3 palabras de más de 3 letras
                let keywords = words.filter(w => w.length > 3).slice(0, 3).join(' ') || 'noticias';

                // 1. Call Pexels API
                const pexelsSearchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape&locale=es-ES`;
                console.log(`  [↓] Consultando API con keywords: "${keywords}"`);
                const searchResponse = await axios.get(pexelsSearchUrl, {
                    headers: { 'Authorization': apiKey },
                    validateStatus: null
                });

                if (searchResponse.status !== 200 || !searchResponse.data.photos || searchResponse.data.photos.length === 0) {
                    console.log(`  [-] Cero resultados en Pexels. Marcando NO_IMAGE.`);
                    await saveImageUrlToDatabase(article.id, 'image_url_stock', 'NO_IMAGE');
                    continue;
                }

                const bestPhotoUrl = searchResponse.data.photos[0].src.large2x || searchResponse.data.photos[0].src.large;

                // 2. Download Image Buffer
                console.log(`  [↓] Descargando foto Stock encontrada...`);
                const imageResponse = await axios.get(bestPhotoUrl, { responseType: 'arraybuffer', timeout: 20000 });
                const imageBuffer = Buffer.from(imageResponse.data);

                // 3. Upload to Supabase
                const filename = `${article.id}_stock.jpg`;
                const publicUrl = await uploadImageToSupabase(imageBuffer, filename);

                if (publicUrl) {
                    await saveImageUrlToDatabase(article.id, 'image_url_stock', publicUrl);
                    console.log(`  [+] Imagen stock subida exitosamente: ${filename}`);
                } else {
                    console.error(`  [X] Error subiendo imagen stock.`);
                    await saveImageUrlToDatabase(article.id, 'image_url_stock', 'ERROR_UPLOADING');
                }

            } catch (err) {
                console.error(`  [X] Error en ${article.id}:`, err.message);
                await saveImageUrlToDatabase(article.id, 'image_url_stock', 'ERROR');
            }
        }
    }
};
