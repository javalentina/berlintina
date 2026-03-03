-- Berlintina Shows: show_submissions table for artist onboarding
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists public.show_submissions (
  id uuid primary key default gen_random_uuid(),
  -- Collected from Join flow
  artist_genre text,
  show_title text not null,
  photo_urls jsonb default '[]'::jsonb,
  video_urls jsonb default '[]'::jsonb,
  duration_minutes integer,
  language_options jsonb default '[]'::jsonb,
  price_text text,
  short_description_facts text,
  sales_pitch_text text,
  social_links text,
  artist_bio text,
  submitter_email text not null,
  -- Pipeline
  status text not null check (status in ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED')) default 'PENDING_REVIEW',
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  review_notes text
);

-- RLS: allow public insert (anyone can submit), only admins read (EPIC 4 will add admin auth)
alter table public.show_submissions enable row level security;

-- Anyone can insert submissions
create policy "Public can insert submissions"
  on public.show_submissions for insert
  with check (true);

-- No public read (admin dashboard will use service role)
create policy "No public select"
  on public.show_submissions for select
  using (false);
