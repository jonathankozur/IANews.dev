export type Locale = 'es' | 'en';

export const dictionaries = {
    es: {
        nav: {
            news: 'Noticias',
            trends: 'Tendencias',
            about: 'Sobre el Proyecto'
        },
        header: {
            subtitle: 'Autogestionado por Inteligencia Artificial.'
        },
        feed: {
            title: 'Noticias Personalizadas',
            subtitle: 'Lee los hechos objetivos y tu perspectiva adaptada automáticamente.',
            noNews: 'No hay noticias en este momento.',
            runWorker: 'Ejecuta el worker para poblar la base de datos.'
        },
        card: {
            readMore: 'Leer más en la fuente periodística base',
            comments: 'Comentarios',
            hide: 'Ocultar',
            showPerspectives: 'Ver Perspectivas',
            perspectives: 'Perspectivas',
            alternative: 'Alternativa',
            devMode: 'Modo Dev'
        },
        footer: {
            rights: 'Todos los derechos reservados.',
            privacy: 'Privacidad y Rastreo',
            coffee: '☕ Invítanos un Cafecito'
        },
        about: {
            title: 'Sobre IA News.dev',
            subtitle: 'Un experimento sobre el consumo de medios, la polarización algorítmica y la Inteligencia Artificial.',
            missionTitle: 'Nuestra Misión',
            missionText: 'En la era de la información hipersegmentada, los usuarios raramente interactúan con perspectivas que desafían sus propias convicciones. IA News.dev nació como un experimento técnico para auditar y evidenciar cómo los algoritmos pueden moldear nuestras realidades políticas y sociales.',
            howItWorksTitle: '¿Cómo Funciona?',
            howItWorksIntro: 'Todo en este portal está completamente automatizado:',
            step1: 'Un Worker en la nube rastrea las noticias más tendencia globalmente.',
            step2: 'Un Modelo de IA avanzado purga el texto periodístico original, eliminando todo sesgo, adjetivo y opinión, quedándose solo con un "Resumen Objetivo" de los hechos.',
            step3: 'Esa misma IA re-escribe la noticia orientándola hacia tres arquetipos clásicos (por ejemplo: Pro-mercado, Neutro, o Estatal).',
            step4: 'El algoritmo de personalización de tu dispositivo aprende de qué clickeas y re-formula la matriz para entregarte el contenido que más resuena contigo, simulando una cámara de eco en tiempo real.',
        },
        privacy: {
            title: 'Privacidad y Manejo de Datos',
            subtitle: 'Totalmente transparente, anónimo y local.',
            introText: 'Tu privacidad es fundamental. Este proyecto fue diseñado para demostrar el poder del perfilado algorítmico sin requerir ni almacenar datos personales.',
            point1Title: 'Sin Cuentas, Sin Nombres',
            point1Text: 'No existe inicio de sesión. Cuando entras, se te asigna un identificador aleatorio UUID (ej: a1b2c3d4...). Nadie sabe quién eres, ni siquiera nosotros.',
            point2Title: 'Cookies Transparentes',
            point2Text: 'Usamos cookies puramente funcionales (session_id) para poder vincular tus clics pasados a tu navegador actual y poder calcular tu "Matriz Ideológica".',
            point3Title: '¿Qué se rastrea?',
            point3Text: 'Rastreamos exclusivamente qué categoría de noticia clickeas y hacia qué perspectiva ideológica te inclinas en ese momento (Izquierda, Centro, Derecha). Estos datos son promediados matemáticamente para moldear tu feed principal en futuras visitas.',
            point4Title: 'Tu Derecho a Olvido',
            point4Text: 'Si borras las cookies de tu navegador, tu UUID histórico se destruye instantáneamente y vuelves a ser un usuario neutral con un perfil en cero.'
        }
    },
    en: {
        nav: {
            news: 'News Feed',
            trends: 'Trending',
            about: 'About Us'
        },
        header: {
            subtitle: 'Self-managed by Artificial Intelligence.'
        },
        feed: {
            title: 'Tailored News Feed',
            subtitle: 'Read objective facts and your automatically tailored perspective.',
            noNews: 'No news available at the moment.',
            runWorker: 'Run the background worker to populate the database.'
        },
        card: {
            readMore: 'Read more at the original journalistic source',
            comments: 'Comments',
            hide: 'Hide',
            showPerspectives: 'Show Perspectives',
            perspectives: 'Perspectives',
            alternative: 'Alternative',
            devMode: 'Dev Mode'
        },
        footer: {
            rights: 'All rights reserved.',
            privacy: 'Privacy & Tracking',
            coffee: '☕ Buy us a Coffee'
        },
        about: {
            title: 'About IA News.dev',
            subtitle: 'An experiment tracking media consumption, algorithmic polarization, and Artificial Intelligence.',
            missionTitle: 'Our Mission',
            missionText: 'In the era of hyper-segmented information, users rarely interact with perspectives that challenge their core convictions. IA News.dev was explicitly born as a technical experiment to audit and demonstrate how algorithms shape our political and social realities.',
            howItWorksTitle: 'How It Works',
            howItWorksIntro: 'Everything on this portal is fully automated:',
            step1: 'A Cloud Worker crawls the most trending news globally.',
            step2: 'An Advanced AI Model purges the original journalistic text, removing all bias, adjectives, and opinions, distilling an "Objective Summary" of the bare facts.',
            step3: 'The same AI re-writes the news tailoring it towards three classic archetypes (e.g., Pro-market, Neutral, or State-leaning).',
            step4: 'The personalization algorithm on your device learns from your clicks and re-shapes the matrix to deliver the content that best resonates with you, simulating a real-time echo chamber.',
        },
        privacy: {
            title: 'Privacy and Data Handling',
            subtitle: 'Fully transparent, anonymous, and local.',
            introText: 'Your privacy is paramount. This project was engineered to demonstrate the sheer power of algorithmic profiling without requiring or storing identifiable personal data.',
            point1Title: 'No Accounts, No Names',
            point1Text: 'There is no login system. When you enter, you are assigned a random UUID identifier (e.g., a1b2c3d4...). Nobody knows who you are, not even us.',
            point2Title: 'Transparent Cookies',
            point2Text: 'We use purely functional cookies (session_id) to link your past clicks to your current browser and power your "Ideological Matrix".',
            point3Title: 'What is tracked?',
            point3Text: 'We exclusively track which news category you click on and which ideological branch you lean towards at that moment (Left, Center, Right). This data is mathematically averaged to mold your main feed on subsequent visits.',
            point4Title: 'Your Right to be Forgotten',
            point4Text: 'If you clear your browser cookies, your historic UUID is instantly destroyed and you revert back to being a neutral blank slate user.'
        }
    }
};

// Helper function to get dictionary safely
export function getDictionary(locale: string = 'es') {
    return dictionaries[locale as Locale] || dictionaries['es'];
}
