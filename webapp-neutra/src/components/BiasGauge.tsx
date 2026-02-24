"use client";

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

interface BiasGaugeProps {
    biasLevel: string; // The text description of the bias
    score?: number; // 0 to 100
}

export default function BiasGauge({ biasLevel, score = 75 }: BiasGaugeProps) {
    const [progress, setProgress] = useState(0);

    // Determines color based on score (higher is more biased/red)
    const getColor = (val: number) => {
        if (val < 40) return 'text-amber-400 stroke-amber-400';
        if (val < 70) return 'text-orange-500 stroke-orange-500';
        return 'text-red-600 stroke-red-600';
    };

    useEffect(() => {
        // Animate on mount
        const timer = setTimeout(() => {
            setProgress(score);
        }, 100);
        return () => clearTimeout(timer);
    }, [score]);

    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm text-white text-xs font-bold pl-2 pr-4 py-2 rounded-full uppercase tracking-wider shadow-xl flex items-center gap-3 border border-slate-700/50">
            <div className="relative w-12 h-12 flex items-center justify-center">
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
                        className={`fill-none transition-all duration-1000 ease-out ${getColor(score).split(' ')[1]}`}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                    />
                </svg>
                {/* Center Icon */}
                <ShieldAlert className={`w-4 h-4 z-10 ${getColor(score).split(' ')[0]}`} />
            </div>

            <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 leading-none mb-1">Sesgo Detectado</span>
                <span className="leading-none max-w-[140px] truncate" title={biasLevel}>{biasLevel}</span>
            </div>
        </div>
    );
}
