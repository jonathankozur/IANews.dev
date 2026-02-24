"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import AdBanner from './AdBanner';

interface TrendingNews {
    id: string;
    title: string;
    slug: string;
    source_name: string;
    detected_bias: string;
}

export default function Sidebar() {
    const [trending, setTrending] = useState<TrendingNews[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const res = await fetch('/api/trending');
                const json = await res.json();
                if (json.data) {
                    setTrending(json.data);
                }
            } catch (err) {
                console.error("Failed to fetch trending news", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTrending();
    }, []);

    return (
        <aside className="w-full lg:w-[350px] flex-shrink-0 flex flex-col gap-6">
            <div className="bg-white border text-left border-red-100 shadow-sm rounded-xl overflow-hidden ring-1 ring-slate-900/5">
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    <h3 className="font-bold text-slate-900">Polémicas</h3>
                </div>

                <div className="p-4 flex flex-col gap-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900"></div>
                        </div>
                    ) : trending.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No hay datos suficientes aún.</p>
                    ) : (
                        trending.map((item, idx) => (
                            <div key={item.id} className="flex flex-col gap-4">
                                <Link href={`/auditoria/${item.slug}`} className="group block border-b border-slate-100 pb-4">
                                    <h4 className="text-sm font-bold text-slate-800 leading-snug group-hover:text-red-700 transition-colors mb-2">
                                        {item.title}
                                    </h4>
                                    <div className="flex flex-col gap-1.5 mt-2">
                                        <p className="text-xs text-slate-500 font-medium">Vía {item.source_name}</p>
                                        <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-600 bg-red-50 w-fit px-1.5 py-0.5 rounded border border-red-200">
                                            <AlertTriangle className="w-3 h-3" />
                                            <span className="truncate max-w-[200px]">{item.detected_bias}</span>
                                        </div>
                                    </div>
                                </Link>
                                {/* Mostrar un anuncio después de ciertos elementos */}
                                {(idx === 2 || idx === 5) && (
                                    <div className="py-2">
                                        <AdBanner />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </aside>
    );
}
