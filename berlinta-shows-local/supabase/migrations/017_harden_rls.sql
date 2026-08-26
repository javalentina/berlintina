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

-- 2) agency_conversations / artist_conversations (migration 005) were given
--    "for all using (true) with check (true)" — anon could select, update or
--    delete every row, including other people's conversation transcripts.
--    The app only ever writes these via the service-role backend, so drop
--    the permissive policy and leave the tables closed.
drop policy if exists "Allow all agency_conversations" on public.agency_conversations;
drop policy if exists "Allow all artist_conversations" on public.artist_conversations;

-- 3) submissions-media storage bucket (migration 004) allowed anon to INSERT
--    directly into storage, bypassing the honeypot/rate-limiting on
--    /api/submissions. Uploads only ever happen server-side (service role),
--    so drop the anon insert policy; public read stays (show photos are
--    meant to be publicly visible).
drop policy if exists "Allow uploads to submissions-media" on storage.objects;
