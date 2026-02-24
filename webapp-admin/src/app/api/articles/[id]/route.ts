import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/articles/[id]
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('neutral_news')
        .select(`
            *,
            raw:raw_articles(source_name, title, image_url_original, image_url_stock),
            analysis:news_analysis(detected_bias, manipulation_tactics, omitted_context, fact_checks)
        `)
        .eq('id', id)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Aplanar para el frontend
    const relatedRaw = Array.isArray(data.raw) ? data.raw[0] : data.raw;
    const relatedAnalysis = Array.isArray(data.analysis) ? data.analysis[0] : data.analysis;

    const mapped = {
        ...data,
        title_neutral: data.title,
        source_name: relatedRaw?.source_name,
        title_original: relatedRaw?.title,
        image_url_original: relatedRaw?.image_url_original,
        image_url_stock: relatedRaw?.image_url_stock,
        detected_bias: relatedAnalysis?.detected_bias,
        manipulation_tactics: relatedAnalysis?.manipulation_tactics || [],
        omitted_context: relatedAnalysis?.omitted_context,
        fact_checks: relatedAnalysis?.fact_checks || []
    };

    return NextResponse.json(mapped);
}

// PUT /api/articles/[id]
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    // 1. Actualizar neutral_news
    const { error: err1 } = await supabase
        .from('neutral_news')
        .update({
            title: body.title_neutral,
            objective_summary: body.objective_summary,
            category: body.category
        })
        .eq('id', id);

    if (err1) return NextResponse.json({ error: `neutral_news: ${err1.message}` }, { status: 500 });

    // 2. Actualizar raw_articles (si hay cambios en imagen o source)
    if (body.raw_article_id) {
        await supabase
            .from('raw_articles')
            .update({
                image_url_original: body.image_url_original
            })
            .eq('id', body.raw_article_id);
    }

    // 3. Actualizar news_analysis
    const { data: existingAnalysis } = await supabase
        .from('news_analysis')
        .select('article_id')
        .eq('article_id', id)
        .single();

    const analysisData = {
        detected_bias: body.detected_bias,
        manipulation_tactics: body.manipulation_tactics,
        omitted_context: body.omitted_context,
        fact_checks: body.fact_checks
    };

    if (existingAnalysis) {
        await supabase
            .from('news_analysis')
            .update(analysisData)
            .eq('article_id', id);
    } else {
        await supabase
            .from('news_analysis')
            .insert({ article_id: id, ...analysisData });
    }

    return NextResponse.json({ success: true });
}
