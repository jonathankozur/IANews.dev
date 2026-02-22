require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Check if API key exists
if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  WARNING: GEMINI_API_KEY is missing in .env. LLM calls will fail.");
}

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const AVAILABLE_MODELS = [
    "gemini-3.1-pro-preview",   // Highest quality, latest generation
    "gemini-3-pro-preview",     // High quality fallback
    "gemini-2.5-pro",           // Stable high quality
    "gemini-3-flash-preview",   // Fast, next-gen
    "gemini-2.5-flash",         // Fast, stable (Current primary workhorse)
    "gemini-2.0-flash",         // Fast, older generation
    "gemini-2.5-flash-lite",    // Fastest/Cheapest stable
    "gemini-2.0-flash-lite"     // Last resort fallback
];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiWithRetry(prompt, isJson = false, modelIndex = 0, retryCount = 0) {
    const config = isJson ? { responseMimeType: "application/json" } : {};
    const modelName = AVAILABLE_MODELS[modelIndex];
    const model = ai.getGenerativeModel({ model: modelName });

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: config
        });
        return result.response.text();
    } catch (error) {
        // Capturar errores de cuota (429) o errores de servidor (503/500) que se puedan solucionar cambiando de modelo
        const isRecoverableError = error.status === 429 || error.status >= 500 ||
            (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota') || error.message.includes('503')));

        if (isRecoverableError) {
            // 1. INTENTO DE FAILOVER A OTRO MODELO
            if (modelIndex < AVAILABLE_MODELS.length - 1) {
                console.warn(`[🔄 IA Service] Error o cuota en ${modelName}. Cambiando a modelo de respaldo: ${AVAILABLE_MODELS[modelIndex + 1]}...`);
                return callGeminiWithRetry(prompt, isJson, modelIndex + 1, retryCount);
            }

            // 2. TODOS LOS MODELOS AGOTADOS. APLICAR BACKOFF SLEEP
            const maxGlobalRetries = 3;
            if (retryCount < maxGlobalRetries) {
                let delayMs = 60000; // Default 60s

                if (error.retryDelay) delayMs = error.retryDelay * 1000;
                else if (error?.response?.retryDelay) delayMs = error.response.retryDelay * 1000;
                else if (error.message) {
                    const match = error.message.match(/retryDelay.*?(\d+)/i);
                    if (match) delayMs = parseInt(match[1], 10) * 1000;
                }

                // Mínimo 15 segundos extra de gracia por sobre el estimado
                delayMs = Math.max(delayMs, 15000) + 1000;

                console.warn(`[⏳ IA Service] TODOS los modelos gratuitos agotados (Toparon la cuota). Esperando ${Math.round(delayMs / 1000)} segundos antes de reiniciar el ciclo... (Quedan ${maxGlobalRetries - retryCount} intentos globales)`);
                await wait(delayMs);

                // Reintentar desde el mejor modelo (índice 0)
                return callGeminiWithRetry(prompt, isJson, 0, retryCount + 1);
            }
        }

        // Si se agotaron los reintentos globales, o no es un error de cuota/servidor
        throw error;
    }
}

async function analizarYExtraerCrudo(textoCrudo, titulo) {
    console.log(`[🤖 IA Service] Analizando sesgo original y extrayendo hechos objetivos...`);

    const prompt = `
Eres un analista político y lingüístico experto. Tu tarea es analizar el siguiente artículo periodístico y realizar dos acciones específicas:

1. Calcular el Sesgo Original: Determina si el texto está inclinado a la 'Izquierda', 'Derecha', o si es de 'Centro'. Calcula un porcentaje de qué tan fuerte es ese sesgo (0 a 100).
2. Extraer Hechos: Escribe un resumen completamente frío, neutral e impersonal (máximo 80-100 palabras) usando solo los hechos comprobables, eliminando adjetivos emocionales o de opinión.

Título: "${titulo}"
Texto Original: "${textoCrudo.substring(0, 3000)}"

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido usando esta estructura exacta:
{
  "original_bias_direction": "Izquierda" | "Derecha" | "Centro",
  "original_bias_score": Número de 0 a 100,
  "objective_summary": "String con el resumen neutral"
}
`;

    try {
        const responseText = await callGeminiWithRetry(prompt, true);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ IA Service] Failed to analyze and extract facts:", error.message);
        return null; // The worker will handle the retry logic
    }
}

