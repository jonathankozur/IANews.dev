-- =========================================================================
-- SCRIPT DE MIGRACIÓN DESTRUCTIVO V3: IANEWS.DEV
-- ¡ADVERTENCIA! Este script borra el esquema actual completamente y lo recrea.
-- Todos los datos serán eliminados.
-- =========================================================================

-- 1. PURGA TOTAL (Drop de todo el esquema público para empezar de cero)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- =========================================================================
-- TABLAS DEL PIPELINE DE NOTICIAS
-- =========================================================================

-- Tabla 1: Worker Scraper
CREATE TABLE public.raw_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name VARCHAR(255) NOT NULL,
    source_url TEXT UNIQUE NOT NULL, -- UNIQUE evita re-procesar o duplicar noticias de una misma URL
    title TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    process_status VARCHAR(50) DEFAULT 'PENDING_ANALYSIS' -- PENDING_ANALYSIS, PROCESSED, ERROR
);

-- Tabla 2: Worker Crudo (Neutralizador)
CREATE TABLE public.neutral_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_article_id UUID NOT NULL UNIQUE REFERENCES public.raw_articles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'Política',
    tags TEXT[] DEFAULT '{}',
    
    -- Análisis del sesgo original de la fuente
    original_bias_direction VARCHAR(20), -- Izquierda, Derecha, Centro
    original_bias_score INT DEFAULT 0, -- Porcentaje de 0 a 100 de sesgo
    
    objective_summary TEXT NOT NULL,
    image_url TEXT,
    
    -- Manejo del pipeline
    process_status VARCHAR(50) DEFAULT 'PENDING_GENERATION', -- PENDING_GENERATION, PUBLISHED
    
    -- Social media (Antiguo Worker 4)
    social_published_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla 3: Worker Generador (Burbujas)
CREATE TABLE public.news_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neutral_news_id UUID NOT NULL REFERENCES public.neutral_news(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL CHECK (language IN ('es', 'en')),
    policy_type VARCHAR(20) NOT NULL CHECK (policy_type IN ('left', 'center', 'right')),
    policy_label VARCHAR(100), -- Ej: "Pro-Mercado", "Nacional y Popular"
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sentiment_score NUMERIC(3, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(neutral_news_id, language, policy_type) -- Solo 1 variante exacta por noticia/idioma/postura
);

-- =========================================================================
-- TABLAS DE USUARIOS E INTERACCIONES
-- =========================================================================

-- Opcional para unificar info de sesión anónima o logueada
CREATE TABLE public.user_profiles (
    session_id UUID PRIMARY KEY, -- Usamos el session_id anónimo como primary key
    user_id UUID DEFAULT NULL, -- Nulo por ahora, usado a futuro para Auth real de Supabase
    calculated_leaning VARCHAR(20) DEFAULT 'center',
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.user_profiles(session_id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.news_variants(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) DEFAULT 'read', -- read, like, dislike
    time_spent_seconds INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, variant_id, interaction_type)
);

CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.user_profiles(session_id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.news_variants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_leaning VARCHAR(20) DEFAULT 'center',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.comment_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.user_profiles(session_id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, comment_id, interaction_type)
);

-- =========================================================================
-- VISTAS PARA CONTADORES Y FRONTEND
-- =========================================================================

CREATE OR REPLACE VIEW public.view_variant_stats AS
SELECT 
    variant_id,
    COUNT(*) FILTER (WHERE interaction_type = 'like') as likes,
    COUNT(*) FILTER (WHERE interaction_type = 'dislike') as dislikes,
    COUNT(*) FILTER (WHERE interaction_type = 'read') as reads
FROM public.user_interactions
GROUP BY variant_id;

CREATE OR REPLACE VIEW public.view_comment_stats AS
SELECT 
    comment_id,
    COUNT(*) FILTER (WHERE interaction_type = 'like') as likes,
    COUNT(*) FILTER (WHERE interaction_type = 'dislike') as dislikes
FROM public.comment_interactions
GROUP BY comment_id;

-- =========================================================================
-- ÍNDICES DE RENDIMIENTO (Clave para paginación y pipelines fluidos)
-- =========================================================================

-- Pipelines
CREATE INDEX idx_raw_articles_status ON public.raw_articles(process_status);
CREATE INDEX idx_neutral_news_status ON public.neutral_news(process_status);

-- Frontend requests
CREATE INDEX idx_neutral_news_created_at ON public.neutral_news(created_at DESC);
CREATE INDEX idx_neutral_news_slug ON public.neutral_news(slug);
CREATE INDEX idx_news_variants_neutral_id ON public.news_variants(neutral_news_id);
CREATE INDEX idx_interactions_session ON public.user_interactions(session_id);

-- =========================================================================
-- SEGURIDAD (RLS)
-- =========================================================================

-- Deshabilitamos temporalmente, activamos tabla por tabla
ALTER TABLE public.raw_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neutral_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_interactions ENABLE ROW LEVEL SECURITY;

-- Políticas ultra-permisivas para MVP frontend (Las APIs del Server / Workers por dentro se saltan el RLS usando la SERVICE KEY)
CREATE POLICY "MVP Data Reading" ON public.neutral_news FOR SELECT USING (true);
CREATE POLICY "MVP Variants Reading" ON public.news_variants FOR SELECT USING (true);

-- Frontend anónimo permisos de inserción
CREATE POLICY "MVP Profiles Insert" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "MVP Interactions Insert" ON public.user_interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "MVP Comments Insert" ON public.comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "MVP Comment Interact" ON public.comment_interactions FOR ALL USING (true) WITH CHECK (true);
