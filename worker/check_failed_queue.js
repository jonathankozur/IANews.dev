const supabase = require('./supabaseClient');

async function checkFailed() {
    console.log("--- Ultimos 10 registros FAILED en ia_request_queue ---");
    const { data, error } = await supabase
        .from('ia_request_queue')
        .select('*')
        .eq('status', 'FAILED')
        .order('updated_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error consultando DB:", error.message);
        return;
    }

    if (data.length === 0) {
        console.log("No hay registros FAILED.");
        return;
    }

    data.forEach(task => {
        console.log(`\nID: ${task.id}`);
        console.log(`Fecha Inicio: ${task.created_at}`);
        console.log(`Fecha Fallo: ${task.updated_at}`);
        console.log(`Error: ${task.error_msg}`);
        console.log(`Prompt (primeros 100 char): ${task.prompt.substring(0, 100)}...`);
    });

    const { count, error: countError } = await supabase
        .from('ia_request_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'FAILED');

    if (!countError) {
        console.log(`\nTotal de registros FAILED: ${count}`);
    }
}

checkFailed();
