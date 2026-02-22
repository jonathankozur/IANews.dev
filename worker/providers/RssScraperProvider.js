const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const axios = require('axios');

const fetchClient = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    timeout: 15000
});

class RssScraperProvider {
    constructor(aiServiceInstance) {
        // We will use GNews API to get the links, because Argentine RSS feeds block server IPs vigorously
        this.apiKey = process.env.GNEWS_API_KEY;
        this.aiService = aiServiceInstance;
    }

    async fetchTrendingNews() {
        console.log(`[🔎 News Provider] Buscando ultimas noticias de Argentina (Vía API)...`);

        if (!this.apiKey) {
            console.warn("⚠️ FALTA GNEWS_API_KEY en .env. El Scraper fallará.");
            return [];
        }

        let allArticles = [];

        try {
            // Busca noticias de Argentina (país AR, idioma ES)
            const url = `https://gnews.io/api/v4/top-headlines?category=nation&country=ar&lang=es&max=10&apikey=${this.apiKey}`;
            const response = await fetchClient.get(url);

            if (response.data && response.data.articles) {
                for (const item of response.data.articles) {
                    allArticles.push({
                        title: item.title,
                        source_url: item.url,
                        source_name: item.source.name,
                        pubDate: new Date(item.publishedAt)
                    });
                }
            }
        } catch (error) {
            console.error(`  [!] Error llamando a API de Noticias:`, error.message);
            return [];
        }

        const articlesWithContent = [];

        for (const article of allArticles) {
            console.log(`  [📥] Extrayendo contenido (bypassing paywalls): ${article.title.substring(0, 40)}...`);
            const content = await this.extractArticleText(article.source_url);

            if (content && content.length > 250) {
                const isRelevant = await this.aiService.esNoticiaDePoliticaOEconomiaArgentina(article.title, content);

                if (isRelevant) {
                    articlesWithContent.push({
                        title: article.title,
                        source_name: article.source_name,
                        source_url: article.source_url,
                        content: content,
                        image_url: null
                    });
                } else {
                    console.log(`  [⛔] Descartada por Filtro Temático: ${article.title}`);
                }
            } else {
                console.log(`  [!] Contenido descartado (paywall estricto o muy corto).`);
            }
        }

        return articlesWithContent;
    }

    async extractArticleText(url) {
        try {
            const response = await fetchClient.get(url, { responseType: 'text' });
            const html = response.data;

            const doc = new JSDOM(html, { url: url });
            const reader = new Readability(doc.window.document);
            const article = reader.parse();

            return article ? article.textContent.trim() : null;

        } catch (error) {
            // Unblockable paywalls or anti-bot JS (Clarin, some La Nacion) will fail here, we just ignore them
            // console.error(`      Error extrayendo HTML de ${url}:`, error.message);
            return null;
        }
    }
}

module.exports = RssScraperProvider;
