const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios'); // Asegurarnos de usar axios o fetch nativo (Node 18+)

// Cargar config general
require('dotenv').config({ path: require('path').join(__dirname, '../../worker/.env') });

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

/**
 * Servicio Centralizado de IA para workers V2.
 * Permite usar Ollama (default), Gemini, Groq, OpenRouter.
 */
async function generateContent(prompt, options = {}) {
    // defaults
    const provider = options.provider || 'ollama';
    const isJson = options.isJson || false;
    const jsonSchema = options.jsonSchema;
    const temperature = options.temperature;
    const top_p = options.top_p;

    console.log(`[🤖 AI Service V2] Solicitando inference a: ${provider.toUpperCase()}${isJson ? ' (Modo JSON)' : ''} [Temp: ${temperature ?? 'default'}]`);

    try {
        switch (provider.toLowerCase()) {
            case 'ollama':
                return await _callOllama(prompt, isJson, temperature, top_p, jsonSchema);
            case 'gemini':
                return await _callGemini(prompt, isJson, temperature, top_p, jsonSchema);
            case 'groq':
                return await _callGroq(prompt, isJson, temperature, top_p, jsonSchema);
            case 'openrouter':
                return await _callOpenRouter(prompt, isJson, temperature, top_p, jsonSchema);
            default:
                throw new Error(`Proveedor de IA desconocido: ${provider}`);
        }
    } catch (error) {
        console.error(`[❌ AI Service V2] Falló llamada a ${provider}:`, error.message);
        throw error;
    }
}

// ========================
// IMPLEMENTACIONES LOCALES
// ========================

async function _callOllama(prompt, isJson, temperature, top_p, jsonSchema) {
    const url = `${OLLAMA_HOST}/api/generate`;
    const body = {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {}
    };

    if (isJson) {
        body.format = jsonSchema ? jsonSchema : "json";
    }

    // Inyectar parámetros si fueron provistos
    if (temperature !== undefined) body.options.temperature = temperature;
    if (top_p !== undefined) body.options.top_p = top_p;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minutos timeout

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Ollama Falló: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response.trim();
    } catch (err) {
        throw new Error(`Ollama Error de Red: ${err.message}`);
    }
}

/* --- HELPER GEMINI --- */
const GEMINI_AVAILABLE_MODELS = [
    "gemini-3.1-pro-preview",
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite"
];
const _waitMs = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function _executeGeminiWithRetry(prompt, isJson, temperature, top_p, jsonSchema, genAI, modelIndex = 0, retryCount = 0) {
    const modelName = GEMINI_AVAILABLE_MODELS[modelIndex];

    const config = {};
    if (isJson) config.responseMimeType = "application/json";
    if (temperature !== undefined) config.temperature = temperature;
    if (top_p !== undefined) config.topP = top_p;

    const modelObj = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: config
    });

    try {
        const result = await modelObj.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        const isRecoverableError = error.status === 429 || error.status >= 500 ||
            (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota') || error.message.includes('503')));

        if (isRecoverableError) {
            if (modelIndex < GEMINI_AVAILABLE_MODELS.length - 1) {
                console.warn(`    [🔄 IA Service] Error o cuota en ${modelName}. Cambiando a modelo: ${GEMINI_AVAILABLE_MODELS[modelIndex + 1]}`);
                return _executeGeminiWithRetry(prompt, isJson, temperature, top_p, jsonSchema, genAI, modelIndex + 1, retryCount);
            }

            const maxGlobalRetries = 3;
            if (retryCount < maxGlobalRetries) {
                let delayMs = 60000;

                if (error.retryDelay) delayMs = error.retryDelay * 1000;
                else if (error?.response?.retryDelay) delayMs = error.response.retryDelay * 1000;
                else if (error.message) {
                    const match = error.message.match(/retryDelay.*?(\d+)/i);
                    if (match) delayMs = parseInt(match[1], 10) * 1000;
                }

                delayMs = Math.max(delayMs, 15000) + 1000;
                console.warn(`    [⏳ IA Service] Modelos agotados. Esperando ${Math.round(delayMs / 1000)}s... (Intentos restantes: ${maxGlobalRetries - retryCount})`);
                await _waitMs(delayMs);

                return _executeGeminiWithRetry(prompt, isJson, temperature, top_p, jsonSchema, genAI, 0, retryCount + 1);
            }
        }
        throw error;
    }
}

async function _callGemini(prompt, isJson, temperature, top_p, jsonSchema) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY no configurada.");

    const genAI = new GoogleGenerativeAI(apiKey);
    return await _executeGeminiWithRetry(prompt, isJson, temperature, top_p, jsonSchema, genAI, 0, 0);
}

async function _callGroq(prompt, isJson, temperature, top_p, jsonSchema) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY no configurada.");

    const payload = {
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile", // V1 default
        messages: [{ role: "user", content: prompt }],
        response_format: isJson ? { type: "json_object" } : { type: "text" }
    };

    if (temperature !== undefined) payload.temperature = temperature;
    if (top_p !== undefined) payload.top_p = top_p;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errDesc = await response.text();
        throw new Error(`Groq HTTP ${response.status}: ${errDesc}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

async function _callOpenRouter(prompt, isJson, temperature, top_p, jsonSchema) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY no configurada.");

    const payload = {
        model: process.env.OPENROUTER_MODEL || "google/gemma-3-12b-it:free",
        messages: [{ role: "user", content: prompt }]
    };

    if (isJson) {
        payload.response_format = { type: "json_object" };
    }

    if (temperature !== undefined) payload.temperature = temperature;
    if (top_p !== undefined) payload.top_p = top_p;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "http://localhost:3000",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errDesc = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${errDesc}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(`OpenRouter Model Error: ${data.error.message}`);
    }

    let content = data.choices[0].message.content.trim();

    // Limpiamos los backticks de markdown (vital para modelos como gemma-3 que los insertan incluso en JSON mode)
    if (isJson && content) {
        content = content.replace(/^```[a-zA-Z]*\n?|```$/gm, '').trim();
    }

    return content;
}

module.exports = {
    generateContent
};
