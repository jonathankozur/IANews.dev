const supabase = require('./supabaseClient');

async function checkDate() {
    const { data: item } = await supabase
        .from('neutral_news')
        .select('title, created_at')
        .ilike('title', '%Adorni%')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (item) {
        console.log(`Noticia: ${item.title}`);
        console.log(`Fecha neutral_news: ${item.created_at}`);

        // Ver últimas 5 de neutral_news en general
        const { data: latest } = await supabase
            .from('neutral_news')
            .select('title, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        console.log("\nUltimas 5 noticias en neutral_news:");
        latest.forEach(n => console.log(`- ${n.created_at}: ${n.title}`));
    }
    process.exit(0);
}

checkDate();
