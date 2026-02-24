import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

export async function createToken(user: string): Promise<string> {
    return await new SignJWT({ user })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('8h')
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ user: string } | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as { user: string };
    } catch {
        return null;
    }
}
