'use client';

import { useState } from 'react';

type PolicyType = 'left' | 'center' | 'right';

interface NewsVariant {
    id: string;
    policy_type: PolicyType;
    title: string;
    content: string;
    sentiment_score: number;
}

interface NewsEvent {
    id: string;
    title: string;
    objective_summary: string;
    published_at: string;
    variants: NewsVariant[];
}

interface NewsCardProps {
    event: NewsEvent;
}

export default function NewsCard({ event }: NewsCardProps) {
    // Por defecto, arrancamos en la variante "center" (la más neutral para el primer pantallazo)
    const [activeTab, setActiveTab] = useState<PolicyType>('center');

    // Buscar la variante activa basándose en la pestaña seleccionada
    const activeVariant = event.variants.find(v => v.policy_type === activeTab);

    if (!activeVariant) return null; // Fallback por si la BD no está completa aun

    return (
        <article className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mb-8 transition-shadow hover:shadow-md">
            {/* Cabecera del Evento Objetivo */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                <p className="text-xs font-semibold tracking-wider text-gray-400 dark:text-gray-500 uppercase mb-2">
                    {new Date(event.published_at).toLocaleDateString('es-ES', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    })} • Hecho Objetivo
                </p>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                    {event.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {event.objective_summary}
                </p>
            </div>

            {/* Selector de Perspectiva (Zero Friction) */}
            <div className="flex w-full border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <button
                    onClick={() => setActiveTab('left')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${activeTab === 'left'
                            ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 z-10'
                        }`}
                >
                    Enfoque Izquierda
                </button>
                <button
                    onClick={() => setActiveTab('center')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${activeTab === 'center'
                            ? 'border-slate-500 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/30'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 z-10'
                        }`}
                >
                    Centro Neutral
                </button>
                <button
                    onClick={() => setActiveTab('right')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${activeTab === 'right'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 z-10'
                        }`}
                >
                    Enfoque Derecha
                </button>
            </div>

            {/* Redacción según Perspectiva */}
            <div className="p-6 md:p-8">
                {/* Animación MUY sutil de entrada para que no salte el layout violentamente */}
                <div key={activeVariant.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100 leading-snug">
                        {activeVariant.title}
                    </h3>
                    <div className="prose prose-slate dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
                        {/* Si viniese en HTML, usaríamos dangerouslySetInnerHTML, pero como es texto plano, mapeamos los párrafos por saltos de linea */}
                        {activeVariant.content.split('\n').map((paragraph: string, idx: number) => (
                            paragraph.trim() && <p key={idx} className="mb-4">{paragraph}</p>
                        ))}
                    </div>
                </div>
            </div>
        </article>
    );
}
