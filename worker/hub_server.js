const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const treeKill = require('tree-kill');
const fs = require('fs');
const path = require('path');

// V2 Imports
const supabaseV2 = require('../workers_v2_system/config/supabase');
const autoRunnerV2 = require('./v2_auto_runner');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

app.use(cors());
app.use(express.json());

// Configuration Storage File
const CONFIG_FILE = path.join(__dirname, 'hub_config.json');

// Default starting config
let systemConfig = {
    instances: {
        'scraper-1': { type: 'scraper', delayMs: 1800000, isRunning: false },
        'orchestrator-1': { type: 'orchestrator', delayMs: 5000, isRunning: false },
        'image_original-1': { type: 'image_original', delayMs: 60000, isRunning: false },
        'watchdog-1': { type: 'watchdog', delayMs: 60000, isRunning: false },
        'twitter-1': { type: 'twitter', delayMs: 900000, isRunning: false },
        'stats-1': { type: 'stats', delayMs: 86400000, isRunning: false }
    },
    globalSettings: {
        aiProvider: 'ollama' // Default AI provider
    }
};

// Load or create config file
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const rawConfig = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsedConfig = JSON.parse(rawConfig);

        // Handle migration from old format
        if (parsedConfig.workers && !parsedConfig.instances) {
            console.log("Migrating old config format to multi-instance...");
            parsedConfig.instances = {};
            Object.keys(parsedConfig.workers).forEach(type => {
                parsedConfig.instances[`${type}-1`] = {
                    type: type,
                    delayMs: parsedConfig.workers[type].delayMs,
                    useOllama: parsedConfig.workers[type].useOllama,
                    isRunning: false
                };
            });
            delete parsedConfig.workers;
        } else if (parsedConfig.instances) {
            // Reset running states on boot
            Object.keys(parsedConfig.instances).forEach(id => parsedConfig.instances[id].isRunning = false);
        }
        systemConfig = parsedConfig;
    } catch (e) {
        console.error("Error loading config:", e);
    }
} else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(systemConfig, null, 2));
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(systemConfig, null, 2));
    io.emit('configUpdate', systemConfig);
}

// Active Process Dictionary
const activeProcesses = {};

// Broadcast logs helper
function broadcastLog(instanceId, type, message) {
    const logData = {
        taskName: instanceId, // Front-end uses taskName as instance ID for logs
        type, // 'info', 'error', 'system'
        message: message.toString().trim(),
        timestamp: new Date().toISOString()
    };
    io.emit('workerLog', logData);
    console.log(`[${instanceId}] ${message.toString().trim()}`);
}

// Hook up the V2 AutoRunner logs to the central broadcast system
autoRunnerV2.setLogCallback((logEvent) => {
    io.emit('workerLog', logEvent);
    console.log(`[V2-AutoR] ${logEvent.message}`);
});

function startWorkerProcess(instanceId) {
    if (activeProcesses[instanceId]) {
        return; // Already running
    }

    const instanceConf = systemConfig.instances[instanceId];
    if (!instanceConf) return;

    let aiFlag = '';
    // Use new provider flag for processor
    if (instanceConf.type === 'processor') {
        aiFlag = `--provider=${instanceConf.aiProvider || 'ollama'}`;
    } else if (instanceConf.useOllama !== undefined) {
        aiFlag = instanceConf.useOllama ? '--ai=ollama' : '--ai=gemini';
    }

    const delayFlag = `--delay=${instanceConf.delayMs}`;
    const instanceFlag = `--instanceId=${instanceId}`;
    const taskFlag = `--task=${instanceConf.type}`;

    const args = ['run_worker.js', taskFlag, '--mode=continuous', instanceFlag, delayFlag];
    if (aiFlag) args.push(aiFlag);
    if (instanceConf.supported_tiers && Array.isArray(instanceConf.supported_tiers)) {
        args.push(`--supportedTiers=${instanceConf.supported_tiers.join(',')}`);
    }

    // Inyectar dinámicamente todos los prompts configurados
    if (instanceConf.prompts) {
        for (const [key, value] of Object.entries(instanceConf.prompts)) {
            if (value) {
                args.push(`--prompt_${key}=${value}`);
            }
        }
    }

    broadcastLog(instanceId, 'system', `Iniciando proceso CMD: node ${args.join(' ')}`);

    // Spawn hidden child process
    const child = spawn('node', args, {
        cwd: __dirname,
        shell: true
    });

    activeProcesses[instanceId] = child;
    systemConfig.instances[instanceId].isRunning = true;
    saveConfig();

    child.stdout.on('data', (data) => broadcastLog(instanceId, 'info', data));
    child.stderr.on('data', (data) => broadcastLog(instanceId, 'error', data));

    child.on('close', (code) => {
        broadcastLog(instanceId, 'system', `Proceso cerrado con código ${code}`);
        delete activeProcesses[instanceId];
        // Ensure config exists before updating (in case of manual deletion while stopping)
        if (systemConfig.instances[instanceId]) {
            systemConfig.instances[instanceId].isRunning = false;
            saveConfig();
        }
    });
}

