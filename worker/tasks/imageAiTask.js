const supabase = require('../supabaseClient');
const axios = require('axios');
const { uploadImageToSupabase, saveImageUrlToDatabase } = require('../imageUploadService');

module.exports = {
    // 30 segundos
    delayMs: 30000,

    execute: async function () {
        console.log(`\n======================================`);
        console.log(`[🤖 Tarea: Image AI] Buscando notas sin imagen generada por IA...`);

        const { data: articles, error } = await supabase
            .from('raw_articles')
            .select('id, title')
            .is('image_url_ai', null)
            .limit(5); // Procesar en pequeños lotes

        if (error) {
            console.error('[X] DB Error:', error.message);
            return;
        }

        if (!articles || articles.length === 0) {
            console.log(`[!] No hay artículos sin procesar imagen IA.`);
            return;
        }

        for (const article of articles) {
            try {
                console.log(`\n  -> Pollinations AI para: "${article.title.substring(0, 40)}..."`);

                // 1. Build Pollinations URL (Using a clear descriptive prompt without letters if possible to avoid garbled text block)
                const safeTitle = encodeURIComponent(`Cinematic editorial news photography about: ${article.title}. hyperrealistic, 8k resolution, modern, award winning photography. NO TEXT`);
                const pollinationsUrl = `https://pollinations.ai/p/${safeTitle}?width=800&height=450&nologo=true`;

                // 2. Download Image Buffer
                console.log(`  [↓] Solicitando y descargando render de IA...`);
                const imageResponse = await axios.get(pollinationsUrl, {
                    responseType: 'arraybuffer',
                    timeout: 45000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                const imageBuffer = Buffer.from(imageResponse.data);

                // 3. Upload to Supabase Storage
                const filename = `${article.id}_ai.jpg`;
                const publicUrl = await uploadImageToSupabase(imageBuffer, filename);

                if (publicUrl) {
                    await saveImageUrlToDatabase(article.id, 'image_url_ai', publicUrl);
                    console.log(`  [+] Imagen IA subida exitosamente: ${filename}`);
                } else {
                    console.error(`  [X] Error subiendo imagen IA.`);
                    await saveImageUrlToDatabase(article.id, 'image_url_ai', 'ERROR_UPLOADING');
                }

            } catch (err) {
                console.error(`  [X] Error IA en ${article.id}:`, err.message);
                await saveImageUrlToDatabase(article.id, 'image_url_ai', 'ERROR');
            }
        }
    }
};
