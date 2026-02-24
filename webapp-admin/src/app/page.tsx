"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  LogOut,
  Search,
  Edit,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

export default function Dashboard() {
  const [articles, setArticles] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/articles?page=${page}&search=${search}`);
      const json = await res.json();
      if (json.data) {
        setArticles(json.data);
        setCount(json.count || 0);
      }
    } catch (err) {
      console.error("Error fetching articles", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Estás seguro de eliminar el artículo "${title}"? esta acción no se puede deshacer.`)) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/articles?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchArticles();
      } else {
        alert("Error al eliminar el artículo");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(count / 20);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center font-black text-white">N</div>
          <span className="font-bold tracking-tight text-white hidden sm:inline">Neutra Admin Hub</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {/* Actions & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-indigo-500" />
              Gestión de Noticias
            </h1>
            <p className="text-slate-400 text-sm">{count} artículos auditados en total</p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por título o medio..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => fetchArticles()}
              className="bg-slate-800 p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-800">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Noticia / Medio</th>
                  <th className="px-6 py-4">Sesgo</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && articles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <span className="text-slate-500 font-medium">Cargando noticias...</span>
                    </td>
                  </tr>
                ) : articles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-slate-500 font-medium">
                      No se encontraron artículos.
                    </td>
                  </tr>
                ) : (
                  articles.map((art) => (
                    <tr key={art.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                        {new Date(art.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <p className="text-white font-bold leading-tight mb-1 line-clamp-2">{art.title_neutral}</p>
                        <p className="text-slate-500 text-xs flex items-center gap-1.5 uppercase font-semibold">
                          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                          {art.source_name}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-tighter ${art.detected_bias?.toLowerCase().includes('izq') ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' :
                            art.detected_bias?.toLowerCase().includes('der') ? 'bg-indigo-500/20 text-indigo-500 border border-indigo-500/30' :
                              'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          }`}>
                          {art.detected_bias || 'Sin analizar'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/edit/${art.id}`}
                            className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(art.id, art.title_neutral)}
                            disabled={deletingId === art.id}
                            className="p-2 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Cerrar sesión"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <a
                            href={`https://neutra.dev/auditoria/${art.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                            title="Ver en la web"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-slate-950/50 px-6 py-4 flex items-center justify-between border-t border-slate-800">
              <span className="text-xs text-slate-500 font-medium">Página {page} de {totalPages}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
