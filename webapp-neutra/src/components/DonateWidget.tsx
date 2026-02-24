"use client";

import { Heart, Coffee } from 'lucide-react';

export default function DonateWidget() {
    return (
        <div className="bg-white text-center pb-2 pt-8 px-6 rounded-t-2xl">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 mt-2">Apoya la Verdad</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Los algoritmos y la IA no son gratis. Ayúdanos a mantener este espacio libre de pautas corporativas.
            </p>
            <div className="flex flex-col gap-3">
                <a
                    href="https://cafecito.app/ianews"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#F39C12] hover:bg-[#D68910] text-white font-bold rounded-lg transition-colors shadow-sm"
                >
                    <Coffee className="w-4 h-4" />
                    Invitame un Cafecito
                </a>
                <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); alert("Dirección BTC: bc1q... (Próximamente)"); }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-colors shadow-sm text-sm"
                >
                    Donar Cripto
                </a>
            </div>
        </div>
    );
}
