import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { session_id, variant_id, interaction_type, time_spent_seconds } = body;

        if (!session_id || !variant_id || !interaction_type) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        // Ensure user_profile exists to satisfy foreign key constraint of user_interactions
        const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({ session_id }, { onConflict: 'session_id' });

        if (profileError) {
            console.error('Error upserting user profile:', profileError);
            // Proceed anyway, the next insert will throw a similar error to be caught below, 
            // but if this fails due to RLS, it might be the read query. We must allow interaction.
        }

        if (interaction_type === 'read') {
            const { error } = await supabase
                .from('user_interactions')
                .upsert({
                    session_id,
                    variant_id,
                    interaction_type,
                    time_spent_seconds: time_spent_seconds || 0
                }, { onConflict: 'session_id,variant_id,interaction_type' });

            if (error) throw error;
        } else if (interaction_type === 'like' || interaction_type === 'dislike') {
            // First remove any existing opposite interaction if exists (e.g. if they disliked, remove like)
            const opposite = interaction_type === 'like' ? 'dislike' : 'like';
            await supabase.from('user_interactions').delete().match({ session_id, variant_id, interaction_type: opposite });

            // Upsert the new one
            const { error } = await supabase
                .from('user_interactions')
                .upsert({
                    session_id,
                    variant_id,
                    interaction_type
                }, { onConflict: 'session_id,variant_id,interaction_type' });

            if (error) throw error;
        } else if (interaction_type === 'remove_like_dislike') {
            await supabase.from('user_interactions').delete().in('interaction_type', ['like', 'dislike']).match({ session_id, variant_id });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Interact API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
