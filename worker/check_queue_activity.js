const supabase = require('./supabaseClient');

async function checkQueueActivity() {
    console.log("Ultimos 5 tickets en la cola (actividad reciente):");
    const { data, error } = await supabase
        .from('ia_request_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    data.forEach(t => {
        console.log(`[${t.status}] ID: ${t.id.substring(0, 8)} | Prompt: ${t.prompt.substring(0, 50)}... | Creado: ${t.created_at}`);
    });
    process.exit(0);
}

checkQueueActivity();
