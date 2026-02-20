import { supabase } from '@/lib/supabase';
import { cookies, headers } from 'next/headers';
import NewsCard from '@/components/NewsCard';
import { getUserLeaning, getUserCategoryPreferences, getCategoryLeaningMatrix, PolicyType } from '@/lib/personalization';
import { getDictionary } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

async function getNews(userLanguage: string, userCountry: string) {
  const { data, error } = await supabase
    .from('news_events')
    .select(`
      id,
      title,
      slug,
      category,
      objective_summary,
      source_name,
      source_url,
      language,
      geo_target,
      published_at,
      variants:news_variants (
        id,
        policy_type,
        title,
        content,
        sentiment_score,
        created_at
      )
    `)
    .eq('language', userLanguage)
    .in('geo_target', [userCountry, 'GLOBAL'])
    .order('published_at', { ascending: false }); // Get all, we will sort them in memory

  if (error) {
    console.error("Error fetching news:", error);
    return [];
  }
  return data;
}

export default async function Home() {
  // 1. Session Initialization
  const cookieStore = await cookies();
  let sessionId = cookieStore.get('session_id')?.value;
  let isNewSession = false;

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    isNewSession = true;
  }

  // 2. Geolocation and i18n detection
  const headersList = await headers();
  // Vercel / Cloudflare standard header for country code (e.g., 'AR', 'US')
  const userCountry = headersList.get('x-vercel-ip-country') || 'AR';

  // Accept-Language header (e.g., 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7')
  const acceptLanguage = headersList.get('accept-language') || 'es';
  let userLanguage = acceptLanguage.toLowerCase().startsWith('en') ? 'en' : 'es';

  // DEV OVERRIDE
  const devLangOverride = cookieStore.get('dev_lang_override')?.value;
  if (devLangOverride === 'es' || devLangOverride === 'en') {
    userLanguage = devLangOverride;
  }

  // Fetch data in parallel
  const [rawNewsEvents, leaningData, categoryPreferences, categoryMatrix] = await Promise.all([
    getNews(userLanguage, userCountry),
    getUserLeaning(sessionId),
    getUserCategoryPreferences(sessionId),
    getCategoryLeaningMatrix(sessionId)
  ]);

  const dict = getDictionary(userLanguage);

  const { leaning: globalPolicy } = leaningData;

  // 1. Feed Sorting Algorithm
  // Calculate a "relevance score" for each article to sort the feed
  const sortedNewsEvents = [...rawNewsEvents].map(event => {
    let relevance = 0;

    // A. Category Relevance (Up to 50 points based on previous interactions)
    // Normalize or just add the raw category score
    const catScore = categoryPreferences[event.category || 'General'] || 0;
    relevance += catScore;

    // B. Recency Relevance
    // The fresher the news, the higher the base score (decay over days)
    const daysOld = (new Date().getTime() - new Date(event.published_at).getTime()) / (1000 * 3600 * 24);
    if (daysOld < 1) relevance += 100; // Today's news is king
    else if (daysOld < 3) relevance += 50;
    else relevance -= (daysOld * 2);

    return { ...event, relevance };
  }).sort((a, b) => b.relevance - a.relevance); // Descending order of relevance


  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">

      <div className="mb-12 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          {dict.feed.title}
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400">
          {dict.feed.subtitle}
        </p>
      </div>

      <div className="space-y-10">
        {sortedNewsEvents.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{dict.feed.noNews}</h3>
            <p className="mt-1 text-sm text-gray-500">{dict.feed.runWorker}</p>
          </div>
        ) : (
          sortedNewsEvents.map((event) => {

            // Determinar la postura preferida para esta categoría particular
            const eventCategory = event.category || 'General';
            const categoryPreferredPolicy = categoryMatrix[eventCategory] || globalPolicy;

            // Per-article Wildcard Logic (20% chance)
            const isWildcardRoll = Math.random() < 0.20;
            let finalLeaning = categoryPreferredPolicy;
            const perspectives: PolicyType[] = ['left', 'center', 'right'];

            if (isWildcardRoll) {
              const alternatives = perspectives.filter(p => p !== categoryPreferredPolicy);
              finalLeaning = alternatives[Math.floor(Math.random() * alternatives.length)];
            }

            return (
              <NewsCard
                key={event.id}
                event={event as any}
                preferredLeaning={finalLeaning}
                isWildcard={isWildcardRoll && finalLeaning !== categoryPreferredPolicy}
                sessionId={sessionId}
                dict={dict}
              />
            );
          })
        )}
      </div>

    </div>
  );
}
