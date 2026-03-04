import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Save, Plus, Trash2, Edit3, X, Check, Loader2, Database } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

export default function PromptSettings() {
    const [prompts, setPrompts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', type: 'processor', prompt_text: '' });

    const [isCreating, setIsCreating] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);

    useEffect(() => {
        fetchPrompts();
    }, []);

    const fetchPrompts = async () => {
        if (!supabase) {
            setError("Supabase variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) not found in .env");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('system_prompts')
                .select('*')
                .order('type', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;
            setPrompts(data || []);
        } catch (err) {
            console.error("Error fetching prompts:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (prompt) => {
        setEditingId(prompt.id);
        setEditForm({ name: prompt.name, type: prompt.type, prompt_text: prompt.prompt_text });
        setIsCreating(false);
    };

    const startCreate = () => {
        setEditingId('new');
        setEditForm({ name: '', type: 'processor', prompt_text: '' });
        setIsCreating(true);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setIsCreating(false);
    };

    const handleSave = async () => {
        if (!editForm.name || !editForm.prompt_text) {
            alert("Name and Prompt Text are required");
            return;
        }

        try {
            setSaveLoading(true);
            let res;
            if (isCreating) {
                res = await supabase.from('system_prompts').insert([
                    { name: editForm.name, type: editForm.type, prompt_text: editForm.prompt_text }
                ]);
            } else {
                res = await supabase.from('system_prompts').update({
                    name: editForm.name, type: editForm.type, prompt_text: editForm.prompt_text
                }).eq('id', editingId);
            }

            if (res.error) throw res.error;

            await fetchPrompts();
            cancelEdit();
        } catch (err) {
            console.error("Error saving prompt:", err);
            alert("Failed to save: " + err.message);
        } finally {
            setSaveLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Are you sure you want to delete prompt "${name}"?`)) return;

        try {
            const { error } = await supabase.from('system_prompts').delete().eq('id', id);
            if (error) throw error;
            await fetchPrompts();
        } catch (err) {
            console.error("Error deleting prompt:", err);
            alert("Failed to delete: " + err.message);
        }
    };

    if (loading) return <div className="p-8 flex items-center gap-3 text-gray-400"><Loader2 className="animate-spin" /> Loading prompts...</div>;

    return (
        <div className="p-6 h-full flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                        <Database size={20} className="text-purple-400" />
                        Global System Prompts
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">Manage centralized AI prompts used by all workers. Changes apply instantly.</p>
                </div>
                <button
                    onClick={startCreate}
                    disabled={editingId !== null}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                >
                    <Plus size={16} /> New Prompt
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-md mb-6 shrink-0">
                    Error: {error}
                </div>
            )}

            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                    {/* New Prompt Form (if active) */}
                    {editingId === 'new' && (
                        <PromptEditor
                            form={editForm}
                            setForm={setEditForm}
                            onSave={handleSave}
                            onCancel={cancelEdit}
                            saveLoading={saveLoading}
                            title="Create New Prompt"
                        />
                    )}

                    {prompts.map(p => (
                        editingId === p.id ? (
                            <PromptEditor
                                key={p.id}
                                form={editForm}
                                setForm={setEditForm}
                                onSave={handleSave}
                                onCancel={cancelEdit}
                                saveLoading={saveLoading}
                                title="Edit Prompt"
                            />
                        ) : (
                            <div key={p.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-col h-[280px]">
                                <div className="flex justify-between items-start mb-3 shrink-0">
                                    <div>
                                        <h3 className="font-mono text-sm font-bold text-purple-300">{p.name}</h3>
                                        <span className="text-xs bg-black/40 px-2 py-0.5 rounded-full text-gray-400 border border-white/5 mt-1 inline-block">
                                            {p.type}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: 1 }}>
                                        <button onClick={() => startEdit(p)} className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded transition-colors" title="Edit">
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors" title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 bg-black/40 rounded border border-white/5 p-3 overflow-y-auto custom-scrollbar text-xs font-mono text-gray-300 whitespace-pre-wrap">
                                    {p.prompt_text}
                                </div>

                                <div className="shrink-0 pt-3 text-[10px] text-gray-500 flex justify-between">
                                    <span>ID: {p.id.split('-')[0]}...</span>
                                    <span>Updated: {new Date(p.updated_at).toLocaleString()}</span>
                                </div>
                            </div>
                        )
                    ))}

                    {!loading && prompts.length === 0 && editingId !== 'new' && (
                        <div className="col-span-full text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-xl">
                            No system prompts found. Create one to get started.
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

function PromptEditor({ form, setForm, onSave, onCancel, saveLoading, title }) {
    return (
        <div className="bg-purple-900/10 border border-purple-500/30 rounded-xl p-4 flex flex-col h-[280px] shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            <div className="flex justify-between items-center mb-3 shrink-0">
                <h3 className="font-bold text-sm text-purple-300">{title}</h3>
            </div>

            <div className="flex gap-3 mb-3 shrink-0">
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Prompt Name (e.g. analyzer_default)"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500"
                    />
                </div>
                <div className="w-32">
                    <select
                        value={form.type}
                        onChange={e => setForm({ ...form, type: e.target.value })}
                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
                    >
                        <option value="processor">Processor</option>
                        <option value="analyzer">Analyzer</option>
                        <option value="generator">Generator</option>
                        <option value="translator">Translator</option>
                        <option value="neutralizer">Neutralizer</option>
                        <option value="twitter">Twitter</option>
                        <option value="global">Global / Other</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 mb-3">
                <textarea
                    placeholder="Enter prompt text here... use {{variable}} for injections"
                    value={form.prompt_text}
                    onChange={e => setForm({ ...form, prompt_text: e.target.value })}
                    className="w-full h-full bg-black/50 border border-white/10 rounded p-3 text-xs font-mono text-gray-300 focus:outline-none focus:border-purple-500 resize-none custom-scrollbar"
                />
            </div>

            <div className="flex justify-end gap-2 shrink-0">
                <button
                    onClick={onCancel}
                    disabled={saveLoading}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-xs transition-colors flex items-center gap-1"
                >
                    <X size={14} /> Cancel
                </button>
                <button
                    onClick={onSave}
                    disabled={saveLoading}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                    {saveLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save
                </button>
            </div>
        </div>
    );
}
