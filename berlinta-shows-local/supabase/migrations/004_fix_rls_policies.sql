-- Berlintina: Fix RLS so backend (service role) can insert and upload
-- Run in Supabase SQL Editor

-- show_submissions: allow service_role to insert (backend uses service role key)
drop policy if exists "Public can insert submissions" on public.show_submissions;
create policy "Allow insert submissions"
  on public.show_submissions for insert
  with check (true);

-- Storage: allow inserts to submissions-media bucket
-- (Backend uploads with service role; need policy for storage.objects)
drop policy if exists "Allow uploads to submissions-media" on storage.objects;
create policy "Allow uploads to submissions-media"
  on storage.objects for insert
  with check (bucket_id = 'submissions-media');

-- Allow public read of objects in submissions-media (for photo URLs)
drop policy if exists "Allow read submissions-media" on storage.objects;
create policy "Allow read submissions-media"
  on storage.objects for select
  using (bucket_id = 'submissions-media');
