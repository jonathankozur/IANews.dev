require('dotenv').config();
const axios = require('axios');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

console.log(`[🤖 Ollama Core] Inicializando motor Ollama en ${OLLAMA_HOST} (Modelo: ${OLLAMA_MODEL})`);

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
        console.error(`[❌ Ollama Core] Error llamando a Ollama API:`, error.message);
        throw error;
    }
}

module.exports = { callOllama };
