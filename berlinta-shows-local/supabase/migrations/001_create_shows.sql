-- Berlintina Shows: create shows table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  short_id text not null,
  slug text not null unique,
  artist_id text not null,
  artist_name text not null,
  title text not null,
  category text not null check (category in ('CLASSICAL', 'BAND', 'ACROBATICS', 'DANCE')),
  instrumentation_text text,
  extracted_tags jsonb default '[]'::jsonb,
  vibe_tags jsonb default '[]'::jsonb,
  short_description_facts text not null default '',
  sales_pitch_text text not null default '',
  duration_minutes integer not null default 0,
  language_options jsonb default '[]'::jsonb,
  price_type text not null check (price_type in ('RANGE', 'POA')) default 'POA',
  price_min integer,
  price_max integer,
  photo_urls jsonb default '[]'::jsonb,
  video_urls jsonb default '[]'::jsonb,
  status text not null check (status in ('PUBLISHED', 'NEEDS_REVIEW')) default 'PUBLISHED',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: allow public read for published shows only
alter table public.shows enable row level security;

create policy "Public can read published shows"
  on public.shows for select
  using (status = 'PUBLISHED');

-- Seed one row for testing (optional)
-- insert into public.shows (
--   short_id, slug, artist_id, artist_name, title, category,
--   instrumentation_text, extracted_tags, vibe_tags, short_description_facts, sales_pitch_text,
--   duration_minutes, language_options, price_type, price_min, price_max, photo_urls, video_urls, status
-- ) values (
--   '7f3a2c', 'elegantes-streichquartett', 'a1', 'Berlin String Ensemble', 'Elegantes Streichquartett für Galas', 'CLASSICAL',
--   '2 Violinen, Viola, Cello', '["Streichquartett","Klassik","Hochzeit"]'::jsonb, '["Elegant / Premium","Hintergrund / Ambient"]'::jsonb,
--   'Professionelles Quartett mit Repertoire von Bach bis Bridgerton.', 'Verleihen Sie Ihrem Event eine zeitlose Eleganz mit unseren harmonischen Klängen.',
--   90, '["DE","EN"]'::jsonb, 'RANGE', 1200, 2500, '["https://picsum.photos/seed/strings/800/600"]'::jsonb, '["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]'::jsonb, 'PUBLISHED'
-- );
