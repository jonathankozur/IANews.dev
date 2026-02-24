import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Server, Activity, Play, Square, Settings, Terminal as TerminalIcon, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

const SOCKET_URL = 'http://localhost:4000'; // Hub Backend URL

const WORKER_TYPES = [
  { id: 'processor', label: 'Processor 🧠' },
  { id: 'scraper', label: 'Scraper 🕸️' },
  { id: 'neutralizer', label: 'Neutralizer ⚖️' },
  { id: 'generator', label: 'Generator 🎨' },
  { id: 'analyzer', label: 'Analyzer 🕵️' },
  { id: 'image_original', label: 'Image Original 🖼️' },
  { id: 'image_ai', label: 'Image AI 🤖' },
  { id: 'image_stock', label: 'Image Stock 📸' },
  { id: 'watchdog', label: 'Watchdog 🐕' },
  { id: 'twitter', label: 'Twitter 🐦' }
];

function App() {
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedGroups, setExpandedGroups] = useState({});
  const logsEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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
      setLogs((prev) => [...prev.slice(-499), log]); // Keep last 500 logs
    });

    return () => socket.disconnect();
  }, []);

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
        <div className="ml-auto text-sm text-gray-400 flex items-center gap-2">
          Status: <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

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
                                  onClick={() => toggleInstance(id, isRunning)}
                                  className={`p-1.5 rounded-md transition-colors ${isRunning ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
                                  title={isRunning ? "Stop Instance" : "Start Instance"}
                                >
                                  {isRunning ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                </button>
                                <button
                                  onClick={() => deleteInstance(id)}
                                  className="p-1.5 rounded-md transition-colors bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
                                  title="Delete Instance"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2 text-xs text-gray-400">
                              <div className="flex justify-between items-center">
                                <span>Delay (ms)</span>
                                <input
                                  type="number"
                                  defaultValue={instance.delayMs}
                                  onBlur={(e) => updateConfig(id, { delayMs: parseInt(e.target.value) })}
                                  className="bg-black/50 border border-white/10 rounded px-2 py-1 w-20 text-right focus:outline-none focus:border-purple-500"
                                />
                              </div>

                              {/* Only Processor gets the Engine toggle */}
                              {instance.type === 'processor' && (
                                <div className="flex justify-between items-center">
                                  <span>Engine</span>
                                  <select
                                    value={instance.useOllama ? "ollama" : "gemini"}
                                    onChange={(e) => updateConfig(id, { useOllama: e.target.value === 'ollama' })}
                                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-right focus:outline-none focus:border-purple-500 cursor-pointer"
                                  >
                                    <option value="ollama">Ollama</option>
                                    <option value="gemini">Gemini</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </aside>

        {/* MAIN CONSOLE AREA */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">

          {/* Tabs */}
          <div className="flex border-b border-white/10 bg-[#0F0817] overflow-x-auto shrink-0 custom-scrollbar">
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

          {/* Terminal */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs md:text-sm">
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
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
