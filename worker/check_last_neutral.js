const supabase = require('./supabaseClient');

async function checkLastNeutral() {
    console.log("Ultimas 5 noticias en neutral_news:");
    const { data, error } = await supabase
        .from('neutral_news')
        .select('title, created_at, process_status')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    data.forEach(n => {
        console.log(`[${n.process_status}] ${n.title} (${n.created_at})`);
    });
    process.exit(0);
}

checkLastNeutral();
