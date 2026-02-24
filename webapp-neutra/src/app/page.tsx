"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import SplitNewsCard from "@/components/SplitNewsCard";
import FilterBar from "@/components/FilterBar";
import Sidebar from "@/components/Sidebar";

export default function Home() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState({ source: 'all', tactic: 'all' });

  const observerTarget = useRef(null);

  const fetchFeed = async (reset = false, customFilters = filters) => {
    if (reset) {
      setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const lastDate = !reset && articles.length > 0 ? articles[articles.length - 1].created_at : '';

      const queryParams = new URLSearchParams({ limit: '10' });
      if (lastDate) queryParams.append('lastDate', lastDate);
      if (customFilters.source !== 'all') queryParams.append('source', customFilters.source);
      if (customFilters.tactic !== 'all') queryParams.append('tactic', customFilters.tactic);

      const res = await fetch(`/api/feed?${queryParams.toString()}`);
      const json = await res.json();

      if (json.data) {
        if (json.data.length < 10) {
          setHasMore(false);
        }

        if (reset) {
          setArticles(json.data);
        } else {
          setArticles(prev => [...prev, ...json.data]);
        }
      }
    } catch (err) {
      console.error("Failed to load neutra feed", err);
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Watch filters change
  const handleFilterChange = (newFilters: { source: string; tactic: string }) => {
    setFilters(newFilters);
    fetchFeed(true, newFilters);
  };

  // Intersection Observer setup
  const handleObserver = useCallback(
    (entries: any[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasMore && !loading && !loadingMore) {
        fetchFeed(false); // Fetch next page
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasMore, loading, loadingMore, articles, filters]
  );

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, { threshold: 1.0 });
    observer.observe(element);

    return () => observer.unobserve(element);
  }, [handleObserver]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-8">
      <div className="mb-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Últimas Auditorías</h2>
      </div>

      <FilterBar onFilterChange={handleFilterChange} />

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Main Feed Column */}
        <div className="flex-1 w-full flex flex-col gap-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-20 text-slate-500 border border-dashed border-slate-300 rounded-xl">
              No se encontraron auditorías forenses que coincidan con estos filtros.
            </div>
          ) : (
            <>
              {articles.map((article: any) => (
                <SplitNewsCard key={article.id} article={article} />
              ))}

              {/* Intersection Observer Target */}
              <div ref={observerTarget} className="h-10 w-full flex justify-center mt-4">
                {loadingMore && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900"></div>}
                {!hasMore && articles.length > 5 && <span className="text-slate-500 text-sm">Has llegado al final de los archivos forenses.</span>}
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar Column */}
        <Sidebar />
      </div>
    </div>
  );
}
