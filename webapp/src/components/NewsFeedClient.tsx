'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import NewsCard from '@/components/NewsCard';
import { PolicyType } from '@/lib/personalization';

interface NewsFeedClientProps {
    initialEvents: any[];
    sessionId: string;
    globalPolicy: PolicyType;
    categoryPreferences: Record<string, number>;
    categoryMatrix: Record<string, PolicyType>;
    dict: Record<string, any>;
    userLanguage: string;
    userCountry: string;
}

export default function NewsFeedClient({
    initialEvents,
    sessionId,
    globalPolicy,
    categoryPreferences,
    categoryMatrix,
    dict,
    userLanguage,
    userCountry
}: NewsFeedClientProps) {
    const [events, setEvents] = useState(initialEvents);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(initialEvents.length === 10);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const loadMoreNews = useCallback(async () => {
        if (loading || !hasMore) return;
        setLoading(true);

        try {
            const lastEvent = events[events.length - 1];
            const lastDate = lastEvent ? lastEvent.published_at : null;

            const res = await fetch(`/api/news?lang=${userLanguage}&country=${userCountry}&limit=10${lastDate ? `&lastDate=${encodeURIComponent(lastDate)}` : ''}`);

            if (res.ok) {
                const { data } = await res.json();

                if (data && data.length > 0) {
                    setEvents(prev => [...prev, ...data]);
                    if (data.length < 10) setHasMore(false);
                } else {
                    setHasMore(false);
                }
            } else {
                console.error("Failed to load more news");
            }
        } catch (error) {
            console.error("Error loading more news:", error);
        } finally {
            setLoading(false);
        }
    }, [events, loading, hasMore, userLanguage, userCountry]);

    // Intersection Observer for Infinite Scroll
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMoreNews();
            }
        });

        if (node) observerRef.current.observe(node);
    }, [loading, hasMore, loadMoreNews]);

    // Sorting algorithm applied on the client side based on currently loaded events
    const sortedNewsEvents = [...events].map(event => {
        let relevance = 0;
        const catScore = categoryPreferences[event.category || 'General'] || 0;
        relevance += catScore;

        const daysOld = (new Date().getTime() - new Date(event.published_at).getTime()) / (1000 * 3600 * 24);
        if (daysOld < 1) relevance += 100;
        else if (daysOld < 3) relevance += 50;
        else relevance -= (daysOld * 2);

        return { ...event, relevance };
    }).sort((a, b) => b.relevance - a.relevance);

    if (sortedNewsEvents.length === 0 && !loading) {
        return (
            <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{dict.feed.noNews}</h3>
                <p className="mt-1 text-sm text-gray-500">{dict.feed.runWorker}</p>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            {sortedNewsEvents.map((event, index) => {
                const eventCategory = event.category || 'General';
                const categoryPreferredPolicy = categoryMatrix[eventCategory] || globalPolicy;

                // Deterministic calculation based on event.id to prevent hydration mismatch (SSR vs Client)
                const idHash = event.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                const isWildcardRoll = (idHash % 100) < 20; // 20% chance based on ID

                let finalLeaning = categoryPreferredPolicy;
                const perspectives: PolicyType[] = ['left', 'center', 'right'];

                if (isWildcardRoll) {
                    const alternatives = perspectives.filter(p => p !== categoryPreferredPolicy);
                    finalLeaning = alternatives[idHash % alternatives.length];
                }

                return (
                    <div
                        key={event.id}
                        ref={index === sortedNewsEvents.length - 1 ? lastElementRef : null}
                    >
                        <NewsCard
                            event={event as any}
                            preferredLeaning={finalLeaning}
                            isWildcard={isWildcardRoll && finalLeaning !== categoryPreferredPolicy}
                            sessionId={sessionId}
                            dict={dict}
                        />
                    </div>
                );
            })}

            {loading && (
                <div className="flex justify-center py-6">
                    <div className="animate-pulse flex flex-col items-center gap-2">
                        <div className="h-4 w-4 bg-blue-500 rounded-full animate-bounce"></div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">Cargando más historias...</span>
                    </div>
                </div>
            )}

            {!hasMore && sortedNewsEvents.length > 0 && (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                    <p>Has llegado al final de tu feed personalizado de los últimos días.</p>
                </div>
            )}
        </div>
    );
}
