require('dotenv').config();

async function callGroq(prompt, isJson = false) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY no está configurada en el archivo .env.");

    // Llama 3.1 8B Instant suele ser excelente para tareas rápidas y es gratis.
    // Llama 3.1 8B Instant suele ser excelente para tareas rápidas y es gratis.
    // También podría ser 'llama-3.3-70b-versatile'
    const modelName = "llama-3.3-70b-versatile";

    const body = {
        model: modelName,
        messages: [{ role: "user", content: prompt }]
    };

    if (isJson) {
        body.response_format = { type: "json_object" };
    }

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        return content;
    } catch (error) {
        throw new Error(`[Groq Core] Falló la petición a Groq: ${error.message}`);
    }
}

module.exports = { callGroq };
