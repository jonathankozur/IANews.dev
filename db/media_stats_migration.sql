-- Migration: Create media_stats table for Point 4 feature
-- This table stores aggregated statistics for each news source.

CREATE TABLE IF NOT EXISTS public.media_stats (
    source_name TEXT PRIMARY KEY,
    total_articles BIGINT DEFAULT 0,
    avg_bias_score INT DEFAULT 0,
    tactics_breakdown JSONB DEFAULT '[]'::jsonb,
    ideology_distribution JSONB DEFAULT '{}'::jsonb,
    original_images INT DEFAULT 0,
    stock_images INT DEFAULT 0,
    no_images INT DEFAULT 0,
    last_article_at TIMESTAMPTZ,
    computed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (Optional, but good practice. Assuming service role will be used for writes)
ALTER TABLE public.media_stats ENABLE ROW LEVEL SECURITY;

-- Allow anonymous reads if you want the public webapp to see it without a service role (usually ANON_KEY is enough if policy allows)
CREATE POLICY "Allow public read-only access on media_stats" 
ON public.media_stats FOR SELECT 
TO anon 
USING (true);

COMMENT ON TABLE public.media_stats IS 'Aggregated news metrics per source, computed by statsTask.js';
