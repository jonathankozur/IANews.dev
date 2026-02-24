"use client";

import { useState } from 'react';
import { Filter, Search } from 'lucide-react';

interface FilterBarProps {
    onFilterChange: (filters: { source: string; tactic: string }) => void;
}

export default function FilterBar({ onFilterChange }: FilterBarProps) {
    const [source, setSource] = useState('all');
    const [tactic, setTactic] = useState('all');

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

    return (
        <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-lg p-4 mb-8 flex flex-col sm:flex-row items-center gap-4 justify-between w-full">
            <div className="flex items-center gap-2 text-slate-700 font-bold whitespace-nowrap">
                <Filter className="w-5 h-5 text-indigo-600" />
                Filtros Forenses:
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-48">
                    <select
                        value={source}
                        onChange={handleSourceChange}
                        className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                    >
                        <option value="all">Cualquier Medio</option>
                        {sources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                    </div>
                </div>

                <div className="relative w-full sm:w-56">
                    <select
                        value={tactic}
                        onChange={handleTacticChange}
                        className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                    >
                        <option value="all">Todas las Tácticas</option>
                        {tactics.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                    </div>
                </div>
            </div>
        </div>
    );
}
