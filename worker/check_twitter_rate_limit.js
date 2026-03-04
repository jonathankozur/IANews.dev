require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

async function checkRateLimits() {
    const {
        TWITTER_API_KEY,
        TWITTER_API_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_SECRET,
    } = process.env;

    const client = new TwitterApi({
        appKey: TWITTER_API_KEY,
        appSecret: TWITTER_API_SECRET,
        accessToken: TWITTER_ACCESS_TOKEN,
        accessSecret: TWITTER_ACCESS_SECRET,
    });

    console.log("Verificando límites de rate de Twitter...");

    try {
        const response = await client.v2.me();
        console.log("✅ Petición exitosa!");
        if (response._rateLimit) {
            console.log(response._rateLimit);
        }

        console.log("\nIntentando enviar un tuit de prueba para forzar el encabezado de límite de publicación...");
        await client.v2.tweet(`Tuit de prueba de tasa de límite: ${Date.now()}`);
        console.log("✅ Tuit publicado con éxito.");

    } catch (error) {
        console.log("\n❌ Error capturado. Extrayendo Rate Limits...");

        if (error.rateLimit) {
            console.log("\n📊 OBTUVIMOS LOS ENCABEZADOS DE RATE LIMIT (Parseados por la librería):");
            console.log(`- Límite Total (x-rate-limit-limit): ${error.rateLimit.limit}`);
            console.log(`- Restantes (x-rate-limit-remaining): ${error.rateLimit.remaining}`);

            const resetDate = new Date(error.rateLimit.reset * 1000);
            console.log(`- Se reinicia el (x-rate-limit-reset): ${resetDate.toLocaleString('es-AR')}`);
        }

        // Always try to print error data to see if it's the daily limit rejection
        if (error.data) {
            console.log("\n[Cuerpo del Error]:");
            console.log(JSON.stringify(error.data, null, 2));
        }

        // Exponer el objeto Response con sus headers crudos
        if (error.response && error.response.headers) {
            console.log("\n[Headers crudos de la respuesta HTTP]:");
            const headers = error.response.headers;
            console.log(`x-rate-limit-limit: ${headers['x-rate-limit-limit']}`);
            console.log(`x-rate-limit-remaining: ${headers['x-rate-limit-remaining']}`);
            console.log(`x-rate-limit-reset: ${headers['x-rate-limit-reset']}`);
        }
    }
}

checkRateLimits();
