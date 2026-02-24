import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const lastDate = searchParams.get('lastDate');
    const sourceFilter = searchParams.get('source');
    const tacticFilter = searchParams.get('tactic');

    try {
        let query = supabase
            .from('neutral_news')
            .select(`
                id,
                title,
                slug,
                category,
                objective_summary,
                created_at,
                raw_article:raw_articles!inner (
                  source_name,
                  source_url,
                  title,
                  image_url_original,
                  image_url_ai,
                  image_url_stock
                ),
                analysis:news_analysis!inner (
                    detected_bias,
                    manipulation_tactics,
                    omitted_context,
                    fact_checks
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (lastDate) {
            query = query.lt('created_at', lastDate);
        }

        if (sourceFilter && sourceFilter !== 'all') {
            query = query.eq('raw_articles.source_name', sourceFilter);
        }

        if (tacticFilter && tacticFilter !== 'all') {
            // manipulation_tactics is a jsonb array of strings
            query = query.contains('news_analysis.manipulation_tactics', [tacticFilter]);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Supabase Error detail:", error);
            throw error;
        }

        // Map data to flat structure for the Neutra UI
        const mappedData = data.map((item: any) => {
            const relatedRaw = Array.isArray(item.raw_article) ? item.raw_article[0] : item.raw_article;
            const relatedAnalysis = Array.isArray(item.analysis) ? item.analysis[0] : item.analysis;

            return {
                id: item.id,
                title_neutral: item.title,
                slug: item.slug,
                category: item.category,
                objective_summary: item.objective_summary,
                created_at: item.created_at,

                // From raw_articles
                source_name: relatedRaw?.source_name,
                source_url: relatedRaw?.source_url,
                title_original: relatedRaw?.title,
                image_url_original: relatedRaw?.image_url_original,
                image_url_ai: relatedRaw?.image_url_ai,
                image_url_stock: relatedRaw?.image_url_stock,

                // From news_analysis
                detected_bias: relatedAnalysis?.detected_bias,
                manipulation_tactics: relatedAnalysis?.manipulation_tactics || [],
                omitted_context: relatedAnalysis?.omitted_context,
                fact_checks: relatedAnalysis?.fact_checks || []
            };
        });

        return NextResponse.json({ data: mappedData });

    } catch (error: any) {
        console.error("Neutra API Error fetching paginated news:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
