-- Esquema de Sincronización para IANews.dev (Supabase PostgreSQL)
-- Este script es seguro de ejecutar múltiples veces.

-- 1. Tabla de Eventos de Noticias
CREATE TABLE IF NOT EXISTS public.news_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    objective_summary TEXT NOT NULL,
    source_urls TEXT[] DEFAULT '{}',
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Actualizar estructura si ya existe (Campos de la V2)
ALTER TABLE public.news_events ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.news_events ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General';
ALTER TABLE public.news_events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.news_events ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.news_events ADD COLUMN IF NOT EXISTS source_name VARCHAR(255);
ALTER TABLE public.news_events ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 2. Tabla de Variantes
CREATE TABLE IF NOT EXISTS public.news_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.news_events(id) ON DELETE CASCADE,
    policy_type VARCHAR(20) NOT NULL CHECK (policy_type IN ('left', 'center', 'right')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sentiment_score NUMERIC(3, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Logs de Interacción
CREATE TABLE IF NOT EXISTS public.user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL, 
    variant_id UUID NOT NULL REFERENCES public.news_variants(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) DEFAULT 'read',
    time_spent_seconds INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, variant_id, interaction_type)
);

-- 4. Tabla de Comentarios
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    variant_id UUID NOT NULL REFERENCES public.news_variants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_leaning VARCHAR(20) DEFAULT 'center',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Interacciones sobre Comentarios
CREATE TABLE IF NOT EXISTS public.comment_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, comment_id, interaction_type)
);

-- 6. Vistas para Contadores (CREATE OR REPLACE es seguro)
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

-- 7. Índices (IF NOT EXISTS es seguro)
CREATE INDEX IF NOT EXISTS idx_news_events_published_at ON public.news_events(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_events_slug ON public.news_events(slug);
CREATE INDEX IF NOT EXISTS idx_news_events_category ON public.news_events(category);
CREATE INDEX IF NOT EXISTS idx_news_variants_event_id ON public.news_variants(event_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session_id ON public.user_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_comments_variant_id ON public.comments(variant_id);
CREATE INDEX IF NOT EXISTS idx_comment_interact_session ON public.comment_interactions(session_id);

-- 8. Seguridad RLS
ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_interactions ENABLE ROW LEVEL SECURITY;

-- 9. Políticas (Usamos DROP si existen para recrearlas limpiamente)
-- Nota: En Supabase es más seguro borrar y crear políticas para asegurar que los cambios se apliquen.
DO $$ 
BEGIN
    -- Limpieza de políticas antiguas
    DROP POLICY IF EXISTS "Noticias visibles para todos" ON public.news_events;
    DROP POLICY IF EXISTS "Variantes visibles para todos" ON public.news_variants;
    DROP POLICY IF EXISTS "Estadísticas de variantes visibles para todos" ON public.user_interactions;
    DROP POLICY IF EXISTS "Permitir insertar interacciones anonimas" ON public.user_interactions;
    DROP POLICY IF EXISTS "Permitir actualizar interacciones anonimas" ON public.user_interactions;
    DROP POLICY IF EXISTS "Permitir borrar interacciones anonimas" ON public.user_interactions;
    DROP POLICY IF EXISTS "Comentarios visibles para todos" ON public.comments;
    DROP POLICY IF EXISTS "Permitir insertar comentarios anonimos" ON public.comments;
    DROP POLICY IF EXISTS "Interacciones de comments visibles" ON public.comment_interactions;
    DROP POLICY IF EXISTS "Permitir insertar interacciones a comentarios" ON public.comment_interactions;
    DROP POLICY IF EXISTS "Permitir borrar interacciones a comentarios" ON public.comment_interactions;
END $$;

CREATE POLICY "Noticias visibles para todos" ON public.news_events FOR SELECT USING (true);
CREATE POLICY "Variantes visibles para todos" ON public.news_variants FOR SELECT USING (true);
CREATE POLICY "Estadísticas de variantes visibles para todos" ON public.user_interactions FOR SELECT USING (true);
CREATE POLICY "Permitir insertar interacciones anonimas" ON public.user_interactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualizar interacciones anonimas" ON public.user_interactions FOR UPDATE USING (true);
CREATE POLICY "Permitir borrar interacciones anonimas" ON public.user_interactions FOR DELETE USING (true);
CREATE POLICY "Comentarios visibles para todos" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Permitir insertar comentarios anonimos" ON public.comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Interacciones de comments visibles" ON public.comment_interactions FOR SELECT USING (true);
CREATE POLICY "Permitir insertar interacciones a comentarios" ON public.comment_interactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir borrar interacciones a comentarios" ON public.comment_interactions FOR DELETE USING (true);

