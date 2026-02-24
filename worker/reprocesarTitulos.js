/**
 * reprocesarTitulos.js
 *
 * Script de migración de uso único: genera 'neutral_title' para todos los registros
 * de neutral_news que tienen el mismo título que su raw_article (es decir, nunca
 * fueron neutralizados correctamente).
 *
 * USO:
 *   node reprocesarTitulos.js          -> Procesa de a 10 por vez (safe, confirma antes)
 *   node reprocesarTitulos.js --all    -> Procesa TODOS (sin límite)
 *   node reprocesarTitulos.js --dryRun -> Solo muestra cuántos hay sin procesar
 */
require('dotenv').config();

const supabase = require('./supabaseClient');
const aiService = require('./aiService');

const BATCH_SIZE = 10;
const DELAY_BETWEEN_MS = 3000; // 3s entre requests para no saturar Ollama

const args = process.argv.slice(2);
const dryRun = args.includes('--dryRun');
const processAll = args.includes('--all');

const wait = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Heuristic: detects if a title looks like it was generated in English.
 * Checks for common English function words that don't appear in Spanish titles.
 */
function isEnglish(title) {
    if (!title) return false;
    const lower = title.toLowerCase();
    // English-only patterns: articles/prepositions that don't exist in Spanish
    const englishMarkers = [
        /\bthe\b/, /\bwarns\b/, /\bsays\b/, /\brejects\b/, /\bfaces\b/,
        /\bcalls\b/, /\bholds\b/, /\bseeks\b/, /\bsigns\b/, /\bof\b/,
        /\bdenies\b/, /\bgrants\b/, /\bpledges\b/, /\bvows\b/, /\bpushes\b/,
        /\bstifling\b/, /\bwithout\b/, /\bpresident\b/, /\bminister\b/
    ];
    // Must also NOT contain Spanish-specific chars (ñ, tildes) — rules out Spanish words that happen to match
    const hasSpanishChars = /[ñáéíóúüÁÉÍÓÚÑ¿¡]/.test(title);
    if (hasSpanishChars) return false;
    return englishMarkers.some(pattern => pattern.test(lower));
}

async function main() {
    console.log('\n🔄 MIGRACIÓN: Reprocesar Títulos Neutros');
    console.log('=========================================');
    if (dryRun) console.log('🧪 [DRY RUN] — Solo contará artículos, no actualizará nada.\n');

    // 1. Fetch neutral_news joined with raw_articles where titles match
    //    (means neutral title was never generated, it's still the original biased title)
    const { data: records, error } = await supabase
        .from('neutral_news')
        .select(`
            id, title, slug,
            raw_articles!inner ( id, title, raw_text )
        `)
        .limit(processAll ? 1000 : BATCH_SIZE);

    if (error) {
        console.error('❌ Error consultando Supabase:', error.message);
        process.exit(1);
    }

    // Filter: reprocess if:
    // a) neutral_news.title === raw_articles.title (never neutralized), OR
    // b) neutral_news.title looks like English (was generated in wrong language)
    const toPatch = records.filter(r =>
        r.title === r.raw_articles.title || isEnglish(r.title)
    );

    const sameCount = records.filter(r => r.title === r.raw_articles.title).length;
    const englishCount = records.filter(r => r.title !== r.raw_articles.title && isEnglish(r.title)).length;

    console.log(`📊 Total artículos encontrados: ${records.length}`);
    console.log(`🔧 Con título original (sin neutralizar): ${sameCount}`);
    console.log(`🇬🇧 Con título en inglés (mal generado):   ${englishCount}`);
    console.log(`🔄 Total a reprocesar: ${toPatch.length}`);

    if (toPatch.length === 0) {
        console.log('\n✅ Todos los títulos ya están neutralizados. Nada que hacer.');
        return;
    }

    if (dryRun) {
        console.log('\nEjemplos:');
        toPatch.slice(0, 5).forEach(r => {
            console.log(`  • "${r.title.substring(0, 70)}..."`);
        });
        return;
    }

    console.log(`\n🚀 Procesando ${toPatch.length} artículos...`);
    console.log('   (Ctrl+C para cancelar — los ya procesados quedan guardados)\n');

    let updated = 0;
    let failed = 0;

    for (const record of toPatch) {
        const shortTitle = record.title.substring(0, 55);
        process.stdout.write(`  → "${shortTitle}..." `);

        try {
            const analysis = await aiService.analizarYExtraerCrudo(
                record.raw_articles.raw_text,
                record.raw_articles.title
            );

            if (!analysis?.neutral_title) {
                console.log('⚠️  Sin neutral_title en respuesta. Saltando.');
                failed++;
            } else {
                const { error: updateError } = await supabase
                    .from('neutral_news')
                    .update({ title: analysis.neutral_title })
                    .eq('id', record.id);

                if (updateError) {
                    console.log(`❌ Error DB: ${updateError.message}`);
                    failed++;
                } else {
                    console.log(`✅ → "${analysis.neutral_title.substring(0, 50)}"`);
                    updated++;
                }
            }
        } catch (err) {
            console.log(`❌ Error IA: ${err.message}`);
            failed++;
        }

        if (toPatch.indexOf(record) < toPatch.length - 1) {
            await wait(DELAY_BETWEEN_MS);
        }
    }

    console.log(`\n=========================================`);
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`❌ Fallidos:     ${failed}`);
    console.log(`Total procesados: ${updated + failed}/${toPatch.length}`);

    if (toPatch.length === BATCH_SIZE && !processAll) {
        console.log(`\n💡 Solo se procesaron ${BATCH_SIZE}. Ejecutá con --all para procesar todos.`);
    }
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err);
    process.exit(1);
});
