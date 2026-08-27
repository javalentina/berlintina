-- Security hardening: close RLS gaps found in a security audit (2026-08-27).
-- Run in Supabase SQL Editor.
--
-- Context: the Express backend (server/index.js) talks to Postgres with the
-- SERVICE ROLE key, which bypasses RLS entirely — none of this affects how
-- the app itself works. RLS is what stands between the `anon` key and these
-- tables if that key is ever used directly (e.g. from a browser). Today the
-- frontend has no working Supabase client (VITE_SUPABASE_ANON_KEY is an
-- unset placeholder), so this isn't currently reachable — but RLS should
-- never depend on a key staying secret by accident.

-- 1) artist_accounts / artist_tokens were created (migration 009) without
--    ever enabling RLS. With RLS off, Supabase's default grants leave these
--    tables fully open to anon/authenticated — artist_accounts holds email
--    addresses. Enable RLS with no permissive policies: fully closed to
--    anon/authenticated, service role unaffected.
alter table public.artist_accounts enable row level security;
alter table public.artist_tokens enable row level security;

-- 2) agency_conversations / artist_conversations: migration 005 gave these
--    "for all using (true) with check (true)" in this repo, but running this
--    migration against production (2026-08-27) showed the tables don't
--    actually exist there — migration 005 was apparently never applied.
--    Nothing to fix; noted here so the gap isn't rediscovered from scratch.
--    If these tables get created later, don't reuse the "for all" policy.

-- 3) submissions-media storage bucket (migration 004) allowed anon to INSERT
--    directly into storage, bypassing the honeypot/rate-limiting on
--    /api/submissions. Uploads only ever happen server-side (service role),
--    so drop the anon insert policy; public read stays (show photos are
--    meant to be publicly visible).
drop policy if exists "Allow uploads to submissions-media" on storage.objects;
