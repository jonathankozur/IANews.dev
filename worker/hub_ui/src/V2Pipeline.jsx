import { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, Eye, Terminal as TerminalIcon, ShieldCheck, Zap, X, Twitter } from 'lucide-react';

const SOCKET_URL = 'http://localhost:4000';

export default function V2Pipeline({ globalLogs }) {
    const [articles, setArticles] = useState([]);
    const [runnerStatus, setRunnerStatus] = useState({ isRunning: false, aiProvider: 'ollama' });
    const [selectedEngine, setSelectedEngine] = useState('ollama');
    const [loading, setLoading] = useState(false);
    const [inspectArticle, setInspectArticle] = useState(null);
    const [filterStatus, setFilterStatus] = useState('ACTIVE'); // Default: Hide DISCARDED_RAW

    const logsEndRef = useRef(null);

    const v2Logs = globalLogs.filter(l => l.taskName === 'Pipeline V2');

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [v2Logs]);

    const fetchData = async () => {
        try {
            const [artRes, runRes] = await Promise.all([
                fetch(`${SOCKET_URL}/api/v2/articles`),
                fetch(`${SOCKET_URL}/api/v2/autorunner/status`)
            ]);
            const artData = await artRes.json();
            const runData = await runRes.json();
            setArticles(Array.isArray(artData) ? artData : []);
            setRunnerStatus(runData);
            if (runData.isRunning) {
                setSelectedEngine(runData.aiProvider);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Polling for grid speed
        return () => clearInterval(interval);
    }, []);

    const toggleRunner = async () => {
        setLoading(true);
        try {
            const action = runnerStatus.isRunning ? 'stop' : 'start';
            const res = await fetch(`${SOCKET_URL}/api/v2/autorunner/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, aiProvider: selectedEngine })
            });
            const data = await res.json();
            setRunnerStatus(data.status);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const executeManual = async (id) => {
        try {
            await fetch(`${SOCKET_URL}/api/v2/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, aiProvider: selectedEngine })
            });
            setTimeout(fetchData, 1000);
        } catch (e) {
            console.error(e);
        }
    };

    const revertManual = async (id) => {
        try {
            await fetch(`${SOCKET_URL}/api/v2/revert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            setTimeout(fetchData, 1000);
        } catch (e) {
            console.error(e);
        }
    };

    const publishTwitterManual = async (id) => {
        try {
            await fetch(`${SOCKET_URL}/api/v2/twitter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            setTimeout(fetchData, 1000);
        } catch (e) {
            console.error(e);
        }
    };

    // Status badge colors
    const getStatusColor = (status) => {
        if (status === 'PENDING_ANALYSIS') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        if (status === 'PENDING_NEUTRALIZATION') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        if (status === 'PENDING_SOCIAL') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        if (status === 'READY_TO_PUBLISH') return 'bg-green-500/20 text-green-400 border-green-500/30';
        if (status.includes('FAILED')) return 'bg-red-500/20 text-red-400 border-red-500/30';
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    };

    // Filtering logic
    const filteredArticles = articles.filter(art => {
        if (filterStatus === 'ACTIVE') return art.status !== 'DISCARDED_RAW';
        if (filterStatus === 'ALL') return true;
        return art.status === filterStatus;
    });

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-gray-200">

            {/* Top Console & Controls Area */}
            <div className="flex h-[35%] border-b border-white/10 shrink-0">

                {/* Controls */}
                <div className="w-1/3 p-6 flex flex-col justify-center items-center border-r border-white/10 bg-white/[0.02]">
                    <ShieldCheck size={48} className={`mb-4 ${runnerStatus.isRunning ? 'text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]' : 'text-gray-600'}`} />
                    <h2 className="text-xl font-bold mb-1">V2 Auto-Runner</h2>
                    <p className="text-xs text-gray-500 mb-6 text-center">Orquestador de LLM-as-a-judge</p>

                    <div className="flex flex-col w-full max-w-xs gap-3">
                        <select
                            className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500 cursor-pointer"
                            value={selectedEngine}
                            onChange={e => setSelectedEngine(e.target.value)}
                            disabled={runnerStatus.isRunning}
                        >
                            <option value="ollama">Ollama (Local LLM)</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="groq">Groq (Rápido)</option>
                            <option value="openrouter">OpenRouter</option>
                        </select>

                        <button
                            onClick={toggleRunner}
                            disabled={loading}
                            className={`flex justify-center items-center gap-2 py-3 px-4 rounded font-bold transition-all shadow-lg ${runnerStatus.isRunning
                                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20'
                                : 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/20'
                                }`}
                        >
                            {runnerStatus.isRunning ? (
                                <><Square size={18} fill="currentColor" /> Detener Pipeline</>
                            ) : (
                                <><Play size={18} fill="currentColor" /> Encender Pipeline</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Live Logs */}
                <div className="w-2/3 p-4 bg-black overflow-y-auto custom-scrollbar font-mono text-xs flex flex-col relative">
                    <div className="absolute top-2 right-4 text-gray-600"><TerminalIcon size={16} /></div>
                    {v2Logs.length === 0 ? (
                        <div className="text-gray-600 mt-4 flex justify-center items-center h-full opacity-50">Esperando eventos del AutoRunner V2...</div>
                    ) : (
                        <div className="space-y-1">
                            {v2Logs.map((log, i) => (
                                <div key={i} className={`flex gap-3 hover:bg-white/[0.02] px-1 rounded ${log.type === 'error' ? 'text-red-400' : log.type === 'system' ? 'text-blue-300' : 'text-gray-300'}`}>
                                    <span className="text-gray-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                    <span className="break-all">{log.message}</span>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Articles Grid Area */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-[#0f0a14]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Zap size={18} className="text-yellow-400" /> Cola de Procesamiento V2
                        <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-full ml-2">
                            {filteredArticles.length} resultados
                        </span>
                    </h3>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Filtro:</span>
                        <select
                            className="bg-[#1a1225] border border-white/10 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500 cursor-pointer text-gray-200 shadow-lg"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="ACTIVE">Activos (Ocultar Descartes)</option>
                            <option value="ALL">Mostrar Absolutamente Todos</option>
                            <option value="PENDING_ANALYSIS">Fase 1: PENDING_ANALYSIS</option>
                            <option value="PENDING_NEUTRALIZATION">Fase 2: PENDING_NEUTRALIZATION</option>
                            <option value="PENDING_SOCIAL">Fase 3: PENDING_SOCIAL</option>
                            <option value="READY_TO_PUBLISH">Finalizados: READY_TO_PUBLISH</option>
                            <option value="DISCARDED_RAW">Descartados: DISCARDED_RAW</option>
                            <option value="ANALYSIS_FAILED">Fallos: ANALYSIS_FAILED</option>
                            <option value="NEUTRALIZATION_FAILED">Fallos: NEUTRALIZATION_FAILED</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredArticles.map(art => (
                        <div key={art.id} className="bg-[#1a1225] border border-white/5 hover:border-white/10 transition-colors rounded-xl p-4 flex flex-col shadow-lg">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${getStatusColor(art.status)}`}>
                                    {art.status.replace('PENDING_', '')}
                                </span>
                                <span className="text-xs text-gray-500">{new Date(art.created_at).toLocaleDateString()}</span>
                            </div>

                            <h4 className="font-semibold text-gray-200 text-sm mb-1 leading-snug line-clamp-2" title={art.clean_title || art.raw_title}>
                                {art.clean_title || art.raw_title}
                            </h4>
                            <p className="text-xs text-gray-500 mb-4 line-clamp-1">{art.source_domain}</p>

                            <div className="mt-auto flex gap-2 justify-end pt-3 border-t border-white/5">
                                <button
                                    onClick={() => setInspectArticle(art)}
                                    className="p-1.5 rounded bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-colors"
                                    title="Inspeccionar JSON generados"
                                >
                                    <Eye size={16} />
                                </button>
                                <button
                                    onClick={() => revertManual(art.id)}
                                    disabled={art.status === 'PENDING_ANALYSIS' || art.status.includes('DISCARDED') || runnerStatus.isRunning}
                                    className="p-1.5 rounded bg-white/5 hover:bg-orange-500/20 text-gray-400 hover:text-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Retroceder 1 Etapa (Revert)"
                                >
                                    <RotateCcw size={16} />
                                </button>
                                <button
                                    onClick={() => executeManual(art.id)}
                                    disabled={art.status === 'READY_TO_PUBLISH' || art.status.includes('DISCARDED') || runnerStatus.isRunning}
                                    className="p-1.5 rounded bg-white/5 hover:bg-green-500/20 text-gray-400 hover:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Forzar Ejecución Manual"
                                >
                                    <Play size={16} />
                                </button>
                                <button
                                    onClick={() => publishTwitterManual(art.id)}
                                    disabled={art.status !== 'READY_TO_PUBLISH' || runnerStatus.isRunning}
                                    className="p-1.5 rounded bg-white/5 hover:bg-[#1DA1F2]/20 text-gray-400 hover:text-[#1DA1F2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Publicar Hilo en X/Twitter"
                                >
                                    <Twitter size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredArticles.length === 0 && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 italic">
                            <ShieldCheck size={48} className="opacity-20 mb-4" />
                            Base de datos limpia o filtro sin resultados.
                        </div>
                    )}
                </div>
            </div>

            {/* Inspect Modal */}
            {inspectArticle && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#150d22] border border-purple-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                            <h2 className="text-lg font-bold">Inspector V2: <span className="text-purple-400 font-mono text-sm">{inspectArticle.id.substring(0, 8)}</span></h2>
                            <button onClick={() => setInspectArticle(null)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6 text-sm custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h3 className="font-bold text-red-400">Título Original</h3>
                                    <p className="bg-black/50 p-3 rounded border border-white/5 text-gray-300">{inspectArticle.raw_title}</p>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-bold text-green-400">Título Neutralizado</h3>
                                    <p className="bg-black/50 p-3 rounded border border-white/5 text-gray-300">
                                        {inspectArticle.clean_title ? inspectArticle.clean_title : <span className="italic text-gray-600">Aún no generado...</span>}
                                    </p>
                                </div>
                            </div>

                            {inspectArticle.bias && (
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-purple-400">Análisis Forense I.A.</h3>
                                        <span className="font-mono bg-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)] text-purple-300 px-3 py-1 rounded border border-purple-500/30">
                                            Score: {inspectArticle.bias_score}/100
                                        </span>
                                    </div>
                                    <p className="mb-2"><strong>Tipología de Sesgo:</strong> <span className="text-yellow-200">{inspectArticle.bias}</span></p>
                                    <p className="mb-3">
                                        <strong>Tácticas Empleadas:</strong>{' '}
                                        {inspectArticle.manipulation_tactics?.map((t, i) => (
                                            <span key={i} className="inline-block bg-white/10 px-2 py-0.5 rounded-full text-xs mr-2 mb-1">{t}</span>
                                        ))}
                                    </p>
                                    <p className="text-gray-400 mb-5 italic border-l-2 border-purple-500/50 pl-3">"{inspectArticle.full_analysis_text}"</p>

                                    {inspectArticle.biased_fragments && inspectArticle.biased_fragments.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-xs uppercase text-gray-500 tracking-widest mb-2">Citas Textuales Detectadas</h4>
                                            {inspectArticle.biased_fragments.map((bf, i) => (
                                                <div key={i} className="bg-black/50 p-3 rounded text-xs border-l-2 border-red-500 border-y border-r border-white/5">
                                                    <p className="italic mb-2 text-red-200">"{bf.quote}"</p>
                                                    <p className="text-gray-400"><strong className="text-gray-300">Auditoría:</strong> {bf.explanation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {inspectArticle.social_thread && (
                                <div className="bg-blue-900/10 p-5 rounded-xl border border-blue-500/20">
                                    <h3 className="font-bold text-blue-400 mb-4 flex items-center gap-2">
                                        <Zap size={16} /> Social Thread (Listo para X/Twitter)
                                    </h3>
                                    <div className="space-y-3">
                                        {inspectArticle.social_thread.map((tweet, i) => (
                                            <div key={i} className="bg-[#1DA1F2]/10 p-3 rounded-lg border border-[#1DA1F2]/30 text-blue-100 flex gap-3">
                                                <div className="shrink-0 w-8 h-8 rounded-full bg-[#1DA1F2]/20 flex items-center justify-center font-bold text-[#1DA1F2]">{i + 1}</div>
                                                <div className="pt-1">{tweet}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
