-- Berlintina Shows: Storage bucket for artist onboarding media
-- The backend creates the bucket on startup via Supabase client.
-- Run this migration only if you need policies; bucket is created by server.
-- If bucket exists via dashboard: Storage → New bucket → submissions-media (public)

-- Allow service role to manage objects (backend uploads with service role)
-- Public read is enabled when bucket is public.
