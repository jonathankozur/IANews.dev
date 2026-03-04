require('dotenv').config();
const supabase = require('./supabaseClient');
const promptManager = require('./utils/promptManager');

// Polling interval defaults to 3000ms
const POLL_INTERVAL_MS = parseInt(process.env.AI_QUEUE_POLL_INTERVAL_MS || '3000', 10);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function enqueueAndAwaitResult(prompt, isJson = false, modelTier = 0) {
    try {
        const { data, error } = await supabase
            .from('ia_request_queue')
            .insert([{
                prompt,
                is_json: isJson,
                model_tier: modelTier,
                status: 'PENDING'
            }])
            .select('id')
            .single();

        if (error) {
            console.error("[❌ IA Client] Error encolando solicitud:", error.message);
            throw error;
        }

        const requestId = data.id;
        console.log(`[� IA Client] Solicitud encolada (ID: ${requestId.substring(0, 8)}...). Esperando respuesta (polling cada ${POLL_INTERVAL_MS / 1000}s)...`);

        while (true) {
            await wait(POLL_INTERVAL_MS);

            const { data: checkData, error: checkError } = await supabase
                .from('ia_request_queue')
                .select('status, result, error_msg')
                .eq('id', requestId)
                .single();

            if (checkError) {
                console.error(`[❌ IA Client] Error consultando estado (ID: ${requestId.substring(0, 8)}...):`, checkError.message);
                continue;
            }

            if (checkData.status === 'DONE') {
                return checkData.result;
            } else if (checkData.status === 'FAILED') {
                throw new Error(checkData.error_msg || "Falló el procesamiento de IA en el Worker Central.");
            }
        }
    } catch (error) {
        throw error;
    }
}

async function analizarYExtraerCrudo(textoCrudo, titulo, promptName = 'analyzer_bias_extraction') {
    console.log(`[🤖 IA Service Client] Encolando análisis de sesgo original y extracción de hechos...`);

    const prompt = promptManager.getPrompt(promptName, { titulo, textoCrudo: textoCrudo.substring(0, 3000) });
    if (!prompt) throw new Error(`Prompt '${promptName}' no encontrado.`);

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 0);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ IA Service Client] Failed to analyze and extract facts:", error.message);
        return null;
    }
}

async function generarVariantesDeNoticia(hechosObjetivos, promptName = 'generator_variants') {
    console.log(`[🤖 IA Service Client] Encolando procesamiento de hechos para i18n...`);

    const prompt = promptManager.getPrompt(promptName, { hechosObjetivos });
    if (!prompt) throw new Error(`Prompt '${promptName}' no encontrado.`);

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 0);
        return JSON.parse(responseText);

    } catch (error) {
        console.error("[❌ IA Service Client] Failed to generate or parse AI content:", error.message);

        return {
            category: "General",
            left: {
                label: "Crítico",
                title: "🔴 ESCÁNDALO: El Sistema Colapsa y Ocultan la Verdad",
                content: "Las fallas en la infraestructura impidieron completar el análisis. Exigimos mayores garantías.",
                sentiment: -0.5
            },
            center: {
                label: "Oficial",
                title: "⚠️ Aviso de Sistema: Generación Fallida",
                content: "Hubo un error de comunicación con el servicio de IA.",
                sentiment: 0.0
            },
            right: {
                label: "Mercado",
                title: "💥 INACEPTABLE: El Servicio Falla. El Mercado Exige Soluciones",
                content: "Soluciones subóptimas causaron inactividad. Se necesitan alternativas privadas y robustas.",
                sentiment: -0.2
            }
        };
    }
}

async function generarNoticiaNeutral(payload, promptName = 'generator_neutral') {
    console.log(`[🤖 IA Service Client] Encolando generación de noticia neutral...`);

    const prompt = promptManager.getPrompt(promptName, payload);
    if (!prompt) throw new Error(`Prompt '${promptName}' no encontrado.`);

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 4);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ IA Service Client] Failed to generate neutral news:", error.message);
        return null;
    }
}

async function esNoticiaDePoliticaOEconomiaArgentina(titulo, texto, promptName = 'analyzer_relevance') {
    if (!texto || texto.length < 100) return false;

    const lowerTitle = titulo.toLowerCase();
    const blacklist = ['horóscopo', 'gran hermano', 'farándula', 'clima', 'pronóstico', 'espectáculos', 'cine', 'netflix'];
    if (blacklist.some(word => lowerTitle.includes(word))) return false;

    console.log(`[🤖 IA Service Client] Encolando evaluación de relevancia temática: "${titulo}"`);

    const prompt = promptManager.getPrompt(promptName, { titulo, texto: texto.substring(0, 600) });
    if (!prompt) throw new Error(`Prompt '${promptName}' no encontrado.`);

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 6);
        const jsonResponse = JSON.parse(responseText);
        return jsonResponse.es_relevante === true;
    } catch (error) {
        console.error("[❌ IA Service Client] Filter checking failed:", error.message);
        return true;
    }
}

