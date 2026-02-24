"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft,
    Save,
    Trash2,
    Plus,
    AlertTriangle,
    CheckCircle,
    Globe,
    FileText,
    ShieldAlert,
    X,
    ImageIcon
} from 'lucide-react';

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [article, setArticle] = useState<any>(null);
    const router = useRouter();

    const fetchArticle = async () => {
        try {
            const res = await fetch(`/api/articles/${id}`);
            if (res.ok) {
                const data = await res.json();
                setArticle(data);
            } else {
                alert("Error al cargar el artículo");
                router.push('/');
            }
        } catch {
            alert("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchArticle();
    }, [id]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/articles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(article)
            });
            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                alert("Error al guardar los cambios");
            }
        } catch {
            alert("Error de conexión");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
    );

    if (!article) return null;

    return (
        <div className="flex flex-col min-h-screen bg-slate-950">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/')}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="h-6 w-px bg-slate-800"></div>
                    <span className="font-bold tracking-tight text-white line-clamp-1 max-w-sm">Editar: {article.title_neutral}</span>
                </div>

                <button
                    form="edit-form"
                    type="submit"
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm flex items-center gap-2"
                >
                    <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </header>

            <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
                <form id="edit-form" onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Main Content Column */}
                    <div className="md:col-span-2 space-y-8">

                        {/* Title Section */}
                        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
                            <h2 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-400" /> Contenido Neutralizado
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-tighter">Título Neutro</label>
                                    <textarea
                                        rows={2}
                                        value={article.title_neutral}
                                        onChange={e => setArticle({ ...article, title_neutral: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-base font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-tighter">Resumen Objetivo</label>
                                    <textarea
                                        rows={6}
                                        value={article.objective_summary}
                                        onChange={e => setArticle({ ...article, objective_summary: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Analysis Section */}
                        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
                            <h2 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-rose-400" /> Análisis Forense
                            </h2>

                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-tighter">Nivel de Sesgo Detectado</label>
                                    <input
                                        type="text"
                                        value={article.detected_bias}
                                        onChange={e => setArticle({ ...article, detected_bias: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-slate-500 font-medium mb-2 uppercase tracking-tighter">Tácticas de Manipulación</label>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {(article.manipulation_tactics || []).map((t: string, i: number) => (
                                            <span key={i} className="bg-indigo-950/40 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2">
                                                {t}
                                                <button type="button" onClick={() => {
                                                    const newT = [...article.manipulation_tactics];
                                                    newT.splice(i, 1);
                                                    setArticle({ ...article, manipulation_tactics: newT });
                                                }}>
                                                    <X className="w-3 h-3 text-indigo-500 hover:text-white" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const t = prompt("Nueva táctica:");
                                            if (t) setArticle({ ...article, manipulation_tactics: [...(article.manipulation_tactics || []), t] });
                                        }}
                                        className="text-xs text-indigo-500 hover:text-indigo-400 font-black flex items-center gap-1.5 uppercase tracking-tighter"
                                    >
                                        <Plus className="w-3 h-3" /> Agregar Táctica
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-tighter">Contexto Omitido</label>
                                    <textarea
                                        rows={4}
                                        value={article.omitted_context}
                                        onChange={e => setArticle({ ...article, omitted_context: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Sidebar Area Column */}
                    <div className="space-y-8">

                        {/* Info Section */}
                        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                            <h2 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                                <Globe className="w-4 h-4 text-emerald-400" /> Datos Originales
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-tighter">Medio de Origen</label>
                                    <p className="text-white font-black">{article.source_name}</p>
                                </div>
                                <div className="h-px bg-slate-800"></div>
                                <div>
                                    <label className="block text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-tighter">Titular Original</label>
                                    <p className="text-slate-400 text-xs italic leading-tight">&ldquo;{article.title_original}&rdquo;</p>
                                </div>
                            </div>
                        </section>

                        {/* Image Preview */}
                        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                            <h2 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-sky-400" /> Imagen del Artículo
                            </h2>

                            <div className="space-y-4">
                                <div className="aspect-video w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                                    <img
                                        src={article.image_url_original || article.image_url_stock}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/400x225?text=Sin+Imagen')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-tighter">URL de Imagen</label>
                                    <input
                                        type="text"
                                        value={article.image_url_original || ''}
                                        onChange={e => setArticle({ ...article, image_url_original: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 overflow-ellipsis"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Danger Zone */}
                        <section className="bg-red-950/10 border border-red-900/30 rounded-2xl p-6">
                            <h2 className="text-red-500 font-bold uppercase text-[10px] tracking-widest mb-4">Zona de Peligro</h2>
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm("¿Borrar definitivamente?")) {
                                        fetch(`/api/articles/${id}`, { method: 'DELETE' }).then(() => router.push('/'));
                                    }
                                }}
                                className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/40 font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Eliminar Artículo
                            </button>
                        </section>
                    </div>
                </form>
            </main>
        </div>
    );
}
