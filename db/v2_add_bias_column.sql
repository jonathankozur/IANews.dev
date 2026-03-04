-- Script para agregar la columna 'bias' a la tabla v2_articles
-- Ejecutar en el SQL Editor de Supabase o mediante psql.

ALTER TABLE public.v2_articles
ADD COLUMN IF NOT EXISTS bias TEXT;

-- Opcional: Agregar un comentario descriptivo
COMMENT ON COLUMN public.v2_articles.bias IS 'Categoría general del sesgo detectado (Ej: Izquierda, Derecha, Oficialista, etc).';
