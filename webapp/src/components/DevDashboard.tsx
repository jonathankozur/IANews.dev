'use client';

import { useState, useEffect } from 'react';

interface UserScores {
    left: number;
    center: number;
    right: number;
}

export default function DevDashboard({ sessionId }: { sessionId: string }) {
    const [scores, setScores] = useState<UserScores | null>(null);
    const [isOpen, setIsOpen] = useState(true);

    // Poll for scores every 3 seconds to see live updates from interactions
    useEffect(() => {
        if (!sessionId) return;

        const fetchScores = async () => {
            try {
                const res = await fetch(`/api/user/scores?session_id=${sessionId}`);
                if (res.ok) {
                    const data = await res.json();
                    setScores(data.scores);
                }
            } catch (err) {
                console.error("Failed to fetch dev scores", err);
            }
        };

        fetchScores(); // Initial fetch
        const interval = setInterval(fetchScores, 3000); // Polling

        return () => clearInterval(interval);
    }, [sessionId]);

    if (!scores || !isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-gray-900 text-white p-3 rounded-full shadow-lg opacity-50 hover:opacity-100 transition-opacity z-50 text-xs font-mono"
            >
                🛠️ Show Dev Score
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 bg-gray-900/95 backdrop-blur-md border border-gray-700 shadow-2xl rounded-xl p-5 z-50 w-72 text-gray-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                    <span>🛠️</span> Dev Mode: Profile Score
                </h4>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
                {/* Language Override Toggle */}
                <div className="flex justify-between items-center w-full mb-3 bg-gray-800 p-2 rounded">
                    <span className="text-gray-300 font-bold">i18n Toggle:</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { document.cookie = "dev_lang_override=es; path=/"; window.location.reload(); }}
                            className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
                        >🇪🇸 ES</button>
                        <button
                            onClick={() => { document.cookie = "dev_lang_override=en; path=/"; window.location.reload(); }}
                            className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
                        >🇺🇸 EN</button>
                    </div>
                </div>

                <div className="flex justify-between items-center w-full">
                    <span className="text-red-400">Izquierda:</span>
                    <div className="flex-1 mx-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, scores.left * 5))}%` }} />
                    </div>
                    <span className="font-bold min-w-[30px] text-right">{scores.left}</span>
                </div>

                <div className="flex justify-between items-center w-full">
                    <span className="text-slate-400">Centro: &nbsp;&nbsp;</span>
                    <div className="flex-1 mx-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, scores.center * 5))}%` }} />
                    </div>
                    <span className="font-bold min-w-[30px] text-right">{scores.center}</span>
                </div>

                <div className="flex justify-between items-center w-full">
                    <span className="text-blue-400">Derecha: &nbsp;</span>
                    <div className="flex-1 mx-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, scores.right * 5))}%` }} />
                    </div>
                    <span className="font-bold min-w-[30px] text-right">{scores.right}</span>
                </div>
            </div>

            <p className="text-[10px] text-gray-500 mt-4 text-center leading-tight">
                Se actualiza cada 3s. Lee o interactúa con noticias para ver los cambios.
            </p>
        </div>
    );
}