function stopWorkerProcess(instanceId) {
    if (activeProcesses[instanceId]) {
        const pid = activeProcesses[instanceId].pid;
        broadcastLog(instanceId, 'system', `Enviando señal de apagado al proceso (PID: ${pid})...`);
        treeKill(pid, 'SIGTERM', (err) => {
            if (err) {
                broadcastLog(instanceId, 'error', `Error al matar proceso: ${err.message}. Intentando SIGKILL...`);
                treeKill(pid, 'SIGKILL');
            } else {
                broadcastLog(instanceId, 'system', `Proceso ${pid} terminado correctamente.`);
            }
        });
        delete activeProcesses[instanceId];
        if (systemConfig.instances[instanceId]) {
            systemConfig.instances[instanceId].isRunning = false;
            saveConfig();
        }
    }
}

// --- API ROUTES ---

app.get('/api/config', (req, res) => {
    res.json(systemConfig);
});

// Create new instance
app.post('/api/instances', (req, res) => {
    const { type } = req.body;
    if (!type) {
        return res.status(400).json({ error: 'Worker type is required' });
    }

    // Default configs per type
    const defaultDelays = {
        scraper: 1800000,
        orchestrator: 5000,
        watchdog: 60000,
        twitter: 900000,
        twitterAudit: 3600000,
        image_original: 60000,
        stats: 86400000,
        translator: 30000
    };

    // Find unique ID
    let count = 1;
    let newId = `${type}-${count}`;
    while (systemConfig.instances[newId]) {
        count++;
        newId = `${type}-${count}`;
    }

    const newConf = {
        type: type,
        delayMs: defaultDelays[type] || 60000,
        isRunning: false
    };

    // Only add aiProvider if processor
    if (type === 'processor') {
        newConf.aiProvider = 'ollama';
        newConf.supported_tiers = ["*"];
    }

    systemConfig.instances[newId] = newConf;
    saveConfig();
    res.json({ success: true, instanceId: newId, config: newConf });
});

// Delete instance
app.delete('/api/instances/:id', (req, res) => {
    const { id } = req.params;
    if (systemConfig.instances[id]) {
        if (systemConfig.instances[id].isRunning) {
            stopWorkerProcess(id);
        }
        delete systemConfig.instances[id];
        saveConfig();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Instance not found' });
    }
});

app.post('/api/instances/:id/start', (req, res) => {
    const { id } = req.params;
    if (systemConfig.instances[id]) {
        startWorkerProcess(id);
        res.json({ success: true, isRunning: true });
    } else {
        res.status(404).json({ error: 'Instance not found' });
    }
});

app.post('/api/instances/:id/stop', (req, res) => {
    const { id } = req.params;
    if (systemConfig.instances[id]) {
        stopWorkerProcess(id);
        res.json({ success: true, isRunning: false });
    } else {
        res.status(404).json({ error: 'Instance not found' });
    }
});

// Update specific instance config
app.put('/api/instances/:id/config', (req, res) => {
    const { id } = req.params;
    if (systemConfig.instances[id]) {
        systemConfig.instances[id] = { ...systemConfig.instances[id], ...req.body };
        saveConfig();

        // If it's running, theoretically restart it
        if (systemConfig.instances[id].isRunning) {
            stopWorkerProcess(id);
            setTimeout(() => { startWorkerProcess(id); }, 2000);
        }
        res.json({ success: true, config: systemConfig.instances[id] });
    } else {
        res.status(404).json({ error: 'Instance not found' });
    }
});

