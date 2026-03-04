-- Migración: Agregar retry_count a tablas de dominio
-- Ejecutar en Supabase > SQL Editor

ALTER TABLE raw_articles  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE neutral_news  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Verificar que las columnas fueron creadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('raw_articles', 'neutral_news')
  AND column_name = 'retry_count';
