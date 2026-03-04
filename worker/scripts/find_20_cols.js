const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
SELECT table_name, column_name, character_maximum_length 
FROM information_schema.columns 
WHERE character_maximum_length = 20 AND table_schema = 'public';
`;

async function run() {
    const { data, error } = await supabase.rpc('execute_sql', { sql });
    if (error) {
        console.error(error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

run();
