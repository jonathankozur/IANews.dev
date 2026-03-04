const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testUpdate() {
    console.log("Actualizando prompt 'twitter_thread' en la base de datos...");
    const { error } = await supabase.from('system_prompts')
        .update({ updated_at: new Date().toISOString() })
        .eq('name', 'twitter_thread');

    if (error) console.error("Error actualizando:", error);
    else console.log("¡Actualizado exitosamente! Revisa el log de test_cache.");
}

testUpdate();
