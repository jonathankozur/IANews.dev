import { supabase } from '@/lib/supabase';
import SplitNewsCard from '@/components/SplitNewsCard';
import Sidebar from '@/components/Sidebar';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const { data } = await supabase
        .from('neutral_news')
        .select('title')
        .eq('slug', resolvedParams.slug)
        .single();

    if (!data) return { title: 'Auditoría no encontrada | Neutra' };

    return {
        title: `${data.title} | Neutra Auditoría Forense`,
    };
}

export default async function AuditDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const { data, error } = await supabase
        .from('neutral_news')
        .select(`
        id,
        title,
        slug,
        category,
        objective_summary,
        created_at,
        raw_article:raw_articles!inner (
          source_name,
          source_url,
          title,
          image_url_original,
          image_url_ai,
          image_url_stock
        ),
        analysis:news_analysis!inner (
            detected_bias,
            manipulation_tactics,
            omitted_context,
            fact_checks
        )
    `)
        .eq('slug', resolvedParams.slug)
        .single();

    if (error || !data) {
        notFound();
    }

    const relatedRaw = Array.isArray(data.raw_article) ? data.raw_article[0] : data.raw_article;
    const relatedAnalysis = Array.isArray(data.analysis) ? data.analysis[0] : data.analysis;

    const article = {
        id: data.id,
        title_neutral: data.title,
        slug: data.slug,
        category: data.category,
        objective_summary: data.objective_summary,
        created_at: data.created_at,
        source_name: relatedRaw?.source_name,
        source_url: relatedRaw?.source_url,
        title_original: relatedRaw?.title,
        image_url_original: relatedRaw?.image_url_original,
        image_url_ai: relatedRaw?.image_url_ai,
        image_url_stock: relatedRaw?.image_url_stock,
        detected_bias: relatedAnalysis?.detected_bias,
        manipulation_tactics: relatedAnalysis?.manipulation_tactics || [],
        omitted_context: relatedAnalysis?.omitted_context,
        fact_checks: relatedAnalysis?.fact_checks || []
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Todas las Auditorías
            </Link>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="flex-1 w-full">
                    <SplitNewsCard article={article} isDetailPage={true} />
                </div>

                <Sidebar />
            </div>

            <div className="mt-8 border-t border-slate-200 pt-8 flex justify-center">
                <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition px-6 py-3 bg-slate-100 rounded-lg hover:bg-slate-200">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Volver a Todas las Auditorías
                </Link>
            </div>
        </div>
    );
}
