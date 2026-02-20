class BaseProvider {
    constructor() {
        if (this.constructor === BaseProvider) {
            throw new Error("Cannot instantiate abstract class.");
        }
    }

    /**
     * Extrae las noticias en tendencia del proveedor conectado.
     * @returns {Promise<Array<{title: string, content: string, source_url: string, source_name: string, image_url: string}>>}
     */
    async fetchTrendingNews() {
        throw new Error("Method 'fetchTrendingNews()' must be implemented.");
    }
}

module.exports = BaseProvider;
