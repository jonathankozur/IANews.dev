import Link from 'next/link';
import { getDictionary, Locale } from '@/lib/i18n';

export default function Footer({ locale = 'es' }: { locale?: string }) {
    const dict = getDictionary(locale);
    return (
        <footer className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 py-8 lg:py-12 mt-16 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Brand */}
                    <div className="flex flex-col space-y-4">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-xl shadow-sm group-hover:scale-105 transition-transform">
                                IA
                            </div>
                            <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">
                                News.dev
                            </span>
                        </Link>
                        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
                            {locale === 'en'
                                ? 'Breaking echo chambers through AI-powered multi-perspective news analysis.'
                                : 'Rompiendo cámaras de eco a través del análisis de noticias multi-perspectiva impulsado por Inteligencia Artificial.'}
                        </p>
                    </div>

                    {/* Links */}
                    <div className="flex flex-col space-y-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs">{locale === 'en' ? 'Platform' : 'Plataforma'}</h3>
                        <Link href="/about" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors text-sm">
                            {dict.nav.about}
                        </Link>
                        <Link href="/privacy" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors text-sm">
                            {dict.footer.privacy}
                        </Link>
                    </div>

                    {/* Support */}
                    <div className="flex flex-col space-y-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs">{locale === 'en' ? 'Support the Project' : 'Apoya el Proyecto'}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                            {locale === 'en' ? 'Server and AI bills don’t pay themselves. Help us keep this experiment free of intrusive ads.' : 'Las facturas de los servidores y de la IA no se pagan solas. Ayúdanos a mantener este experimento libre de publicidad intrusiva.'}
                        </p>
                        <a
                            href="https://cafecito.app/ianews"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#F39C12] hover:bg-[#D68910] text-white font-semibold rounded-lg text-sm transition-colors w-max"
                        >
                            {dict.footer.coffee}
                        </a>
                    </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                        &copy; {new Date().getFullYear()} IANews.dev. {dict.footer.rights}
                    </p>
                </div>
            </div>
        </footer>
    );
}
