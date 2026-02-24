const supabase = require('../supabaseClient');

/**
 * statsTask.js — Calcula estadísticas por medio de comunicación
 * y las guarda en la tabla `media_stats` de Supabase.
 *
 * Modo de uso desde el Hub:
 *  - Single run: corre una vez y termina
 *  - Continuo: corre cada 24h (86400000ms)
 */
module.exports = {
    delayMs: 86400000, // 24 horas

    execute: async function () {
        console.log('[Stats] 🔍 Iniciando cálculo de estadísticas por medio...');

        // Obtener datos cruzando las tablas raw_articles y news_analysis
        const { data: rawData, error } = await supabase
            .from('neutral_news')
            .select(`
                created_at,
                raw:raw_articles!inner(source_name, image_url_original, image_url_stock),
                analysis:news_analysis(detected_bias, manipulation_tactics)
            `);

        if (error) {
            console.error('[Stats] ❌ Error al obtener artículos:', error.message);
            console.error('[Stats] Detalle:', error);
            return;
        }

        if (!rawData || rawData.length === 0) {
            console.log('[Stats] ⚠️ No hay artículos para analizar.');
            return;
        }

        // Mapear a una estructura plana para que el resto de la lógica siga funcionando igual
        const articles = rawData.map(item => {
            const raw = Array.isArray(item.raw) ? item.raw[0] : item.raw;
            const analysis = Array.isArray(item.analysis) ? item.analysis[0] : item.analysis;

            return {
                created_at: item.created_at,
                source_name: raw?.source_name,
                image_url_original: raw?.image_url_original,
                image_url_stock: raw?.image_url_stock,
                detected_bias: analysis?.detected_bias,
                manipulation_tactics: analysis?.manipulation_tactics
            };
        });

        console.log(`[Stats] 📰 Analizando ${articles.length} artículos...`);

        // Agrupar por source_name
        const bySource = {};
        for (const article of articles) {
            const source = article.source_name || 'Desconocido';
            if (!bySource[source]) {
                bySource[source] = [];
            }
            bySource[source].push(article);
        }

        const statsRows = [];

        for (const [sourceName, items] of Object.entries(bySource)) {
            const totalArticles = items.length;

            // --- Tácticas de manipulación ---
            const tacticCounts = {};
            let totalTacticScore = 0;

            for (const item of items) {
                const tactics = Array.isArray(item.manipulation_tactics) ? item.manipulation_tactics : [];
                totalTacticScore += tactics.length;
                for (const t of tactics) {
                    if (t) tacticCounts[t] = (tacticCounts[t] || 0) + 1;
                }
            }

            // Ordenar tácticas de mayor a menor frecuencia
            const sortedTactics = Object.entries(tacticCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => ({ name, count }));

            const avgBiasScore = totalArticles > 0
                ? Math.round((totalTacticScore / totalArticles) * 20 + 40)
                : 0;
            const clampedAvg = Math.min(100, Math.max(0, avgBiasScore));

            // --- Distribución ideológica ---
            const ideologyMap = { izquierda: 0, centro: 0, derecha: 0, otro: 0 };
            for (const item of items) {
                const bias = (item.detected_bias || '').toLowerCase();
                if (bias.includes('izquierda') || bias.includes('progresista') || bias.includes('kirchner')) {
                    ideologyMap.izquierda++;
                } else if (bias.includes('derecha') || bias.includes('liberal') || bias.includes('conservad')) {
                    ideologyMap.derecha++;
                } else if (bias.includes('centro') || bias.includes('moderado') || bias.includes('neutral')) {
                    ideologyMap.centro++;
                } else if (bias && bias.length > 0) {
                    ideologyMap.otro++;
                }
            }

            // --- Recursos visuales ---
            let originalImages = 0;
            let stockImages = 0;
            let noImages = 0;

            for (const item of items) {
                const hasOriginal = item.image_url_original &&
                    !item.image_url_original.includes('ERROR') &&
                    !item.image_url_original.includes('NO_IMAGE');
                const hasStock = item.image_url_stock &&
                    !item.image_url_stock.includes('ERROR');

                if (hasOriginal) originalImages++;
                else if (hasStock) stockImages++;
                else noImages++;
            }

            // Fecha de la última noticia del medio
            const dates = items
                .map(i => i.created_at)
                .filter(Boolean)
                .sort()
                .reverse();
            const lastArticleAt = dates[0] || null;

            statsRows.push({
                source_name: sourceName,
                total_articles: totalArticles,
                avg_bias_score: clampedAvg,
                tactics_breakdown: sortedTactics,
                ideology_distribution: ideologyMap,
                original_images: originalImages,
                stock_images: stockImages,
                no_images: noImages,
                last_article_at: lastArticleAt,
                computed_at: new Date().toISOString()
            });

            console.log(`[Stats] ✅ ${sourceName}: ${totalArticles} artículos | Sesgo promedio: ${clampedAvg}%`);
        }

        // Upsert en Supabase (usando source_name como clave única)
        const { error: upsertError } = await supabase
            .from('media_stats')
            .upsert(statsRows, { onConflict: 'source_name' });

        if (upsertError) {
            console.error('[Stats] ❌ Error al guardar estadísticas:', upsertError.message);
        } else {
            console.log(`[Stats] 🎉 Estadísticas de ${statsRows.length} medios guardadas correctamente.`);
        }
    }
};
