require('dotenv').config();

async function callOpenRouter(prompt, isJson = false) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY no está configurada en el archivo .env.");

    // Elegimos uno de los modelos gratuitos garantizados extraidos de la API hoy
    const modelName = "google/gemma-3-12b-it:free";

    const body = {
        model: modelName,
        messages: [{ role: "user", content: prompt }]
    };

    // Algunos modelos gratis en OpenRouter soportan formato JSON estricto
    if (isJson) {
        body.response_format = { type: "json_object" };
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "http://localhost:3000", // OpenRouter sugiere el HTTP Referer
                "X-Title": "IANews Worker",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();

            // Si el modo JSON falla porque el modelo no lo soporta, hacemos fallback a texto plano en el siguiente throw para debug
            throw new Error(`OpenRouter API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`OpenRouter Model Error: ${data.error.message}`);
        }

        let content = data.choices[0].message.content;

        // Limpiamos los backticks de markdown (google/gemma-3-12b-it:free suele enviarlos aunque response_format sea json)
        if (isJson && content) {
            content = content.replace(/^```json\n?|```$/gm, '').trim();
        }

        return content;
    } catch (error) {
        throw new Error(`[OpenRouter Core] Falló la petición: ${error.message}`);
    }
}

module.exports = { callOpenRouter };
