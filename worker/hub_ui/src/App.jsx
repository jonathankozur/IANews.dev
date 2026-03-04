import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { createClient } from '@supabase/supabase-js';
import { Server, Activity, Play, Square, Settings, Terminal as TerminalIcon, Plus, Trash2, ChevronDown, ChevronRight, X, Loader2, Download, ArrowDown } from 'lucide-react';

const SOCKET_URL = 'http://localhost:4000'; // Hub Backend URL

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const WORKER_TYPES = [
  { id: 'scraper', label: 'Scraper 🕸️' },
  { id: 'processor', label: 'AI Queue Consumer 🧠' },
  { id: 'image_original', label: 'Image Downloader 🖼️' },
  { id: 'watchdog', label: 'Watchdog 🐕' },

  // Asynchronous Phases
  { id: 'phase0_submitter', label: 'Phase 0: Theme Filter 📤' },
  { id: 'phase0_receiver', label: 'Phase 0: Receiver 📥' },
  { id: 'phase1_submitter', label: 'Phase 1: Forensic 📤' },
  { id: 'phase1_receiver', label: 'Phase 1: Receiver 📥' },
  { id: 'phase2_submitter', label: 'Phase 2: Neutralizer 📤' },
  { id: 'phase2_receiver', label: 'Phase 2: Receiver 📥' },
  { id: 'phase_qcb_submitter', label: 'QC B: Editorial Judge ⚖️' },
  { id: 'phase_qcb_receiver', label: 'QC B: Receiver 📥' },
  { id: 'phase3_submitter', label: 'Phase 3: Twitter Gen 🐦' },
  { id: 'phase3_receiver', label: 'Phase 3: Receiver 📥' },
  { id: 'phase_qca_receiver', label: 'QC A: Translation Healer 🏥' },

  { id: 'twitter_audit', label: 'Twitter Audit 🧵' },
  { id: 'twitter', label: 'Twitter Publisher 🚀' },
  { id: 'stats', label: 'Statistics 📊' }
];

// Mapeo detallado de qué prompts puede configurar cada worker
const TASK_PROMPT_CONFIG = {
  'phase0_submitter': {
    title: 'Configuración: Filtro Temático (Fase 0)',
    prompts: [{ key: 'relevance', label: 'Prompt: Filtro Criterio' }]
  },
  'phase1_submitter': {
    title: 'Configuración: Análisis Forense (Fase 1)',
    prompts: [{ key: 'audit', label: 'Prompt: Extracción de Hechos' }]
  },
  'phase2_submitter': {
    title: 'Configuración: Redacción Neutral (Fase 2)',
    prompts: [{ key: 'neutral', label: 'Prompt: Generador Neutral' }]
  },
  'phase_qcb_submitter': {
    title: 'Configuración: Juez Editorial (QC B)',
    prompts: [{ key: 'judge', label: 'Prompt: Criterio Editorial' }]
  },
  'phase3_submitter': {
    title: 'Configuración: Motores de Hilos (Fase 3)',
    prompts: [{ key: 'twitter', label: 'Prompt: Plantilla de Twitter' }]
  },
  'phase_qca_receiver': {
    title: 'Configuración: Traductor de Emergencia (QC A)',
    prompts: [{ key: 'correction', label: 'Prompt: Reparador JSON al Español' }]
  }
};

import PromptSettings from './PromptSettings';
import V2Pipeline from './V2Pipeline';

