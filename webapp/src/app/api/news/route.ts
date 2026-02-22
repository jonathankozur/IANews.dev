import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const lang = searchParams.get('lang') || 'es';
    const country = searchParams.get('country') || 'AR';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    // lastDate acts as the cursor for infinite scrolling or load more
    const lastDate = searchParams.get('lastDate');

    try {
        let query = supabase
            .from('neutral_news')
            .select(`
                id,
                title,
                slug,
                category,
                objective_summary,
                raw_article:raw_articles (
                  source_name,
                  source_url,
                  image_url_original,
                  image_url_ai,
                  image_url_stock
                ),
                geo_target,
                published_at:created_at,
                variants:news_variants!inner (
                    id,
                    policy_type,
                    policy_label,
                    title,
                    content,
                    sentiment_score,
                    created_at
                )
            `)
            .eq('news_variants.language', lang)
            .in('geo_target', [country, 'GLOBAL'])
            .order('created_at', { ascending: false })
            .limit(limit);

        if (lastDate) {
            query = query.lt('created_at', lastDate);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Map to flat structure expected by the frontend component
        const mappedData = data.map((item: any) => ({
            ...item,
            source_name: Array.isArray(item.raw_article) ? item.raw_article[0]?.source_name : item.raw_article?.source_name,
            source_url: Array.isArray(item.raw_article) ? item.raw_article[0]?.source_url : item.raw_article?.source_url,
            image_url_original: Array.isArray(item.raw_article) ? item.raw_article[0]?.image_url_original : item.raw_article?.image_url_original,
            image_url_ai: Array.isArray(item.raw_article) ? item.raw_article[0]?.image_url_ai : item.raw_article?.image_url_ai,
            image_url_stock: Array.isArray(item.raw_article) ? item.raw_article[0]?.image_url_stock : item.raw_article?.image_url_stock,
            language: lang
        }));

        return NextResponse.json({ data: mappedData });

    } catch (error: any) {
        console.error("API Error fetching paginated news:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
