# Estrategia de Crecimiento para neutraNews en X (usando API gratuita)

## Contexto

Este documento define las estrategias y features que debe implementar el sistema automatizado para crecer orgánicamente en X utilizando únicamente capacidades disponibles en la API gratuita (v2).

Restricciones clave de la API Gratuita:
- Límite de publicación estricto (~50 tweets/día o 1,500/mes).
- No permite lectura (GET) de timelines, búsquedas, menciones o métricas nativas.
- No automatizar interacciones agresivas (follow/unfollow masivo, replies masivas, etc.).

El objetivo es optimizar la autoridad de la cuenta, las impresiones y el engagement rate compensando las restricciones de la API gratuita mediante la inyección de contenido de extremada calidad, recursos visuales y métricas alternativas.

---

# Estrategias Factibles con API Gratuita

---

## 1. Publicación en formato hilo optimizado con Media
### Objetivo
Maximizar retención y tiempo de lectura dentro de la plataforma frenando el scroll.

### Features a implementar
- Generación automática de hilos estrictos:
  - Tweet 1: Gancho emocional/impacto + **Imagen generada o Stock obligatoria**.
  - Tweets intermedios (1-2): Contexto + datos clave o impacto personal.
  - Último tweet: Link + CTA.
- Validación automática por IA:
  - Máximo 280 caracteres por tweet.
  - No repetir frases del titular original.
  - Link de destino únicamente en el tweet de cierre.

---

## 2. Sistema de Score de Viralidad
### Objetivo
Priorizar noticias con mayor potencial de interacción para no desperdiciar los limitados posts diarios.

### Features a implementar
- Evaluación de IA pre-publicación con asignación de Score (0-100) basado en:
  - Impacto económico directo o polémica asociada.
  - Cambios regulatorios o afectación masiva.
- Cola de publicación inteligente que solo toma noticias si superan el umbral (ej. > 75).

---

## 3. Feedback Loop Alternativo: Tracking UTM
### Objetivo
Medir el rendimiento de cada estrategia sin acceso a los endpoints de métricas de X.

### Features a implementar
- Inyección automática de parámetros UTM únicos en cada link compartido.
  - `utm_campaign`: identifica el tipo de hook o variante de redacción usada.
- Medición de éxito basada en clics efectivos, tráfico y tiempo de estancia en nuestro propio portal web, en lugar de Likes o RTs nativos.

---

## 4. Etiquetado Estratégico Indirecto (Tagging)
### Objetivo
Traccionar la atención de comunidades y actores específicos de manera orgánica sin penalización.

### Features a implementar
- IA para identificar entidades clave en la noticia (políticos, ministerios, empresas).
- Mencionar (@usuario) orgánicamente a estas entidades dentro del segundo o tercer tweet del hilo (nunca spam directo en el primero).

---

## 5. Auditoría Diaria de Medios (Reporte Nocturno Peek)
### Objetivo
Convertirse en árbitro informativo, generando un contenido altamente viralizable aprovechando el resentimiento anti-sesgo y la retrospectiva del final del día.

### Features a implementar
- **Ejecución Diaria en Horario Pico** (ej. 21:00 hs - 22:30 hs).
- Reemplaza el resumen genérico con un análisis duro y polemizable.
- Estructura del Hilo (3-5 tweets):
  - **Tweet 1 (Impacto Visual):** Gráfico/Gauge generado automáticamente resumiendo el nivel de polarización del día o el tema principal.
  - **Tweet 2 (El Podio):** Ranking de los 3 medios más polarizados/sesgados del día según los análisis de la base de datos de neutraNews.
  - **Tweet 3 (La Omisión):** Contrapunto entre qué medios ocultaron ciertos temas o usaron titulares alarmistas.
  - **Tweet 4 (Cierre):** CTA final llamando a leer las noticias despojadas de sesgos en el portal.

---

## 6. Publicación por Ventanas Horarias Óptimas
### Objetivo
Aumentar visibilidad inicial y parecer orgánico.

### Features a implementar
- Distribución de los hilos generados en bloques: Mañana, Mediodía, Tarde, Noche.
- Inyección de delay aleatorio en los minutos para no clavar un tweet exactamente a las 12:00.

---

# Plan de Implementación por Etapas (Roadmap Técnico)

### Etapa 1: MVP - Supervivencia y Creación de Valor (Impacto Máximo)
*Lo mínimo indispensable para empezar a existir con calidad.*
- [ ] 1.1 Setup de cliente API X v2 (permisos de escritura).
- [ ] 1.2 Worker Generador de Hilos (Prompts de Ollama/IA para estructura Hook/Contexto/Cierre).
- [ ] 1.3 Integración de imagen (Stock o generada) obligatoria en el Tweet 1.
- [ ] 1.4 Agendamiento básico en cola respetando minutos aleatorios y slots horarios.

### Etapa 2: Ahorro de Cuota y Analítica Alternativa (Impacto Alto)
*Cuidar el límite diario y empezar a "ver" en la oscuridad.*
- [ ] 2.1 Worker Evaluador (Score de Viralidad 0-100 para descartar noticias irrelevantes).
- [ ] 2.2 Inyector de UTMs en los generadores de Hilos para tracking de Hooks.
- [ ] 2.3 Implementación del Hilo de la 'Auditoría Diaria de Medios' (Script nocturno que promedia datos de la DB).

### Etapa 3: Experimentación a Ciegas y Tracción (Impacto Medio)
*Optimizaciones sutiles para empujar más retención.*
- [ ] 3.1 Rotación automática de estilos de Hooks asignados por la IA.
- [ ] 3.2 Reconocimiento de entidades (NER) para Arrobado/Tagging estratégico.
- [ ] 3.3 Detección de contenido Evergreen para reciclaje diferido semanal.

### Etapa 4: Pausada (Requiere Presupuesto/API Basic)
*   Sistema de Respuestas a Menciones Reales.
*   Auto-Optimización recabando interacciones nativas (Likes, RTs).

---

# Resultado Esperado

El sistema debe comportarse como un **analista implacable y presentador de datos**, no como un bot de rebote de links. Debe forzar la detención del scroll inmediato a través de elementos gráficos e indignación analítica de la cobertura mediática de los competidores.