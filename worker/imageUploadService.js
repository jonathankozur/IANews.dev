require('dotenv').config();
const supabase = require('./supabaseClient');

/**
 * Downloads an image buffer and uploads it to Supabase Storage
 * @param {Buffer} imageBuffer - the raw image buffer to upload
 * @param {string} fileName - the unique filename ideally ending in extension (e.g., .jpg)
 * @returns {Promise<string|null>} - returns the public URL of the uploaded image or null on error
 */
async function uploadImageToSupabase(imageBuffer, fileName) {
    try {
        const { data, error } = await supabase.storage
            .from('news_images')
            .upload(fileName, imageBuffer, {
                contentType: 'image/jpeg', // Best guess, storage will auto-detect on serving if necessary
                upsert: true
            });

        if (error) {
            console.error('[Supabase Storage] Error uploading image:', error.message);
            return null;
        }

        const { data: publicUrlData } = supabase.storage
            .from('news_images')
            .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
    } catch (err) {
        console.error('[Supabase Storage] Exception while uploading image:', err.message);
        return null;
    }
}

/**
 * Updates the image url in the SQL database for a given raw_article
 * @param {string} articleId - UUID of the raw article
 * @param {string} column - the column to update ('image_url_original', 'image_url_ai', 'image_url_stock')
 * @param {string} url - the public Supabase Storage URL
 */
async function saveImageUrlToDatabase(articleId, column, url) {
    try {
        const { error } = await supabase
            .from('raw_articles')
            .update({ [column]: url })
            .eq('id', articleId);

        if (error) {
            console.error(`[Supabase DB] Error updating ${column}:`, error.message);
        } else {
            console.log(`[Supabase DB] Con éxito guardada ${column} para artículo: ${articleId}`);
        }
    } catch (err) {
        console.error(`[Supabase DB] Exception while updating ${column}:`, err.message);
    }
}

module.exports = {
    uploadImageToSupabase,
    saveImageUrlToDatabase
};
