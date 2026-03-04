require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetFailedTasks() {
    console.log("=== Resetting Failed Tasks & Errors ===");

    // 1. Reset ia_request_queue
    console.log("1. Resetting ia_request_queue from FAILED to PENDING...");
    const { data: qData, error: qError } = await supabase
        .from('ia_request_queue')
        .update({ status: 'PENDING', error_msg: null, updated_at: new Date() })
        .eq('status', 'FAILED')
        .select();

    if (qError) {
        console.error("  [X] Error resetting ia_request_queue:", qError.message);
    } else {
        console.log(`  [+] Reset ${qData ? qData.length : 0} items in ia_request_queue.`);
    }

    // 2. Reset raw_articles
    console.log("2. Resetting raw_articles from ERROR to PENDING_ANALYSIS...");
    const { data: rawData, error: rawError } = await supabase
        .from('raw_articles')
        .update({ process_status: 'PENDING_ANALYSIS' })
        .eq('process_status', 'ERROR')
        .select();

    if (rawError) {
        console.error("  [X] Error resetting raw_articles:", rawError.message);
    } else {
        console.log(`  [+] Reset ${rawData ? rawData.length : 0} articles in raw_articles.`);
    }

    // 3. Reset neutral_news
    console.log("3. Resetting neutral_news from ERROR to PENDING_GENERATION...");
    const { data: neutralData, error: neutralError } = await supabase
        .from('neutral_news')
        .update({ process_status: 'PENDING_GENERATION' })
        .eq('process_status', 'ERROR')
        .select();

    if (neutralError) {
        console.error("  [X] Error resetting neutral_news:", neutralError.message);
    } else {
        console.log(`  [+] Reset ${neutralData ? neutralData.length : 0} articles in neutral_news.`);
    }

    console.log("=== Reset Complete ===");
}

resetFailedTasks().catch(console.error);
