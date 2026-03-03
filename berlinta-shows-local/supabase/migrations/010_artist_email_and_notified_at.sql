-- Admin can edit published shows; show is only visible if artist was notified by email.
-- Run in Supabase SQL Editor.

-- Store artist contact email on show (from submission)
alter table public.shows
  add column if not exists artist_email text;

-- When we successfully send email to artist (on publish or after admin edit), set this.
-- If null, show is not shown to public (email send failed or not yet sent).
alter table public.shows
  add column if not exists artist_notified_at timestamptz;

-- RLS: public can only read published shows where artist was notified
drop policy if exists "Public can read published shows" on public.shows;
create policy "Public can read published shows"
  on public.shows for select
  using (status = 'PUBLISHED' and artist_notified_at is not null);
