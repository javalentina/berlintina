-- Show is visible on catalog when Approved (PUBLISHED) only; no artist_notified_at required.
-- Run in Supabase SQL Editor.

drop policy if exists "Public can read published shows" on public.shows;
create policy "Public can read published shows"
  on public.shows for select
  using (status = 'PUBLISHED');
