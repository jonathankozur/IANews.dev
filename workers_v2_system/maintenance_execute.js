require('dotenv').config({ path: require('path').join(__dirname, '../worker/.env') });
const supabase = require('./config/supabase');

const EXECUTION_MAP = {
    'PENDING_ANALYSIS': {
        phaseName: 'Fase 1 (Analizador de Sesgo)',
        modulePath: './01_analyzer_bias',
        functionName: 'runAnalyzer'
    },
    'PENDING_NEUTRALIZATION': {
        phaseName: 'Fase 2 (Redactor Neutral)',
        modulePath: './02_neutralizer',
        functionName: 'runNeutralizer'
    },
    'PENDING_SOCIAL': {
        phaseName: 'Fase 3 (Auditor Social)',
        modulePath: './03_social_auditor',
        functionName: 'runSocialAuditor'
    }
};

async function executeNextPhase(articleId, aiProvider) {
    if (!articleId) {
        console.error("❌ ERROR: Debes proporcionar un ID de artículo usando '--id=tu-uuid'");
        process.exit(1);
    }

    console.log(`\n🔍 Buscando artículo [${articleId}] para determinar su fase...`);

    // 1. Obtener estado actual
    const { data: article, error: fetchError } = await supabase
        .from('v2_articles')
        .select('id, raw_title, status')
        .eq('id', articleId)
        .single();

    if (fetchError || !article) {
        console.error(`❌ ERROR: No se encontró el artículo o hubo un problema de BD. (${fetchError?.message})`);
        process.exit(1);
    }

    console.log(`📰 Artículo: "${article.raw_title}"`);
    console.log(`📍 Estado Actual: ${article.status}`);

    // 2. Comprobar si hay un handler para este estado
    const executionRule = EXECUTION_MAP[article.status];

    if (!executionRule) {
        console.log(`🛑 El estado '${article.status}' no requiere ninguna acción automática por parte de los Workers, o pertenece a una fase final (Ej: READY_TO_PUBLISH o un estado de FALLO que requiere reversión manual previa).`);
        console.log(`Si el estado es FAILED, recuerda usar 'node maintenance_revert.js --id=${articleId}' primero.`);
        process.exit(0);
    }

    console.log(`\n🚀 ¡Ruteando hacia ${executionRule.phaseName}!`);
    console.log(`⚙️  Motor IA seleccionado: ${aiProvider.toUpperCase()}\n`);

    // 3. Importar dinámicamente y ejecutar
    try {
        const workerModule = require(executionRule.modulePath);
        const runFunction = workerModule[executionRule.functionName];

        // Ejecutamos pasándole isTestMode = true, provider, y el specificId
        await runFunction(true, aiProvider, articleId);
    } catch (err) {
        console.error(`❌ ERROR CRÍTICO al intentar arrancar el Worker correspondiente:`, err.message);
        process.exit(1);
    }
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);

    let specificId = null;
    const idArg = args.find(a => a.startsWith('--id='));
    if (idArg) {
        specificId = idArg.split('=')[1];
    }

    let provider = 'ollama'; // Default super-safe
    const aiArg = args.find(a => a.startsWith('--ai='));
    if (aiArg) {
        provider = aiArg.split('=')[1].toLowerCase();
    }

    executeNextPhase(specificId, provider);
}

module.exports = { executeNextPhase };
