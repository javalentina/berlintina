-- Returning Artist (ohne Login): artist_accounts + artist_tokens
-- Run in Supabase SQL Editor

create table if not exists public.artist_accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  instagram_handle text,
  website_url text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists artist_accounts_instagram_uq
  on public.artist_accounts (lower(trim(instagram_handle)))
  where instagram_handle is not null and trim(instagram_handle) != '';

create unique index if not exists artist_accounts_email_uq
  on public.artist_accounts (lower(trim(email)))
  where email is not null and trim(email) != '';

create unique index if not exists artist_accounts_website_uq
  on public.artist_accounts (lower(trim(website_url)))
  where website_url is not null and trim(website_url) != '';

create table if not exists public.artist_tokens (
  id uuid primary key default gen_random_uuid(),
  artist_account_id uuid not null references public.artist_accounts(id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create index if not exists artist_tokens_artist_idx
  on public.artist_tokens (artist_account_id);

alter table public.show_submissions
  add column if not exists artist_account_id uuid references public.artist_accounts(id);

alter table public.shows
  add column if not exists artist_account_id uuid references public.artist_accounts(id);
