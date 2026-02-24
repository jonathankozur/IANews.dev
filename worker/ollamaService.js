require('dotenv').config();
const supabase = require('./supabaseClient');

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
            console.error("[❌ Ollama Client] Error encolando solicitud:", error.message);
            throw error;
        }

        const requestId = data.id;
        console.log(`[🕒 Ollama Client] Solicitud encolada (ID: ${requestId.substring(0, 8)}...). Esperando respuesta (polling cada ${POLL_INTERVAL_MS / 1000}s)...`);

        while (true) {
            await wait(POLL_INTERVAL_MS);

            const { data: checkData, error: checkError } = await supabase
                .from('ia_request_queue')
                .select('status, result, error_msg')
                .eq('id', requestId)
                .single();

            if (checkError) {
                console.error(`[❌ Ollama Client] Error consultando estado (ID: ${requestId.substring(0, 8)}...):`, checkError.message);
                continue;
            }

            if (checkData.status === 'DONE') {
                return checkData.result;
            } else if (checkData.status === 'FAILED') {
                throw new Error(checkData.error_msg || "Falló el procesamiento de Ollama en el Worker Central.");
            }
        }
    } catch (error) {
        throw error;
    }
}

async function analizarYExtraerCrudo(textoCrudo, titulo) {
    console.log(`[🤖 Ollama Client] Analizando sesgo original y extrayendo hechos objetivos...`);

    const prompt = `
Eres un analista político y lingüístico experto. Tu tarea es analizar el siguiente artículo periodístico y realizar dos acciones específicas:

1. Calcular el Sesgo Original: Determina si el texto está inclinado a la 'Izquierda', 'Derecha', o si es de 'Centro'. Calcula un porcentaje de qué tan fuerte es ese sesgo (0 a 100).
2. Extraer Hechos: Escribe un resumen completamente frío, neutral e impersonal (máximo 80-100 palabras) usando solo los hechos comprobables, eliminando adjetivos emocionales o de opinión.

Título: "${titulo}"
Texto Original: "${textoCrudo.substring(0, 3000)}"

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido usando esta estructura exacta:
{
  "original_bias_direction": "Centro",
  "original_bias_score": 0,
  "objective_summary": "Resumen neutral..."
}
`;

    try {
        const text = await enqueueAndAwaitResult(prompt, true);
        return JSON.parse(text);
    } catch (error) {
        console.error("[❌ Ollama Client] Error analizando artículo crudo:", error.message);
        return null;
    }
}

async function generarVariantesDeNoticia(hechosObjetivos) {
    console.log(`[🤖 Ollama Client] Procesando hechos con Ollama para i18n: "${hechosObjetivos.substring(0, 50)}..."`);

    const prompt = `
Eres un analista de noticias global y editor web enfocado en la viralidad.
Se te dará un conjunto de hechos objetivos neutrales en español.
Tu tarea es escribir tres versiones breves (aprox 2 párrafos cada una) del artículo adaptadas a tres corrientes ideológicas diferentes.
DEBES HACER ESTO PARA DOS IDIOMAS SIMULTÁNEAMENTE: Español ('es') e Inglés ('en').

INTRUCCION CRITICA 1: Los títulos ("title") de CADA versión en AMBOS idiomas deben ser EXTREMADAMENTE CLICKBAIT, virales y de alto impacto emocional. Usa frases fuertes, mayúsculas ocasionales y plantea interrogantes.
INTRUCCION CRITICA 2: Además del clickbait, provee un "label" corto para cada perspectiva.
INTRUCCION CRITICA 3: Analiza la relevancia geográfica y asigna el ISO Alpha-2 (Ej 'AR', 'US'). Si es global asigna 'GLOBAL'.

Corrientes Clásicas:
1. Izquierda/Postura A (Enfoque social, regulación, trabajador).
2. Centro/Postura B (Enfoque neutral, equilibrado, hechos fríos).
3. Derecha/Postura C (Enfoque en mercado, libertad, desregulación).

Asigna un "sentiment_score" del -1.0 (muy negativo) al 1.0 (muy positivo).

Hechos Objetivos: "${hechosObjetivos}"

IMPORTANTE: TU RESPUESTA DEBE SER ÚNICAMENTE UN JSON VÁLIDO CON LA SIGUIENTE ESTRUCTURA EXACTA.
{
  "geo_target": "AR",
  "category": "Política",
  "translations": [
    {
      "language": "es",
      "objective_summary": "String",
      "left": { "label": "Social", "title": "String", "content": "String", "sentiment": 0.0 },
      "center": { "label": "Neutral", "title": "String", "content": "String", "sentiment": 0.0 },
      "right": { "label": "Mercado", "title": "String", "content": "String", "sentiment": 0.0 }
    },
    {
      "language": "en",
      "objective_summary": "String",
      "left": { "label": "Social", "title": "String", "content": "String", "sentiment": 0.0 },
      "center": { "label": "Neutral", "title": "String", "content": "String", "sentiment": 0.0 },
      "right": { "label": "Market", "title": "String", "content": "String", "sentiment": 0.0 }
    }
  ]
}`;

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ Ollama Client] Failed to generate or parse AI content:", error.message);
        return null;
    }
}

