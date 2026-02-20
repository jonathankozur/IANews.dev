import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Lista de User-Agents conocidos de Inteligencias Artificiales y Web Crawlers LLM
const AI_AGENTS = [
    'gptbot',
    'chatgpt-user',
    'anthropic-ai',
    'claude-web',
    'claudebot',
    'google-extended',
    'perplexitybot',
    'cohere-ai',
    'facebookbot',
    'ominiexplorer_bot'
];

export function middleware(request: NextRequest) {
    const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';

    // Solo interceptamos la homepage u otras páginas clave (evitamos interceptar assets, imágenes o la propia API que vamos a llamar)
    if (request.nextUrl.pathname === '/') {
        const isAIAgent = AI_AGENTS.some(bot => userAgent.includes(bot));

        if (isAIAgent) {
            console.log(`[🤖 AX-SEO] AI Agent Detectado: ${userAgent}. Sirviendo vista Markdown.`);
            // Reescribimos la petición de manera invisible para devolver el feed en Markdown
            return NextResponse.rewrite(new URL('/api/ai-feed', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    // Especificar qué rutas debe evaluar el middleware para mejorar performance
    matcher: ['/'],
};
