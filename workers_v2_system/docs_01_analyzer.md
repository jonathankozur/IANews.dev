# Documentación Fase 1: Analizador de Sesgo y Calidad

Este worker (`01_analyzer_bias.js`) representa la Fase 1 del patrón **Pipeline de Calidad (LLM-as-a-judge)**.

## Características del Worker
- **100% Autónomo:** Se levanta de forma cron-like. Busca en la nueva base de datos (`v2_articles`) aquellos artículos con el status `PENDING_ANALYSIS`.
- **QC 1-A (Traductor Reactivo / Sanador Sintáctico):** Antes de enviar el código al analizador complejo, evalúa mediante IA el modelo del idioma de la noticia cruda y el título. Asegura que pase a modelo Español neutro 100% puro para evitar que la IA devuelva Spanglish o alucine.
- **Análisis Profundo:** Construye un JSON de manera nativa usando el motor de IA seleccionado (Ollama, Gemini, Groq, o OpenRouter).
- **QC 1-B (Juez Estructural):** Una función pura valida vía código rígido que el LLM no haya roto el JSON y que contenga todas las métricas solicitadas (`biased_fragments`, `manipulation_tactics`, etc). Si falla de forma grave, hace un retry.

## Qué Lee
- La tabla limpia `public.v2_articles` filtrando por `status = 'PENDING_ANALYSIS'`.

## Qué Escribe / Qué Modifica
- Actualiza la fila _original_ del artículo en `public.v2_articles`.
- **Columnas afectadas:**
  - `biased_fragments` (JSONB): Formato `[ { "quote": "...", "explanation": "..." } ]`.
  - `manipulation_tactics` (TEXT[]): Palabras clave de sesgo detectadas (Ej: `["Ad Hominem", "Falso Dilema"]`).
  - `fact_checking_text` (TEXT): Chequeo del sesgo narrativo.
  - `full_analysis_text` (TEXT): Análisis explayado.
  - `bias_score` (NUMERIC): Puntuación de 0 a 100.
- **Transición de Estado:**
  - Si finaliza con éxito absoluto: `PENDING_NEUTRALIZATION`.
  - Si falla el QC 3 veces: `ANALYSIS_FAILED`.

---

## Cómo Probarlo (Test Mode)

Asegúrate de haber procesado al menos 1 noticia con el Scraper (Fase 0) que haya quedado como `PENDING_ANALYSIS`.

Ejecuta el Analizador en **modo prueba** (procesará máximo 1 noticia y se detendrá). Puedes elegir tu motor de IA cambiando el flag `--ai` (por defecto usa `ollama` / llama3 local).

```bash
node c:\Proyectos\IANews.dev\workers_v2_system\01_analyzer_bias.js --test --ai=ollama
```

### Verificación
Después de correrlo, chequea Supabase y revisa si el registro pasó a estado `PENDING_NEUTRALIZATION`. Verifica los campos de Sesgo. ¡Una vez comprobado, podemos pasar a la **Fase 2**!
