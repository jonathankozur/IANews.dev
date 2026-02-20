-- Esquema Inicial para IANews.dev (Supabase PostgreSQL)

-- 1. Tabla de Eventos de Noticias (El hecho objetivo)
CREATE TABLE IF NOT EXISTS public.news_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    objective_summary TEXT NOT NULL,
    source_urls TEXT[] DEFAULT '{}',
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Variantes (Las diferentes posturas)
-- policy_type = 'left', 'center', 'right'
CREATE TABLE IF NOT EXISTS public.news_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.news_events(id) ON DELETE CASCADE,
    policy_type VARCHAR(20) NOT NULL CHECK (policy_type IN ('left', 'center', 'right')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sentiment_score NUMERIC(3, 2) DEFAULT 0, -- Rango -1.0 a 1.0 (Ej: -0.8 muy negativo, 0.8 muy positivo)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Logs de Interacción de Usuario (Fricción Cero)
-- Guardamos el uuid del cookie/localstorage en session_id
CREATE TABLE IF NOT EXISTS public.user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL, 
    variant_id UUID NOT NULL REFERENCES public.news_variants(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) DEFAULT 'read', -- 'read', 'like', 'share'
    time_spent_seconds INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para eficiencia
CREATE INDEX IF NOT EXISTS idx_news_events_published_at ON public.news_events(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_variants_event_id ON public.news_variants(event_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session_id ON public.user_interactions(session_id);

-- Configuración de Seguridad RLS (Row Level Security) para habilitar acceso anónimo desde Next.js
-- Esto es fundamental en Supabase para proteger los datos si se expone la API pública.

ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública para noticias (cualquiera puede leer)
CREATE POLICY "Noticias visibles para todos" ON public.news_events FOR SELECT USING (true);
CREATE POLICY "Variantes visibles para todos" ON public.news_variants FOR SELECT USING (true);

-- Política para que el cliente Next.js pueda insertar interacciones de forma anónima
CREATE POLICY "Permitir insertar interacciones anonimas" ON public.user_interactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir a usuarios ver sus propias interacciones" ON public.user_interactions FOR SELECT USING (true);

-- Nota: El worker de IA usará el Service Role Key, el cual se salta el RLS y puede insertar y modificar noticias libremente.
