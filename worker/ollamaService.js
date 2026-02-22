require('dotenv').config();
const axios = require('axios');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

console.log(`[🤖 Ollama Service] Inicializando conexión con Ollama en ${OLLAMA_HOST} (Modelo: ${OLLAMA_MODEL})`);

async function callOllama(prompt, jsonFormat = false) {
    const url = `${OLLAMA_HOST}/api/generate`;

    const payload = {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false
    };

    if (jsonFormat) {
        payload.format = "json";
    }

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.response) {
            return response.data.response;
        } else {
            throw new Error("Respuesta inválida de Ollama");
        }
    } catch (error) {
        console.error(`[❌ Ollama Service] Error llamando a Ollama API:`, error.message);
        throw error;
    }
}

async function analizarYExtraerCrudo(textoCrudo, titulo) {
    console.log(`[🤖 Ollama Service] Analizando sesgo original y extrayendo hechos objetivos...`);

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
        const text = await callOllama(prompt, true);
        return JSON.parse(text);
    } catch (error) {
        console.error("[❌ Ollama Service] Error analizando artículo crudo:", error.message);
        return null; // Worker retries
    }
}

async function generarVariantesDeNoticia(hechosObjetivos) {
    console.log(`[🤖 Ollama Service] Procesando hechos con Ollama para i18n: "${hechosObjetivos.substring(0, 50)}..."`);

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
        const responseText = await callOllama(prompt, true);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ Ollama Service] Failed to generate or parse AI content:", error.message);
        return null;
    }
}

async function esNoticiaDePoliticaOEconomiaArgentina(titulo, texto) {
    if (!texto || texto.length < 100) return false;

    const lowerTitle = titulo.toLowerCase();
    const blacklist = ['horóscopo', 'gran hermano', 'farándula', 'clima', 'pronóstico', 'espectáculos', 'cine', 'netflix'];
    if (blacklist.some(word => lowerTitle.includes(word))) return false;

    console.log(`[🤖 Ollama Service] Evaluando relevancia temática: "${titulo}"`);

    const prompt = `
Determina si el siguiente artículo trata DIRECTAMENTE de POLÍTICA o ECONOMÍA ARGENTINA.
Si es sobre espectáculos, farándula, deportes, clima, responde false.
Si es sobre el Presidente, ministros, leyes, inflación, dólar, Congreso, gobernadores, etc., devuelve true.

Título: "${titulo}"
Extracto: "${texto.substring(0, 600)}"

Reglas: Responde ÚNICAMENTE un JSON válido con esta estructura: {"es_relevante": true} o {"es_relevante": false}
`;

    try {
        const responseText = await callOllama(prompt, true);
        const jsonResponse = JSON.parse(responseText);
        return jsonResponse.es_relevante === true;
    } catch (error) {
        console.error("[❌ Ollama Service] Filter checking failed:", error.message);
        return true; // Fallback so we don't drop news on error
    }
}

async function generarTweetViral(noticia) {
    // Basic placeholder if needed in the future
    return "¡Mira esta nueva noticia en IANews!";
}

module.exports = {
    generarVariantesDeNoticia,
    analizarYExtraerCrudo,
    esNoticiaDePoliticaOEconomiaArgentina,
    generarTweetViral
};
