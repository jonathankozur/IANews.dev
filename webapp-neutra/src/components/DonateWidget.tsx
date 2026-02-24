"use client";

import { useState } from 'react';
import { Heart, Coffee, Copy, Check, Bitcoin } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
// Editá estos valores para configurar tus métodos de pago

const MERCADOPAGO_ALIAS = "jonathankozur.mp";
const MERCADOPAGO_URL = "https://link.mercadopago.com.ar/neutranews";

const CRYPTO_WALLETS: { symbol: string; label: string; address: string }[] = [
    // Cripto deshabilitado por ahora — descomentar cuando esté listo
    // { symbol: "BTC", label: "Bitcoin (BSC)", address: "0x2fe0f1704666714b8ad192765cf44cc7aff27db6" },
    // { symbol: "ETH", label: "Ethereum (BSC)", address: "0x2fe0f1704666714b8ad192765cf44cc7aff27db6" },
    // { symbol: "USDT", label: "Tether (BSC)", address: "0x2fe0f1704666714b8ad192765cf44cc7aff27db6" },
];

const CAFECITO_URL = "https://cafecito.app/ianews";
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "mp" | "cafecito" | "crypto";

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            title="Copiar"
            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
    );
}

export default function DonateWidget() {
    const [tab, setTab] = useState<Tab>("mp");

    const tabs: { id: Tab; label: string; emoji: string }[] = [
        { id: "mp", label: "MercadoPago", emoji: "💳" },
        { id: "cafecito", label: "Cafecito", emoji: "☕" },
        { id: "crypto", label: "Cripto", emoji: "₿" },
    ];

    return (
        <div className="bg-white text-center px-6 pt-6 pb-4 rounded-t-2xl">
            {/* Header */}
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">Apoya la Verdad</h3>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                Ayúdanos a mantener este espacio libre de pautas corporativas.
            </p>

            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-5 gap-1">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${tab === t.id
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        <span className="mr-1">{t.emoji}</span>{t.label}
                    </button>
                ))}
            </div>

            {/* MercadoPago */}
            {tab === "mp" && (
                <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <img
                            src="/QR MERCADOPAGO.png"
                            alt="QR MercadoPago"
                            width={148}
                            height={148}
                            className="rounded-lg"
                        />
                    </div>
                    <p className="text-xs text-slate-400">Escaneá con la app de MercadoPago</p>
                    <div className="flex items-center justify-between w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-sm font-mono font-semibold text-slate-700">{MERCADOPAGO_ALIAS}</span>
                        <CopyButton text={MERCADOPAGO_ALIAS} />
                    </div>
                    <a
                        href={MERCADOPAGO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#009EE3] hover:bg-[#0088CC] text-white font-bold rounded-lg transition-colors shadow-sm text-sm"
                    >
                        💳 Donar por MercadoPago
                    </a>
                </div>
            )}

            {/* Cafecito */}
            {tab === "cafecito" && (
                <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <QRCodeSVG
                            value={CAFECITO_URL}
                            size={148}
                            bgColor="#f8fafc"
                            fgColor="#1e293b"
                            level="M"
                        />
                    </div>
                    <p className="text-xs text-slate-400">Escaneá o hacé clic abajo</p>
                    <a
                        href={CAFECITO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#F39C12] hover:bg-[#D68910] text-white font-bold rounded-lg transition-colors shadow-sm"
                    >
                        <Coffee className="w-4 h-4" />
                        Invitame un Cafecito
                    </a>
                </div>
            )}

            {/* Crypto */}
            {tab === "crypto" && (
                <div className="flex flex-col items-center gap-3">
                    {CRYPTO_WALLETS.length === 0 ? (
                        <div className="py-6 text-center text-slate-400">
                            <Bitcoin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm font-medium">Próximamente</p>
                            <p className="text-xs mt-1">Las direcciones cripto estarán disponibles en breve.</p>
                        </div>
                    ) : (
                        CRYPTO_WALLETS.map((wallet) => (
                            <div key={wallet.symbol} className="w-full">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{wallet.label}</span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-2 flex justify-center">
                                    <QRCodeSVG value={wallet.address} size={120} bgColor="#f8fafc" fgColor="#1e293b" level="M" />
                                </div>
                                <div className="flex items-center justify-between w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                    <span className="text-xs font-mono text-slate-600 truncate mr-2">{wallet.address}</span>
                                    <CopyButton text={wallet.address} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
