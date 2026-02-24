"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
    slot: string;
    format?: "auto" | "rectangle" | "horizontal";
    className?: string;
}

export default function AdBanner({ slot, format = "auto", className = "" }: AdBannerProps) {
    const pushed = useRef(false);

    useEffect(() => {
        if (pushed.current) return;
        try {
            const win = window as any;
            (win.adsbygoogle = win.adsbygoogle || []).push({});
            pushed.current = true;
        } catch {
            // Silent — AdSense lanzará error si el script no cargó aún
        }
    }, []);

    // En desarrollo mostramos un placeholder visual para que el layout sea visible
    if (process.env.NODE_ENV !== "production") {
        return (
            <div
                className={`bg-slate-100 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center gap-1 ${className}`}
                style={{ minHeight: 90 }}
            >
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Publicidad</span>
                <span className="text-xs text-slate-400 font-mono">slot: {slot}</span>
            </div>
        );
    }

    return (
        <ins
            className={`adsbygoogle ${className}`}
            style={{ display: "block" }}
            data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT}
            data-ad-slot={slot}
            data-ad-format={format}
            data-full-width-responsive="true"
        />
    );
}
