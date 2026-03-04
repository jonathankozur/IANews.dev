const supabase = require('../supabaseClient');

class PromptManager {
    constructor() {
        this.promptsCache = new Map();
        this.isInitialized = false;
    }

    /**
     * Inicializa la caché de prompts descargando todos desde la base de datos
     * y suscribiéndose a los cambios en tiempo real.
     */
    async init() {
        if (this.isInitialized) return;

        console.log(`[📦 PromptManager] Inicializando caché de prompts desde Supabase...`);

        try {
            // 1. Descarga inicial
            const { data, error } = await supabase
                .from('system_prompts')
                .select('name, prompt_text');

            if (error) {
                console.error(`[❌ PromptManager] Error al cargar los prompts iniciales:`, error.message);
                throw error;
            }

            if (data) {
                data.forEach(p => {
                    this.promptsCache.set(p.name, p.prompt_text);
                });
                console.log(`[📦 PromptManager] ${data.length} prompts cargados en memoria.`);
            }

            // 2. Suscripción a Realtime para actualizaciones en vivo
            supabase
                .channel('custom-prompts-channel')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'system_prompts' },
                    (payload) => {
                        console.log('\n[⚡ Realtime] Cambio detectado en system_prompts. Actualizando caché...');

                        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                            const { name, prompt_text } = payload.new;
                            this.promptsCache.set(name, prompt_text);
                            console.log(`[📦 PromptManager] Prompt '${name}' actualizado en memoria.`);
                        } else if (payload.eventType === 'DELETE') {
                            const { name } = payload.old;
                            this.promptsCache.delete(name);
                            console.log(`[📦 PromptManager] Prompt '${name}' eliminado de memoria.`);
                        }
                    }
                )
                .subscribe();

            this.isInitialized = true;
        } catch (err) {
            console.error(`[❌ PromptManager] Fallo en la inicialización:`, err);
        }
    }

    /**
     * Obtiene un prompt por su nombre y reemplaza las variables definidas en \`variables\`.
     * Si no existe, devuelve nulo o lanza un error dependiendo del uso.
     * 
     * @param {string} promptName El 'name' único del prompt en DB.
     * @param {Object} variables Objeto llave-valor para interpolar (Ej: { titulo: "Hola" })
     * @returns {string|null} El prompt final o null si no se encuentra.
     */
    getPrompt(promptName, variables = {}) {
        if (!this.promptsCache.has(promptName)) {
            console.warn(`[⚠️ PromptManager] El prompt '${promptName}' no fue encontrado en la caché. ¿Falta en la DB?`);
            return null;
        }

        let promptText = this.promptsCache.get(promptName);

        // Reemplazar todas las variables utilizando la sintaxis {{varName}}
        for (const [key, value] of Object.entries(variables)) {
            // Se usa una expresión regular global para reemplazar todas las ocurrencias
            const regex = new RegExp(`{{${key}}}`, 'g');
            promptText = promptText.replace(regex, value);
        }

        return promptText;
    }
}

// Exportar una única instancia (Singleton) para que toda la app use la misma caché
const promptManagerInstance = new PromptManager();
module.exports = promptManagerInstance;
