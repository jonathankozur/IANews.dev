export default function PrivacyPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h1 className="text-4xl font-black text-slate-900 mb-6">Políticas de Privacidad</h1>

            <div className="prose prose-slate prose-lg text-slate-700">
                <p>
                    En <strong>Neutra.dev</strong>, nos tomamos muy en serio la privacidad de nuestros usuarios y la transparencia en el manejo de los datos. Esta política describe qué información recopilamos y cómo la utilizamos.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">1. Recopilación de Información</h3>
                <p>
                    Nuestro servicio está diseñado para funcionar con la recolección mínima de datos. Actualmente, Neutra.dev no requiere registro de usuarios para acceder a las auditorías forenses, y no recopilamos información personalmente identificable de manera proactiva.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">2. Cookies y Analíticas</h3>
                <p>
                    Podemos utilizar herramientas de análisis de tráfico básicas (como Google Analytics, Vercel Analytics u otras alternativas enfocadas en la privacidad) de manera agregada, para comprender cómo interactúan los visitantes con el contenido. Estos datos son anónimos y no se utilizan para rastrear interacciones individuales a largo plazo a través de sitios web de terceros.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">3. Publicidad</h3>
                <p>
                    Neutra.dev puede incluir espacios publicitarios de redes de terceros (como Google AdSense) para ayudar a mantener los costos operativos de los servidores y la API de inteligencia artificial. Estas redes publicitarias pueden utilizar cookies para mostrar anuncios relevantes basados en su historial de navegación anónimo.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">4. Fuentes de Datos</h3>
                <p>
                    Las "auditorías" publicadas son el resultado del procesamiento mediante Inteligencia Artificial de artículos noticiosos públicos. No reclamamos derechos de autor sobre el contenido original, sino que ejercemos un enfoque de "fair use" para propósitos de análisis periodístico, comentario crítico e identificación de tendencias de desinformación.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">5. Enlaces a Terceros</h3>
                <p>
                    Nuestra plataforma contiene enlaces a los atículos originales alojados por los respectivos medios de comunicación. No somos responsables por las prácticas de privacidad y el contenido de dichos sitios externos. Le animamos a leer atentamente las políticas de privacidad de cualquier sitio que visite.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">6. Contacto</h3>
                <p>
                    Si tiene alguna pregunta sobre nuestras Políticas de Privacidad o prácticas, por favor contáctese a través de nuestros canales oficiales o repositorios en GitHub.
                </p>

                <p className="text-sm mt-12 text-slate-500">Última actualización: 22 de Febrero, 2026</p>
            </div>
        </div>
    );
}
