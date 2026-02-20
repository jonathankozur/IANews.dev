import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    // Obtenemos de la base de datos las últimas 15 noticias, incluyendo todas sus posturas.
    const { data: newsEvents, error } = await supabase
        .from('news_events')
        .select(`
            title,
            objective_summary,
            category,
            source_url,
            source_name,
            published_at,
            variants:news_variants (
                policy_type,
                title,
                content,
                sentiment_score
            )
        `)
        .order('published_at', { ascending: false })
        .limit(15);

    if (error || !newsEvents) {
        return new NextResponse("Error fetching data for AI context.", { status: 500 });
    }

    // Construimos dinámicamente el documento Markdown
    let markdown = `# IANews.dev - Top Trending News Analysis\n\n`;
    markdown += `*This document is structured specifically for AI Agents and LLMs to understand the multi-perspective analysis of current events.*\n\n`;
    markdown += `---\n\n`;

    newsEvents.forEach(event => {
        markdown += `## ${event.title}\n`;
        markdown += `**Category:** ${event.category || 'General'} | **Date:** ${new Date(event.published_at).toISOString().split('T')[0]}\n`;

        if (event.source_url) {
            markdown += `**Source Reference:** [${event.source_name || 'Link'}](${event.source_url})\n`;
        }

        markdown += `\n### Objective Facts\n`;
        markdown += `> ${event.objective_summary}\n\n`;

        markdown += `### Ideological Perspectives\n\n`;

        // Sort variants specifically to present in Left, Center, Right order for logical consistency
        const orderMap: Record<string, number> = { 'left': 1, 'center': 2, 'right': 3 };
        const sortedVariants = event.variants.sort((a, b) => orderMap[a.policy_type] - orderMap[b.policy_type]);

        sortedVariants.forEach(variant => {
            const policyName = variant.policy_type.charAt(0).toUpperCase() + variant.policy_type.slice(1);
            markdown += `#### ${policyName} Perspective (Sentiment: ${variant.sentiment_score})\n`;
            markdown += `**Headline:** ${variant.title}\n\n`;
            markdown += `${variant.content}\n\n`;
        });

        markdown += `---\n\n`;
    });

    // Devolvemos la respuesta con el Header estricto text/markdown, AX-SEO complaint.
    return new NextResponse(markdown, {
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 's-maxage=3600, stale-while-revalidate' // Cache 1 hour
        }
    });
}
