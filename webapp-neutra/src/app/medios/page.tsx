import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { BarChart2, Newspaper, TrendingUp, ImageIcon } from 'lucide-react';

interface TacticEntry {
    name: string;
    count: number;
}

interface IdeologyDist {
    izquierda: number;
    centro: number;
    derecha: number;
    otro: number;
}

interface MediaStat {
    source_name: string;
    total_articles: number;
    avg_bias_score: number;
    tactics_breakdown: TacticEntry[];
    ideology_distribution: IdeologyDist;
    original_images: number;
    stock_images: number;
    no_images: number;
    last_article_at: string | null;
    computed_at: string;
}

async function getMediaStats(): Promise<MediaStat[]> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
        .from('media_stats')
        .select('*')
        .order('total_articles', { ascending: false });

    if (error) {
        console.error('[Medios Page] Error al obtener media_stats:', error.message);
        return [];
    }
    return data || [];
}

function BiasBar({ score }: { score: number }) {
    const color = score < 40 ? 'bg-amber-400' : score < 70 ? 'bg-orange-500' : 'bg-red-600';
    const label = score < 40 ? 'Sesgo Bajo' : score < 70 ? 'Sesgo Moderado' : 'Sesgo Alto';
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <span className="text-xs font-bold text-slate-700">{score}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-2 rounded-full ${color} transition-all duration-700`}
                    style={{ width: `${score}%` }}
                />
            </div>
        </div>
    );
}

function IdeologyPill({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    if (count === 0) return null;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold ${color}`}>
            <span>{label}</span>
            <span>{count} ({pct}%)</span>
        </div>
    );
}

function ImageBreakdown({ original, stock, none }: { original: number; stock: number; none: number }) {
    const total = original + stock + none;
    if (total === 0) return null;
    return (
        <div className="flex gap-1 mt-1">
            {original > 0 && (
                <div
                    className="h-1.5 rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${(original / total) * 100}%` }}
                    title={`Original: ${original}`}
                />
            )}
            {stock > 0 && (
                <div
                    className="h-1.5 rounded-full bg-sky-400 transition-all"
                    style={{ width: `${(stock / total) * 100}%` }}
                    title={`Stock: ${stock}`}
                />
            )}
            {none > 0 && (
                <div
                    className="h-1.5 rounded-full bg-slate-200 transition-all"
                    style={{ width: `${(none / total) * 100}%` }}
                    title={`Sin imagen: ${none}`}
                />
            )}
        </div>
    );
}

export default async function MediosPage() {
    const stats = await getMediaStats();
    const computedAt = stats[0]?.computed_at ? new Date(stats[0].computed_at).toLocaleString('es-AR') : null;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <BarChart2 className="w-7 h-7 text-indigo-600" />
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Análisis por Medio</h1>
                </div>
                <p className="text-slate-500 text-sm max-w-2xl">
                    Radiografía forense de cada medio. Qué tácticas usa, cuán sesgado es su contenido y cómo usa los recursos visuales.
                </p>
                {computedAt && (
                    <p className="text-xs text-slate-400 mt-2">Última actualización: {computedAt}</p>
                )}
            </div>

            {/* Empty State */}
            {stats.length === 0 && (
                <div className="text-center py-24 border border-dashed border-slate-300 rounded-xl text-slate-500">
                    <BarChart2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="font-semibold mb-1">Sin datos todavía</p>
                    <p className="text-sm">Ejecutá el worker <span className="font-mono bg-slate-100 px-1 rounded">stats-1</span> desde el Hub para generar las estadísticas.</p>
                </div>
            )}

            {/* Cards Grid */}
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {stats.map((stat) => {
                    const topTactics = (stat.tactics_breakdown || []).slice(0, 3);
                    const ideology = stat.ideology_distribution || { izquierda: 0, centro: 0, derecha: 0, otro: 0 };
                    const totalImages = (stat.original_images || 0) + (stat.stock_images || 0) + (stat.no_images || 0);

                    return (
                        <div
                            key={stat.source_name}
                            className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                        >
                            {/* Card Header */}
                            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Newspaper className="w-4 h-4 text-slate-400" />
                                    <h2 className="font-black text-white text-base">{stat.source_name}</h2>
                                </div>
                                <span className="bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                    {stat.total_articles} art.
                                </span>
                            </div>

                            <div className="p-5 flex flex-col gap-5">
                                {/* Bias Score */}
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <TrendingUp className="w-3.5 h-3.5" /> Sesgo Promedio
                                    </p>
                                    <BiasBar score={stat.avg_bias_score || 0} />
                                </div>

                                {/* Top Tactics */}
                                {topTactics.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Top Tácticas</p>
                                        <ol className="space-y-1.5">
                                            {topTactics.map((t, i) => (
                                                <li key={t.name} className="flex items-center justify-between text-xs">
                                                    <span className="flex items-center gap-1.5 text-slate-700">
                                                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-red-100 text-red-700' : i === 1 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {i + 1}
                                                        </span>
                                                        {t.name}
                                                    </span>
                                                    <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{t.count}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Ideology Distribution */}
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Perfil Ideológico</p>
                                    <div className="flex flex-col gap-1.5">
                                        <IdeologyPill label="Izquierda / Progresista" count={ideology.izquierda} total={stat.total_articles} color="bg-rose-50 text-rose-700" />
                                        <IdeologyPill label="Centro / Moderado" count={ideology.centro} total={stat.total_articles} color="bg-sky-50 text-sky-700" />
                                        <IdeologyPill label="Derecha / Conservador" count={ideology.derecha} total={stat.total_articles} color="bg-indigo-50 text-indigo-700" />
                                        <IdeologyPill label="Otro / Inclasificable" count={ideology.otro} total={stat.total_articles} color="bg-slate-50 text-slate-600" />
                                    </div>
                                </div>

                                {/* Image Resources */}
                                {totalImages > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <ImageIcon className="w-3.5 h-3.5" /> Recursos Visuales
                                        </p>
                                        <ImageBreakdown
                                            original={stat.original_images || 0}
                                            stock={stat.stock_images || 0}
                                            none={stat.no_images || 0}
                                        />
                                        <div className="flex gap-3 mt-2 text-[10px] text-slate-400">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />Original ({stat.original_images})</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />Stock ({stat.stock_images})</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />Sin img ({stat.no_images})</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
