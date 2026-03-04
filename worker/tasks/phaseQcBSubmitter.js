const supabase = require('../supabaseClient');
const aiService = process.env.AI_PROVIDER === 'groq' ? require('../aiService') : require('../ollamaService');

module.exports = {
    delayMs: 30000,

    execute: async function ({ prompts }) {
        console.log(`\n======================================`);
        console.log(`[📤 QC B Submitter] Presentando Noticia al Juez Editorial...`);

        // Buscamos noticias neutrales que no hayan sido aprobadas todavía
        const { data: neutralNews, error } = await supabase
            .from('neutral_news')
            .select(`
                id, 
                title, 
                objective_summary, 
                raw_article_id,
                raw_articles!inner ( process_status )
            `)
            .eq('raw_articles.process_status', 'PENDING_QC_B')
            .limit(10);

        if (error) {
            console.error(`[X] Error buscando noticias para el Juez:`, error.message);
            return;
        }

        if (!neutralNews || neutralNews.length === 0) {
            console.log(`[✔] No hay noticias esperando veredicto editorial.`);
            return;
        }

        let enqueued = 0;

        for (const news of neutralNews) {
            const promptName = prompts?.judge || 'qc_judge';

            try {
                const draftText = `TÍTULO:\n${news.title}\n\nCONTENIDO:\n${news.objective_summary}`;
                console.log(`  [+] Solicitando veredicto para: "${news.title.substring(0, 40)}..."`);

                await aiService.submitJuezEditorial(news.raw_article_id, draftText, promptName);

                const { error: updateError } = await supabase
                    .from('raw_articles')
                    .update({ process_status: 'PROCESSING_QC_B', locked_at: new Date().toISOString() })
                    .eq('id', news.raw_article_id);

                if (updateError) throw updateError;
                enqueued++;

            } catch (err) {
                console.error(`  [X] Falló someter a Juez ${news.raw_article_id}:`, err.message);
            }
        }

        console.log(`[✔] QC B Submitter finalizado: ${enqueued} noticias en estrados.`);
    }
};
