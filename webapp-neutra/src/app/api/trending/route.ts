import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Obtenemos las noticias que tienen sesgo detectado y las ordenamos por fecha
        // En un caso real más complejo, podríamos ordenar por un puntaje de "polémica"
        const { data, error } = await supabase
            .from('neutral_news')
            .select(`
                id,
                title,
                slug,
                created_at,
                raw_article:raw_articles!inner (
                  source_name
                ),
                analysis:news_analysis!inner (
                    detected_bias
                )
            `)
            .not('news_analysis.detected_bias', 'is', null) // asegurar que haya un sesgo detectado
            .order('created_at', { ascending: false })
            .limit(8);

        if (error) {
            console.error("Supabase Error detail:", error);
            throw error;
        }

        const mappedData = data.map((item: any) => {
            const relatedRaw = Array.isArray(item.raw_article) ? item.raw_article[0] : item.raw_article;
            const relatedAnalysis = Array.isArray(item.analysis) ? item.analysis[0] : item.analysis;

            return {
                id: item.id,
                title: item.title,
                slug: item.slug,
                created_at: item.created_at,
                source_name: relatedRaw?.source_name,
                detected_bias: relatedAnalysis?.detected_bias
            };
        });

        // Simular un poco de polemica ordenando por las que tienen textos de sesgo más largos o algo así
        // o simplemente devolver las más recientes con sesgo.
        return NextResponse.json({ data: mappedData });

    } catch (error: any) {
        console.error("Neutra API Error fetching trending news:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
