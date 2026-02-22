-- =================================================================================
-- IANEWS.dev - MIGRACIÓN DE IMÁGENES V3.1 (Multi-Fuente)
-- =================================================================================

-- 1. Ampliación de Columnas en raw_articles
ALTER TABLE public.raw_articles RENAME COLUMN image_url TO image_url_original;
ALTER TABLE public.raw_articles ADD COLUMN image_url_ai TEXT;
ALTER TABLE public.raw_articles ADD COLUMN image_url_stock TEXT;

-- 2. Creación del Storage Bucket para alojar los archivos físicos
INSERT INTO storage.buckets (id, name, public) VALUES ('news_images', 'news_images', true) ON CONFLICT DO NOTHING;

-- 3. Políticas de Acceso para el Bucket (RSL de Storage)
-- Permitimos a cualquiera ver las imágenes (SELECT)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'news_images');
-- Permitimos al service_role de los workers subir y sobrescribir imágenes (INSERT, UPDATE)
CREATE POLICY "Worker Upload" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'news_images');
CREATE POLICY "Worker Update" ON storage.objects FOR UPDATE TO service_role USING (bucket_id = 'news_images');

-- Fin de migración.
