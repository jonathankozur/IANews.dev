import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { session_id, comment_id, interaction_type } = body;

        if (!session_id || !comment_id || !interaction_type) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        if (interaction_type === 'like' || interaction_type === 'dislike') {
            // First remove any existing opposite interaction if exists 
            const opposite = interaction_type === 'like' ? 'dislike' : 'like';
            await supabase.from('comment_interactions').delete().match({ session_id, comment_id, interaction_type: opposite });

            // Upsert the new one
            const { error } = await supabase
                .from('comment_interactions')
                .upsert({
                    session_id,
                    comment_id,
                    interaction_type
                }, { onConflict: 'session_id,comment_id,interaction_type' });

            if (error) throw error;
        } else if (interaction_type === 'remove_like_dislike') {
            await supabase.from('comment_interactions').delete().in('interaction_type', ['like', 'dislike']).match({ session_id, comment_id });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Comment Interact API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
