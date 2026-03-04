require('dotenv').config({ path: require('path').join(__dirname, '../worker/.env') });
const { TwitterApi } = require('twitter-api-v2');

async function testV2() {
    console.log("Iniciando test de Twitter...");
    const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    try {
        console.log("Enviando tweet de prueba v1...");
        const res = await client.v1.tweet("Test debug API v1 (Ignorar) " + Date.now());
        console.log("ÉXITO:", res.id_str);
    } catch (e) {
        console.log("ERROR CODE:", e.code || e.status);
        console.log("ERROR DATA:", JSON.stringify(e?.data, null, 2));
        console.log("ERROR MESSAGE:", e.message);
    }
}

testV2();
