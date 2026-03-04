const supabase = require('./supabaseClient');

async function checkProgress() {
    console.log("=== REPORTE DE PROGRESO DE PROCESAMIENTO ===\n");

    // 1. raw_articles
    const { data: rawData, error: rawError } = await supabase
        .from('raw_articles')
        .select('process_status', { count: 'exact' });

    if (!rawError) {
        const stats = rawData.reduce((acc, curr) => {
            acc[curr.process_status] = (acc[curr.process_status] || 0) + 1;
            return acc;
        }, {});
        console.log("--- raw_articles (Extracción inicial) ---");
        console.table(stats);
    }

    // 2. neutral_news
    const { data: neutralData, error: neutralError } = await supabase
        .from('neutral_news')
        .select('process_status', { count: 'exact' });

    if (!neutralError) {
        const stats = neutralData.reduce((acc, curr) => {
            acc[curr.process_status] = (acc[curr.process_status] || 0) + 1;
            return acc;
        }, {});
        console.log("\n--- neutral_news (Neutralización) ---");
        console.table(stats);
    }

    // 3. ia_request_queue
    const { data: queueData, error: queueError } = await supabase
        .from('ia_request_queue')
        .select('status', { count: 'exact' });

    if (!queueError) {
        const stats = queueData.reduce((acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
        }, {});
        console.log("\n--- ia_request_queue (Cola de IA) ---");
        console.table(stats);
    }

    process.exit(0);
}

checkProgress();
