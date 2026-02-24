"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Activity } from "lucide-react";

export default function TrendingTicker() {
    const [trends, setTrends] = useState<string[]>([]);

    useEffect(() => {
        async function fetchTrends() {
            try {
                const res = await fetch("/api/news?limit=6");
                const data = await res.json();
                if (data.data) {
                    setTrends(data.data.map((r: any) => r.title));
                }
            } catch (err) {
                console.error("Error fetching trends", err);
            }
        }
        fetchTrends();
    }, []);

    if (trends.length === 0) return null;

    return (
        <div className="bg-blue-600 dark:bg-blue-900/60 text-white text-xs font-semibold py-2.5 px-4 flex items-center overflow-hidden whitespace-nowrap border-b border-blue-700 dark:border-blue-900/80 shadow-inner relative">
            <div className="flex items-center gap-2 mr-4 shrink-0 z-10 bg-blue-600 dark:bg-transparent pr-4 relative">
                <Activity className="w-4 h-4 animate-pulse text-blue-200" />
                <span className="uppercase tracking-widest text-blue-50 font-bold">Último Momento</span>
                {/* Gradient mask for seamless scroll effect underneath the tag */}
                <div className="absolute right-0 top-0 bottom-0 w-8 translate-x-full bg-gradient-to-r from-blue-600 dark:from-blue-900/60 to-transparent z-10 pointer-events-none"></div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <div className="animate-marquee inline-block text-blue-100">
                    {trends.map((t, i) => (
                        <span key={i} className="mx-4 font-medium tracking-wide">
                            {t} {i < trends.length - 1 && <span className="text-blue-400 dark:text-blue-500/50 ml-8 animate-pulse">•</span>}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
