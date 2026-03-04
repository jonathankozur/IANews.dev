require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetCorruptedAnalysis() {
    console.log("=== Limpiando Análisis Corruptos ===");

    // Find the IDs that have the generic text
    const genericText = "Se encontró un sesgo en el momento de la evaluación.";

    const { data: badRecords, error: fetchError } = await supabase
        .from('news_analysis')
        .select('article_id')
        .eq('detected_bias', genericText);

    if (fetchError) {
        console.error("Error fetching bad records:", fetchError.message);
        return;
    }

    if (!badRecords || badRecords.length === 0) {
        console.log("No bad records found to delete.");
        return;
    }

    console.log(`Found ${badRecords.length} bad analysis rows. Deleting...`);

    const badIds = badRecords.map(r => r.article_id);

    const { error: deleteError } = await supabase
        .from('news_analysis')
        .delete()
        .in('article_id', badIds);

    if (deleteError) {
        console.error("Error deleting bad records:", deleteError.message);
    } else {
        console.log(`Successfully deleted ${badIds.length} bad analysis rows. The analyzer task will now pick them up again.`);
    }
}

resetCorruptedAnalysis().catch(console.error);
