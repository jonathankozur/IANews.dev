const { spawn } = require('child_process');

const tasks = [
    'processor',
    'scraper',
    'neutralizer',
    'generator',
    'image_original',
    'image_ai',
    'image_stock',
    'analyzer'
];

async function runWorker(taskName) {
    return new Promise((resolve, reject) => {
        console.log(`\n\x1b[36m========== INICIANDO: ${taskName} ==========\x1b[0m`);

        const process = spawn('node', ['run_worker.js', `--task=${taskName}`], { stdio: 'inherit', shell: true });

        process.on('close', (code) => {
            if (code === 0) {
                console.log(`\x1b[32m========== FINALIZADO: ${taskName} ==========\x1b[0m\n`);
                resolve();
            } else {
                console.error(`\x1b[31m[!] ${taskName} finalizó con código de error ${code}\x1b[0m`);
                resolve(); // Constinue even on error for testing purposes
            }
        });

        process.on('error', (err) => {
            console.error(`\x1b[31m[!] Error al lanzar ${taskName}:\x1b[0m`, err);
            resolve();
        });
    });
}

async function runAll() {
    console.log("🚀 Iniciando Test Secuencial de Todos los Workers...");

    for (const task of tasks) {
        await runWorker(task);
    }

    console.log("🎉 Test Secuencial Completado Exitosamente.");
}

runAll();
