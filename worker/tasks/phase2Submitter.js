const supabase = require('../supabaseClient');
const aiService = process.env.AI_PROVIDER === 'groq' ? require('../aiService') : require('../ollamaService');

module.exports = {
    // 30 segundos
    delayMs: 30000,

    execute: async function ({ prompts }) {
        console.log(`\n======================================`);
        console.log(`[📤 Phase 2 Submitter] Buscando análisis validados para Redacción Neutral...`);

        // 1. Buscamos (usando Inner Join inverso simple desde analysis)
        // Optamos por buscar articulos primero por query manual ya que supabase no soporta select on constraints facilmente
        const { data: articles, error } = await supabase
            .from('raw_articles')
            .select('id, title')
            .eq('process_status', 'PENDING_NEUTRAL')
            .limit(10);

        if (error) {
            console.error(`[X] Error buscando noticias para Neutralización:`, error.message);
            return;
        }

        if (!articles || articles.length === 0) {
            console.log(`[✔] No hay noticias en la cola de Redacción Neutral.`);
            return;
        }

        let enqueued = 0;

        for (const article of articles) {
            const promptName = prompts?.neutral || 'generator_neutral';

            try {
                // Buscamos su analisis recien horneado para inyectarselo a la IA redactora
                const { data: analysis, error: fError } = await supabase
                    .from('news_analysis')
                    .select('detected_bias, manipulation_tactics, omitted_context, fact_checks')
                    .eq('article_id', article.id)
                    .single();

                if (fError) throw new Error("Faltaba la Fila de Análisis Forense");

                // Encolamos 
                console.log(`  [+] Encolando Pluma Neutral para: "${article.title.substring(0, 40)}..."`);
                await aiService.submitNeutralizacion(article.id, JSON.stringify(analysis), promptName);

                // Lock the article
                const { error: updateError } = await supabase
                    .from('raw_articles')
                    .update({ process_status: 'PROCESSING_NEUTRAL', locked_at: new Date().toISOString() })
                    .eq('id', article.id);

                if (updateError) throw updateError;
                enqueued++;

            } catch (err) {
                console.error(`  [X] Falló encolar redacción forense ${article.id}:`, err.message);
            }
        }

        console.log(`[✔] Phase 2 Submitter finalizado: ${enqueued} redacciones encoladas.`);
    }
};
