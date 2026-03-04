require('dotenv').config();
const supabase = require('./supabaseClient');
const promptManager = require('./utils/promptManager');

/**
 * Encolas de forma asincrónica un trabajo en ia_request_queue.
 * El Submitter llama aquí y NO SE QUEDA HACIENDO POLLING.
 * Retorna true si se encoló con éxito, de modo que el Worker se puede apagar.
 */
async function enqueueAiTask(articleId, taskType, promptName, promptParams, isJson = false, modelTier = 0) {
    console.log(`[🤖 AI Service] Preparando tarea asíncrona: ${taskType} para artículo ${articleId}`);

    const prompt = promptManager.getPrompt(promptName, promptParams);
    if (!prompt) {
        throw new Error(`Prompt '${promptName}' no encontrado en el sistema dinámico.`);
    }

    try {
        const { error } = await supabase
            .from('ia_request_queue')
            .insert([{
                article_id: articleId,
                task_type: taskType,
                prompt_name: promptName,     // Para fines de telemetría/tracking
                prompt: prompt,
                is_json: isJson,
                model_tier: modelTier,
                status: 'PENDING'
            }]);

        if (error) {
            console.error(`[❌ AI Service] Error encolando ${taskType}:`, error.message);
            throw error;
        }

        console.log(`[🕒 AI Service] Tarea ${taskType} encolada exitosamente para AI Queue Consumer.`);
        return true;
    } catch (error) {
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────
// Métodos de Fachada para los Submitters
// ─────────────────────────────────────────────────────────────

async function submitFiltroTematico(articleId, titulo, texto, promptName = 'analyzer_relevance') {
    if (!texto || texto.length < 100) return false;
    return await enqueueAiTask(articleId, 'PHASE_0_RELEVANCE', promptName, { titulo, texto: texto.substring(0, 600) }, true);
}

async function submitAuditoriaForense(articleId, textoCrudo, promptName = 'analyzer_audit') {
    return await enqueueAiTask(articleId, 'PHASE_1_FORENSIC', promptName, { textoCrudo: textoCrudo.substring(0, 3000) }, true);
}

async function submitNeutralizacion(articleId, forensicJson, promptName = 'generator_neutral') {
    return await enqueueAiTask(articleId, 'PHASE_2_NEUTRAL', promptName, {
        analisisForense: forensicJson
    }, true);
}

async function submitJuezEditorial(articleId, textoNeutral, promptName = 'qc_judge') {
    return await enqueueAiTask(articleId, 'QC_B_JUDGE', promptName, {
        textoNeutral: textoNeutral
    }, false); // Juez retorna string "TRUE"/"FALSE"
}

async function submitHiloX(articleId, noticia, promptName = 'twitter_thread') {
    return await enqueueAiTask(articleId, 'PHASE_3_TWITTER', promptName, {
        tituloOriginal: noticia.tituloOriginal,
        resumen: noticia.resumen,
        izquierda: noticia.izquierda,
        derecha: noticia.derecha
    }, true);
}

async function submitTraduccionSanadora(articleId, payloadStr, origenFase, promptName = 'translator_correction') {
    // Para no pisar task_types, usamos un sub-tipo QC_A dinámico
    const taskType = `QC_A_TRANSLATE_${origenFase}`;
    return await enqueueAiTask(articleId, taskType, promptName, { payloadStr }, true);
}

module.exports = {
    enqueueAiTask,
    submitFiltroTematico,
    submitAuditoriaForense,
    submitNeutralizacion,
    submitJuezEditorial,
    submitHiloX,
    submitTraduccionSanadora
};

