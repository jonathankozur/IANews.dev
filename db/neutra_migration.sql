-- =================================================================================
-- NEUTRA.DEV - MIGRACIÓN DE TABLAS DE ANÁLISIS FORENSE (V3.2)
-- =================================================================================

-- 1. Creación de la tabla de Radiografía de Sesgo
CREATE TABLE IF NOT EXISTS public.news_analysis (
    article_id UUID PRIMARY KEY REFERENCES public.neutral_news(id) ON DELETE CASCADE,
    detected_bias TEXT,
    manipulation_tactics JSONB,
    omitted_context TEXT,
    fact_checks JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitación de Seguridades y RLS
ALTER TABLE public.news_analysis ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acceso
-- Público puede leer la auditoría
CREATE POLICY "Public Access" ON public.news_analysis FOR SELECT USING (true);
-- Los workers pueden insertar desde el backend
CREATE POLICY "Worker Insert" ON public.news_analysis FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Worker Update" ON public.news_analysis FOR UPDATE TO service_role USING (true);

-- 4. Asignación de Permisos en crudo (por el Bug del CASCADE previo)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.news_analysis TO service_role;
GRANT SELECT ON TABLE public.news_analysis TO anon, authenticated;

-- Fin de migración.
