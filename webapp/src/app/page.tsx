import { supabase } from '@/lib/supabase';
import NewsCard from '@/components/NewsCard';

// Optamos por ISR / SSR asíncrono. Next.js App Router (Server Components) por defecto.
// Revalidamos los datos (ISR) cada 60 segundos si estuviéramos recibiéndolos asícronamente en producción.
export const revalidate = 60;

async function getNews() {
  // Hacemos un JOIN directo usando la sintaxis de Supabase (foreign keys detectadas automáticamente)
  const { data, error } = await supabase
    .from('news_events')
    .select(`
      id,
      title,
      objective_summary,
      published_at,
      variants:news_variants (
        id,
        policy_type,
        title,
        content,
        sentiment_score
      )
    `)
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error fetching news:', error);
    return [];
  }

  return data;
}

export default async function Home() {
  const newsEvents = await getNews();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">

      <div className="mb-12 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          Noticias sin filtros ocultos.
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400">
          Lee los hechos objetivos y cruza perspectivas al instante.
        </p>
      </div>

      <div className="space-y-10">
        {newsEvents?.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No hay noticias en este momento.</h3>
            <p className="mt-1 text-sm text-gray-500">Ejecuta el worker para poblar la base de datos.</p>
          </div>
        ) : (
          newsEvents?.map((event) => (
            <NewsCard key={event.id} event={event as any} />
          ))
        )}
      </div>

    </div>
  );
}
