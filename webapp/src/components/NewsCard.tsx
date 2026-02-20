'use client';

import { useState, useEffect, useRef } from 'react';
import CommentSection from './CommentSection';

type PolicyType = 'left' | 'center' | 'right';

interface NewsVariant {
    id: string;
    policy_type: PolicyType;
    policy_label?: string; // Nuevo campo
    title: string;
    content: string;
    sentiment_score: number;
}

interface NewsEvent {
    id: string;
    title: string;
    slug: string;
    category?: string;
    objective_summary: string;
    source_name?: string;
    source_url?: string;
    published_at: string;
    variants: NewsVariant[];
}

interface NewsCardProps {
    event: NewsEvent;
    preferredLeaning: PolicyType;
    isWildcard: boolean;
    sessionId: string;
    dict: Record<string, any>;
}

export default function NewsCard({ event, preferredLeaning, isWildcard, sessionId, dict }: NewsCardProps) {
    const [activeTab, setActiveTab] = useState<PolicyType>(preferredLeaning || 'center');
    const [devMode, setDevMode] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [interaction, setInteraction] = useState<'like' | 'dislike' | null>(null);
    const [counters, setCounters] = useState<{ likes: number, dislikes: number }>({ likes: 0, dislikes: 0 });

    const activeVariant = event.variants.find(v => v.policy_type === activeTab);
    const readTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Effect to track reading time
    useEffect(() => {
        if (!activeVariant || !sessionId) return;

        // Empezar a contar como lectura a los 5 segundos de ver la variante
        readTimerRef.current = setTimeout(async () => {
            try {
                await fetch('/api/interact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        variant_id: activeVariant.id,
                        interaction_type: 'read',
                        time_spent_seconds: 5
                    })
                });
            } catch (err) {
                console.error("Failed to log read interaction", err);
            }
        }, 5000);

        return () => {
            if (readTimerRef.current) clearTimeout(readTimerRef.current);
        };
    }, [activeVariant, sessionId]);

    // Effect to fetch aggregate counters when the active variant changes
    useEffect(() => {
        if (!activeVariant) return;

        const fetchCounters = async () => {
            try {
                const res = await fetch(`/api/variant/counters?variant_id=${activeVariant.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setCounters(data);
                }
            } catch (err) {
                console.error("Failed to fetch variant counters", err);
            }
        };

        fetchCounters();
    }, [activeVariant, interaction]); // Re-fetch logic triggered when interaction changes

    const handleInteraction = async (type: 'like' | 'dislike') => {
        if (!activeVariant || !sessionId) return;

        const newInteraction = interaction === type ? 'remove_like_dislike' : type;

        try {
            await fetch('/api/interact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    variant_id: activeVariant.id,
                    interaction_type: newInteraction
                })
            });
            setInteraction(newInteraction === 'remove_like_dislike' ? null : type);
        } catch (err) {
            console.error("Failed to log interaction", err);
        }
    };

    if (!activeVariant) return null; // Fallback por si la BD no está completa aun

    return (
        <article className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mb-8 transition-shadow hover:shadow-md relative">

            {/* Wildcard Indicator */}
            {isWildcard && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500" title="Ruptura de Cámara de Eco" />
            )}

            {/* Dev Mode Action (Hidden in Production) */}
            {process.env.NODE_ENV !== 'production' && (
                <div className="flex justify-between px-4 pt-2 items-center">
                    {isWildcard ? (
                        <span className="text-xs font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded">
                            🎯 {dict.card.alternative}
                        </span>
                    ) : <div />}

                    <button
                        onClick={() => setDevMode(!devMode)}
                        className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        {devMode ? '🛑' : '🛠️'} {dict.card.devMode}
                    </button>
                </div>
            )}

            {/* Always Visible Section */}
            <div className="p-6 pb-4">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-semibold tracking-wider text-gray-400 dark:text-gray-500 uppercase">
                        {new Date(event.published_at).toLocaleDateString('es-ES', {
                            day: 'numeric', month: 'short', year: 'numeric'
                        })} • {event.category || 'General'}
                    </p>
                    {!devMode && process.env.NODE_ENV !== 'production' && (
                        <span className="text-xs font-mono bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded text-indigo-500 dark:text-indigo-400">
                            {activeVariant.policy_label || activeTab}
                        </span>
                    )}
                </div>

                {/* Clickbait Title from Active Variant */}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 leading-tight cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}>
                    {activeVariant.title}
                </h2>

                {/* Objective Summary (Clamped) */}
                <p className={`text-gray-600 dark:text-gray-400 text-sm mb-4 ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {event.objective_summary}
                </p>

                {/* Always Visible Interaction Bar */}
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
                    <div className="flex gap-4">
                        <button
                            onClick={() => handleInteraction('like')}
                            title="Me gusta y quiero ver más de este enfoque"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${interaction === 'like' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-50 text-gray-600 hover:bg-green-50 hover:text-green-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-green-900/20 dark:hover:text-green-400'}`}
                        >
                            <svg className="w-4 h-4" fill={interaction === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                            {counters.likes > 0 && <span>{counters.likes}</span>}
                        </button>
                        <button
                            onClick={() => handleInteraction('dislike')}
                            title="No me gusta este enfoque"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${interaction === 'dislike' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400'}`}
                        >
                            <svg className="w-4 h-4" fill={interaction === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                            {counters.dislikes > 0 && <span>{counters.dislikes}</span>}
                        </button>
                    </div>

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                    >
                        {isExpanded ? dict.card.hide : dict.card.readMore}
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
            </div>

            {/* Expanded Section */}
            {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">

                    {event.source_url && (
                        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                            <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center gap-1 transition-colors">
                                {dict.card.readMore} ({event.source_name})
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                    )}

                    {/* Selector de Perspectiva (Oculto por defecto para el usuario final, visible en Dev Mode) */}
                    {devMode && (
                        <div className="flex w-full border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
                            {event.variants.map((v) => (
                                <button
                                    key={v.policy_type}
                                    onClick={() => setActiveTab(v.policy_type)}
                                    className={`flex-1 py-3 px-4 text-sm font-medium text-center transition-colors border-b-2 whitespace-nowrap ${activeTab === v.policy_type
                                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 z-10'
                                        }`}
                                >
                                    {v.policy_label || v.policy_type}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="p-6 md:p-8 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="prose prose-slate dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed mb-8">
                            {activeVariant.content.split('\n').map((paragraph: string, idx: number) => (
                                paragraph.trim() && <p key={idx} className="mb-4">{paragraph}</p>
                            ))}
                        </div>

                        {/* Componente de Comentarios */}
                        <CommentSection variantId={activeVariant.id} sessionId={sessionId} dict={dict} />
                    </div>
                </div>
            )}
        </article>
    );
}
