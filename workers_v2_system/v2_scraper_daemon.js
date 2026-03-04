const { spawn } = require('child_process');
const path = require('path');

const SCRAPER_INTERVAL = 5 * 60 * 1000; // 5 minutos

function runScraper() {
    console.log(`\n============== [V2 SCRAPER DAEMON] =================`);
    console.log(`🕒 [${new Date().toLocaleTimeString()}] Ejecutando Scraper V2 Quirúrgico...`);

    // Ejecutar el script 00_scraper_admission.js de forma asíncrona pero visible
    const scraperPath = path.join(__dirname, '00_scraper_admission.js');
    const child = spawn('node', [scraperPath], {
        cwd: __dirname,
        stdio: 'inherit'
    });

    child.on('close', (code) => {
        console.log(`\n🕒 Scraper finalizado con código ${code}. Entrando en reposo.`);
        console.log(`💤 Próxima ejecución programada en 5 minutos.`);
    });
}

// Ejecutar el bot inmediatamente al despertar
runScraper();

// Programar el loop infinito
setInterval(runScraper, SCRAPER_INTERVAL);

console.log(`♻️ Daemon del Scraper V2 Iniciado (Ciclo Automático: 5m)`);
