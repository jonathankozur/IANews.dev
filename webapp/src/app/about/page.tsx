import { headers, cookies } from 'next/headers';
import { getDictionary } from '@/lib/i18n';

export default async function AboutPage() {
    const cookieStore = await cookies();
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language') || 'es';
    let userLanguage = acceptLanguage.toLowerCase().startsWith('en') ? 'en' : 'es';

    const devLangOverride = cookieStore.get('dev_lang_override')?.value;
    if (devLangOverride === 'es' || devLangOverride === 'en') {
        userLanguage = devLangOverride;
    }

    const dict = getDictionary(userLanguage);

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                <div className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
                        {dict.about.title}
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        {dict.about.subtitle}
                    </p>
                </div>

                <div className="prose prose-lg prose-blue dark:prose-invert max-w-none">
                    <h2 className="text-2xl font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-6">{dict.about.missionTitle}</h2>
                    <p>
                        {dict.about.missionText}
                    </p>

                    <h2 className="text-2xl font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-6 mt-12">{dict.about.howItWorksTitle}</h2>
                    <p>{dict.about.howItWorksIntro}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                        <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="text-3xl mb-4">🤖</div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{dict.about.step1}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="text-3xl mb-4">📝</div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{dict.about.step2}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="text-3xl mb-4">🎭</div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{dict.about.step3}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="text-3xl mb-4">🎯</div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{dict.about.step4}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
