const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const treeKill = require('tree-kill');
const fs = require('fs');
const path = require('path');

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
        'processor-1': { type: 'processor', delayMs: 2000, useOllama: true, isRunning: false },
        'scraper-1': { type: 'scraper', delayMs: 1800000, isRunning: false },
        'neutralizer-1': { type: 'neutralizer', delayMs: 120000, isRunning: false },
        'generator-1': { type: 'generator', delayMs: 60000, isRunning: false },
        'image_original-1': { type: 'image_original', delayMs: 60000, isRunning: false },
        'image_ai-1': { type: 'image_ai', delayMs: 30000, isRunning: false },
        'image_stock-1': { type: 'image_stock', delayMs: 60000, isRunning: false },
        'analyzer-1': { type: 'analyzer', delayMs: 15000, isRunning: false },
        'watchdog-1': { type: 'watchdog', delayMs: 60000, isRunning: false },
        'twitter-1': { type: 'twitter', delayMs: 900000, isRunning: false }
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

function startWorkerProcess(instanceId) {
    if (activeProcesses[instanceId]) {
        return; // Already running
    }

    const instanceConf = systemConfig.instances[instanceId];
    if (!instanceConf) return;

    let aiFlag = '';
    // Only pass ai flag if the instance type supports/requires it (like processor)
    if (instanceConf.useOllama !== undefined) {
        aiFlag = instanceConf.useOllama ? '--ai=ollama' : '--ai=gemini';
    }

    const delayFlag = `--delay=${instanceConf.delayMs}`;
    const instanceFlag = `--instanceId=${instanceId}`;
    const taskFlag = `--task=${instanceConf.type}`;

    const args = ['run_worker.js', taskFlag, '--mode=continuous', instanceFlag, delayFlag];
    if (aiFlag) args.push(aiFlag);

    broadcastLog(instanceId, 'system', `Iniciando proceso: node ${args.join(' ')}`);

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
        processor: 2000,
        scraper: 1800000,
        neutralizer: 120000,
        generator: 60000,
        analyzer: 15000,
        watchdog: 60000,
        twitter: 900000,
        image_original: 60000,
        image_ai: 30000,
        image_stock: 60000
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

    // Only add useOllama if processor
    if (type === 'processor') {
        newConf.useOllama = true;
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
