const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await supabase
        .from('neutral_news')
        .select(`
          id,
          raw_article:raw_articles!inner (id),
          analysis:news_analysis!inner (article_id)
      `);

    console.log(`Exactly published in Neutra: ${data ? data.length : 0}`);

    const { data: allNeutral } = await supabase.from('neutral_news').select('id');
    console.log(`Total neutral news: ${allNeutral ? allNeutral.length : 0}`);

    if (data && allNeutral) {
        console.log(`Pending: ${allNeutral.length - data.length}`);
    }
}
run();
