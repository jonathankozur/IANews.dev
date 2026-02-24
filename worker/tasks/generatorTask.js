const supabase = require('../supabaseClient');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    // 1 minuto
    delayMs: 1 * 60 * 1000,

    execute: async function ({ useOllama }) {
        console.log(`\n======================================`);
        console.log(`[🎨 Tarea: Generator] Buscando noticias neutralizadas pendientes...`);

        // Importamos dinámicamente el servicio de IA
        const aiService = useOllama ? require('../ollamaService') : require('../aiService');

        // Fetch pending neutral news
        const { data: neutralNews, error: fetchError } = await supabase
            .from('neutral_news')
            .select('*')
            .eq('process_status', 'PENDING_GENERATION')
            .order('created_at', { ascending: true }) // Oldest first
            .limit(3);

        if (fetchError) {
            console.error("[X] Error fetching neutral news:", fetchError.message);
            return;
        }

        if (!neutralNews || neutralNews.length === 0) {
            console.log(`[!] No hay noticias neutralizadas pendientes de generación.`);
            return;
        }

        console.log(`[📥] Encontradas ${neutralNews.length} noticias pendientes. Procesando...`);

        let processed = 0;

        for (const news of neutralNews) {
            console.log(`\n  -> Generando variantes para: "${news.title.substring(0, 50)}..."`);

            try {
                const result = await aiService.generarVariantesDeNoticia(news.objective_summary);

                if (!result || !result.translations) {
                    console.warn(`  [⚠️] AI returned invalid payload. Marking as error.`);
                    await supabase.from('neutral_news').update({ process_status: 'ERROR' }).eq('id', news.id);
                    continue;
                }

                // Update categories
                await supabase
                    .from('neutral_news')
                    .update({ geo_target: result.geo_target, category: result.category })
                    .eq('id', news.id);

                const variantsToInsert = [];

                for (const t of result.translations) {
                    const lang = t.language;

                    ['left', 'center', 'right'].forEach(policy => {
                        if (t[policy] && t[policy].title) {
                            variantsToInsert.push({
                                neutral_news_id: news.id,
                                language: lang,
                                policy_type: policy,
                                policy_label: t[policy].label,
                                title: t[policy].title,
                                content: t[policy].content,
                                sentiment_score: t[policy].sentiment || 0
                            });
                        }
                    });
                }

                if (variantsToInsert.length > 0) {
                    const { error: insertError } = await supabase
                        .from('news_variants')
                        .insert(variantsToInsert);

                    if (insertError) {
                        console.error(`  [X] Failed inserting variants DB:`, insertError.message);
                        await supabase.from('neutral_news').update({ process_status: 'ERROR_DB' }).eq('id', news.id);
                    } else {
                        console.log(`  [+] Insertadas ${variantsToInsert.length} variantes (${result.translations.length} idiomas).`);
                        // Mark as PUBLISHED!!!
                        await supabase.from('neutral_news').update({ process_status: 'PUBLISHED' }).eq('id', news.id);
                        processed++;
                    }
                } else {
                    console.error(`  [X] AI returned no valid variants.`);
                }

            } catch (err) {
                console.error(`  [X] Excepción crítica procesando noticia ${news.id}:`, err);
                await supabase.from('neutral_news').update({ process_status: 'ERROR' }).eq('id', news.id);
            }

            await wait(3000);
        }

        console.log(`\n[✔] Resumen Generator: ${processed}/${neutralNews.length} noticias publicadas exitosamente.`);
    }
};
