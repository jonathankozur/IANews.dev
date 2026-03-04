# Propuesta de Arquitectura: Pipeline Unificado (Calidad > Velocidad)

## Crítica a la Arquitectura Actual y "Ownership" de Problemas

Esta revisión aborda con total criticidad los 4 problemas actuales del sistema, priorizando explícitamente la **CALIDAD FINAL** sobre la velocidad de procesamiento:

1. **Desorganización y falta de trazabilidad:** El esquema actual de micro-workers separados leyendo la BD de forma asíncrona sin un orquestador central hace que rastrear el punto exacto de fallo de una noticia sea imposible.
2. **Estancamiento de noticias:** Ocurre debido a fallos de red silenciosos, promesas colgadas en llamadas a APIs de terceros y falta de un esquema de reintentos con estados de error finales (Dead Letter Queue).
3. **Textos en inglés y mala generación:** Se asume erróneamente que traducir el artículo original garantiza una salida en español. Las IAs alucinan. Falta un control estricto de la *salida* de cada etapa.
4. **Tweets cortados o inválidos:** El proceso de publicación corta el texto a ciegas (truncamiento) sin un control de calidad estructural.

---

## 1. Patrón "LLM-as-a-Judge" (La IA como Juez de Calidad)

Dado que la premisa principal es **Calidad > Velocidad**, el sistema abandona las validaciones de código frágiles (heurísticas o regex) y adopta el patrón *LLM-as-a-Judge* para los controles de calidad (QC).

Cada fase crítica tiene dos validadores:

*   **QC Tipo A (El Sanador Sintáctico):** Su única función es detectar el problema endémico del idioma ("*¿Hay texto en inglés?*"). Si encuentra inglés, pasa el texto por un modelo ligero (o traductor) enfocado solo en traducir al español y **CONTINÚA**. Salva tokens del modelo pesado.
*   **QC Tipo B (El Juez Evaluador - Inteligencia Artificial):** Un prompt secundario e implacable enviado a la IA que audita el trabajo de la IA principal. Retorna un booleano (Aprobado/Rechazado) y un motivo. Si falla, obliga a **RETROCEDER Y REINTENTAR** el paso principal.

---

## 2. Flujo Arquitectónico Resolutivo

### Fase 0: Admisión (Scraping Inteligente y Extracción de Media)
*   **Acción 1 (Extracción de Texto):** El scraper extrae la noticia.
*   **Acción 2 (Manejo de Imágenes):** Se **desecha por completo** la generación de imágenes por IA en la Pipeline. El Scraper **debe extraer la URL de la imagen original** propia de la noticia. Idealmente, debe descargarla/subirla a nuestro propio Storage (Supabase) en este momento para evitar enlaces caídos en el portal a futuro.
*   **Filtro Temático IA:** Antes de introducirla al flujo de trabajo, el texto extraído se envía a un modelo rápido con la pregunta: *¿Esta noticia trata específicamente sobre Política o Economía de Argentina?*.
    *   *No:* Se descarta directamente (`DISCARDED_RAW`).
    *   *Sí:* Se inserta en la base de datos como `PENDING_ANALYSIS` asegurando que la URL de su imagen original esté guardada en la misma fila.

### Fase 1: Analizar
*   **Acción:** Extraer métricas y sesgo de la noticia admitida usando un LLM profundo.
*   **QC 1-A (Idioma):** ¿Tiene inglés? -> *Sí: Traduce y continúa.*
*   **QC 1-B (Juez Estructural):** Se evalúa por código (no IA) si el JSON devuelto es válido y contiene todas las claves (`porcentaje_sesgo`, `justificacion`, etc.).
    *   *No pasa:* **REINTENTA FASE 1.**
    *   *Pasa:* Avanza de estado.

### Fase 2: Neutralizar
*   **Acción:** LLM profundo redacta el título y cuerpo neutralizado para el portal IANews.
*   **QC 2-A (Idioma):** ¿Tiene inglés? -> *Sí: Traduce y continúa.*
*   **QC 2-B (Juez Editorial IA):** Se envía el texto generado a un prompt Juez: *"Analiza este texto. ¿Elimina todo sesgo partidario u opiniones subjetivas? ¿Está libre de muletillas de IA como 'Como asistente...'?"*.
    *   *No pasa:* La neutralización es de mala calidad. **REINTENTA FASE 2.**
    *   *Pasa:* Avanza de estado.

### Fase 3: Generar Contenido para Redes (Auditoría en Twitter)
*   **Acción:** LLM genera el hilo explicativo del sesgo para la red social X.
*   **QC 3-A (Idioma):** ¿Tiene inglés? -> *Sí: Traduce y continúa.*
*   **QC 3-B (Juez Físico):** Se verifica estrictamente por código: *¿Ningún mensaje del hilo supera los 280 caracteres?*.
    *   *No pasa:* El texto se rompería en la red social. **REINTENTA FASE 3**.
    *   *Pasa:* Consolidación. Estado cambia a `READY_TO_PUBLISH`.

### Fase 4: Publisher Tonto
*   Consume `READY_TO_PUBLISH`.
*   Publica sin modificar una coma del texto y publicando la **imagen original guardada en Fase 0**. La calidad textual ya fue garantizada.

---

## 3. Extensibilidad Futura: Clústeres de Noticias y "Guerra de Medios"

Esta arquitectura de Pipeline Orquestado es 100% compatible y preparatoria para funcionalidades complejas (como agrupar la misma noticia desde La Nación, Clarín, Página/12, etc., y contrastar sus sesgos).

¿Por qué sobrevive y brilla en este escenario futuro?

1.  **Atomización de la "Partícula Origen" (El Entity Resolution):** Dado que la Fase 0 (Admisión) pasa por un filtro inteligente, y el Pipeline unificado es inmutable por noticia, cada noticia es un átomo perfecto con su propio JSON de Sesgo (Fase 1) atado a su `dominio/medio_origen`.
2.  **El "Orquestador de Clústeres" (Nuevo Layer Futuro):** En el futuro, no modificamos en absoluto este pipeline. Simplemente añadimos un servicio superior que observe la base de datos de noticias ya procesadas (`PUBLISHED`).
    *   *Ejemplo:* Un Worker agrupa noticias de las últimas 12 horas por similitud semántica (Embeddings o LLM clustering).
    *   Si encuentra la "misma historia" cubierta por 3 diarios distintos, toma los 3 objetos JSON de sesgo que el Pipeline ya calculó perfectamente, y genera un contenido compuesto (la "Guerra de Medios") sin tener que re-analizar la noticia desde cero.
3.  **Trazabilidad:** Al saber exactamente en qué fase está cada noticia, el "Clusteador" futuro solo toma fuentes confiables terminadas, evitando crear debates con noticias mal escrapeadas.
