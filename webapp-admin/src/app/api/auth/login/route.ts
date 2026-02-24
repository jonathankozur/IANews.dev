import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
    const { user, pass } = await req.json();

    const validUser = process.env.ADMIN_USER;
    const validPass = process.env.ADMIN_PASS;

    if (!validUser || !validPass) {
        return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    if (user !== validUser || pass !== validPass) {
        return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }

    const token = await createToken(user);
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8, // 8 hours
        path: '/'
    });

    return response;
}
