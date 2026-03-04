const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const articleId = '89659751-682f-43fe-971e-6fca46fc1ab8';
const analysisResult = {
    "detected_bias": "Centro-Derecha, Oficialista",
    "manipulation_tactics": [
        "Apelación a la emoción",
        "Sesgo de omisión",
        "Selección selectiva de datos"
    ],
    "omitted_context": [
        "No se menciona la posible relación entre los capos narcos detenidos y el gobierno o partidos políticos en funciones",
        "Falta de detalles sobre las pruebas físicas que sustentan el plan de atentado"
    ],
    "fact_checks": [
        {
            "claim": "El plan criminal incluía el asesinato de un juez federal y un fiscal federal",
            "truth": "Información obtenida de fuentes oficiales sin confirmación independiente detallada",
            "is_false": false
        }
    ]
};

async function run() {
    const { data, error } = await supabase
        .from('news_analysis')
        .upsert({
            article_id: articleId,
            detected_bias: analysisResult.detected_bias,
            manipulation_tactics: analysisResult.manipulation_tactics,
            omitted_context: analysisResult.omitted_context,
            fact_checks: analysisResult.fact_checks
        }, { onConflict: 'article_id' });

    if (error) {
        console.error("Error inserting news_analysis:", error);
    } else {
        console.log("News analysis record created successfully for " + articleId);
    }
}

run();
