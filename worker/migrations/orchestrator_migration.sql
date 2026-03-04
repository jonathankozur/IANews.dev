-- Migración: Arquitectura Pipeline Unificado y Concurrencia
-- Ejecutar en Supabase > SQL Editor

-- 1. Añadir campos para bloqueo de concurrencia y rastreo en raw_articles
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS worker_id UUID DEFAULT NULL;
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT NULL;

-- 2. Asegurarse de que neutral_news tenga también last_error (por si acaso una tarea falla copiando)
ALTER TABLE neutral_news ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT NULL;

-- Verificar que se crearon correctamente
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('raw_articles', 'neutral_news') 
AND column_name IN ('worker_id', 'locked_at', 'image_url', 'last_error');
