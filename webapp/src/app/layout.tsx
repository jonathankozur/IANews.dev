import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable}`}>
      <body className="min-h-screen flex flex-col antialiased selection:bg-blue-200 dark:selection:bg-blue-900">

        {/* Simple, fast-loading Header */}
        <header className="sticky top-0 z-50 glass w-full border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">
              IA<span className="text-blue-500">News</span><span className="text-gray-400">.dev</span>
            </h1>
            <nav>
              <ul className="flex space-x-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                <li><a href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">Inicio</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Tendencias</a></li>
              </ul>
            </nav>
          </div>
        </header>

        <main className="flex-grow">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="w-full border-t border-gray-200 dark:border-gray-800 mt-16 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} IANews.dev. Autogestionado por Inteligencia Artificial.</p>
        </footer>
      </body>
    </html>
  );
}
