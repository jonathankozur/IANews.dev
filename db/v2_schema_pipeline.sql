-- =========================================================================
-- Migración V2: Sistema de Pipeline Unificado (LLM-as-a-Judge)
-- Archivo: c:\Proyectos\IANews.dev\db\v2_schema_pipeline.sql
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.v2_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_url TEXT UNIQUE NOT NULL,
    source_domain TEXT,
    category TEXT DEFAULT 'General',
    status TEXT DEFAULT 'PENDING_ANALYSIS',
    image_url TEXT,
    raw_title TEXT NOT NULL,
    raw_body TEXT NOT NULL,
    
    -- Fase 1 (Analyzer)
    biased_fragments JSONB,
    manipulation_tactics TEXT[],
    fact_checking_text TEXT,
    full_analysis_text TEXT,
    bias_score NUMERIC(5,2),
    
    -- Fase 2 (Neutralizer)
    clean_title TEXT,
    slug TEXT UNIQUE,
    clean_body TEXT,
    
    -- Fase 3 (Social Auditor)
    social_thread JSONB,
    
    -- Trazabilidad / Health
    retries_count INT DEFAULT 0,
    last_error_log TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de performance básicos
CREATE INDEX IF NOT EXISTS idx_v2_articles_status ON public.v2_articles(status);
CREATE INDEX IF NOT EXISTS idx_v2_articles_created_at ON public.v2_articles(created_at DESC);

-- Opcional: Seguridad ROW LEVEL SECURITY
ALTER TABLE public.v2_articles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Noticias v2 visibles para todos" ON public.v2_articles;
    DROP POLICY IF EXISTS "Insertar desde workers" ON public.v2_articles;
    DROP POLICY IF EXISTS "Actualizar desde workers" ON public.v2_articles;
END $$;

CREATE POLICY "Noticias v2 visibles para todos" ON public.v2_articles FOR SELECT USING (true);
CREATE POLICY "Insertar desde workers" ON public.v2_articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualizar desde workers" ON public.v2_articles FOR UPDATE USING (true);


-- =========================================================================
-- Tabla de Configuración Global del Sistema V2
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.v2_system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Config
ALTER TABLE public.v2_system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config visible para todos" ON public.v2_system_config FOR SELECT USING (true);
CREATE POLICY "Config update workers" ON public.v2_system_config FOR UPDATE USING (true);
CREATE POLICY "Config insert workers" ON public.v2_system_config FOR INSERT WITH CHECK (true);

-- Instanciar valor inicial
INSERT INTO public.v2_system_config (key, value)
VALUES ('scraper', '{"last_scrape_time": null}')
ON CONFLICT (key) DO NOTHING;
