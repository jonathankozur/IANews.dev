require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
    console.log("=== Checking Database Status ===");

    // 1. Raw articles
    const { count: rawPending } = await supabase.from('raw_articles').select('*', { count: 'exact', head: true }).eq('process_status', 'PENDING_ANALYSIS');
    const { count: rawError } = await supabase.from('raw_articles').select('*', { count: 'exact', head: true }).eq('process_status', 'ERROR');
    console.log(`Raw Articles - Pending: ${rawPending}, Error: ${rawError}`);

    // 2. IA Request Queue
    const { count: qPending } = await supabase.from('ia_request_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
    const { count: qProcessing } = await supabase.from('ia_request_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING');
    const { count: qFailed } = await supabase.from('ia_request_queue').select('*', { count: 'exact', head: true }).eq('status', 'FAILED');
    console.log(`IA Queue - Pending: ${qPending}, Processing: ${qProcessing}, Failed: ${qFailed}`);

    // Let's get the 5 most recent failed tasks to see what's wrong
    if (qFailed > 0) {
        const { data: failedTasks } = await supabase.from('ia_request_queue').select('id, error_msg, created_at, prompt').eq('status', 'FAILED').order('created_at', { ascending: false }).limit(3);
        console.log("Recent Failed IA Tasks:");
        failedTasks.forEach(t => {
            console.log(`  - ID: ${t.id}, Error: ${t.error_msg}`);
            // console.log(`Prompt: ${t.prompt.substring(0, 50)}...`);
        });
    }

    // 3. Neutral News without analysis
    // In workers, how is analysis saved? Let's check neutral_news.
    const { count: neutralPendingGeneration } = await supabase.from('neutral_news').select('*', { count: 'exact', head: true }).eq('process_status', 'PENDING_GENERATION');
    const { count: neutralPendingPublish } = await supabase.from('neutral_news').select('*', { count: 'exact', head: true }).eq('process_status', 'PENDING_PUBLISH');
    const { count: neutralError } = await supabase.from('neutral_news').select('*', { count: 'exact', head: true }).eq('process_status', 'ERROR');
    console.log(`Neutral News - PENDING_GENERATION: ${neutralPendingGeneration}, PENDING_PUBLISH: ${neutralPendingPublish}, ERROR: ${neutralError}`);

    // Let's also check article_analysis
    const { count: analysisCount } = await supabase.from('article_analysis').select('*', { count: 'exact', head: true });
    console.log(`Total Article Analysis: ${analysisCount}`);
}

checkStatus().catch(console.error);
