import { supabase } from '@/lib/supabase';
import SplitNewsCard from '@/components/SplitNewsCard';
import Sidebar from '@/components/Sidebar';
import AdBanner from '@/components/AdBanner';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const { data } = await supabase
        .from('v2_articles')
        .select('clean_title')
        .eq('slug', resolvedParams.slug)
        .single();

    if (!data) return { title: 'Auditoría no encontrada | Neutra' };

    return {
        title: `${data.clean_title} | Neutra Auditoría Forense`,
    };
}

export default async function AuditDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const { data, error } = await supabase
        .from('v2_articles')
        .select('*')
        .eq('slug', resolvedParams.slug)
        .single();

    if (error || !data) {
        notFound();
    }

    const article = {
        id: data.id,
        title_neutral: data.clean_title,
        slug: data.slug,
        category: data.category || 'General',
        objective_summary: data.clean_body,
        created_at: data.created_at,
        source_name: data.source_domain,
        source_url: data.original_url,
        title_original: data.raw_title,
        image_url_original: data.image_url,
        image_url_ai: null,
        image_url_stock: null,
        detected_bias: data.bias,
        manipulation_tactics: data.manipulation_tactics || [],
        omitted_context: data.full_analysis_text,
        fact_checking_text: data.fact_checking_text
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

            <div className="mt-8 border-t border-slate-200 pt-8">
                {/* TODO: Reemplazar SLOT_DETAIL_BANNER con el Slot ID real de AdSense */}
                <AdBanner slot="SLOT_DETAIL_BANNER" format="horizontal" className="mb-8" />
                <div className="flex justify-center">
                    <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition px-6 py-3 bg-slate-100 rounded-lg hover:bg-slate-200">
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Volver a Todas las Auditorías
                    </Link>
                </div>
            </div>
        </div>
    );
}