async function esNoticiaDePoliticaOEconomiaArgentina(titulo, texto) {
    if (!texto || texto.length < 100) return false;

    const lowerTitle = titulo.toLowerCase();
    const blacklist = ['horóscopo', 'gran hermano', 'farándula', 'clima', 'pronóstico', 'espectáculos', 'cine', 'netflix'];
    if (blacklist.some(word => lowerTitle.includes(word))) return false;

    console.log(`[🤖 Ollama Client] Evaluando relevancia temática: "${titulo}"`);

    const prompt = `
Determina si el siguiente artículo trata DIRECTAMENTE de POLÍTICA o ECONOMÍA ARGENTINA.
Si es sobre espectáculos, farándula, deportes, clima, responde false.
Si es sobre el Presidente, ministros, leyes, inflación, dólar, Congreso, gobernadores, etc., devuelve true.

Título: "${titulo}"
Extracto: "${texto.substring(0, 600)}"

Reglas: Responde ÚNICAMENTE un JSON válido con esta estructura: {"es_relevante": true} o {"es_relevante": false}
`;

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true);
        const jsonResponse = JSON.parse(responseText);
        return jsonResponse.es_relevante === true;
    } catch (error) {
        console.error("[❌ Ollama Client] Filter checking failed:", error.message);
        return true;
    }
}

async function generarTweetViral(noticia) {
    return "¡Mira esta nueva noticia en IANews!";
}

async function auditarSesgoPeriodistico(textoCrudo) {
    console.log(`[🤖 Ollama Client] Iniciando Auditoría Forense de Sesgo...`);

    const prompt = `
Eres un riguroso auditor de medios y experto en análisis del discurso periodístico.
Tu misión es diseccionar el siguiente artículo crudo para encontrar las huellas de su sesgo ideológico, la ideología subyacente que promociona, y las tácticas de manipulación que emplea para alterar la percepción del lector.

Artículo original:
"${textoCrudo.substring(0, 4000)}"

Reglas estrictas de salida:
Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta:
{
  "detected_bias": "String corto",
  "manipulation_tactics": ["Táctica 1", "Táctica 2", "Táctica 3"],
  "omitted_context": "String explicando qué falta",
  "fact_checks": [
    {
      "claim": "La afirmación concreta",
      "truth": "El contexto u otra perspectiva",
      "is_false": false
    }
  ] 
}
`;

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ Ollama Client] Falló la auditoría forense:", error.message);
        return null;
    }
}

module.exports = {
    generarVariantesDeNoticia,
    analizarYExtraerCrudo,
    esNoticiaDePoliticaOEconomiaArgentina,
    generarTweetViral,
    auditarSesgoPeriodistico
};
