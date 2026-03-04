const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
    console.log("Comenzando el seeding de prompts en Supabase...");

    try {
        const rawData = fs.readFileSync('initial_prompts.json', 'utf8');
        const prompts = JSON.parse(rawData);

        for (const prompt of prompts) {
            console.log(`Insertando prompt: ${prompt.name} (Tipo: ${prompt.type})...`);
            const { error } = await supabase
                .from('system_prompts')
                .upsert({
                    name: prompt.name,
                    type: prompt.type,
                    prompt_text: prompt.prompt_text
                }, { onConflict: 'name' }); // upsert based on unique name

            if (error) {
                console.error(`[❌] Error insertando ${prompt.name}:`, error.message);
            } else {
                console.log(`[✓] Prompt ${prompt.name} insertado/actualizado correctamente.`);
            }
        }
        console.log("Seeding finalizado.");
    } catch (err) {
        console.error("Falló el script:", err);
    }
}

seed();
