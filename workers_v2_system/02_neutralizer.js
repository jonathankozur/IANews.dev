require('dotenv').config({ path: require('path').join(__dirname, '../worker/.env') });
const supabase = require('./config/supabase');
const { generateContent } = require('./core/ai_service');

/**
 * QC 2-A: Validador Estructural (Código duro)
 * Verifica que el generador respete el formato de respuesta del JSON.
 */
function qcFormatValidator(jsonRaw) {
    try {
        let cleaned = jsonRaw.replace(/^```json/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        console.log(`  [QC 2-A] clean_title:`, parsed.clean_title);
        console.log(`  [QC 2-A] clean_body:`, parsed.clean_body);
        if (!parsed.clean_title || !parsed.clean_body) {
            throw new Error(`Falta clean_title o clean_body.`);
        }

        if (parsed.clean_body.length < 300) {
            throw new Error(`El cuerpo limpio es sospechosamente corto (${parsed.clean_body.length} chars). Posible alucinación.`);
        }

        return parsed;
    } catch (e) {
        throw new Error(`Fallo QC 2-A Formato JSON: ${e.message}`);
    }
}

/**
 * QC 2-B: Juez Editorial (Sanitización de Muletillas de IA)
 * Purga modismos robóticos clásicos mediante código (o IA rápida).
 * Aquí lo hacemos vía código para ahorrar tokens y mejorar la velocidad.
 */
function qcEditorialJudge(text) {
    let sanitized = text;
    const aiCrutches = [
        "en resumen,",
        "en conclusión,",
        "cabe destacar",
        "es importante señalar",
        "es fundamental notar",
        "a modo de resumen,",
        "esto demuestra que",
        "sin lugar a dudas,"
    ];

    aiCrutches.forEach(crutch => {
        const regex = new RegExp(crutch, 'gi');
        sanitized = sanitized.replace(regex, '');
    });

    // Limpiar dobles espacios o puntos huerfanos resultantes
    sanitized = sanitized.replace(/  +/g, ' ').replace(/ \./g, '.');
    return sanitized.trim();
}

/**
 * Generador de Slugs SEO-friendly únicos (añadiendo prefijo ID)
 */
function generateSlug(title, id) {
    const baseSlug = title.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remueve acentos
        .replace(/[^a-z0-9]+/g, "-") // Remueve caracteres raros
        .replace(/(^-|-$)+/g, ""); // Limpia guiones al inicio y fin

    const shortId = id.substring(0, 8); // Primer bloque del UUID
    return `${baseSlug}-${shortId}`;
}

/**
 * Función principal del Neutralizador
 */
async function runNeutralizer(isTestMode = false, aiProvider = 'ollama', specificId = null) {
    console.log(`🚀 Iniciando Fase 2: Redactor Neutral V2 (Motor IA: ${aiProvider.toUpperCase()}) ...`);

    let query = supabase.from('v2_articles').select('*').eq('status', 'PENDING_NEUTRALIZATION');

    if (specificId) {
        console.log(`\n🔗 Modo ID Directo: Filtrando por artículo ID: ${specificId}`);
        query = query.eq('id', specificId);
    } else {
        const limit = isTestMode ? 1 : 10;
        query = query.order('created_at', { ascending: true }).limit(limit);
    }

    const { data: articles, error: fetchError } = await query;

    if (fetchError) {
        console.error("❌ Error leyendo PENDING_NEUTRALIZATION:", fetchError.message);
        process.exit(1);
    }

    if (!articles || articles.length === 0) {
        console.log("💤 No hay noticias pendientes de neutralización.");
        process.exit(0);
    }

    let itemsProcessed = 0;

    for (const article of articles) {
        console.log(`\n======================================================`);
        console.log(`✍️ Neutralizando [ID: ${article.id.substring(0, 8)}] - ${article.raw_title}`);
        console.log(`======================================================`);

        try {
            // Generar prompt neutralizador
            const prompt = `
Eres un editor periodístico de la agencia Reuters o AP. Tu trabajo es reescribir noticias tendenciosas, eliminando adjetivos calificativos, valoraciones personales y frases emotivas. Debes mantener estrictamente los hechos puros (quién, qué, cuándo, dónde, por qué) y citar de forma neutral.

Tienes este contexto original:
TÍTULO: "${article.raw_title}"
CUERPO CRUDO: """${article.raw_body.substring(0, 4000)}"""

YA SABEMOS QUE CONTIENE LOS SIGUIENTES SESGOS (Tácticas detectadas: ${article.manipulation_tactics ? article.manipulation_tactics.join(', ') : 'Ninguna'}):
Presta especial atención a no replicar esos sesgos.

Tu tarea: Reescribe la noticia.
Devuelve ÚNICAMENTE un objeto JSON estrictamente válido con la siguiente estructura:
{
  "clean_title": "Título puramente descriptivo e imparcial, de no más de 12 palabras.",
  "clean_body": "El cuerpo completo de la noticia, reescrito con tono aséptico y estrictamente informativo."
}

REGLAS EXTREMAS:
- El idioma de salida debe ser ESPAÑOL.
- NO uses frases como "En conclusión", "Cabe destacar", "Es importante señalar". Ve directo a los hechos.
- Los parrafos del clean_body NO deben entregarse en un array, sino como un string con saltos de linea.
- El clean_body debe tener al menos 3 o 4 parrafos bien desarrollados de al menos 100 caracteres cada uno.
`;

            console.log(`  [LLM] Enviando texto a limpiar a ${aiProvider.toUpperCase()}...`);
            const rawResponse = await generateContent(prompt, { provider: aiProvider, isJson: true, temperature: 0.3, top_p: 0.5 });

            console.log(`  [LLM] Respuesta cruda:`, rawResponse);

            // QC 2-A: Juez Estructural
            console.log(`  [QC 2-A] Validando formato de salida JSON...`);
            let cleanData = qcFormatValidator(rawResponse);

            // QC 2-B: Juez Editorial (Purga de muletillas de IA)
            console.log(`  [QC 2-B] Limpiando muletillas editoriales de IA...`);
            cleanData.clean_body = qcEditorialJudge(cleanData.clean_body);

            console.log(`  ✅ Neutralización Exitosa.`);
            console.log(`  ✨ Título Limpio: ${cleanData.clean_title}`);

            const finalSlug = generateSlug(cleanData.clean_title, article.id);

            // Guardar resultados
            const { error: updateError } = await supabase
                .from('v2_articles')
                .update({
                    status: 'PENDING_SOCIAL',
                    clean_title: cleanData.clean_title,
                    slug: finalSlug,
                    clean_body: cleanData.clean_body,
                    retries_count: 0,
                    last_error_log: null
                })
                .eq('id', article.id);

            if (updateError) {
                console.error(`  ❌ Error guardando en BD:`, updateError.message);
            } else {
                console.log(`  💾 Artículo actualizado a PENDING_SOCIAL.`);
                itemsProcessed++;
            }

        } catch (error) {
            console.error(`  ❌ Error neutralizando el artículo:`, error.message);

            // Incrementar retries
            const newRetries = (article.retries_count || 0) + 1;
            const newStatus = newRetries >= 3 ? 'NEUTRALIZATION_FAILED' : 'PENDING_NEUTRALIZATION';
            await supabase.from('v2_articles').update({
                retries_count: newRetries,
                last_error_log: error.message,
                status: newStatus
            }).eq('id', article.id);

            console.log(`  ⚠️ Marcado con error. Intento ${newRetries}/3. Estado: ${newStatus}`);
        }
    }

    console.log(`\n🏁 Finish: Fase 2 completada. ${itemsProcessed} artículos neutralizados.`);
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

    runNeutralizer(isTestMode, provider, specificId);
}

module.exports = { runNeutralizer };
