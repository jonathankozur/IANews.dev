const supabase = require('./supabaseClient');

async function checkSpecificArticle() {
    console.log("Buscando noticia sobre Adorni y Mayra Mendoza...");

    const { data: news, error } = await supabase
        .from('neutral_news')
        .select(`
            id,
            title,
            created_at,
            news_variants (id, language),
            news_analysis (id)
        `)
        .ilike('title', '%Adorni%')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    if (news.length === 0) {
        console.log("No se encontró ninguna noticia con 'Adorni' en el título.");
        return;
    }

    const item = news[0];
    console.log(`\nNoticia encontrada: ${item.title}`);
    console.log(`ID: ${item.id}`);
    console.log(`Variantes: ${item.news_variants.length}`);
    console.log(`Auditoría (news_analysis): ${item.news_analysis.length > 0 ? 'SI (ID: ' + item.news_analysis[0].id + ')' : 'NO'}`);

    if (item.news_analysis.length === 0) {
        console.log("\nCONCLUSIÓN: La noticia no aparece en NEUTRA porque le falta el registro de news_analysis (Auditoría Forense).");
    }

    process.exit(0);
}

checkSpecificArticle();
