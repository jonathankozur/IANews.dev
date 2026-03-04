const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const orchestratorTask = require('./tasks/orchestratorTask');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const articleId = '621398e3-d73a-498a-aa88-d34e5e96fd3d';

    // Reset it first
    await supabase.from('raw_articles').update({
        process_status: 'PENDING_ANALYSIS',
        retry_count: 0,
        worker_id: null,
        locked_at: null
    }).eq('id', articleId);

    console.log("Processing article: " + articleId);

    // We can't easily call execute because it fetches the oldest.
    // Let's modify execute to accept an ID? 
    // No, I'll just temporarily change the code in orchestratorTask.js to pick this ID.
}

run();