async function generarVariantesDeNoticia(hechosObjetivos) {
    console.log(`[🤖 IA Service] Procesando hechos con Gemini para i18n: "${hechosObjetivos.substring(0, 50)}..."`);

    const prompt = `
Eres un analista de noticias global y editor web enfocado en la viralidad.
Se te dará un conjunto de hechos objetivos neutrales en español.
Tu tarea es escribir tres versiones breves (aprox 2 párrafos cada una) del artículo adaptadas a tres corrientes ideológicas diferentes.
DEBES HACER ESTO PARA DOS IDIOMAS SIMULTÁNEAMENTE: Español ('es') e Inglés ('en').

INTRUCCION CRITICA 1: Los títulos ("title") de CADA versión en AMBOS idiomas deben ser EXTREMADAMENTE CLICKBAIT, virales y de alto impacto emocional, diseñados para que el lector haga clic inmediatamente. Usa frases fuertes, mayúsculas ocasionales y plantea interrogantes si es necesario.
INTRUCCION CRITICA 2: Además del clickbait, provee un "label" corto para cada perspectiva que describa a quién va dirigida esta variante según la temática de la noticia (Ej: Fanático X / Neutral / Fanático Y).
INTRUCCION CRITICA 3: Analiza la relevancia geográfica de la noticia y asigna el ISO Alpha-2 (Ej 'AR', 'US', 'ES', 'MX'). Si es una noticia de impacto global (Ej: guerra, tech big tech, pandemia) asigna 'GLOBAL'.

Corrientes Clásicas (usar como guía abstracta):
1. Izquierda/Postura A (Enfoque social, regulación, trabajador, fanático local, emocionado).
2. Centro/Postura B (Enfoque neutral, equilibrado, hechos fríos, impacto macroeconómico o deportivo analítico).
3. Derecha/Postura C (Enfoque en mercado, libertad, desregulación, fanático rival o crítico).

Asigna una categoría general única a esta noticia.
Asigna un "sentiment_score" del -1.0 (muy negativo) al 1.0 (muy positivo).

Hechos Objetivos: "${hechosObjetivos}"

IMPORTANTE: TU RESPUESTA DEBE SER ÚNICAMENTE UN JSON VÁLIDO CON LA SIGUIENTE ESTRUCTURA EXACTA. NADA MÁS.
{
  "geo_target": "String (ISO-2 o GLOBAL)",
  "category": "String",
  "translations": [
    {
      "language": "es",
      "objective_summary": "String",
      "left": { "label": "String", "title": "String", "content": "String", "sentiment": Number },
      "center": { "label": "String", "title": "String", "content": "String", "sentiment": Number },
      "right": { "label": "String", "title": "String", "content": "String", "sentiment": Number }
    },
    {
      "language": "en",
      "objective_summary": "String",
      "left": { "label": "String", "title": "String", "content": "String", "sentiment": Number },
      "center": { "label": "String", "title": "String", "content": "String", "sentiment": Number },
      "right": { "label": "String", "title": "String", "content": "String", "sentiment": Number }
    }
  ]
}`;

    try {
        const responseText = await callGeminiWithRetry(prompt, true);
        const jsonResponse = JSON.parse(responseText);

        return jsonResponse;

    } catch (error) {
        console.error("[❌ IA Service] Failed to generate or parse AI content:", error.message);

        // Return a mock / fallback
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

async function esNoticiaDePoliticaOEconomiaArgentina(titulo, texto) {
    if (!texto || texto.length < 100) return false;

    // Check local cache/rules quickly to avoid API call if obviously wrong
    const lowerTitle = titulo.toLowerCase();
    const blacklist = ['horóscopo', 'gran hermano', 'farándula', 'clima', 'pronóstico', 'espectáculos', 'cine', 'netflix'];
    if (blacklist.some(word => lowerTitle.includes(word))) return false;

    console.log(`[🤖 IA Service] Evaluando relevancia temática: "${titulo}"`);

    const prompt = `
Determina si el siguiente artículo trata DIRECTAMENTE de POLÍTICA o ECONOMÍA ARGENTINA.
Si es sobre espectáculos, farándula, chismes, policiales menores, deportes (salvo que implique política nacional), clima, o noticias internacionales que no afectan a Argentina, devuelve false.
Si es sobre el Presidente, ministros, leyes, inflación, dólar, cepo, Congreso, paritarias, gobernadores, etc., devuelve true.

Título: "${titulo}"
Extracto: "${texto.substring(0, 600)}"

Reglas:
1. Responde ÚNICAMENTE un JSON válido con esta estructura: {"es_relevante": boolean}
2. Sé exigente. Ante la duda de si es un policial suelto o nota de color, pon false.
`;

    try {
        // Use flash-lite if possible for cost-savings on filtering
        const responseText = await callGeminiWithRetry(prompt, true, 6); // Index 6 is usually gemini-2.5-flash-lite
        const jsonResponse = JSON.parse(responseText);
        return jsonResponse.es_relevante === true;
    } catch (error) {
        console.error("[❌ IA Service] Filter checking failed:", error.message);
        // Fallback to true if we hit errors to not drop news, but ideally monitor this
        return true;
    }
}

async function generarTweetViral(noticia) {
    console.log(`[🤖 IA Service] Generando gancho viral para Twitter (X)...`);

    const prompt = `
Eres un Community Manager experto en periodismo político y viralidad en Twitter/X.
Tu objetivo es redactar un (1) único tweet MUY ENGANCHADOR para promocionar un artículo de nuestro portal de noticias "IANews".
La particularidad de nuestro portal es que ofrecemos la misma noticia redactada desde tres enfoques (Izquierda, Centro y Derecha) para que la gente "salga de su burbuja".

Noticia: "${noticia.tituloOriginal}"
Resumen: "${noticia.resumen}"
Titular de Izquierda: "${noticia.izquierda}"
Titular de Derecha: "${noticia.derecha}"

Reglas estrictas para el Tweet:
1. MAXIMO 200 caracteres (dejaremos espacio para el link que se agregará después).
2. Tono incisivo, filoso o que incite al debate (muy al estilo del "Termo Político" o Twitter Argentina).
3. No uses hashtags molestos como #Noticias ni emoticons innecesarios (1 o 2 máximo).
4. Plantea el choque de visiones basado en los titulares de izquierda y derecha provistos.
5. NO incluyas a qué enlace deben hacer clic (eso lo manejo yo por código).
6. Responde ÚNICAMENTE con el texto del tweet, sin comillas alrededor ni texto introductorio. 
`;

    try {
        const text = await callGeminiWithRetry(prompt, false, 4); // Index 4 is gemini-2.5-flash
        return text.trim().replace(/^"|"$/g, ''); // Quita comillas si la IA decide ponerlas igual
    } catch (error) {
        console.error("[❌ IA Service] Failed to generate Tweet:", error.message);
        return null;
    }
}

module.exports = {
    generarVariantesDeNoticia,
    analizarYExtraerCrudo,
    esNoticiaDePoliticaOEconomiaArgentina,
    generarTweetViral
};
