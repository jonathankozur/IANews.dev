# Documentación Fase 3: Auditor Social (Generador de Hilos)

Este worker (`03_social_auditor.js`) representa la Fase 3 del patrón **Pipeline de Calidad (LLM-as-a-judge)**.

## Características del Worker
- **100% Autónomo:** Busca artículos que tengan el estado `PENDING_SOCIAL` en la tabla `v2_articles`.
- **Inferencia Múltiple:** Combina la data del Título Crudo + Título Limpio + Fact-Checking + Métricas de Sesgo, para redactar un hilo atrapante mediante el Motor de IA elegido.
- **QC 3-A (Validador de Twitter API):**
  - Asegura que la lista de tweets sea un Array válido.
  - Verifica dinámicamente el límite duro de la API de Twitter (280 caracteres).
  - Inyecta un prefijo contador seguro (ej `[1/4]`) automáticamente a los mensajes si la IA olvidó proporcionarlos.
  - Si un tweet sobreapasa el límite a pesar de las instrucciones, el script realiza un truncado rápido ("...") para garantizar que nunca sea rechazado por Twitter más adelante.

## Qué Lee
- La tabla limpia `public.v2_articles` filtrando por `status = 'PENDING_SOCIAL'`.

## Qué Escribe / Qué Modifica
- Actualiza la fila original del artículo.
- **Columnas afectadas:**
  - `social_thread` (JSONB): Mapeado como un array simple de strings `["tweet 1", "tweet 2"]`.
- **Transición de Estado:**
  - Si finaliza con éxito absoluto: `READY_TO_PUBLISH`.
  - Si falla consistentemente: `SOCIAL_FAILED`.

---

## Cómo Probarlo (Test Mode)

Debes tener al menos 1 noticia validada por la Fase 2 que se encuentre en estado `PENDING_SOCIAL` (usa `maintenance_revert.js` si necesitas retroceder a este paso manual).

Ejecuta el Auditor Social:
```bash
# Prueba apuntada a toda la cola (1 elemento):
node c:\Proyectos\IANews.dev\workers_v2_system\03_social_auditor.js --test --ai=ollama

# Prueba apuntada a un ID específico directamente:
node c:\Proyectos\IANews.dev\workers_v2_system\03_social_auditor.js --id="a1b2c3d4-..." --ai=ollama
```

### Verificación
Después de correrlo, mira en tu terminal cómo imprime los tweets generados con su contador. Ve a tu base de datos Supabase y verifica que la columna `social_thread` sea un JSONB Array con los textos y que el estado global sea `READY_TO_PUBLISH`.
