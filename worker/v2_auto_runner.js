const { spawn } = require('child_process');
const path = require('path');
const supabase = require('../workers_v2_system/config/supabase');

let isRunning = false;
let currentChild = null;
let currentAiProvider = 'ollama';
let logCallback = null;

function setLogCallback(cb) {
    logCallback = cb;
}

function broadcastLog(type, message) {
    // console.log(`[AutoRunner] ${message}`);
    if (logCallback) {
        logCallback({
            taskName: 'Pipeline V2',
            type,
            message: message.toString().trim(),
            timestamp: new Date().toISOString()
        });
    }
}

async function getOldestPendingArticle() {
    const { data, error } = await supabase
        .from('v2_articles')
        .select('id, status, raw_title')
        .in('status', ['PENDING_ANALYSIS', 'PENDING_NEUTRALIZATION', 'PENDING_SOCIAL'])
        .order('created_at', { ascending: true })
        .limit(1);

    if (error) {
        broadcastLog('error', `Error DB AutoRunner: ${error.message}`);
        return null;
    }

    if (data && data.length > 0) {
        return data[0];
    }
    return null;
}

function runMaintenanceExecute(articleId, provider) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../workers_v2_system/maintenance_execute.js');
        const args = [scriptPath, `--id=${articleId}`, `--ai=${provider}`];

        currentChild = spawn('node', args, { cwd: path.join(__dirname, '../workers_v2_system') });

        currentChild.stdout.on('data', (data) => broadcastLog('info', data));
        currentChild.stderr.on('data', (data) => broadcastLog('error', data));

        currentChild.on('close', (code) => {
            currentChild = null;
            if (code === 0) resolve();
            else reject(new Error(`Worker exited with code ${code}`));
        });

        currentChild.on('error', (err) => {
            currentChild = null;
            reject(err);
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function loop() {
    while (isRunning) {
        try {
            const article = await getOldestPendingArticle();

            if (!article) {
                broadcastLog('system', "💤 Cola V2 vacía. Durmiendo 30 segundos...");
                // Espera fraccionada para poder frenar el loop rápido si el usuario le da Stop
                for (let i = 0; i < 30; i++) {
                    if (!isRunning) return;
                    await sleep(1000);
                }
                continue;
            }

            broadcastLog('system', `\n🚀 AutoRunner accionando sobre: "${article.raw_title}" [${article.status}]`);

            await runMaintenanceExecute(article.id, currentAiProvider);

        } catch (error) {
            broadcastLog('error', `❌ Error en ciclo AutoRunner: ${error.message}`);
            broadcastLog('system', `Pausando 10s tras fallo crítico...`);
            await sleep(10000);
        }
    }
    broadcastLog('system', `🛑 AutoRunner se ha detenido limpiamente.`);
}

function start(aiProvider = 'ollama') {
    if (isRunning) return false;
    currentAiProvider = aiProvider;
    isRunning = true;
    broadcastLog('system', `🟢 AutoRunner V2 INICIADO (IA: ${aiProvider.toUpperCase()})`);
    loop(); // Fire and forget
    return true;
}

function stop() {
    if (!isRunning) return false;
    isRunning = false;
    broadcastLog('system', `🔴 Deteniendo AutoRunner V2. Esperando que termine la tarea actual...`);
    return true;
}

function getStatus() {
    return {
        isRunning,
        aiProvider: currentAiProvider,
        isCurrentlyProcessing: !!currentChild
    };
}

module.exports = {
    start,
    stop,
    getStatus,
    setLogCallback
};
