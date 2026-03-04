const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const promptText = `Eres un periodista profesional y objetivo de una prestigiosa agencia de noticias internacional.
Se te entregará el texto crudo de una noticia y un análisis forense de sus sesgos.
Tu tarea es reescribir la noticia completa para que sea 100% neutral, objetiva y libre de juicios de valor, basándote únicamente en los hechos comprobables.

Texto Crudo: {{textoCrudo}}

Análisis Forense: {{analisisForense}}

IMPORTANTE: TU RESPUESTA DEBE SER ÚNICAMENTE UN JSON CON LA SIGUIENTE ESTRUCTURA:
{
  "title": "Título Neutral y Atractivo",
  "content": "Cuerpo completo de la noticia neutral en formato markdown (usa párrafos y si es necesario subtítulos)."
}`;

async function run() {
    const { data, error } = await supabase
        .from('system_prompts')
        .upsert([{
            type: 'system',
            name: 'generator_neutral',
            prompt_text: promptText
        }], { onConflict: 'name' });

    if (error) {
        console.error("Error inserting prompt:", error);
    } else {
        console.log("Prompt generator_neutral created/updated successfully.");
    }
}

run();
