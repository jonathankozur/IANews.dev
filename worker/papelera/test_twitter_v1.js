require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

async function testV1Tweet() {
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

    console.log("Intentando publicar un tuit usando el viejo endpoint v1.1 (POST statuses/update)...");

    try {
        const response = await client.v1.tweet(`Prueba de Endpoint v1.1: ${Date.now()}`);
        console.log("✅ ¡ÉXITO! El tuit se publicó usando la API v1.1.");
        console.log(`URL: https://twitter.com/user/status/${response.id_str}`);
    } catch (error) {
        console.log("\n❌ Falló la publicación por v1.1:");
        console.log(`Mensaje General: ${error.message}`);

        if (error.data) {
            console.log("\n[Cuerpo del Error]:");
            console.log(JSON.stringify(error.data, null, 2));
        }
    }
}

testV1Tweet();
