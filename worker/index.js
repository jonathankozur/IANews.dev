require('dotenv').config();
const supabase = require('./supabaseClient');
const aiService = require('./aiService');

async function procesarNuevaNoticia(titulo, hechosResumen) {
    console.log(`\n======================================`);
    console.log(`[▶] Iniciando procesamiento de noticia: ${titulo}`);

    try {
        // 1. Insertar el Evento Raíz en Supabase
        console.log(`[1] Guardando Evento Raíz en DB...`);
        const { data: eventData, error: eventError } = await supabase
            .from('news_events')
            .insert([{ title: titulo, objective_summary: hechosResumen }])
            .select()
            .single();

        if (eventError) throw eventError;

        const eventId = eventData.id;
        console.log(`[✓] Evento guardado con ID: ${eventId}`);

        // 2. Usar la IA para generar las 3 posturas
        console.log(`[2] Solicitando a la IA las posturas ideológicas...`);
        const variantes = await aiService.generarVariantesDeNoticia(hechosResumen);

        // 3. Preparar e insertar las variantes en Supabase
        console.log(`[3] Guardando Variantes en DB...`);
        const variantsToInsert = [
            { event_id: eventId, policy_type: 'left', title: variantes.left.title, content: variantes.left.content, sentiment_score: variantes.left.sentiment },
            { event_id: eventId, policy_type: 'center', title: variantes.center.title, content: variantes.center.content, sentiment_score: variantes.center.sentiment },
            { event_id: eventId, policy_type: 'right', title: variantes.right.title, content: variantes.right.content, sentiment_score: variantes.right.sentiment },
        ];

        const { error: variantError } = await supabase
            .from('news_variants')
            .insert(variantsToInsert);

        if (variantError) throw variantError;

        console.log(`[✓] 3 Variantes guardadas correctamente.`);
        console.log(`[✔] Procesamiento exitoso para: ${titulo}\n`);

    } catch (error) {
        console.error(`[X] Error procesando la noticia:`, error);
    }
}

// Simulación de ejecución (esto en el futuro será disparado por el cron de Github Actions)
async function startWorker() {
    console.log("Iniciando News Worker...");

    const mockTrends = [
        {
            title: "Nueva tecnología disruptiva anunciada",
            hechos: "Empresa tecnológica anuncia chip cuántico funcional a temperatura ambiente. Costo estimado de desarrollo de 2 billones."
        },
        {
            title: "Acuerdo tarifario bloqueado",
            hechos: "El senado no logra consenso para el nuevo paquete tarifario. Exportaciones suspendidas por 48 hs."
        }
    ];

    for (const trend of mockTrends) {
        await procesarNuevaNoticia(trend.title, trend.hechos);
    }
}

startWorker();
