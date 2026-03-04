require('dotenv').config({ path: require('path').join(__dirname, '../worker/.env') });
const supabase = require('./config/supabase');
const { generateContent } = require('./core/ai_service');

/**
 * QC 1-A: El Sanador Sintáctico (Anti-Inglés)
 * Fuerza la traducción al español. Las IAs a veces alucinan en inglés al procesar JSONs o analizar.
 */
async function qcLanguageSanitizer(text, aiProvider) {
    if (!text || text.trim().length === 0) return text;

    // 1. Verificación rápida (solo los primeros 500 caracteres)
    const checkPrompt = `
Eres un detector de idiomas estricto. Analiza este texto y responde ÚNICAMENTE con la palabra "SI" si la mayor parte del texto está en Español. Si está en Inglés u otro idioma, responde "NO". No des explicaciones.

Texto: 
"""
${text.substring(0, 500)}
"""
`;
    console.log(`    [Idioma] Verificando si requiere traducción...`);
    const checkResponse = await generateContent(checkPrompt, { provider: aiProvider, isJson: false, temperature: 0.1 });

    if (checkResponse.toUpperCase().includes("SI")) {
        console.log(`    [Idioma] El texto ya está en Español. Omitiendo traducción masiva.`);
        return text.trim();
    }

    // 2. Traducción Pesada (Solo si es necesario)
    console.log(`    [Idioma] Se detectó idioma extranjero. Iniciando traducción completa...`);
    const translatePrompt = `
Actúa como un traductor estricto.
Traduce el siguiente texto al Español de Argentina de manera fiel y literal. No agregues saludos ni comentarios.

Texto original:
"""
${text}
"""
`;
    const sanitized = await generateContent(translatePrompt, { provider: aiProvider, isJson: false, temperature: 0.1 });
    return sanitized.trim();
}

/**
 * QC 1-B: Juez Estructural (Código duro)
 * Verifica que el JSON devuelto contenga exactamente lo que necesitamos y repara fallas menores.
 */
