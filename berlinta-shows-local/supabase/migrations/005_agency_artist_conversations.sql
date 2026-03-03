-- Berlintina: Agency and artist chat conversations
-- Run in Supabase SQL Editor

create table if not exists public.agency_conversations (
  id uuid primary key default gen_random_uuid(),
  locale text default 'de',
  messages jsonb default '[]'::jsonb,
  brief jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.artist_conversations (
  id uuid primary key default gen_random_uuid(),
  messages jsonb default '[]'::jsonb,
  submission_draft jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.agency_conversations enable row level security;
alter table public.artist_conversations enable row level security;

-- Allow inserts and selects for agency_conversations (backend uses service role)
create policy "Allow all agency_conversations" on public.agency_conversations for all using (true) with check (true);

create policy "Allow all artist_conversations" on public.artist_conversations for all using (true) with check (true);
