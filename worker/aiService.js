require('dotenv').config();

// Módulo simulado para el servicio de IA hasta que definamos qué API usaremos (OpenAI, Gemini, etc.)
// Su función será recibir hechos objetivos o una URL y devolver las tres perspectivas.

async function generarVariantesDeNoticia(hechosObjetivos) {
    console.log(`[🤖 IA Service] Procesando hechos: "${hechosObjetivos.substring(0, 50)}..."`);

    // Simulación de delay de API
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Prompt interno simulado: "A partir de estos hechos, redacta 3 artículos periodísticos con diferentes sesgos: Izquierda, Centro y Derecha."

    return {
        left: {
            title: "🚨 Impacto social: " + hechosObjetivos.split(" ")[0] + " afecta a trabajadores",
            content: "Un profundo análisis revela cómo el evento reciente margina a las clases populares. Es imperativo que el Estado intervenga para proteger los derechos ganados...",
            sentiment: -0.4
        },
        center: {
            title: "📰 Resumen de la Jornada: " + hechosObjetivos.substring(0, 30),
            content: "En un día marcado por la volatilidad, los expertos sugieren cautela. Las medidas anunciadas tendrán efectos mixtos en la economía según los indicadores actuales.",
            sentiment: 0.1
        },
        right: {
            title: "📈 Oportunidad de mercado: El sector privado reacciona a " + hechosObjetivos.split(" ")[0],
            content: "Frente a las recientes medidas, los mercados muestran resiliencia. La desregulación es clave para aprovechar el impulso y fomentar la inversión privada...",
            sentiment: 0.6
        }
    };
}

module.exports = {
    generarVariantesDeNoticia
};
