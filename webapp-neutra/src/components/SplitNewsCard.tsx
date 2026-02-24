"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, Search } from 'lucide-react';
import BiasGauge from './BiasGauge';

interface FactCheck {
    claim: string;
    truth: string;
    is_false: boolean;
}

interface SplitNewsCardProps {
    article: {
        id: string;
        title_neutral: string;
        slug: string;
        category: string;
        objective_summary: string;
        created_at: string;
        source_name: string;
        source_url: string;
        title_original: string;
        image_url_original?: string;
        image_url_stock?: string;
        detected_bias?: string;
        manipulation_tactics?: string[];
        omitted_context?: string;
        fact_checks?: FactCheck[];
    };
    isDetailPage?: boolean;
}

export default function SplitNewsCard({ article, isDetailPage = false }: SplitNewsCardProps) {
    const [isExpanded, setIsExpanded] = useState(isDetailPage);
    const [gaugeVisible, setGaugeVisible] = useState(isDetailPage); // On detail page, animate immediately
    const articleRef = useRef<HTMLElement>(null);

    const displayImage = article.image_url_original && !article.image_url_original.includes('ERROR') && !article.image_url_original.includes('NO_IMAGE')
        ? article.image_url_original
        : article.image_url_stock && !article.image_url_stock.includes('ERROR') ? article.image_url_stock : null;

    // IntersectionObserver: Trigger gauge animation only once when the card enters view
    useEffect(() => {
        if (isDetailPage || !article.detected_bias) return; // Already visible or no gauge to animate

        const el = articleRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setGaugeVisible(true);
                    observer.disconnect(); // fire only once
                }
            },
            { threshold: 0.1 } // Trigger when 10% of card is visible
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [isDetailPage, article.detected_bias]);

    return (
        <article ref={articleRef} className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden mb-12">
            {/* Visual Header */}
            {displayImage && (
                <div className="w-full h-48 md:h-64 overflow-hidden relative border-b border-slate-200">
                    <img
                        src={displayImage}
                        alt={article.title_original || article.title_neutral}
                        className="w-full h-full object-cover"
                    />
                    {article.detected_bias && (
                        <BiasGauge
                            biasLevel={article.detected_bias}
                            score={Math.min(100, (article.manipulation_tactics?.length || 1) * 20 + 40)}
                            shouldAnimate={gaugeVisible}
                        />
                    )}
                </div>
            )}

            {/* Split Screen Content */}
            <div className="flex flex-col md:flex-row">

                {/* LEFT: Original Manipulated */}
                <div className="flex-1 p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-200 bg-red-50/30">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Publicación Original</span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2 leading-tight">
                        {article.title_original || "Titular Original No Disponible"}
                    </h2>

                    <p className="text-sm font-medium text-slate-500 mb-6 flex items-center gap-1">
                        Vía <span className="text-indigo-600">{article.source_name || "Fuente Desconocida"}</span>
                    </p>

                    {/* Forensic Analysis */}
                    {article.manipulation_tactics && article.manipulation_tactics.length > 0 && (
                        <div className="mt-8 bg-white border border-red-100 rounded-lg p-5 shadow-sm">
                            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <Search className="w-4 h-4 text-red-500" />
                                Tácticas de Manipulación Detectadas
                            </h4>
                            <ul className="space-y-2">
                                {article.manipulation_tactics.map((tactic, idx) => (
                                    <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <span>{tactic}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* RIGHT: Depurated Truth */}
                <div className="flex-1 p-6 md:p-8 bg-slate-50">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Noticia Depurada</span>
                    </div>

                    <h2 className="text-xl font-bold text-slate-800 mb-4 leading-snug">
                        {article.title_neutral}
                    </h2>

                    <div className="prose prose-slate prose-sm text-slate-600 mb-6">
                        <p className="leading-relaxed border-l-4 border-slate-300 pl-4 italic">
                            {article.objective_summary}
                        </p>
                    </div>

                    {!isDetailPage && (
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-4 decoration-indigo-300 transition-colors"
                            >
                                {isExpanded ? "Ocultar Auditoría Fáctica" : "Ver Análisis de Contexto Faltante"}
                            </button>
                            <Link
                                href={`/auditoria/${article.slug}`}
                                className="text-sm font-medium text-slate-500 hover:text-slate-800 underline underline-offset-4 decoration-slate-300 transition-colors"
                            >
                                Ver Auditoría Completa
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* EXPANDED: Context & Fact Checking */}
            {isExpanded && (
                <div className="border-t border-slate-200 bg-white p-6 md:p-8 animate-in fade-in duration-300">
                    <div className="max-w-4xl mx-auto">

                        {article.omitted_context && (
                            <div className="mb-8">
                                <h3 className="text-lg font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">Contexto Omitido por el Medio</h3>
                                <p className="text-slate-700 text-sm leading-relaxed">{article.omitted_context}</p>
                            </div>
                        )}

                        {article.fact_checks && article.fact_checks.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Verificación de Hechos (Fact-Checking)</h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {article.fact_checks.map((check, idx) => (
                                        <div key={idx} className={`border rounded-lg p-4 ${check.is_false ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                            <p className="text-sm font-bold text-slate-900 mb-2 flex items-start gap-2">
                                                {check.is_false ? <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" /> : <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />}
                                                Afirmación Original:
                                            </p>
                                            <p className="text-sm text-slate-600 italic mb-3">&ldquo;{check.claim}&rdquo;</p>

                                            <p className="text-sm font-bold text-slate-900 mb-1">La Realidad Objetiva:</p>
                                            <p className="text-sm text-slate-700">{check.truth}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {article.source_url && (
                            <div className="mt-8 text-right">
                                <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-slate-600 transition">
                                    Leer el artículo original en la fuente ↗
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </article>
    );
}
