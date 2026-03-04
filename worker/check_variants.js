const supabase = require('./supabaseClient');

async function checkVariants() {
    const { count, error } = await supabase
        .from('news_variants')
        .select('*', { count: 'exact', head: true });

    if (!error) {
        console.log(`Total de registros en news_variants: ${count}`);
    } else {
        console.error("Error consultando news_variants:", error.message);
    }
    process.exit(0);
}

checkVariants();
