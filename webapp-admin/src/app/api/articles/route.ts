import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/articles?page=1&search=...
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const limit = 20;
    const offset = (page - 1) * limit;

    const supabase = getSupabaseAdmin();
    let query = supabase
        .from('neutral_news')
        .select(`
            id, 
            slug, 
            title, 
            created_at,
            raw:raw_articles!inner(source_name, title),
            analysis:news_analysis(detected_bias)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (search) {
        // En Supabase, para buscar en tablas relacionadas se usa el nombre de la tabla
        query = query.or(`title.ilike.%${search}%,raw_articles.source_name.ilike.%${search}%,raw_articles.title.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) {
        console.error("Admin API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mapear a estructura plana para el frontend
    const mappedData = data.map((item: any) => {
        const relatedRaw = Array.isArray(item.raw) ? item.raw[0] : item.raw;
        const relatedAnalysis = Array.isArray(item.analysis) ? item.analysis[0] : item.analysis;

        return {
            id: item.id,
            slug: item.slug,
            title_neutral: item.title,
            title_original: relatedRaw?.title,
            source_name: relatedRaw?.source_name,
            detected_bias: relatedAnalysis?.detected_bias || 'Sin analizar',
            created_at: item.created_at
        };
    });

    return NextResponse.json({ data: mappedData, count });
}

// DELETE /api/articles?id=...
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('neutral_news').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
