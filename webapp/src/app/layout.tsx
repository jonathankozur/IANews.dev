import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import DevDashboard from '@/components/DevDashboard';
import Footer from '@/components/Footer';
import { cookies, headers } from 'next/headers';
import { getDictionary } from '@/lib/i18n';

// Using Inter as the primary font for maximum legibility (Designer Rule 1)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IANews.dev - La verdad en todas sus dimensiones',
  description: 'Portal de noticias generado por IA, ofreciendo múltiples perspectivas ideológicas sin fricciones.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;

  // i18n Language Detection for Layout
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language') || 'es';
  let userLanguage = acceptLanguage.toLowerCase().startsWith('en') ? 'en' : 'es';

  // DEV OVERRIDE
  const devLangOverride = cookieStore.get('dev_lang_override')?.value;
  if (devLangOverride === 'es' || devLangOverride === 'en') {
    userLanguage = devLangOverride;
  }

  const dict = getDictionary(userLanguage);

  return (
    <html lang={userLanguage} className={`${inter.variable}`}>
      <body className="min-h-screen flex flex-col antialiased selection:bg-blue-200 dark:selection:bg-blue-900">

        {/* Simple, fast-loading Header */}
        <header className="sticky top-0 z-50 glass w-full border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">
              IA<span className="text-blue-500">News</span><span className="text-gray-400">.dev</span>
            </h1>
            <nav>
              <ul className="flex space-x-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                <li><a href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">{dict.nav.news}</a></li>
                <li><a href="/about" className="hover:text-gray-900 dark:hover:text-white transition-colors">{dict.nav.about}</a></li>
              </ul>
            </nav>
          </div>
        </header>

        <main className="flex-grow">
          {children}
          {sessionId && <DevDashboard sessionId={sessionId} />}
        </main>

        {/* Dynamic Footer Component */}
        <Footer locale={userLanguage} />
      </body>
    </html>
  );
}
