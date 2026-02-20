import { NextResponse } from 'next/server';
import { getUserLeaning } from '@/lib/personalization';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get('session_id');

    if (!session_id) {
        return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    try {
        const { leaning, scores } = await getUserLeaning(session_id);
        return NextResponse.json({ leaning, scores });
    } catch (error: any) {
        console.error('Scores API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
