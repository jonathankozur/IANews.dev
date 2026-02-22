import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserLeaning } from '@/lib/personalization';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { session_id, variant_id, content } = body;

        if (!session_id || !variant_id || !content) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        // Ensure user_profile exists to satisfy foreign key constraint of comments
        const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({ session_id }, { onConflict: 'session_id' });

        if (profileError) {
            console.error('Error upserting user profile for comments:', profileError);
        }

        // Get the author's current political leaning to give the comment a weight
        const { leaning: author_leaning } = await getUserLeaning(session_id);

        const { data, error } = await supabase
            .from('comments')
            .insert({
                session_id,
                variant_id,
                content,
                author_leaning
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Comments API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const variant_id = searchParams.get('variant_id');

    if (!variant_id) {
        return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('variant_id', variant_id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Comments GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}
