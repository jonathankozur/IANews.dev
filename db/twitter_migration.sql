-- =================================================================================
-- NEUTRA.DEV - MIGRACIÓN: Twitter Worker Support (V3.3)
-- =================================================================================

-- Add tweeted_at column to neutral_news to track which articles have been posted
-- Run this in Supabase SQL Editor

ALTER TABLE public.neutral_news 
ADD COLUMN IF NOT EXISTS tweeted_at TIMESTAMP WITH TIME ZONE NULL;

-- Comment for clarity
COMMENT ON COLUMN public.neutral_news.tweeted_at IS 'Timestamp of when this article was posted to Twitter/X. NULL means not yet tweeted.';
