-- Migración: Arquitectura Pipeline Unificado y Concurrencia
-- Ejecutar en Supabase > SQL Editor

-- 1. Añadir campos para bloqueo de concurrencia y rastreo en raw_articles
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS worker_id UUID DEFAULT NULL;
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT NULL;
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

-- 2. Asegurarse de que neutral_news tenga también last_error y retry_count
ALTER TABLE neutral_news ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT NULL;
ALTER TABLE neutral_news ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

-- 3. Crear tabla news_analysis (Fase 1)
CREATE TABLE IF NOT EXISTS public.news_analysis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid REFERENCES public.neutral_news(id) ON DELETE CASCADE,
  detected_bias text,
  manipulation_tactics jsonb DEFAULT '[]'::jsonb,
  omitted_context jsonb DEFAULT '[]'::jsonb,
  fact_checks jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_article_analysis UNIQUE (article_id)
);

-- 4. Crear tabla twitter_audit (Fase 3)
CREATE TABLE IF NOT EXISTS public.twitter_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_article_id uuid REFERENCES public.raw_articles(id) ON DELETE CASCADE,
  thread_content jsonb NOT NULL,
  status text DEFAULT 'PENDING',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_twitter_audit UNIQUE (raw_article_id)
);

-- 5. Dar permisos (Habilitar para el rol autenticado o anónimo si es necesario)
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_analysis;
ALTER PUBLICATION supabase_realtime ADD TABLE public.twitter_audit;
