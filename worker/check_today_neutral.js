const supabase = require('./supabaseClient');

async function checkRecentNeutral() {
    console.log("Noticias neutralizadas hoy (2026-02-25):");
    const { data, error } = await supabase
        .from('neutral_news')
        .select('title, created_at, process_status')
        .gte('created_at', '2026-02-25T00:00:00')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    if (data.length === 0) {
        console.log("No hay noticias neutralizadas generadas hoy todavía.");
    } else {
        data.forEach(n => {
            console.log(`[${n.process_status}] ${n.title} (${n.created_at})`);
        });
    }
    process.exit(0);
}

checkRecentNeutral();
