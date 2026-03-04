const supabase = require('./supabaseClient');

async function checkSpecificArticle() {
    console.log("Buscando noticia sobre Adorni y Mayra Mendoza...");

    // Primero buscamos la noticia en neutral_news
    const { data: news, error } = await supabase
        .from('neutral_news')
        .select(`
            id,
            title,
            created_at
        `)
        .ilike('title', '%Adorni%')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("Error neutral_news:", error.message);
        return;
    }

    if (!news || news.length === 0) {
        console.log("No se encontró ninguna noticia con 'Adorni' en el título.");
        return;
    }

    const item = news[0];
    console.log(`\nNoticia encontrada: ${item.title}`);
    console.log(`ID: ${item.id}`);

    // Ahora buscamos variants
    const { data: variants, error: vError } = await supabase
        .from('news_variants')
        .select('id, language')
        .eq('neutral_news_id', item.id);

    console.log(`Variantes: ${variants?.length || 0}`);

    // Ahora buscamos analysis
    const { data: analysis, error: aError } = await supabase
        .from('news_analysis')
        .select('*')
        .eq('article_id', item.id);

    console.log(`Auditoría (news_analysis): ${analysis?.length > 0 ? 'SI' : 'NO'}`);

    if (analysis && analysis.length === 0) {
        console.log("\nCONCLUSIÓN: La noticia no aparece en NEUTRA porque le falta el registro de news_analysis (Auditoría Forense).");
    }

    process.exit(0);
}

checkSpecificArticle();
