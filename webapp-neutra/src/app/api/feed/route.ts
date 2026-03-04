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
            .from('v2_articles')
            .select('*')
            .in('status', ['READY_TO_PUBLISH', 'PUBLISHED'])
            .order('created_at', { ascending: false })
            .limit(limit);

        if (lastDate) {
            query = query.lt('created_at', lastDate);
        }

        if (sourceFilter && sourceFilter !== 'all') {
            query = query.eq('source_domain', sourceFilter);
        }

        if (tacticFilter && tacticFilter !== 'all') {
            query = query.contains('manipulation_tactics', [tacticFilter]);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Supabase Error detail:", error);
            throw error;
        }

        // Map data to flat structure for the Neutra UI
        const mappedData = data.map((item: any) => {
            return {
                id: item.id,
                title_neutral: item.clean_title,
                slug: item.slug,
                category: item.category || 'General',
                objective_summary: item.clean_body,
                created_at: item.created_at,

                // Metadata de origen
                source_name: item.source_domain,
                source_url: item.original_url,
                title_original: item.raw_title,
                image_url_original: item.image_url,
                image_url_ai: null,
                image_url_stock: null,

                // Análisis V2
                detected_bias: item.bias,
                manipulation_tactics: item.manipulation_tactics || [],
                omitted_context: item.full_analysis_text,
                fact_checking_text: item.fact_checking_text, // En V2 es String, no array
                bias_score: item.bias_score
            };
        });

        return NextResponse.json({ data: mappedData });

    } catch (error: any) {
        console.error("Neutra API Error fetching paginated news:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
