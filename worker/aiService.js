require('dotenv').config();
const supabase = require('./supabaseClient');

// Polling interval defaults to 3000ms
const POLL_INTERVAL_MS = parseInt(process.env.AI_QUEUE_POLL_INTERVAL_MS || '3000', 10);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function enqueueAndAwaitResult(prompt, isJson = false, modelTier = 0) {
    try {
        const { data, error } = await supabase
            .from('ia_request_queue')
            .insert([{
                prompt,
                is_json: isJson,
                model_tier: modelTier,
                status: 'PENDING'
            }])
            .select('id')
            .single();

        if (error) {
            console.error("[❌ IA Client] Error encolando solicitud:", error.message);
            throw error;
        }

        const requestId = data.id;
        console.log(`[� IA Client] Solicitud encolada (ID: ${requestId.substring(0, 8)}...). Esperando respuesta (polling cada ${POLL_INTERVAL_MS / 1000}s)...`);

        while (true) {
            await wait(POLL_INTERVAL_MS);

            const { data: checkData, error: checkError } = await supabase
                .from('ia_request_queue')
                .select('status, result, error_msg')
                .eq('id', requestId)
                .single();

            if (checkError) {
                console.error(`[❌ IA Client] Error consultando estado (ID: ${requestId.substring(0, 8)}...):`, checkError.message);
                continue;
            }

            if (checkData.status === 'DONE') {
                return checkData.result;
            } else if (checkData.status === 'FAILED') {
                throw new Error(checkData.error_msg || "Falló el procesamiento de IA en el Worker Central.");
            }
        }
    } catch (error) {
        throw error;
    }
}

async function analizarYExtraerCrudo(textoCrudo, titulo) {
    console.log(`[🤖 IA Service Client] Encolando análisis de sesgo original y extracción de hechos...`);

    const prompt = `
Eres un analista político y lingüístico experto. Tu tarea es analizar el siguiente artículo periodístico y realizar TRES acciones:

1. Calcular el Sesgo Original: Determina si el texto está inclinado a la 'Izquierda', 'Derecha', o si es de 'Centro'. Calcula un porcentaje de qué tan fuerte es ese sesgo (0 a 100).
2. Extraer Hechos: Escribe un resumen completamente frío, neutral e impersonal (máximo 80-100 palabras) usando solo los hechos comprobables, eliminando adjetivos emocionales o de opinión.
3. Redactar Titular Neutro: Reescribí el titular original eliminando completamente el sesgo. El titular neutro debe describir el hecho sin carga emotiva, adjetivos valorativos ni framing ideológico. Máximo 15 palabras.

Título Original: "${titulo}"
Texto Original: "${textoCrudo.substring(0, 3000)}"

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido usando esta estructura exacta:
{
  "original_bias_direction": "Izquierda" | "Derecha" | "Centro",
  "original_bias_score": Número de 0 a 100,
  "objective_summary": "String con el resumen neutral de 80-100 palabras",
  "neutral_title": "String con el titular reescrito sin sesgo (máximo 15 palabras)"
}
`;

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 0);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ IA Service Client] Failed to analyze and extract facts:", error.message);
        return null;
    }
}

async function generarVariantesDeNoticia(hechosObjetivos) {
    console.log(`[🤖 IA Service Client] Encolando procesamiento de hechos para i18n...`);

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
        const responseText = await enqueueAndAwaitResult(prompt, true, 0);
        return JSON.parse(responseText);

    } catch (error) {
        console.error("[❌ IA Service Client] Failed to generate or parse AI content:", error.message);

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

    const lowerTitle = titulo.toLowerCase();
    const blacklist = ['horóscopo', 'gran hermano', 'farándula', 'clima', 'pronóstico', 'espectáculos', 'cine', 'netflix'];
    if (blacklist.some(word => lowerTitle.includes(word))) return false;

    console.log(`[🤖 IA Service Client] Encolando evaluación de relevancia temática: "${titulo}"`);

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
        const responseText = await enqueueAndAwaitResult(prompt, true, 6);
        const jsonResponse = JSON.parse(responseText);
        return jsonResponse.es_relevante === true;
    } catch (error) {
        console.error("[❌ IA Service Client] Filter checking failed:", error.message);
        return true;
    }
}

async function generarTweetViral(noticia) {
    console.log(`[🤖 IA Service Client] Encolando generación de tweet viral...`);

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
        const text = await enqueueAndAwaitResult(prompt, false, 4);
        return text.trim().replace(/^"|"$/g, '');
    } catch (error) {
        console.error("[❌ IA Service Client] Failed to generate Tweet:", error.message);
        return null;
    }
}

async function auditarSesgoPeriodistico(textoCrudo) {
    console.log(`[🤖 IA Service Client] Encolando Auditoría Forense de Sesgo...`);

    const prompt = `
Eres un riguroso auditor de medios y experto en análisis del discurso periodístico.
Tu misión es diseccionar el siguiente artículo crudo para encontrar las huellas de su sesgo ideológico, la ideología subyacente que promociona, y las tácticas de manipulación que emplea para alterar la percepción del lector.

Artículo original:
"${textoCrudo.substring(0, 4000)}"

Reglas estrictas de salida:
Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta:
{
  "detected_bias": "String corto (ej: 'Centro-Derecha, Oficialista', 'Izquierda, Opositor', 'Amarillismo de Mercado')",
  "manipulation_tactics": ["Táctica 1", "Táctica 2", "Táctica 3"], // Ej: ["Apelación a la emoción", "Falacia de hombre de paja", "Sesgo de omisión", "Selección selectiva de datos"]
  "omitted_context": "String explicando brevemente qué información crucial parece faltar o haber sido minimizada a propósito para sostener la narrativa.",
  "fact_checks": [
    {
      "claim": "La afirmación concreta hecha en el texto",
      "truth": "El contexto u otra perspectiva objetiva real",
      "is_false": boolean (true si es sospechosa de falacia/mentira/exageración, false si es cierta pero maliciosamente presentada)
    }
  ] // Extrae al menos 2 fact-checks
}
`;

    try {
        const responseText = await enqueueAndAwaitResult(prompt, true, 2);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("[❌ IA Service Client] Falló la auditoría forense:", error.message);
        return null;
    }
}

module.exports = {
    generarVariantesDeNoticia,
    analizarYExtraerCrudo,
    esNoticiaDePoliticaOEconomiaArgentina,
    generarTweetViral,
    auditarSesgoPeriodistico
};
