# Manual de Ejecución de Workers - IANews

Este documento detalla cómo ejecutar cada uno de los *workers* que componen el motor automatizado de IANews. Gracias a la nueva arquitectura centralizada con Supabase, los workers delegan el trabajo pesado de IA a una cola unificada.

## 🧠 Worker 0: El Procesador Central (`worker0_ai_processor.js`)

Este es el **cerebro del sistema**. Su única función es escuchar la tabla `ia_request_queue` en Supabase y resolver las peticiones pendientes llamando a Gemini o a Ollama.

**Importante:** Este worker *siempre* debe estar ejecutándose en segundo plano (idealmente con PM2) para que el resto de los workers (1 al 7) no se queden bloqueados esperando respuestas de IA. Funciona en un ciclo infinito de forma predeterminada.

- **Comando:** `node worker0_ai_processor.js`
- **Motor de IA:** Determinado por la variable `AI_PROVIDER` en el archivo `.env`. Si es `ollama`, usará tu GPU local. Si no está definido (o es `gemini`), usará la nube de Google.

---

## Parámetros Generales (Para Workers 1 al 7)

A diferencia del Processor, los workers 1 al 7 son "clientes" y soportan estos parámetros por consola:

1. `--mode=continuous`: Si lo agregas, el worker entrará en un ciclo infinito (ejecutándose, durmiendo un lapso de tiempo definido en su código, y volviéndose a ejecutar). Si **NO** incluyes este parámetro, el worker hará **una sola pasada completa** de su tarea y se cerrará limpiamente (`process.exit(0)`).
2. `--ai=ollama`: Fuerza a que el cliente construya sus prompts utilizando la estructura optimizada para Llama3 local en lugar de Gemini. *(Nota: El resultado final igual será procesado por el motor que el Worker 0 tenga configurado en su `.env`)*.

---

## 🕷️ Worker 1: Scraper (`worker1_scraper.js`)

Se encarga de conectarse periódicamente a GNews y extraer las noticias crudas y el texto de los artículos evadiendo paywalls. Pasa cada artículo por el Filtro de IA para saber si trata de Política o Economía Argentina.

- **Ejecución única:** `node run_worker.js --task=scraper`
- **Ejecución continua:** `node run_worker.js --task=scraper --mode=continuous` (Duerme 30 min entre ciclos).

## ⚖️ Worker 2: Neutralizer (`worker2_neutralizer.js`)

Busca artículos crudos (`raw_articles`) que estén "Pendientes de Análisis". Usa la IA para evaluar el sesgo original, eliminar adjetivos emocionales, y extraer un resumen 100% fáctico (Hechos Objetivos) pasándolo a la tabla `neutral_news`.

- **Ejecución única:** `node run_worker.js --task=neutralizer`
- **Ejecución continua:** `node run_worker.js --task=neutralizer --mode=continuous` (Duerme 2 min entre ciclos).

## 🎨 Worker 3: Generator (`worker3_generator.js`)

Toma las noticias neutrales y pide a la IA que genere 3 variantes ideológicas radicalizadas (Izquierda, Centro, Derecha) con títulos hiper-clickbait. Además, lo traduce automáticamente al inglés. Publica todo en `news_variants`.

- **Ejecución única:** `node run_worker.js --task=generator`
- **Ejecución continua:** `node run_worker.js --task=generator --mode=continuous` (Duerme 1 min entre ciclos).

## 🖼️ Worker 4: Image Original (`worker4_image_original.js`)

Navega por las notas crudas y visita la URL original del diario fuente para extraer la imagen destacada (metadato `og:image`). La descarga y la sube al bucket de Supabase Storage.

- **Ejecución única:** `node run_worker.js --task=image_original`
- **Ejecución continua:** `node run_worker.js --task=image_original --mode=continuous` (Duerme 1 min entre ciclos).

## 🤖 Worker 5: Image AI (`worker5_image_ai.js`)

Busca noticias sin imagen generada por IA. Usa la API libre de Pollinations.ai para generar una imagen hiperrealista y cinemática en base al título de la noticia, subirla al Storage y vincularla a la base de datos.

- **Ejecución única:** `node run_worker.js --task=image_ai`
- **Ejecución continua:** `node run_worker.js --task=image_ai --mode=continuous` (Duerme 30 seg entre ciclos).

## 📸 Worker 6: Image Stock (`worker6_image_stock.js`)

Busca artículos sin imágenes de Stock. Extrae las 2 palabras clave más relevantes del título y busca una foto periodística/genérica en Pexels a través de su API.

- **Ejecución única:** `node run_worker.js --task=image_stock`
- **Ejecución continua:** `node run_worker.js --task=image_stock --mode=continuous` (Duerme 1 min entre ciclos para no saturar los límites de la API gratis de Pexels).

## 🔍 Worker 7: Deep Analyzer (`worker7_analyzer.js`)

Es el trabajador más pesado. Toma artículos neutralizados y corre una auditoría forense del discurso: detecta tácticas de manipulación psicológica, omisiones de contexto y realiza "Fact-Checks" separando las afirmaciones. Guarda el resultado en `news_analysis` para mostrarse en el frontend.

- **Ejecución única:** `node run_worker.js --task=analyzer`
- **Ejecución continua:** `node run_worker.js --task=analyzer --mode=continuous` (Duerme 15 seg por cada lote, muy intensivo).

---

## 🛠️ Herramientas de Testing

**Orquestador Secuencial (`run_all_test.js`)**
Si deseas realizar una pasada completa de tu sistema (desde conseguir noticias hasta analizar profundamente las publicadas), tienes un script especial diseñado para depuración y testing local. Este script ejecuta los Workers del 1 al 7 de manera secuencial, esperando a que uno termine exitosamente antes de abrir el siguiente.

- **Comando:** `node run_all_test.js`
*(Asegúrate de tener el `worker0` corriendo en otra terminal antes de lanzar esto).*

---

## 🧹 Limpieza Manual (`reset_db.js`)
Si deseas vaciar todas las tablas para iniciar el sistema desde cero (borrar todas las noticias, variantes y la cola de IA), utiliza este script.

- **Comando:** `node reset_db.js`
**Advertencia:** Este comando es irreversible y borra toda la información acumulada en las tablas de la base de datos.
