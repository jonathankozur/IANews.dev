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
        .select('*')
        .eq('id', id)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// PUT /api/articles/[id]
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    // Remove immutable fields if present
    const { id: _, created_at: __, ...updateData } = body;

    const { data, error } = await supabase
        .from('neutral_news')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