// --- API ROUTES V2 ---

app.get('/api/v2/articles', async (req, res) => {
    try {
        const { data, error } = await supabaseV2
            .from('v2_articles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error("Supabase V2 Error:", error);
            return res.status(500).json({ error: error.message });
        }
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/execute', (req, res) => {
    const { id, aiProvider } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing article ID' });

    const provider = aiProvider || 'ollama';
    broadcastLog('Pipeline V2', 'system', `🚀 Disparando ejecución manual para: ${id.substring(0, 8)}... (Motor: ${provider})`);

    const child = spawn('node', ['../workers_v2_system/maintenance_execute.js', `--id=${id}`, `--ai=${provider}`], {
        cwd: __dirname,
        shell: true
    });

    child.stdout.on('data', (data) => broadcastLog('Pipeline V2', 'info', `[Manual EX] ${data}`));
    child.stderr.on('data', (data) => broadcastLog('Pipeline V2', 'error', `[Manual EX] ${data}`));

    // Respond immediately since execution can take minutes (AI)
    res.json({ success: true, message: 'Ejecución manual iniciada en background' });
});

app.post('/api/v2/twitter', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing article ID' });

    broadcastLog('Pipeline V2', 'system', `🐦 Disparando Publicador X/Twitter para: ${id.substring(0, 8)}...`);

    const child = spawn('node', ['../workers_v2_system/04_twitter_publisher.js', `--id=${id}`], {
        cwd: __dirname,
        shell: true
    });

    child.stdout.on('data', (data) => broadcastLog('Pipeline V2', 'info', `[X/Twitter] ${data}`));
    child.stderr.on('data', (data) => broadcastLog('Pipeline V2', 'error', `[X/Twitter] ${data}`));

    child.on('close', (code) => {
        if (code === 0) {
            broadcastLog('Pipeline V2', 'system', `✅ Hilo de Twitter publicado exitosamente.`);
            res.json({ success: true, message: 'Hilo publicado' });
        } else {
            res.status(500).json({ error: 'Publicación falló con código ' + code });
        }
    });
});

app.post('/api/v2/revert', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing article ID' });

    broadcastLog('Pipeline V2', 'system', `🔙 Disparando Rollback manual para: ${id.substring(0, 8)}... espere por favor.`);

    const child = spawn('node', ['../workers_v2_system/maintenance_revert.js', `--id=${id}`], {
        cwd: __dirname,
        shell: true
    });

    child.stdout.on('data', (data) => broadcastLog('Pipeline V2', 'info', `[Rollback] ${data}`));
    child.stderr.on('data', (data) => broadcastLog('Pipeline V2', 'error', `[Rollback] ${data}`));

    child.on('close', (code) => {
        if (code === 0) {
            broadcastLog('Pipeline V2', 'system', `✅ Rollback completado exitosamente.`);
            res.json({ success: true, message: 'Rollback completado' });
        } else {
            res.status(500).json({ error: 'Rollback fallo con código ' + code });
        }
    });
});

app.post('/api/v2/autorunner/toggle', (req, res) => {
    const { action, aiProvider } = req.body; // action = 'start' | 'stop'
    if (action === 'start') {
        const provider = aiProvider || 'ollama';
        const started = autoRunnerV2.start(provider);
        res.json({ success: started, status: autoRunnerV2.getStatus() });
    } else {
        const stopped = autoRunnerV2.stop();
        res.json({ success: stopped, status: autoRunnerV2.getStatus() });
    }
});

app.get('/api/v2/autorunner/status', (req, res) => {
    res.json(autoRunnerV2.getStatus());
});


// Socket.io Connections
io.on('connection', (socket) => {
    console.log('UI Dashboard Connected:', socket.id);
    socket.emit('configUpdate', systemConfig);
});

const PORT = process.env.HUB_PORT || 4000;
server.listen(PORT, () => {
    console.log(`\n================================`);
    console.log(`🚀 IANews Worker Hub Server (Multi-Instance)`);
    console.log(`📡 Escuchando en el puerto ${PORT}`);
    console.log(`================================\n`);
});
