require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

async function testV2() {
    console.log("Iniciando test de Twitter desde worker/ ...");
    const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    try {
        console.log("Enviando tweet de prueba v2...");
        const res = await client.v2.tweet({ text: "Test debug API v2 (Ignorar) " + Date.now() });
        console.log("ÉXITO:", res.data);
    } catch (e) {
        console.log("ERROR CODE:", e.code || e.status);
        console.log("ERROR DATA:", JSON.stringify(e?.data, null, 2));
        console.log("ERROR MESSAGE:", e.message);
    }
}

testV2();
