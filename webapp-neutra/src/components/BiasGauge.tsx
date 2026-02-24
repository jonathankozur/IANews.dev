"use client";

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

interface BiasGaugeProps {
    biasLevel: string;
    score?: number;
    shouldAnimate?: boolean; // Controlled by parent's IntersectionObserver
}

export default function BiasGauge({ biasLevel, score = 75, shouldAnimate = false }: BiasGaugeProps) {
    const [progress, setProgress] = useState(0);

    const getColor = (val: number) => {
        if (val < 40) return 'text-amber-400 stroke-amber-400';
        if (val < 70) return 'text-orange-500 stroke-orange-500';
        return 'text-red-600 stroke-red-600';
    };

    useEffect(() => {
        if (!shouldAnimate) return;
        const timer = setTimeout(() => {
            setProgress(score);
        }, 200);
        return () => clearTimeout(timer);
    }, [shouldAnimate, score]);

    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm text-white text-xs font-bold pl-2 pr-4 py-2 rounded-2xl uppercase tracking-wider shadow-xl flex items-center gap-3 border border-slate-700/50 max-w-[220px]">
            <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                {/* Background circle */}
                <svg className="w-full h-full transform -rotate-90 absolute top-0 left-0">
                    <circle
                        cx="24"
                        cy="24"
                        r={radius}
                        className="stroke-slate-700 fill-none"
                        strokeWidth="4"
                    />
                    {/* Animated foreground circle */}
                    <circle
                        cx="24"
                        cy="24"
                        r={radius}
                        className={`fill-none transition-all duration-[2500ms] ease-out ${getColor(score).split(' ')[1]}`}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                    />
                </svg>
                {/* Center Icon */}
                <ShieldAlert className={`w-4 h-4 z-10 ${getColor(score).split(' ')[0]}`} />
            </div>

            <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-slate-400 leading-none mb-1 normal-case tracking-normal font-normal">Sesgo Detectado</span>
                <span className="leading-tight text-[11px] whitespace-normal break-words">{biasLevel}</span>
            </div>
        </div>
    );
}
