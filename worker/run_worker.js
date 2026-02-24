require('dotenv').config();

// Importamos todas las tareas (estrategias)
const tasks = {
    'processor': require('./tasks/processorTask'),
    'scraper': require('./tasks/scraperTask'),
    'neutralizer': require('./tasks/neutralizerTask'),
    'generator': require('./tasks/generatorTask'),
    'image_original': require('./tasks/imageOriginalTask'),
    'image_ai': require('./tasks/imageAiTask'),
    'image_stock': require('./tasks/imageStockTask'),
    'analyzer': require('./tasks/analyzerTask'),
    'watchdog': require('./tasks/watchdogTask'),
    'twitter': require('./tasks/twitterTask'),
    'stats': require('./tasks/statsTask')
};

async function startWorker() {
    const args = process.argv.slice(2);

    // Buscar los argumentos soportados
    const taskArg = args.find(arg => arg.startsWith('--task='));
    const isContinuous = args.includes('--mode=continuous');
    const delayArg = args.find(arg => arg.startsWith('--delay='));
    const instanceArg = args.find(arg => arg.startsWith('--instanceId='));
    const instanceId = instanceArg ? instanceArg.split('=')[1] : null;

    // --ai flag toma prioridad absoluta sobre la variable de entorno
    // Esto permite que el Hub sobreescriba la config del .env por instancia
    const aiFlag = args.find(arg => arg.startsWith('--ai='));
    const dryRun = args.includes('--dryRun');
    let useOllama;
    if (aiFlag) {
        useOllama = aiFlag === '--ai=ollama';
    } else {
        // Sin flag explícito, usamos el .env como fallback
        useOllama = process.env.AI_PROVIDER === 'ollama';
    }

    if (!taskArg) {
        console.error("❌ Debes especificar un worker. Ej: --task=scraper");
        process.exit(1);
    }

    const taskName = taskArg.split('=')[1];
    const taskConfig = tasks[taskName];

    if (!taskConfig) {
        console.error(`❌ El worker '${taskName}' no existe.`);
        process.exit(1);
    }

    // Calcular el delay final
    let sleepMs = taskConfig.delayMs || 60000;
    if (delayArg) {
        sleepMs = parseInt(delayArg.split('=')[1], 10);
    }

    const displayName = instanceId || taskName;

    console.log(`\n🚀 [Task Runner] Iniciando Worker -> Especialidad: [${taskName.toUpperCase()}] | Instancia: [${displayName}]`);
    console.log(`[🧠 IA Motor] ${useOllama ? 'OLLAMA (Local)' : 'GEMINI (Nube)'}`);
    console.log(`[🔄 Modo] ${isContinuous ? 'CONTINUO' : 'ÚNICA VEZ'}`);

    // Determinar opciones a pasar a la tarea
    const options = {
        useOllama: useOllama,
        instanceId: instanceId || taskName,
        dryRun: dryRun
    };

    if (dryRun) {
        console.log(`[🧪 DRY RUN] Modo prueba activado. No se realizarán acciones reales.`);
    }

    if (isContinuous) {
        // En modo continuo, manejamos excepciones para que no se detenga
        while (true) {
            try {
                await taskConfig.execute(options);
            } catch (err) {
                console.error(`[❌ Worker ${displayName}] Error global interceptado:`, err.message);
            }
            // Use getNextDelay() for tasks that want jitter, otherwise use fixed sleepMs
            const nextSleep = (typeof taskConfig.getNextDelay === 'function' && !delayArg)
                ? taskConfig.getNextDelay()
                : sleepMs;
            console.log(`⏳ [Task Runner] Durmiendo ${Math.round(nextSleep / 1000)}s antes del próximo ciclo de [${displayName}]...`);
            await new Promise(r => setTimeout(r, nextSleep));
        }
    } else {
        // Ejecución única aborta con código de error si falla
        try {
            await taskConfig.execute(options);
            console.log(`🎉 [Task Runner] Ejecución única de [${displayName}] finalizada.`);
            process.exit(0);
        } catch (err) {
            console.error(`[❌ Task Runner] Ejecución fallida:`, err.message);
            process.exit(1);
        }
    }
}

// Controlar cierre limpio
process.on('SIGINT', () => {
    console.log('\n[Task Runner] Señal SIGINT recibida. Apagando worker...');
    process.exit(0);
});

startWorker();
