const axios = require('axios');
const BaseProvider = require('./BaseProvider');

class GNewsProvider extends BaseProvider {
    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
        this.baseUrl = 'https://gnews.io/api/v4';
    }

    async fetchTrendingNews() {
        if (!this.apiKey) {
            console.error("[GNews] ⚠️ Falta GNEWS_API_KEY. Devolviendo array vacío.");
            return [];
        }

        try {
            console.log("[GNews] 📡 Conectando a api.gnews.io para buscar 'top-headlines' en español...");

            const response = await axios.get(`${this.baseUrl}/top-headlines`, {
                params: {
                    category: 'general',
                    lang: 'es',
                    max: 5, // Traer top 5 cada vez que corre el worker
                    apikey: this.apiKey,
                    expand: 'content' // Para traernos más texto sobre la noticia cruda
                },
                timeout: 5000 // Para no colgar el worker
            });

            if (response.data && response.data.articles) {
                console.log(`[GNews] ✅ Se encontraron ${response.data.articles.length} noticias en tendencia.`);

                return response.data.articles.map(article => ({
                    title: article.title,
                    // Combinamos descripción descriptiva con el contenido puro si lo hay.
                    content: `${article.description || ''} ${article.content || ''}`.trim(),
                    source_url: article.url,
                    source_name: article.source.name,
                    image_url: article.image
                }));
            }
            return [];
        } catch (error) {
            console.error("[GNews] ❌ Error conectando a GNews API:", error.response?.data || error.message);
            return [];
        }
    }
}

module.exports = GNewsProvider;
