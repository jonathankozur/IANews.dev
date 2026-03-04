const promptManager = require('./utils/promptManager');

async function runTest() {
    console.log("Inicializando Prompt Manager...");
    await promptManager.init();

    // removed get all prompts

    console.log("\n[TEST] Prueba de interpolación:");
    try {
        const text = promptManager.getPrompt('twitter_thread', { tituloOriginal: 'PRUEBA TITULO', resumen: 'PRUEBA RESUMEN' });
        console.log("Interpolado con exito! Longitud:", text.length);
        console.log(text.substring(0, 150) + '...\n');
    } catch (e) {
        console.error("Error al obtener twitter_thread:", e.message);
    }

    console.log("\n[TEST] Quedando a la escucha de cambios de Realtime (Presiona Ctrl+C para salir)...");
    console.log("-> Ve al Hub UI (o DB), edita cualquier prompt y guarda. Deberías ver el log de actualización aquí.");
}

runTest();
