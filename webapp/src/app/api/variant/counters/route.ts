import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const variant_id = searchParams.get('variant_id');

    if (!variant_id) {
        return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Aggregate user interactions for this variant using the optimized view
    const { data, error } = await supabase
        .from('view_variant_stats')
        .select('likes, dislikes')
        .eq('variant_id', variant_id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Variant counters API Error:', error);
        return NextResponse.json({ likes: 0, dislikes: 0 });
    }

    return NextResponse.json({
        likes: data?.likes || 0,
        dislikes: data?.dislikes || 0
    });
}
