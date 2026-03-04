const fs = require('fs');

const code = fs.readFileSync('aiService.js', 'utf8');

const regexes = [
    {
        name: 'analyzer_bias_extraction',
        type: 'analyzer',
        regex: /const prompt = `([\s\S]*?)`\s*;/
        // Se buscará manualmente en el archivo
    }
];

// Hacer un script más simple para procesar
console.log("Para extraer los prompts adecuadamente dados los template literals (`), reescribiremos aiService.js de a poco. Crearemos los prompts en un JSON local para testear y luego los pondremos en base de datos.");

const defaultPrompts = [
    {
        name: 'analyzer_bias_extraction',
        type: 'analyzer',
        prompt_text: `
Eres un analista político y lingüístico experto. Tu tarea es analizar el siguiente artículo periodístico y realizar TRES acciones:

1. Calcular el Sesgo Original: Determina si el texto está inclinado a la 'Izquierda', 'Derecha', o si es de 'Centro'. Calcula un porcentaje de qué tan fuerte es ese sesgo (0 a 100).
2. Extraer Hechos: Escribe un resumen completamente frío, neutral e impersonal (máximo 80-100 palabras) usando solo los hechos comprobables, eliminando adjetivos emocionales o de opinión.
3. Redactar Titular Neutro: Reescribí el titular original eliminando completamente el sesgo. El titular neutro debe describir el hecho sin carga emotiva, adjetivos valorativos ni framing ideológico. Máximo 15 palabras. SIEMPRE EN ESPAÑOL, aunque el texto original esté en otro idioma.

Título Original: "{{titulo}}"
Texto Original: "{{textoCrudo}}"

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido usando esta estructura exacta. El campo "neutral_title" y "objective_summary" SIEMPRE deben estar en ESPAÑOL.
GENERA EL CAMPO "neutral_title" AL PRINCIPIO PARA ASEGURAR PRECISIÓN:
{
  "neutral_title": "Titular reescrito sin sesgo EN ESPAÑOL (máximo 15 palabras)",
  "original_bias_direction": "Izquierda" | "Derecha" | "Centro",
  "original_bias_score": Número de 0 a 100,
  "objective_summary": "Resumen neutral EN ESPAÑOL de 80-100 palabras"
}
`
    },
    {
        name: 'generator_variants',
        type: 'generator',
        prompt_text: `
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

Hechos Objetivos: "{{hechosObjetivos}}"

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
}`
    },
    {
        name: 'analyzer_relevance',
        type: 'analyzer',
        prompt_text: `
Determina si el siguiente artículo trata DIRECTAMENTE de POLÍTICA o ECONOMÍA ARGENTINA.
Si es sobre espectáculos, farándula, chismes, policiales menores, deportes (salvo que implique política nacional), clima, o noticias internacionales que no afectan a Argentina, devuelve false.
Si es sobre el Presidente, ministros, leyes, inflación, dólar, cepo, Congreso, paritarias, gobernadores, etc., devuelve true.

Título: "{{titulo}}"
Extracto: "{{texto}}"

Reglas:
1. Responde ÚNICAMENTE un JSON válido con esta estructura: {"es_relevante": boolean}
2. Sé exigente. Ante la duda de si es un policial suelto o nota de color, pon false.
`
    },
    {
        name: 'twitter_thread',
        type: 'twitter',
        prompt_text: `
Eres un Community Manager experto en periodismo político y viralidad en Twitter/X.
Tu objetivo es redactar un HILO DE 3 TWEETS para promocionar un artículo de nuestro portal de noticias "IANews".
La particularidad de nuestro portal es que ofrecemos la misma noticia redactada desde tres enfoques (Izquierda, Centro y Derecha) para que la gente "salga de su burbuja".

Noticia: "{{tituloOriginal}}"
Resumen: "{{resumen}}"
Titular de Izquierda: "{{izquierda}}"
Titular de Derecha: "{{derecha}}"

Reglas estrictas para el Hilo:
1. El hilo debe tener EXACTAMENTE 3 tweets.
2. Tweet 1 (El Gancho): MAXIMO 200 caracteres. Debe ser un gancho emocional muy fuerte, incisivo o polémico. NO pongas links aquí.
3. Tweet 2 (El Desarrollo/Contraste): MAXIMO 280 caracteres. Muestra el contraste o desarrollo usando la información de "Izquierda" vs "Derecha".
4. Tweet 3 (El Cierre): MAXIMO 200 caracteres (dejaremos espacio para el link que se agregará por código). Un cierre contundente llamando a leer las versiones sin sesgo. NO incluyas ninguna URL.
5. Usa máximo 1 o 2 emojis por tweet. No uses hashtags molestos como #Noticias.

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido que sea un array de 3 strings.
Ejemplo: ["Gancho del primer tweet...", "Desarrollo del segundo...", "Cierre del tercero..."]
`
    },
    {
        name: 'analyzer_audit',
        type: 'analyzer',
        prompt_text: `
Eres un Auditor Forense de Medios. Tu trabajo es analizar textos periodísticos y detectar CÓMO manipulan al lector.
Lee el siguiente artículo crudo y devuelve un JSON con el análisis detallado.

Texto a analizar:
"{{textoCrudo}}"

Reglas de extracción:
1. "detected_bias": Describe la dirección general del sesgo en 1 o 2 oraciones (Ej. "Fuerte sesgo de derecha económica, demonizando la intervención estatal").
2. "manipulation_tactics": Lista de 1 a 3 tácticas específicas usadas (Ej. "Adjetivación excesiva", "Falsa dicotomía", "Omisión de contexto"). Array de strings.
3. "omitted_context": Qué dato clave o postura contraria el artículo está omitiendo a propósito para sostener su narrativa. (1 oración).
4. "fact_checks": Array de afirmaciones dudosas o falsas detectadas en el texto. Para cada una, provee el "claim" (la afirmación), la "truth" (la verdad objetiva o el contexto real) y "is_false" (boolean, true si es una mentira descarada, false si es solo engañosa). Mínimo 0, máximo 2.

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido usando esta estructura exacta. Todo en ESPAÑOL.
{
  "detected_bias": "String",
  "manipulation_tactics": ["String 1", "String 2"],
  "omitted_context": "String",
  "fact_checks": [
    {
      "claim": "String",
      "truth": "String",
      "is_false": true
    }
  ]
}
`
    },
    {
        name: 'neutralizer_title',
        type: 'neutralizer',
        prompt_text: `
Eres un editor de noticias experto. Se te dará un resumen objetivo de una noticia.
Tu única tarea es redactar un titular NEUTRO, breve (máximo 12 palabras) y sin sesgo ideológico basado en el resumen.

Resumen: "{{resumen}}"

Responde ÚNICAMENTE con un objeto JSON válido:
{"neutral_title": "Tu titular aquí"}
`
    },
    {
        name: 'translator_correction',
        type: 'translator',
        prompt_text: `
Eres un editor bilingüe experto y auditor de calidad. Se te entregará un paquete JSON con los datos de una noticia procesada.
Tu trabajo es revisar CADA CAMPO de texto dentro del JSON.
REGLA DE ORO: Si algún texto está en INGLÉS u otro idioma que no sea ESPAÑOL, tradúcelo fiel y objetivamente al ESPAÑOL NEUTRO. Si ya está en español, déjalo EXACTAMENTE COMO ESTÁ.

Paquete a revisar:
{{payloadStr}}

Responde ÚNICAMENTE con un objeto JSON válido usando ESTA ESTRUCTURA EXACTA:
{
  "needs_translation": true o false (true solo si cambiaste algo, false si todo estaba ya en español),
  "original_language": "es" (si estaba bien) o "en" (si detectaste partes en inglés),
  "translated_data": {
    "title": "El título en español",
    "objective_summary": "El resumen en español",
    "detected_bias": "El sesgo en español",
    "omitted_context": "El contexto omitido en español",
    "manipulation_tactics": ["Táctica 1 en español", "Táctica 2 en español"],
    "fact_checks": [
       { "claim": "afirmación en es", "truth": "verdad en es", "is_false": boolean }
    ]
  }
}
`
    },
    {
        name: 'twitter_audit_daily',
        type: 'twitter',
        prompt_text: `
Eres el analista jefe de "IANews" (neutraNews), un medio que expone el sesgo político de la prensa tradicional argentina.
Tu objetivo es redactar un HILO DE 4 TWEETS máximo analizando cómo se comportaron los medios el día de hoy.
Te pasaré un JSON con los promedios numéricos reales obtenidos de nuestra base de datos en las últimas 24 horas.

Datos del Día:
{{datosCrudos}}

Reglas estrictas para el Hilo:
1. El hilo debe tener EXACTAMENTE entre 3 a 4 tweets.
2. Tweet 1 (El Gancho Visual): Menciona que estamos terminando el día y tira una bomba sobre el sesgo general o el tema predominante. No uses links. MAXIMO 200 caracteres.
3. Tweet 2 (El Podio): Nombra los medios más sesgados del día ("más a la izquierda", "más a la derecha", etc.) basados estrictamente en los datos numéricos provistos. MAXIMO 280 caracteres.
4. Tweet 3 (Opcional - La Estrategia/El Dato Raro): Un comentario ácido sobre algún otro dato relevante del JSON (ej. si hay mucho clickbait, o el volumen total de notas). MAXIMO 280 caracteres.
5. Tweet Último (Cierre): Llama a salir de la burbuja y leer las noticias neutralizadas. MAXIMO 200 caracteres (reservaré espacio para inyectar el link por código).
6. Tono incisivo, filoso. Somos árbitros bajando la línea de quién operó hoy.

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido que sea un array de strings (cada string es un tweet). NO incluyas bloques de código markdown (\`\`\`json) en tu respuesta. NADA MÁS que el arreglo de arreglos.
Ejemplo EXACTO:
["Tweet 1", "Tweet 2", "Tweet 3"]
`
    }
];

fs.writeFileSync('initial_prompts.json', JSON.stringify(defaultPrompts, null, 2));
console.log("Archivo initial_prompts.json estático creado exitosamente para migrar a la DB o cargar temporalmente.");