function qcStructuralJudge(jsonRaw) {
    try {
        // Limpieza de Markdown residual (ej: ```json ... ```)
        let cleaned = jsonRaw.replace(/^```json/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(cleaned);

        const requiredKeys = ['biased_fragments', 'manipulation_tactics', 'fact_checking_text', 'full_analysis_text', 'bias', 'bias_score'];
        for (const key of requiredKeys) {
            if (parsed[key] === undefined) {
                throw new Error(`Falta la clave requerida: ${key}`);
            }
        }

        // Parseo seguro de array de fragmentos
        if (!Array.isArray(parsed.biased_fragments)) parsed.biased_fragments = [];
        if (!Array.isArray(parsed.manipulation_tactics)) parsed.manipulation_tactics = [];

        // Conversión segura de bias_score
        parsed.bias_score = parseFloat(parsed.bias_score) || 0;

        return parsed;
    } catch (e) {
        throw new Error(`Fallo QC 1-B Estructural: El LLM no devolvió un JSON válido. Info: ${e.message}`);
    }
}

/**
 * Función principal del analizador
 */
async function runAnalyzer(isTestMode = false, aiProvider = 'ollama', specificId = null) {
    console.log(`🚀 Iniciando Fase 1: Analizador de Sesgo V2 (Motor IA: ${aiProvider.toUpperCase()}) ...`);

    // 1. Buscar artículos pendientes
    let query = supabase.from('v2_articles').select('*').eq('status', 'PENDING_ANALYSIS');

    if (specificId) {
        console.log(`\n🔗 Modo ID Directo: Filtrando por artículo ID: ${specificId}`);
        query = query.eq('id', specificId);
    } else {
        const limit = isTestMode ? 1 : 10;
        query = query.order('created_at', { ascending: true }).limit(limit);
    }

    const { data: articles, error: fetchError } = await query;

    if (fetchError) {
        console.error("❌ Error leyendo PENDING_ANALYSIS:", fetchError.message);
        process.exit(1);
    }

    if (!articles || articles.length === 0) {
        console.log("💤 No hay noticias pendientes de análisis.");
        process.exit(0);
    }

    let itemsProcessed = 0;

    for (const article of articles) {
        console.log(`\n======================================================`);
        console.log(`🧠 Analizando [ID: ${article.id.substring(0, 8)}] - ${article.raw_title}`);
        console.log(`======================================================`);

        try {
            // QC 1-A: Sanitización del Raw content por las dudas (Asegurar español puro antes de analizar)
            console.log(`  [QC 1-A] Verificando y sanitizando idioma...`);
            const safeTitle = await qcLanguageSanitizer(article.raw_title, aiProvider);
            const safeBody = await qcLanguageSanitizer(article.raw_body, aiProvider);

            // Armar el prompt profundo de análisis
            const prompt = `
Eres un analista experto en medios, periodismo y sesgos cognitivos.
Analiza exhaustivamente la siguiente noticia buscando sesgos de izquierda, derecha, oficialistas, opositores o amarillismos.

Título: "${safeTitle}"
Cuerpo: """${safeBody.substring(0, 4000)}"""

Devuelve UNICAMENTE un objeto JSON estrictamente válido con la siguiente estructura:
{
  "biased_fragments": [
    { 
      "quote": "Cita EXACTA Y TEXTUAL (copiar y pegar) extraída directamente del cuerpo crudo que demuestra el sesgo. No inventes ni resumas la frase. Si no hay una cita textual evidente, el array 'biased_fragments' debe quedar VACÍO [].",
      "explanation": "Explicación muy precisa de por qué esa cita en particular revela sesgo o subjetividad periodística." 
    }
  ],
  "manipulation_tactics": ["Táctica 1", "Táctica 2"],
  "fact_checking_text": "Un párrafo realizando fact-checking, desmintiendo o aportando contexto ausente a los datos de la noticia.",
  "full_analysis_text": "Análisis completo redactado sobre el sesgo general de la noticia.",
  "bias": "Clasificación principal (Ej: Izquierda, Derecha, Centro, Oficialista, Opositor, Amarillista)",
  "bias_score": <numero decimal de 0 a 100, donde 100 es máximo sesgo y manipulación, y 0 es periodismo totalmente neutral>
}

REGLAS EXTREMAS:
- El idioma de salida debe ser ESPAÑOL.
- El campo "quote" DEBE existir literalmente en el CUERPO CRUDO provisto. Si alucinas una frase que no está en el texto original, fallarás la prueba.
- Si la noticia es 100% neutral y no tiene frases sesgadas comprobables, la lista "biased_fragments" debe ser [].
- "manipulation_tactics" debe ser un array de strings de máximo 3 palabras (ej: "Ad Hominem", "Falso Dilema", "Lenguaje Emocional", etc).
- No incluyas explicaciones fuera del JSON. 
- Formato JSON estricto.
`;

            console.log(`  [LLM] Enviando prompt analítico a ${aiProvider.toUpperCase()}...`);
            const rawResponse = await generateContent(prompt, { provider: aiProvider, isJson: true, temperature: 0.1, top_p: 0.2 });

            // QC 1-B: Juez Estructural
            console.log(`  [QC 1-B] Validando estructura JSON devuelta...`);
            const analysisData = qcStructuralJudge(rawResponse);

            console.log(`  ✅ Análisis Exitoso. Bias Score: ${analysisData.bias_score}`);

            // Guardar resultados
            const { error: updateError } = await supabase
                .from('v2_articles')
                .update({
                    status: 'PENDING_NEUTRALIZATION',
                    biased_fragments: analysisData.biased_fragments,
                    manipulation_tactics: analysisData.manipulation_tactics,
                    fact_checking_text: analysisData.fact_checking_text,
                    full_analysis_text: analysisData.full_analysis_text,
                    bias: analysisData.bias,
                    bias_score: analysisData.bias_score,
                    retries_count: 0,
                    last_error_log: null
                })
                .eq('id', article.id);

            if (updateError) {
                console.error(`  ❌ Error guardando en BD:`, updateError.message);
            } else {
                console.log(`  💾 Artículo actualizado a PENDING_NEUTRALIZATION.`);
                itemsProcessed++;
            }

        } catch (error) {
            console.error(`  ❌ Error procesando el artículo:`, error.message);

            // Incrementar retries
            const newRetries = (article.retries_count || 0) + 1;
            const newStatus = newRetries >= 3 ? 'ANALYSIS_FAILED' : 'PENDING_ANALYSIS';
            await supabase.from('v2_articles').update({
                retries_count: newRetries,
                last_error_log: error.message,
                status: newStatus
            }).eq('id', article.id);

            console.log(`  ⚠️ Marcado con error. Intento ${newRetries}/3. Estado: ${newStatus}`);
        }
    }

    console.log(`\n🏁 Finish: Fase 1 completada. ${itemsProcessed} artículos analizados.`);
    process.exit(0);
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const isTestMode = args.includes('--test');

    let provider = 'ollama';
    const aiArg = args.find(a => a.startsWith('--ai='));
    if (aiArg) {
        provider = aiArg.split('=')[1].toLowerCase();
    }

    let specificId = null;
    const idArg = args.find(a => a.startsWith('--id='));
    if (idArg) {
        specificId = idArg.split('=')[1];
    }

    runAnalyzer(isTestMode, provider, specificId);
}

module.exports = { runAnalyzer };
