# Documentación Fase 2: Redactor Neutral

Este worker (`02_neutralizer.js`) representa la Fase 2 del patrón **Pipeline de Calidad (LLM-as-a-judge)**.

## Características del Worker
- **100% Autónomo:** Se levanta de forma cron-like o manual y busca artículos con estado `PENDING_NEUTRALIZATION`.
- **QC 2-A (Validador Estructural):** Asegura estricto cumplimiento del JSON con `clean_title` y `clean_body`, además de prevenir recortes alucinatorios (si el texto resultante es sospechosamente corto, fuerza un fallo).
- **QC 2-B (Juez Editorial):** Ejecuta código duro (Regex) post-IA para purgar instantáneamente *"muletillas robóticas"* (ej: "En conclusión", "Cabe destacar"). Esto evita gastar tokens extras pidiéndole a la IA que se corrija a sí misma.

## Qué Lee
- La tabla `public.v2_articles` filtrando por `status = 'PENDING_NEUTRALIZATION'`.
- Lee el **título crudo**, **cuerpo crudo**, y también las **tácticas de manipulación** ya detectadas por la Fase 1 para instruirle a la IA que no vuelva a caer en ellas.

## Qué Escribe / Qué Modifica
- Actualiza la fila original en `public.v2_articles`.
- **Columnas afectadas:**
  - `clean_title` (TEXT): Título aséptico y puramente descriptivo.
  - `clean_body` (TEXT): Cuerpo narrativo sin adjetivos tendenciosos.
- **Transición de Estado:**
  - Si finaliza con éxito absoluto: `PENDING_SOCIAL`.
  - Si falla el QC 3 veces: `NEUTRALIZATION_FAILED`.

---

## Cómo Probarlo (Test Mode)

Asegúrate de tener al menos 1 noticia validada por la Fase 1 que se encuentre en estado `PENDING_NEUTRALIZATION`.

Puedes usar `--test` para procesar el primero de la cola, o pasarle `--id={tu-uuid}` para correr la prueba en un registro puntual.

```bash
# Prueba apuntada a toda la cola (1 elemento):
node c:\Proyectos\IANews.dev\workers_v2_system\02_neutralizer.js --test --ai=ollama

# Prueba apuntada a un ID específico directamente:
node c:\Proyectos\IANews.dev\workers_v2_system\02_neutralizer.js --id="a1b2c3d4-..." --ai=ollama
```

### Verificación
Después de correrlo, chequea Supabase y revisa si el registro pasó a estado `PENDING_SOCIAL`. Verifica si el `clean_body` suena natural y desprovisto de emociones, y que no contenga frases sueltas como "En resumen". Si el resultado te gusta, estaremos listos para armar la **Fase 3 (Red Social)**.
