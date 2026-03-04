require('dotenv').config();

const tasks = {
    'scraper': require('./tasks/scraperTask'),
    'image_original': require('./tasks/imageOriginalTask'),
    'watchdog': require('./tasks/watchdogTask'),
    'twitter': require('./tasks/twitterTask'),
    'stats': require('./tasks/statsTask'),
    'twitter_audit': require('./tasks/twitterAuditTask'),
    'processor': require('./tasks/processorTask'), // The AI Queue Consumer

    // Asynchronous Choreography
    'phase0_submitter': require('./tasks/phase0Submitter'),
    'phase0_receiver': require('./tasks/phase0Receiver'),
    'phase1_submitter': require('./tasks/phase1Submitter'),
    'phase1_receiver': require('./tasks/phase1Receiver'),
    'phase2_submitter': require('./tasks/phase2Submitter'),
    'phase2_receiver': require('./tasks/phase2Receiver'),
    'phase_qcb_submitter': require('./tasks/phaseQcBSubmitter'),
    'phase_qcb_receiver': require('./tasks/phaseQcBReceiver'),
    'phase3_submitter': require('./tasks/phase3Submitter'),
    'phase3_receiver': require('./tasks/phase3Receiver'),
    'phase_qca_receiver': require('./tasks/phaseQcAReceiver')
};

const promptManager = require('./utils/promptManager');

async function startWorker() {
    await promptManager.init();

    const args = process.argv.slice(2);

    // Buscar los argumentos soportados
    const taskArg = args.find(arg => arg.startsWith('--task='));
    const isContinuous = args.includes('--mode=continuous');
    const delayArg = args.find(arg => arg.startsWith('--delay='));
    const instanceArg = args.find(arg => arg.startsWith('--instanceId='));
    const instanceId = instanceArg ? instanceArg.split('=')[1] : null;
    const dryRun = args.includes('--dryRun');

    // --provider flag o fallback a .env / --ai flag
    const providerFlag = args.find(arg => arg.startsWith('--provider='));
    let aiProvider = 'ollama';
    if (providerFlag) {
        aiProvider = providerFlag.split('=')[1];
    } else {
        const aiFlag = args.find(arg => arg.startsWith('--ai='));
        if (aiFlag) {
            aiProvider = aiFlag === '--ai=ollama' ? 'ollama' : 'gemini';
        } else {
            aiProvider = process.env.AI_PROVIDER || 'ollama';
        }
    }

    const useOllama = aiProvider === 'ollama';

    const tiersArg = args.find(arg => arg.startsWith('--supportedTiers='));
    let supportedTiers = null;
    if (tiersArg) {
        const tiersStr = tiersArg.split('=')[1];
        supportedTiers = tiersStr.split(',').map(t => t === '*' ? '*' : parseInt(t, 10));
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

    let sleepMs = taskConfig.delayMs || 60000;
    if (delayArg) {
        sleepMs = parseInt(delayArg.split('=')[1], 10);
    }

    const displayName = instanceId || taskName;

    console.log(`\n🚀 [Task Runner] Iniciando Worker -> Especialidad: [${taskName.toUpperCase()}] | Instancia: [${displayName}]`);
    console.log(`[🧠 IA Motor] ${aiProvider.toUpperCase()}`);
    console.log(`[🔄 Modo] ${isContinuous ? 'CONTINUO' : 'ÚNICA VEZ'}`);

    // Extraer TODOS los prompts inyectados interactivamente por Hub (--prompt_LLAVE=VALOR)
    const prompts = {};
    for (const arg of args) {
        if (arg.startsWith('--prompt_')) {
            const [keyFull, val] = arg.split('=');
            const keyName = keyFull.replace('--prompt_', '');
            prompts[keyName] = val;
        }
    }

    // Determinar opciones a pasar a la tarea
    const options = {
        useOllama: useOllama,
        aiProvider: aiProvider,
        instanceId: instanceId || taskName,
        dryRun: dryRun,
        supportedTiers: supportedTiers,
        prompts: prompts
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
