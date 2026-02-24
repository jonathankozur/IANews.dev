"use client";

import { useState } from 'react';
import Link from 'next/link';
import DonateWidget from './DonateWidget';
import { X } from 'lucide-react';

export default function Header() {
    const [isDonateOpen, setIsDonateOpen] = useState(false);

    return (
        <header className="fixed w-full top-0 z-50 bg-slate-900 border-b border-slate-800 text-slate-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center font-bold group-hover:bg-red-500 transition-colors">N</div>
                            <h1 className="text-xl font-bold tracking-tight">Neutra<span className="text-slate-400 font-normal">.dev</span></h1>
                        </Link>
                    </div>
                    <nav className="flex items-center gap-4 md:gap-6 text-sm font-medium">
                        <div className="hidden md:flex gap-6">
                            <Link href="/" className="text-slate-300 hover:text-white transition">Auditorías</Link>
                            <Link href="/medios" className="text-slate-300 hover:text-white transition">Medios</Link>
                            <Link href="/about" className="text-slate-300 hover:text-white transition">Acerca del Proyecto</Link>
                        </div>
                        <button
                            onClick={() => setIsDonateOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm"
                        >
                            Donar
                        </button>
                    </nav>
                </div>
            </div>

            {/* Donation Modal Overlay */}
            {isDonateOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 min-h-screen animate-in fade-in duration-200">
                    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-slate-900 animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsDonateOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors bg-slate-100 hover:bg-slate-200 rounded-full p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="-mt-6 -mx-6 mb-6">
                            <DonateWidget />
                        </div>

                        <p className="text-xs text-center text-slate-500 mt-4 px-4">
                            Al apoyar Neutra.dev, nos ayudas a pagar la infraestructura tecnológica y mantener nuestro análisis 100% independiente.
                        </p>
                    </div>
                </div>
            )}
        </header>
    );
}