async function generarTweetViral(noticia, promptName = 'twitter_thread') {
    console.log(`[🤖 IA Service Client] Encolando generación de hilo viral para X...`);

    const prompt = promptManager.getPrompt(promptName, {
        tituloOriginal: noticia.tituloOriginal,
        resumen: noticia.resumen,
        izquierda: noticia.izquierda,
        derecha: noticia.derecha
    });
    if (!prompt) throw new Error(`Prompt '${promptName}' no encontrado.`);

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 4);
        const tweetsRaw = JSON.parse(responseText);
        let tweets = tweetsRaw;

        // Si la IA envolvió el array en un objeto (común en algunos modelos)
        if (tweetsRaw && typeof tweetsRaw === 'object' && !Array.isArray(tweetsRaw)) {
            tweets = tweetsRaw.tweets || tweetsRaw.thread || tweetsRaw.hilo || Object.values(tweetsRaw).find(Array.isArray);
        }

        if (!Array.isArray(tweets) || tweets.length === 0) {
            throw new Error("La IA no devolvió un array válido de tweets.");
        }
        return tweets;
    } catch (error) {
        console.error("[❌ IA Service Client] Failed to generate Tweet Thread:", error.message);
        return null;
    }
}

async function auditarSesgoPeriodistico(textoCrudo, promptName = 'analyzer_audit') {
    console.log(`[🤖 IA Service Client] Encolando auditoría profunda de sesgo...`);

    const prompt = promptManager.getPrompt(promptName, { textoCrudo: textoCrudo.substring(0, 3000) });
    if (!prompt) throw new Error(`Prompt '${promptName}' no encontrado.`);

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 0); // Usamos modelo Tier 0 (Gemini Flash) para esta tarea analítica
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ IA Service Client] Error en auditoría de sesgo:", error.message);
        return null;
    }
}

async function generarTituloSolo(resumen, promptName = 'neutralizer_title') {
    // ... same as before
    console.log(`[🤖 IA Service Client] Encolando micro-tarea: Generación de título faltante...`);

    const prompt = promptManager.getPrompt(promptName, { resumen });
    if (!prompt) throw new Error(`Prompt '${promptName}' no encontrado.`);

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 4);
        const json = JSON.parse(responseText);
        return json.neutral_title || null;
    } catch (error) {
        console.error("[❌ IA Service Client] Micro-task title generation failed:", error.message);
        return null;
    }
}

async function corregirIdiomaJson(payloadStr, promptName = 'translator_correction') {
    console.log(`[🤖 IA Service Client] Encolando tarea de post-procesamiento (Traducción/Corrección)...`);

    const prompt = promptManager.getPrompt(promptName, { payloadStr });
    if (!prompt) throw new Error(`Prompt '${promptName}' no encontrado.`);

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 2);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ IA Service Client] Error en corrección de idioma:", error.message);
        return null;
    }
}

async function generarVarianteSimple(promptStr) {
    console.log(`[🤖 IA Service Client] Encolando consulta de QC / Sanidad...`);
    try {
        const responseText = await enqueueAndAwaitResult(promptStr, false, 4); // JSON no restrictivo para QC
        return responseText;
    } catch (error) {
        console.error("[❌ IA Service Client] Error en consulta simple QC:", error.message);
        throw error;
    }
}

async function generarHiloAuditoriaDiaria(datosCrudos, promptName = 'twitter_audit_daily') {
    console.log(`[🤖 IA Service Client] Encolando generación de Hilo de Auditoría Diaria...`);

    const prompt = promptManager.getPrompt(promptName, { datosCrudos: JSON.stringify(datosCrudos, null, 2) });
    if (!prompt) throw new Error(`Prompt '${promptName}' no encontrado.`);

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 4);

        // Limpiamos posibles bloques markdown
        const cleanedText = responseText.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();

        try {
            let tweets = JSON.parse(cleanedText);

            // Fallback si la IA devuelve un objeto en lugar de un array
            if (tweets && typeof tweets === 'object' && !Array.isArray(tweets)) {
                tweets = Object.values(tweets).map(val => {
                    if (Array.isArray(val)) return val.join(' ');
                    return typeof val === 'string' ? val : JSON.stringify(val);
                }).filter(Boolean);
            }

            if (!Array.isArray(tweets) || tweets.length === 0) {
                throw new Error("La IA no devolvió un array válido de tweets para la auditoría.");
            }
            return tweets;
        } catch (parseErr) {
            console.error(`[❌ IA Service Client] Falló JSON parse. Texto Crudo: \n>>>\n${cleanedText}\n<<<`);
            throw parseErr;
        }
    } catch (error) {
        console.error("[❌ IA Service Client] Failed to generate Audit Thread:", error.message);
        return null;
    }
}

module.exports = {
    generarVariantesDeNoticia,
    analizarYExtraerCrudo,
    esNoticiaDePoliticaOEconomiaArgentina,
    generarTweetViral,
    auditarSesgoPeriodistico,
    generarTituloSolo,
    corregirIdiomaJson,
    generarHiloAuditoriaDiaria,
    generarVarianteSimple,
    generarNoticiaNeutral
};

