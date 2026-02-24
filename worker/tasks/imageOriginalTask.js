const supabase = require('../supabaseClient');
const axios = require('axios');
const cheerio = require('cheerio');
const { uploadImageToSupabase, saveImageUrlToDatabase } = require('../imageUploadService');

module.exports = {
    // 1 minuto
    delayMs: 60000,

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[🖼️ Tarea: Image Original] Buscando notas sin imagen original...`);

        const { data: articles, error } = await supabase
            .from('raw_articles')
            .select('id, source_url')
            .is('image_url_original', null)
            .limit(10);

        if (error) {
            console.error('[X] DB Error:', error.message);
            return;
        }

        if (!articles || articles.length === 0) {
            console.log(`[!] No hay artículos sin procesar imagen original.`);
            return;
        }

        for (const article of articles) {
            try {
                console.log(`  -> Extrayendo og:image de: ${article.source_url}`);

                // 1. Fetch HTML
                const { data: html } = await axios.get(article.source_url, {
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IANewsBot/1.0)' } // Some sites block bots without UA
                });
                const $ = cheerio.load(html);
                let ogImage = $('meta[property="og:image"]').attr('content');

                if (!ogImage) {
                    console.log(`  [-] No se encontró og:image. Marcando como NO_IMAGE`);
                    await saveImageUrlToDatabase(article.id, 'image_url_original', 'NO_IMAGE');
                    continue;
                }

                // Corregir URLs relativas 
                if (ogImage.startsWith('/')) {
                    const urlObj = new URL(article.source_url);
                    ogImage = `${urlObj.protocol}//${urlObj.host}${ogImage}`;
                }

                // 2. Download Image
                console.log(`  [↓] Descargando imagen original: ${ogImage.substring(0, 50)}...`);
                const imageResponse = await axios.get(ogImage, { responseType: 'arraybuffer', timeout: 15000 });
                const imageBuffer = Buffer.from(imageResponse.data);

                // 3. Upload to Supabase Storage
                const filename = `${article.id}_original.jpg`;
                const publicUrl = await uploadImageToSupabase(imageBuffer, filename);

                if (publicUrl) {
                    // 4. Save DB
                    await saveImageUrlToDatabase(article.id, 'image_url_original', publicUrl);
                    console.log(`  [+] Imagen original subida exitosamente: ${filename}`);
                } else {
                    console.error(`  [X] Error subiendo imagen original.`);
                    await saveImageUrlToDatabase(article.id, 'image_url_original', 'ERROR_UPLOADING');
                }

            } catch (err) {
                console.error(`  [X] Error en artículo ${article.id}:`, err.message);
                await saveImageUrlToDatabase(article.id, 'image_url_original', 'ERROR');
            }
        }
    }
};
