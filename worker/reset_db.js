require('dotenv').config();
const supabase = require('./supabaseClient');

async function resetDatabase() {
    console.log("⚠️  PREPARANDO REINICIO DE BASE DE DATOS...");
    console.log("Esto eliminará TODA la información de las tablas de noticias y la cola de IA.");

    // Confirmación simple (puedes comentar esto si quieres que sea 100% automático)
    console.log("Iniciando en 3 segundos... Presiona Ctrl+C para cancelar.");
    await new Promise(r => setTimeout(r, 3000));

    try {
        // Eliminar en orden inverso a las dependencias (FKs)

        console.log("[-] Vaciando tabla: news_variants");
        const { error: e1 } = await supabase.from('news_variants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (e1) console.error("Error en news_variants:", e1.message);

        console.log("[-] Vaciando tabla: news_analysis");
        const { error: e2 } = await supabase.from('news_analysis').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (e2) console.error("Error en news_analysis:", e2.message);

        console.log("[-] Vaciando tabla: neutral_news");
        const { error: e3 } = await supabase.from('neutral_news').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (e3) console.error("Error en neutral_news:", e3.message);

        console.log("[-] Vaciando tabla: raw_articles");
        const { error: e4 } = await supabase.from('raw_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (e4) console.error("Error en raw_articles:", e4.message);

        console.log("[-] Vaciando tabla: ia_request_queue");
        const { error: e5 } = await supabase.from('ia_request_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (e5) console.error("Error en ia_request_queue:", e5.message);

        console.log("\n✅ Base de datos inicializada correctamente (Tablas vaciadas).");

    } catch (error) {
        console.error("\n❌ Error crítico durante el reset:", error.message);
    } finally {
        process.exit(0);
    }
}

resetDatabase();
