require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Para borrar necesitamos la clave de Service Role que ignora el RLS (Row Level Security)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Faltan credenciales de Supabase en .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function purgeDatabase() {
    console.log("==================================================");
    console.log("⚠️ INICIANDO PURGA TOTAL DE LA BASE DE DATOS ⚠️");
    console.log("==================================================");

    try {
        // Al borrar 'news_events', SUPABASE automáticamente borrará (CASCADE):
        // - news_variants
        // - user_interactions
        // - comments
        // - comment_interactions
        console.log("-> Eliminando todos los registros de news_events...");

        // Un delete sin eq/in en Supabase requiere un filtro que siempre sea true si se hace desde el cliente, pero con service role a veces requiere un match all.
        // Hacemos un delete de todo lo que no sea null.
        const { count, error } = await supabase
            .from('news_events')
            .delete({ count: 'exact' })
            .not('id', 'is', null);

        if (error) throw error;

        console.log(`✅ Purga completada. Se eliminaron ${count || 'múltiples'} eventos y todas sus ramas en cascada.`);
        console.log("La base de datos está ahora limpia como recién instalada.");

    } catch (error) {
        console.error("❌ Error durante la purga:", error);
    }
}

purgeDatabase();
