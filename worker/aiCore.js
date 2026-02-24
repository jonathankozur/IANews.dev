require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Check if API key exists
if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  WARNING: GEMINI_API_KEY is missing in .env. LLM calls will fail.");
}

const ai = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

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
    if (!ai) throw new Error("GEMINI_API_KEY no está configurada.");

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
                console.warn(`[🔄 IA Core] Error o cuota en ${modelName}. Cambiando a modelo de respaldo: ${AVAILABLE_MODELS[modelIndex + 1]}...`);
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

                console.warn(`[⏳ IA Core] TODOS los modelos gratuitos agotados (Toparon la cuota). Esperando ${Math.round(delayMs / 1000)} segundos antes de reiniciar el ciclo... (Quedan ${maxGlobalRetries - retryCount} intentos globales)`);
                await wait(delayMs);

                // Reintentar desde el mejor modelo (índice 0)
                return callGeminiWithRetry(prompt, isJson, 0, retryCount + 1);
            }
        }

        // Si se agotaron los reintentos globales, o no es un error de cuota/servidor
        throw error;
    }
}

module.exports = { callGeminiWithRetry, wait };
