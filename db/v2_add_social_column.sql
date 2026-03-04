-- Script para agregar la columna 'social_thread' a la tabla v2_articles
-- Ejecutar en el SQL Editor de Supabase o mediante psql.

ALTER TABLE public.v2_articles
ADD COLUMN IF NOT EXISTS social_thread JSONB;

-- Opcional: Agregar un comentario descriptivo
COMMENT ON COLUMN public.v2_articles.social_thread IS 'Array de strings que componen los tweets del hilo de auditoría listos para publicarse.';
