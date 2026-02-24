"use client";

import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

interface FilterBarProps {
    onFilterChange: (filters: { source: string; tactic: string }) => void;
}

export default function FilterBar({ onFilterChange }: FilterBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [source, setSource] = useState('all');
    const [tactic, setTactic] = useState('all');
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const hasActiveFilters = source !== 'all' || tactic !== 'all';

    const sources = [
        "Infobae", "Clarín", "La Nación", "Página/12", "Ámbito Financiero", "Letra P"
    ];

    const tactics = [
        "Apelación a la emoción",
        "Sesgo de omisión",
        "Lenguaje sesgado",
        "Encuadre (Framing)",
        "Falacia de hombre de paja",
        "Generalización apresurada"
    ];

    const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSource(e.target.value);
        onFilterChange({ source: e.target.value, tactic });
    };

    const handleTacticChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setTactic(e.target.value);
        onFilterChange({ source, tactic: e.target.value });
    };

    const handleClear = () => {
        setSource('all');
        setTactic('all');
        onFilterChange({ source: 'all', tactic: 'all' });
    };

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative flex justify-end mb-6">
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(prev => !prev)}
                title="Filtros Forenses"
                className={`relative flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-all duration-200 shadow-sm
                    ${isOpen
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
                    }`}
            >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filtros</span>
                {/* Active indicator dot */}
                {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div
                    ref={panelRef}
                    className="absolute top-12 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-72 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filtros Forenses</span>
                        {hasActiveFilters && (
                            <button
                                onClick={handleClear}
                                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition-colors"
                            >
                                <X className="w-3 h-3" /> Limpiar
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* Source Filter */}
                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1">Medio</label>
                            <div className="relative">
                                <select
                                    value={source}
                                    onChange={handleSourceChange}
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="all">Cualquier Medio</option>
                                    {sources.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                    <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Tactic Filter */}
                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1">Táctica</label>
                            <div className="relative">
                                <select
                                    value={tactic}
                                    onChange={handleTacticChange}
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="all">Todas las Tácticas</option>
                                    {tactics.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                    <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