function App() {
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // log tabs
  const [mainView, setMainView] = useState('console'); // 'console' or 'prompts'
  const [expandedGroups, setExpandedGroups] = useState({});
  const [configModalInstance, setConfigModalInstance] = useState(null); // id of instance to config
  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(true);
  const logsEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    autoScrollRef.current = autoScroll;
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs, autoScroll]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;

    // Only update state if needed to prevent infinite re-renders
    if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    } else if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  };

  const exportLogs = () => {
    const textContext = filteredLogs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.taskName}] [${log.type}] ${log.message}`).join('\n');
    const blob = new Blob([textContext], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hub_logs_${activeTab}_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('configUpdate', (newConfig) => {
      setConfig(newConfig);

      // Auto-expand groups that have instances on initial load
      if (newConfig?.instances) {
        setExpandedGroups(prev => {
          if (Object.keys(prev).length === 0) {
            const newExpanded = {};
            WORKER_TYPES.forEach(t => {
              if (Object.values(newConfig.instances).some(inst => inst.type === t.id)) {
                newExpanded[t.id] = true;
              }
            });
            return newExpanded;
          }
          return prev;
        });
      }
    });

    socket.on('workerLog', (log) => {
      setLogs((prev) => {
        if (autoScrollRef.current) {
          return [...prev.slice(-499), log]; // Keep last 500 logs if auto-scrolling
        } else {
          return [...prev, log]; // Accumulate infinitely to prevent scroll shifting
        }
      });
    });

    return () => socket.disconnect();
  }, []);

  const handleResumeAutoScroll = () => {
    setAutoScroll(true);
    setLogs(prev => prev.slice(-500)); // Memory cleanup instantly
  };

  const toggleInstance = async (id, isRunning) => {
    try {
      const action = isRunning ? 'stop' : 'start';
      await fetch(`${SOCKET_URL}/api/instances/${id}/${action}`, { method: 'POST' });
    } catch (e) {
      console.error("Failed to toggle instance", e);
    }
  };

  const updateConfig = async (id, payload) => {
    try {
      await fetch(`${SOCKET_URL}/api/instances/${id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Failed to update config", e);
    }
  };

  const addInstance = async (type) => {
    try {
      await fetch(`${SOCKET_URL}/api/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      setExpandedGroups(prev => ({ ...prev, [type]: true }));
    } catch (e) {
      console.error("Failed to add instance", e);
    }
  };

  const deleteInstance = async (id) => {
    if (!confirm(`Are you sure you want to delete instance ${id}?`)) return;
    try {
      await fetch(`${SOCKET_URL}/api/instances/${id}`, { method: 'DELETE' });
      if (activeTab === id) setActiveTab('all');
    } catch (e) {
      console.error("Failed to delete instance", e);
    }
  };

  const toggleGroup = (type) => {
    setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] }));
  };

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin text-accent"><Activity size={48} /></div>
      </div>
    );
  }

  const instances = config.instances || {};
  const instanceIds = Object.keys(instances);
  const filteredLogs = activeTab === 'all' ? logs : logs.filter(l => l.taskName === activeTab);

  return (
    <div className="h-screen overflow-hidden bg-[#0F0817] text-gray-200 flex flex-col font-sans">

      {/* HEADER */}
      <header className="h-16 border-b border-white/10 flex items-center px-6 bg-white/5 backdrop-blur-md shrink-0">
        <Server className="text-purple-500 mr-3" />
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          IANews Orchestrator
        </h1>
        <div className="ml-auto text-sm text-gray-400 flex items-center gap-4">
          <button
            onClick={() => setMainView('console')}
            className={`font-semibold transition-colors ${mainView === 'console' ? 'text-purple-400 border-b border-purple-400' : 'hover:text-white'}`}
          >
            Terminal Hub
          </button>
          <button
            onClick={() => setMainView('prompts')}
            className={`font-semibold transition-colors ${mainView === 'prompts' ? 'text-purple-400 border-b border-purple-400' : 'hover:text-white'}`}
          >
            Global Prompts
          </button>
          <button
            onClick={() => setMainView('v2')}
            className={`font-semibold transition-colors shadow-lg ${mainView === 'v2' ? 'text-yellow-400 border-b border-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'text-gray-300 hover:text-white'}`}
          >
            🚀 Pipeline V2
          </button>
          <div className="w-px h-4 bg-white/20"></div>
          Status: <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {mainView === 'prompts' ? (
          <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
            <PromptSettings />
          </main>
        ) : mainView === 'v2' ? (
          <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
            <V2Pipeline globalLogs={logs} />
          </main>
        ) : (
          <>
            {/* SIDEBAR - WORKERS LIST */}
            <aside className="w-96 shrink-0 h-full border-r border-white/10 bg-white/[0.02] overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
              <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1 px-1">Worker Categories</h2>

              {WORKER_TYPES.map(workerType => {
                const groupInstances = instanceIds.filter(id => instances[id].type === workerType.id);
                const isExpanded = expandedGroups[workerType.id];

                return (
                  <div key={workerType.id} className="shrink-0 bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                    {/* Accordion Header */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => toggleGroup(workerType.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                        <h3 className="font-semibold text-sm text-gray-200">{workerType.label}</h3>
                        <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full text-gray-400">{groupInstances.length}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); addInstance(workerType.id); }}
                        className="p-1.5 hover:bg-purple-500/20 text-purple-400 rounded-md transition-colors flex items-center gap-1 text-xs"
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="p-2 pt-0 space-y-2 bg-black/20">
                        {groupInstances.length === 0 ? (
                          <div className="text-center p-4 text-xs text-gray-500 italic">No instances running. Add one.</div>
                        ) : (
                          groupInstances.map(id => {
                            const instance = instances[id];
                            const isRunning = instance.isRunning;
                            return (
                              <div key={id} className={`p-3 rounded-lg border transition-all ${isRunning ? 'border-purple-500/30 bg-purple-500/10' : 'border-white/10 bg-[#0a0a0a]'}`}>
                                <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${isRunning ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50'}`}></span>
                                    <h4 className="font-mono text-sm text-gray-300">{id}</h4>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setConfigModalInstance(id); }}
                                      className="p-1.5 rounded-md transition-colors bg-white/5 text-gray-400 hover:bg-purple-500/20 hover:text-purple-400"
                                      title="Instance Settings"
                                    >
                                      <Settings size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleInstance(id, isRunning); }}
                                      className={`p-1.5 rounded-md transition-colors ${isRunning ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
                                      title={isRunning ? "Stop Instance" : "Start Instance"}
                                    >
                                      {isRunning ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteInstance(id); }}
                                      className="p-1.5 rounded-md transition-colors bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
                                      title="Delete Instance"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-2 text-xs text-gray-400">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500">Delay:</span>
                                    <span className="text-gray-300 font-mono">{instance.delayMs}ms</span>
                                  </div>
                                  {(instance.aiProvider || (instance.prompts && Object.keys(instance.prompts).length > 0)) && (
                                    <div className="flex flex-col gap-1 mt-1 border-t border-white/5 pt-1">
                                      {instance.aiProvider && (
                                        <div className="flex justify-between items-center text-[10px]">
                                          <span className="text-gray-500">Engine:</span>
                                          <span className="text-purple-300 font-mono uppercase">{instance.aiProvider}</span>
                                        </div>
                                      )}
                                      {instance.prompts && Object.keys(instance.prompts).length > 0 && Object.entries(instance.prompts).map(([k, v]) => (
                                        <div key={k} className="flex justify-between items-center text-[10px]">
                                          <span className="text-gray-500">Prompt [{k}]:</span>
                                          <span className="text-blue-300 font-mono truncate max-w-[100px]" title={v}>
                                            {v}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </aside>

            {/* MAIN CONSOLE AREA */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">

              {/* Tabs */}
              <div className="flex border-b border-white/10 bg-[#0F0817] justify-between items-center group">
                <div className="flex overflow-x-auto custom-scrollbar">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'all' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                  >
                    All Logs
                  </button>
                  {instanceIds.map(id => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap font-mono ${activeTab === id ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
                <button
                  onClick={exportLogs}
                  className="mr-3 p-1.5 rounded-md text-gray-500 hover:bg-white/5 hover:text-purple-400 transition-colors flex items-center gap-2"
                  title="Export Logs as TXT"
                >
                  <Download size={16} />
                </button>
              </div>

              {/* Terminal */}
              <div
                className="flex-1 overflow-y-auto p-4 font-mono text-xs md:text-sm relative"
                onScroll={handleScroll}
              >
                {filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-600">
                    <TerminalIcon size={48} className="mb-4 opacity-20" />
                    <p>Waiting for instance logs...</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredLogs.map((log, i) => (
                      <div key={i} className="flex gap-3 hover:bg-white/[0.02] px-2 py-0.5 rounded">
                        <span className="text-gray-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className={`shrink-0 font-bold w-28 ${log.type === 'error' ? 'text-red-400' : log.type === 'system' ? 'text-blue-400' : 'text-purple-400'}`}>
                          [{log.taskName}]
                        </span>
                        <span className={`break-all ${log.type === 'error' ? 'text-red-300' : log.type === 'system' ? 'text-blue-300' : 'text-gray-300'}`}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}

                {/* Floating auto-scroll button */}
                {!autoScroll && (
                  <button
                    onClick={handleResumeAutoScroll}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-purple-600/90 hover:bg-purple-500 text-white shadow-lg backdrop-blur px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-semibold font-sans transition-all z-10 animate-fade-in"
                  >
                    <ArrowDown size={14} /> Resume Auto-Scroll
                  </button>
                )}
              </div>
            </main>
          </>
        )}
        {/* CONFIG MODAL */}
        {configModalInstance && (
          <InstanceConfigModal
            instanceId={configModalInstance}
            instanceData={instances[configModalInstance]}
            onClose={() => setConfigModalInstance(null)}
            onSave={updateConfig}
          />
        )}
      </div>
    </div>
  );
}

function InstanceConfigModal({ instanceId, instanceData, onClose, onSave }) {
  const [form, setForm] = useState({
    delayMs: instanceData.delayMs || 60000,
    aiProvider: instanceData.aiProvider || 'ollama',
    supported_tiers: instanceData.supported_tiers ? instanceData.supported_tiers.join(', ') : '*',
    prompts: instanceData.prompts || {}
  });

  const [dbPrompts, setDbPrompts] = useState([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const fetchPrompts = async () => {
      setLoadingPrompts(true);
      const { data } = await supabase.from('system_prompts').select('name, type').order('type').order('name');
      if (data) setDbPrompts(data);
      setLoadingPrompts(false);
    };
    fetchPrompts();
  }, []);

  const handleSave = () => {
    const payload = { ...form };

    // Process tiers
    if (!payload.supported_tiers || payload.supported_tiers.trim() === '') {
      payload.supported_tiers = ['*'];
    } else {
      payload.supported_tiers = payload.supported_tiers.split(',').map(s => s.trim() === '*' ? '*' : parseInt(s.trim(), 10)).filter(i => !isNaN(i) || i === '*');
    }

    if (payload.prompts && Object.keys(payload.prompts).length === 0) {
      delete payload.prompts;
    }

    onSave(instanceId, payload);
    onClose();
  };

  const workerType = instanceData.type;
  const promptConfig = TASK_PROMPT_CONFIG[workerType];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#150d22] border border-purple-500/30 rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-white/5 border-b border-white/10 p-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <Settings size={18} className="text-purple-400" />
            Configure: <span className="font-mono text-purple-300">{instanceId}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Delay Loop (ms)</label>
            <input
              type="number"
              value={form.delayMs}
              onChange={e => setForm({ ...form, delayMs: parseInt(e.target.value) || 0 })}
              className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          {workerType === 'processor' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">AI Engine Override</label>
                <select
                  value={form.aiProvider}
                  onChange={e => setForm({ ...form, aiProvider: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="groq">Groq</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Supported Tiers (Processor Only)</label>
                <input
                  type="text"
                  value={form.supported_tiers}
                  onChange={e => setForm({ ...form, supported_tiers: e.target.value })}
                  placeholder="*, 0, 4, 6"
                  className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1">Comma separated list of tiers. Use * for all.</p>
              </div>
            </>
          )}

          {promptConfig ? (
            <div className="pt-2 border-t border-white/10">
              <h3 className="text-sm font-bold text-gray-200 mb-3 flex justify-between items-center">
                {promptConfig.title}
                {loadingPrompts && <Loader2 size={14} className="animate-spin text-purple-400" />}
              </h3>

              <div className="space-y-3">
                {promptConfig.prompts.map(pDef => (
                  <div key={pDef.key}>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">{pDef.label}</label>
                    <select
                      value={form.prompts[pDef.key] || ''}
                      onChange={e => setForm({ ...form, prompts: { ...form.prompts, [pDef.key]: e.target.value } })}
                      className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 cursor-pointer font-mono"
                    >
                      <option value="">-- Usar prompt por defecto en código --</option>
                      {dbPrompts.map(dbP => (
                        <option key={dbP.name} value={dbP.name}>
                          [{dbP.type}] {dbP.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic mt-4 pt-4 border-t border-white/10 text-center">
              This worker type does not require prompt configuration.
            </p>
          )}
        </div>

        <div className="bg-white/5 border-t border-white/10 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-medium transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div >
    </div >
  );
}

export default App;
