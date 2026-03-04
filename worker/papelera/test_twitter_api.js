require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

async function testTwitter() {
    const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    let mediaId = null;
    try {
        console.log("Probando upload de media (v1.1)...");
        const imageResponse = await axios.get('https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80', { responseType: 'arraybuffer' });
        mediaId = await client.v1.uploadMedia(Buffer.from(imageResponse.data), { mimeType: 'image/jpeg' });
        console.log("✅ Media subida OK:", mediaId);
    } catch (e) {
        console.error("❌ Error de upload media:", e?.data?.detail || e.message);
    }

    try {
        console.log("\nProbando Tweet Thread con media...");
        const threadPayload = [
            { text: `🧵 Test de Hilo (Parte 1)\n${new Date().toISOString()}`, media: mediaId ? { media_ids: [mediaId] } : undefined },
            { text: `🧵 Test de Hilo (Parte 2 con link)\nhttps://neutra-ashy.vercel.app/?utm_source=twitter&utm_medium=social&utm_campaign=audit_diaria` }
        ];
        const response = await client.v2.tweetThread(threadPayload);
        console.log("✅ Thread OK:", response.map(t => t.data.id));
    } catch (e) {
        console.error("❌ Error emitir Thread:", e?.data?.detail || e.message, "\n---", e);
    }
}

testTwitter();
