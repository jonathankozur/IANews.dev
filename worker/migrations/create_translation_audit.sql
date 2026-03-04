-- Create translation_audit table
CREATE TABLE IF NOT EXISTS public.translation_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES public.neutral_news(id) ON DELETE CASCADE,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    was_translated BOOLEAN NOT NULL DEFAULT false,
    original_language TEXT
);

-- Index for fast lookups by the translator worker
CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_audit_article_id ON public.translation_audit(article_id);
