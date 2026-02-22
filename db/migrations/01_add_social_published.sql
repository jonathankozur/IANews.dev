-- Supabase SQL Migration
-- Add social_published_at to news_events to track which articles have been posted to social media

ALTER TABLE public.news_events 
ADD COLUMN IF NOT EXISTS social_published_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create an index to quickly find unpublished news
CREATE INDEX IF NOT EXISTS idx_news_events_social_published_at 
ON public.news_events(social_published_at) 
WHERE social_published_at IS NULL;
