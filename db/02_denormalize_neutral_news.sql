-- =========================================================================
-- MIGRACIÓN DE DESNORMALIZACIÓN V3.5: IANEWS.DEV
-- Objetivo: Agregar campos redundantes a neutral_news para optimizar
-- las lecturas del Dashboard Admin y del Worker de Estadísticas.
-- =========================================================================

-- 1. Agregar las columnas necesarias
ALTER TABLE public.neutral_news 
ADD COLUMN IF NOT EXISTS source_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS title_original TEXT,
ADD COLUMN IF NOT EXISTS detected_bias TEXT,
ADD COLUMN IF NOT EXISTS manipulation_tactics JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS omitted_context TEXT,
ADD COLUMN IF NOT EXISTS fact_checks JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS image_url_original TEXT,
ADD COLUMN IF NOT EXISTS image_url_ai TEXT,
ADD COLUMN IF NOT EXISTS image_url_stock TEXT;

-- 2. Backfill: Poblar datos desde raw_articles
UPDATE public.neutral_news n
SET 
    source_name = r.source_name,
    title_original = r.title,
    image_url_original = r.image_url_original,
    image_url_ai = r.image_url_ai,
    image_url_stock = r.image_url_stock
FROM public.raw_articles r
WHERE n.raw_article_id = r.id;

-- 3. Backfill: Poblar datos desde news_analysis
UPDATE public.neutral_news n
SET 
    detected_bias = a.detected_bias,
    manipulation_tactics = a.manipulation_tactics,
    omitted_context = a.omitted_context,
    fact_checks = a.fact_checks
FROM public.news_analysis a
WHERE n.id = a.article_id;

-- 4. Renombrar columna 'title' a 'title_neutral' para claridad (opcional, pero recomendado por coherencia con el admin)
-- Nota: Si haces esto, hay que actualizar neutra-webapp. Por ahora la dejamos como 'title' pero
-- en el código del admin la mapeamos. Si prefieres renombrarla, descomenta abajo:
-- ALTER TABLE public.neutral_news RENAME COLUMN title TO title_neutral;

COMMENT ON TABLE public.neutral_news IS 'Tabla central de noticias neutralizadas con datos desnormalizados para optimizar performance.';
