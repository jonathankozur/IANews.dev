require('dotenv').config({ path: require('path').join(__dirname, '../worker/.env') });
const supabase = require('./config/supabase');

const DOWNGRADE_MAP = {
    // Fase 1 Finalizada -> Revertir a Fase 0
    'PENDING_NEUTRALIZATION': {
        targetStatus: 'PENDING_ANALYSIS',
        fieldsToClear: ['biased_fragments', 'manipulation_tactics', 'fact_checking_text', 'full_analysis_text', 'bias', 'bias_score']
    },
    'ANALYSIS_FAILED': {
        targetStatus: 'PENDING_ANALYSIS',
        fieldsToClear: ['biased_fragments', 'manipulation_tactics', 'fact_checking_text', 'full_analysis_text', 'bias', 'bias_score']
    },

    // Fase 2 Finalizada -> Revertir a Fase 1
    'PENDING_SOCIAL': {
        targetStatus: 'PENDING_NEUTRALIZATION',
        fieldsToClear: ['clean_title', 'clean_body']
    },
    'NEUTRALIZATION_FAILED': {
        targetStatus: 'PENDING_NEUTRALIZATION',
        fieldsToClear: ['clean_title', 'clean_body']
    },

    // Fase 3 Finalizada -> Revertir a Fase 2
    'READY_TO_PUBLISH': {
        targetStatus: 'PENDING_SOCIAL',
        fieldsToClear: ['social_thread'] // Para la futura Fase 3
    },
    'SOCIAL_FAILED': {
        targetStatus: 'PENDING_SOCIAL',
        fieldsToClear: ['social_thread']
    },

    // Fase 4 Social (Twitter) Finalizada -> Revertir a Fase 3
    'PUBLISHED': {
        targetStatus: 'READY_TO_PUBLISH',
        fieldsToClear: []
    },
    'PUBLISH_FAILED': {
        targetStatus: 'READY_TO_PUBLISH',
        fieldsToClear: []
    }
};

async function revertArticle(articleId) {
    if (!articleId) {
        console.error("❌ ERROR: Debes proporcionar un ID de artículo usando '--id=tu-uuid'");
        process.exit(1);
    }

    console.log(`\n⏳ Buscando artículo [${articleId}]...`);

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

    // 2. Comprobar si es posible el downgrade
    const downgradeRule = DOWNGRADE_MAP[article.status];

    if (!downgradeRule) {
        console.log(`🛑 El estado '${article.status}' no tiene definida una regla de reversión. (No se puede revertir).`);
        process.exit(0);
    }

    console.log(`\n🔙 Aplicando Downgrade: ${article.status}  ==>  ${downgradeRule.targetStatus}`);

    // 3. Preparar el payload de limpieza incuyendo los retries
    const updatePayload = {
        status: downgradeRule.targetStatus,
        retries_count: 0,
        last_error_log: null
    };

    console.log(`🧹 Limpiando columnas: ${downgradeRule.fieldsToClear.join(', ')}`);
    for (const field of downgradeRule.fieldsToClear) {
        updatePayload[field] = null;
    }

    // 4. Ejecutar el Rollback
    const { error: updateError } = await supabase
        .from('v2_articles')
        .update(updatePayload)
        .eq('id', articleId);

    if (updateError) {
        console.error(`❌ ERROR al revertir el estado:`, updateError.message);
        process.exit(1);
    }

    console.log(`✅ ¡Éxito! El artículo fue revertido a '${downgradeRule.targetStatus}' y sus secuelas fueron borradas.`);
    process.exit(0);
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);

    let specificId = null;
    const idArg = args.find(a => a.startsWith('--id='));
    if (idArg) {
        specificId = idArg.split('=')[1];
    }

    revertArticle(specificId);
}

module.exports = { revertArticle };
