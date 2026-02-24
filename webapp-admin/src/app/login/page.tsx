"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, pass })
            });
            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || 'Error de autenticación');
            }
        } catch {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-lg">N</div>
                    <div>
                        <p className="text-white font-black text-xl tracking-tight leading-none">Neutra<span className="text-slate-400 font-normal">.dev</span></p>
                        <p className="text-slate-500 text-xs">Panel de Administración</p>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
                    <h1 className="text-white font-bold text-lg mb-6">Iniciar sesión</h1>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 font-medium mb-1.5">Usuario</label>
                            <input
                                type="text"
                                value={user}
                                onChange={e => setUser(e.target.value)}
                                required
                                autoComplete="username"
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-600"
                                placeholder="admin"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 font-medium mb-1.5">Contraseña</label>
                            <input
                                type="password"
                                value={pass}
                                onChange={e => setPass(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-600"
                                placeholder="••••••••"
                            />
                        </div>
                        {error && (
                            <p className="text-red-400 text-xs text-center bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2">{error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
                        >
                            {loading ? 'Verificando...' : 'Entrar al Panel'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
