const supabase = require('../supabaseClient');

module.exports = {
    // 15 segundos
    delayMs: 15000,

    execute: async function ({ useOllama }) {
        console.log(`\n======================================`);
        console.log(`[🔍 Tarea: Deep Analyzer] Buscando artículos neutralizados pendientes de auditoría...`);

        // Importamos dinámicamente el servicio de IA
        const aiService = useOllama ? require('../ollamaService') : require('../aiService');

        // Fetch existing audited IDs
        const { data: existingAudits, error: existingError } = await supabase.from('news_analysis').select('article_id');
        const existingIds = existingAudits ? existingAudits.map(x => x.article_id) : [];

        if (existingError) {
            console.error('[X] Error fetching existing audits:', existingError.message);
            return;
        }

        // Query articles that have a neutral_news entry but NO news_analysis entry
        // Limit to a small batch (e.g. 2) since this analysis is text-heavy and slow
        let query = supabase
            .from('neutral_news')
            .select(`
                id,
                objective_summary,
                source:raw_articles!inner (
                    raw_text,
                    source_name
                )
            `);

        if (existingIds.length > 0) {
            query = query.not('id', 'in', `(${existingIds.join(',')})`);
        }

        const { data: articlesToAudit, error } = await query.limit(2);

        if (error) {
            console.error('[X] Error fetching articles to audit:', error.message);
            return;
        }

        if (!articlesToAudit || articlesToAudit.length === 0) {
            console.log(`[!] No hay artículos pendientes de auditoría detectados.`);
            return; // Nothing to audit
        }

        for (const article of articlesToAudit) {
            // Flatten the relation to get the actual raw content
            const rawContent = Array.isArray(article.source) ? article.source[0].raw_text : article.source.raw_text;
            const sourceName = Array.isArray(article.source) ? article.source[0].source_name : article.source.source_name;

            console.log(`\n  -> Auditando noticia de ${sourceName} (ID: ${article.id.substring(0, 8)}...)`);

            try {
                // Request the forensic analysis from the chosen AI model
                const forensicJson = await aiService.auditarSesgoPeriodistico(rawContent);

                if (!forensicJson) {
                    console.warn(`  [⚠️] El modelo de IA devolvió un análisis vacío para ${article.id}`);
                    continue;
                }

                // Insert the analysis into our new table
                const { error: insertError } = await supabase
                    .from('news_analysis')
                    .insert({
                        article_id: article.id,
                        detected_bias: forensicJson.detected_bias,
                        manipulation_tactics: forensicJson.manipulation_tactics,
                        omitted_context: forensicJson.omitted_context,
                        fact_checks: forensicJson.fact_checks
                    });

                if (insertError) {
                    console.error(`  [X] Failed to save DB analysis for ${article.id}:`, insertError.message);
                } else {
                    console.log(`  [+] Análisis forense guardado exitosamente para ${article.id}`);
                }

            } catch (err) {
                console.error(`  [X] Error crítico durante la auditoría de ${article.id}:`, err.message);
            }
        }
    }
};
