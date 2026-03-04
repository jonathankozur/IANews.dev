const aiService = require('../aiService');
const ollamaService = require('../ollamaService');

class QcService {
    /**
     * QC A (Detector de Inglés):
     * Verifica si el texto devuelto contiene una porción significativa de inglés.
     * Devuelve true si la IA alucinó en inglés.
     */
    static async detectEnglish(textOrJson) {
        if (!textOrJson) return false;

        let processedText = textOrJson;
        if (typeof textOrJson === 'object') {
            processedText = JSON.stringify(textOrJson);
        }

        // Simple heuristic: check for common English filler words that IAs use when failing fallback
        const englishWords = ['the', 'and', 'is', 'in', 'it', 'to', 'of', 'that', 'this', 'with', 'for', 'are', 'was', 'were'];
        const words = String(processedText).toLowerCase().split(/\W+/);

        let englishWordCount = 0;
        for (const word of words) {
            if (englishWords.includes(word)) englishWordCount++;
        }

        return englishWordCount > 5;
    }

    /**
     * QC B para Fase 2 (Juez Editorial):
     * Evalúa si un texto es verdaderamente neutral y no tiene sesgos marcados o muletillas de IA.
     */
    static async judgeEditorialQuality(neutralText, serviceToUse = aiService) {
        console.log(`  [QC B] Juez Editorial evaluando neutralidad...`);
        const prompt = `Actúa como un Juez Editorial implacable. Tu única tarea es evaluar si el siguiente texto es completamente neutral, objetivo y libre de sesgos políticos, y que NO contenga muletillas de IA (ej: "Como inteligencia artificial...", "En resumen...").\n\nResponde ÚNICAMENTE con la palabra "TRUE" si el texto es apto para publicarse, o "FALSE" si contiene sesgo, opiniones o estilo robótico.\n\nTexto a evaluar:\n"${neutralText}"`;

        try {
            const result = await serviceToUse.generarVarianteSimple(prompt);
            const isApproved = result.trim().toUpperCase().includes("TRUE");

            if (!isApproved) {
                console.log(`  [QC B] ❌ Rechazado por Juez Editorial. El texto tiene sesgo o fallas lógicas.`);
            } else {
                console.log(`  [QC B] ✅ Aprobado por Juez Editorial.`);
            }
            return isApproved;
        } catch (error) {
            console.error("  [QC B] Fallo al llamar al Juez Editorial:", error);
            return false;
        }
    }

    /**
     * QC B para Fase 3 (Juez Físico - Twitter):
     * Verifica que el array de tweets generado sea un array válido de strings,
     * y que NINGÚN tweet supere los 280 caracteres.
     */
    static validateTwitterLength(threadArray) {
        console.log(`  [QC B] Validando longitud de hilo de Twitter...`);
        if (!Array.isArray(threadArray) || threadArray.length === 0) {
            console.log(`  [QC B] ❌ Falla: No es un array o está vacío.`);
            return { isValid: false, reason: "El formato devuelto no es un array de hilos." };
        }

        for (let i = 0; i < threadArray.length; i++) {
            const tweet = threadArray[i];
            if (typeof tweet !== 'string') {
                return { isValid: false, reason: `El tweet en la posición ${i + 1} no es un texto válido.` };
            }
            if (tweet.length > 280) {
                console.log(`  [QC B] ❌ Falla: Tweet ${i + 1} supera límite (${tweet.length} > 280).`);
                return { isValid: false, reason: `El tweet ${i + 1} contiene ${tweet.length} caracteres, superando el límite de 280.` };
            }
        }

        console.log(`  [QC B] ✅ Hilos validados. Cumplen longitud de plataforma (Max 280 chars).`);
        return { isValid: true };
    }
}

module.exports = QcService;
