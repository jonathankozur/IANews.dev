import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const comment_id = searchParams.get('comment_id');

    if (!comment_id) {
        return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('view_comment_stats')
        .select('likes, dislikes')
        .eq('comment_id', comment_id)
        .single();

    if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ likes: 0, dislikes: 0 });
    }

    return NextResponse.json({
        likes: data?.likes || 0,
        dislikes: data?.dislikes || 0
    });
}
