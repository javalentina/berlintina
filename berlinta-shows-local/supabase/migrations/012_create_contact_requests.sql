-- Berlintina Shows: contact_requests table for "Jetzt anfragen" (UC-04)
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  show_id uuid references public.shows(id) on delete set null,
  show_title text,
  requester_name text not null,
  requester_email text not null,
  message text,
  event_date text,
  created_at timestamptz default now()
);

alter table public.contact_requests enable row level security;

-- No public read (admin will use service role)
create policy "No public select on contact_requests"
  on public.contact_requests for select using (false);

-- Anyone can insert (submit contact form)
create policy "Public can insert contact_requests"
  on public.contact_requests for insert with check (true);
