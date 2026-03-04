const supabase = require('./supabaseClient');

async function checkAnalysisDate() {
    const { data: item } = await supabase
        .from('news_analysis')
        .select('created_at, article_id')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("Ultimas 5 auditorías en news_analysis:");
    if (item) {
        item.forEach(n => console.log(`- ${n.created_at}: article_id=${n.article_id}`));
    }
    process.exit(0);
}

checkAnalysisDate();
