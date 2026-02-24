export default function AboutPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h1 className="text-4xl font-black text-slate-900 mb-6">Acerca del Proyecto</h1>

            <div className="prose prose-slate prose-lg text-slate-700">
                <p>
                    Neutra.dev es un experimento periodístico impulsado por Inteligencia Artificial diseñado para combatir la desinformación, el clickbait y la manipulación emocional recurrente en los medios de comunicación modernos.
                </p>
                <p>
                    Nuestro motor de IA monitorea en tiempo real las portadas de los diarios, analizando los artículos con un enfoque puramente analítico para extraer <strong>exclusivamente los hechos fácticos</strong>.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-10 mb-4">¿Cómo funciona la auditoría forense?</h3>
                <p>Cada noticia pasa por un escrutinio automatizado que:</p>
                <ul className="list-disc pl-6 space-y-2 mb-8">
                    <li>Retira los adjetivos valorativos y el lenguaje polarizante.</li>
                    <li>Identifica falacias lógicas y tácticas de manipulación.</li>
                    <li>Detecta contexto omitido que cambia la interpretación de los hechos.</li>
                    <li>Realiza un <em>fact-checking</em> veloz comparando las afirmaciones cruzando diversas fuentes de conocimiento.</li>
                </ul>

                <p>
                    El resultado es lo que llamamos una <strong>Noticia Depurada</strong>: una versión neutral, objetiva y sin aditivos, diseñada para que el lector forme sus propias conclusiones sobre la base exclusiva de los hechos comprobables.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Transparencia y Privacidad</h3>
                <p>
                    El proyecto tiene un componente dual. Por un lado, analizamos los sesgos de la prensa, pero también queremos promover un entorno donde la privacidad del usuario sea respetada mediante un manejo transparente de la información.
                </p>
            </div>
        </div>
    );
}
