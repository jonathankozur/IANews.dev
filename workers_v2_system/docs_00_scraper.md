# Documentación Fase 0: Scraper y Admisión

Este worker (`00_scraper_admission.js`) representa la Fase 0 del patrón **Pipeline de Calidad (LLM-as-a-judge)**.

## Características del Worker
- **Independiente:** No depende de las encoladoras antiguas ni de las bases de datos v1. Posee su propio `package.json` y `node_modules` dentro de la carpeta `workers_v2_system`.
- **Motor de IA Flexible:** Utiliza un servicio centralizado (`core/ai_service.js`) que soporta Ollama (local), Gemini, Groq y OpenRouter.
- **Scraping Real:** Extrae de manera fidedigna la URL original de la imagen `og:image` y el texto real con `readability`, sorteando paywalls básicos mediante User-Agents.
- **Filtro Temático:** Clasifica la noticia mediante IA para asegurar que trate estrictamente sobre Política o Economía de Argentina.

## Qué Lee
- **GNews API:** Obtiene los titulares y links más recientes de Argentina vía `gnews.io`. Requiere `GNEWS_API_KEY` en el archivo `.env`.
- **HTML Directo:** Descarga el HTML de la noticia para procesarla localmente.
- **Inferencia de IA:** Utiliza el motor configurado para determinar la relevancia del contenido.

## Qué Escribe
- **Base de Datos:** El worker inserta _únicamente_ en la tabla limpia `public.v2_articles`.
- **Columnas afectadas:**
  - `original_url` (STRING)
  - `source_domain` (STRING)
  - `image_url` (STRING)
  - `raw_title` (STRING)
  - `raw_body` (STRING)
  - `category` (STRING - 'Política/Economía')
  - `status` (STRING)
- **Estado Resultante:**
  - Si pasa el filtro temático IA: `PENDING_ANALYSIS`.
  - Si la IA define que es farándula/deporte, etc: `DISCARDED_RAW`.

---

## Cómo Probarlo (Test Mode)

1. **Dependencias y DB:**
   - Asegúrate de haber ejecutado `npm install` dentro de `workers_v2_system`.
   - Verifica que la tabla `v2_articles` exista (vía `db/v2_schema_pipeline.sql`).
2. **Ejecutar el Scraper (1 sola tarea):**
   Abre una terminal y ejecuta el flag `--test` para procesar una sola noticia y detenerse.
   Por defecto utilizará **Ollama (Llama3)**. Puedes cambiarlo con el flag `--ai`:
   
   ```bash
   node c:\Proyectos\IANews.dev\workers_v2_system\00_scraper_admission.js --test --ai=ollama
   ```
   *Otros motores:* `--ai=gemini`, `--ai=groq`, `--ai=openrouter`

Una vez que compruebes la inserción en `v2_articles`, avísame para proceder con la **Fase 1**.
