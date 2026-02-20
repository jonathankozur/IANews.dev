import { headers, cookies } from 'next/headers';
import { getDictionary } from '@/lib/i18n';

export default async function PrivacyPage() {
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

                <div className="mb-12">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
                        {dict.privacy.title}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">{dict.privacy.subtitle}</p>
                </div>

                <div className="prose prose-blue dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                    <p>
                        {dict.privacy.introText}
                    </p>

                    <h2 className="text-xl font-bold mt-8 mb-4">{dict.privacy.point1Title}</h2>
                    <p>
                        {dict.privacy.point1Text}
                    </p>

                    <h2 className="text-xl font-bold mt-8 mb-4">{dict.privacy.point2Title}</h2>
                    <p>
                        {dict.privacy.point2Text}
                    </p>

                    <h2 className="text-xl font-bold mt-8 mb-4">{dict.privacy.point3Title}</h2>
                    <p>
                        {dict.privacy.point3Text}
                    </p>

                    <h2 className="text-xl font-bold mt-8 mb-4">{dict.privacy.point4Title}</h2>
                    <p>
                        {dict.privacy.point4Text}
                    </p>
                </div>

            </div>
        </div>
    );
}
