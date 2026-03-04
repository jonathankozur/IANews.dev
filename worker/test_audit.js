require('dotenv').config();
const auditTask = require('./tasks/twitterAuditTask.js');

async function testAudit() {
    console.log("Forzando ejecución de auditoría (dryRun = false) para test de API v2...");
    await auditTask.execute({ dryRun: false });
    console.log("Ejecución finalizada.");
}

testAudit();
