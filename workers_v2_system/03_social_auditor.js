require('dotenv').config({ path: require('path').join(__dirname, '../worker/.env') });
const supabase = require('./config/supabase');
const { generateContent } = require('./core/ai_service');

/**
 * QC 3-A: Validador Estructural y de Longitud (Twitter Validator)
 * Verifica que el LLM devuelva un array válido y que ningún tweet exceda los 280 caracteres.
 */
function qcTwitterThreadValidator(jsonRaw) {
    try {
        let cleaned = jsonRaw.replace(/^```json/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(cleaned);

        if (!parsed.tweet1 || !parsed.tweet2 || !parsed.tweet3) {
            throw new Error(`Falta alguno de los 3 tweets en el JSON devuelto.`);
        }

        const rawThread = [parsed.tweet1, parsed.tweet2, parsed.tweet3];
        const validThread = [];

        for (let i = 0; i < rawThread.length; i++) {
            let tweet = rawThread[i];

            // Añadir el contador visual [1/3] si no está presente
            const counter = `[${i + 1}/3]`;
            if (!tweet.includes(`[${i + 1}/`)) {
                tweet = `${counter} ${tweet}`;
            }

            if (tweet.length > 280) {
                console.warn(`    ⚠️ Tweet ${i + 1} excede 280 caracteres (${tweet.length}). Truncando de forma dura...`);
                // Dejamos margen para los '...'
                tweet = tweet.substring(0, 277) + '...';
            }

            validThread.push(tweet);
        }

        return validThread;
    } catch (e) {
        throw new Error(`Fallo QC 3-A Formato API Twitter: ${e.message}`);
    }
}

/**
 * Función principal del Auditor Social
 */
async function runSocialAuditor(isTestMode = false, aiProvider = 'ollama', specificId = null) {
    console.log(`🚀 Iniciando Fase 3: Auditor Social (Motor IA: ${aiProvider.toUpperCase()}) ...`);

    let query = supabase.from('v2_articles').select('*').eq('status', 'PENDING_SOCIAL');

    if (specificId) {
        console.log(`\n🔗 Modo ID Directo: Filtrando por artículo ID: ${specificId}`);
        query = query.eq('id', specificId);
    } else {
        const limit = isTestMode ? 1 : 10;
        query = query.order('created_at', { ascending: true }).limit(limit);
    }

    const { data: articles, error: fetchError } = await query;

    if (fetchError) {
        console.error("❌ Error leyendo PENDING_SOCIAL:", fetchError.message);
        process.exit(1);
    }

    if (!articles || articles.length === 0) {
        console.log("💤 No hay noticias pendientes de auditoría social.");
        process.exit(0);
    }

    let itemsProcessed = 0;

    for (const article of articles) {
        console.log(`\n======================================================`);
        console.log(`🐦 Generando Hilo para [ID: ${article.id.substring(0, 8)}] - ${article.clean_title}`);
        console.log(`======================================================`);

        try {
            // Generar prompt para el hilo interactivo
            const prompt = `
### ROLE
Analista de medios especializado en sesgo cognitivo.
Idioma: Español (Argentina - voseo).

### TASK
Generar un hilo de 3 tweets analizando el sesgo de una noticia para el portal IANews.dev.

### DATA
- Diario: ${article.source_domain}
- Título Original: ${article.raw_title}
- Título Limpio: ${article.clean_title}
- Sesgo: ${article.bias} (Score: ${article.bias_score}/100)
- Tácticas: ${article.manipulation_tactics}
- Hechos: ${article.fact_checking_text}

### SPECIFICATIONS
1. tweet1: Comparación directa entre título original y limpio.
2. tweet2: Explicación de la táctica de manipulación detectada.
3. tweet3: Resumen objetivo de los hechos.
4. Límite de caracteres: Máximo 170 caracteres por cada elemento (estricto).
5. Comillas: No uses comillas dobles (") dentro de los tweets. Usá comillas simples (').
6. Tono: Analítico, profesional, neutro.

### OUTPUT SCHEMA (STRICT)
{
  "tweet1": "string (tweet 1)",
  "tweet2": "string (tweet 2)",
  "tweet3": "string (tweet 3)"
}
`;

            const schema = {
                type: "object",
                properties: {
                    tweet1: { type: "string" },
                    tweet2: { type: "string" },
                    tweet3: { type: "string" }
                },
                required: ["tweet1", "tweet2", "tweet3"]
            };

            console.log(`  [LLM] Pidiendo diseño del hilo a ${aiProvider.toUpperCase()}...`);
            const rawResponse = await generateContent(prompt, {
                provider: aiProvider,
                isJson: true,
                temperature: 0.7,
                top_p: 0.8,
                jsonSchema: schema
            });
            console.log(`  [LLM] Respuesta cruda: ${rawResponse}`);
            // QC 3-A: Juez Estructural y Truncador de Seguridad
            console.log(`  [QC 3-A] Validando límites de la API de Twitter...`);
            let finalThread = qcTwitterThreadValidator(rawResponse);

            console.log(`  ✅ Hilo Generado Exitosamente (${finalThread.length} tweets).`);
            finalThread.forEach(t => console.log(`      > ${t}`));

            // Guardar resultados
            const { error: updateError } = await supabase
                .from('v2_articles')
                .update({
                    status: 'READY_TO_PUBLISH',
                    social_thread: finalThread,
                    retries_count: 0,
                    last_error_log: null
                })
                .eq('id', article.id);

            if (updateError) {
                console.error(`  ❌ Error guardando en BD:`, updateError.message);
            } else {
                console.log(`  💾 Artículo actualizado a READY_TO_PUBLISH.`);
                itemsProcessed++;
            }

        } catch (error) {
            console.error(`  ❌ Error generando el hilo:`, error.message);

            // Incrementar retries
            const newRetries = (article.retries_count || 0) + 1;
            const newStatus = newRetries >= 3 ? 'SOCIAL_FAILED' : 'PENDING_SOCIAL';
            await supabase.from('v2_articles').update({
                retries_count: newRetries,
                last_error_log: error.message,
                status: newStatus
            }).eq('id', article.id);

            console.log(`  ⚠️ Marcado con error. Intento ${newRetries}/3. Estado: ${newStatus}`);
        }
    }

    console.log(`\n🏁 Finish: Fase 3 completada. ${itemsProcessed} hilos generados.`);
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

    runSocialAuditor(isTestMode, provider, specificId);
}

module.exports = { runSocialAuditor };
