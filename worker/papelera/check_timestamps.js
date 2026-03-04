const supabase = require('./supabaseClient');

async function checkRecentNews() {
    console.log("Ultimas 5 noticias publicadas con sus variantes:");
    const { data, error } = await supabase
        .from('neutral_news')
        .select(`
            id,
            title,
            created_at,
            process_status,
            news_variants (
                id,
                language,
                policy_type,
                created_at
            )
        `)
        .eq('process_status', 'PUBLISHED')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    data.forEach(news => {
        console.log(`\nNoticia: ${news.title}`);
        console.log(`Creada en: ${news.created_at}`);
        console.log(`Variantes generadas: ${news.news_variants.length}`);
        if (news.news_variants.length > 0) {
            console.log(`Ultima variante creada: ${news.news_variants[0].created_at}`);
        }
    });
    process.exit(0);
}

checkRecentNews();
