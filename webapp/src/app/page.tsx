import { supabase } from '@/lib/supabase';
import { cookies, headers } from 'next/headers';
import NewsFeedClient from '@/components/NewsFeedClient';
import { getUserLeaning, getUserCategoryPreferences, getCategoryLeaningMatrix, PolicyType } from '@/lib/personalization';
import { getDictionary } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

async function getNews(userLanguage: string, userCountry: string) {
  const { data, error } = await supabase
    .from('neutral_news')
    .select(`
      id,
      title,
      slug,
      category,
      objective_summary,
      raw_article:raw_articles (
        source_name,
        source_url,
        image_url_original,
        image_url_ai,
        image_url_stock
      ),
      geo_target,
      published_at:created_at,
      variants:news_variants!inner (
        id,
        policy_type,
        policy_label,
        title,
        content,
        sentiment_score,
        created_at
      )
    `)
    .eq('news_variants.language', userLanguage)
    .in('geo_target', [userCountry, 'GLOBAL'])
    .order('created_at', { ascending: false })
    .limit(10); // LIMIT ADDED HERE FOR THE INITIAL RENDER

  if (error) {
    console.error("Error fetching news:", error);
    return [];
  }

  // Map to flat structure expected by NewsCard
  return data.map((item: any) => ({
    ...item,
    source_name: Array.isArray(item.raw_article) ? item.raw_article[0]?.source_name : item.raw_article?.source_name,
    source_url: Array.isArray(item.raw_article) ? item.raw_article[0]?.source_url : item.raw_article?.source_url,
    image_url_original: Array.isArray(item.raw_article) ? item.raw_article[0]?.image_url_original : item.raw_article?.image_url_original,
    image_url_ai: Array.isArray(item.raw_article) ? item.raw_article[0]?.image_url_ai : item.raw_article?.image_url_ai,
    image_url_stock: Array.isArray(item.raw_article) ? item.raw_article[0]?.image_url_stock : item.raw_article?.image_url_stock,
    language: userLanguage
  }));
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
  const [initialNewsEvents, leaningData, categoryPreferences, categoryMatrix] = await Promise.all([
    getNews(userLanguage, userCountry),
    getUserLeaning(sessionId),
    getUserCategoryPreferences(sessionId),
    getCategoryLeaningMatrix(sessionId)
  ]);

  const dict = getDictionary(userLanguage);

  const { leaning: globalPolicy } = leaningData;

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

      <NewsFeedClient
        initialEvents={initialNewsEvents}
        sessionId={sessionId}
        globalPolicy={globalPolicy}
        categoryPreferences={categoryPreferences}
        categoryMatrix={categoryMatrix}
        dict={dict}
        userLanguage={userLanguage}
        userCountry={userCountry}
      />

    </div>
  );
}
