-- Berlintina Shows — schema for Railway Postgres.
--
-- Consolidated from supabase/migrations/001-016. Deliberately left out:
--   * Row Level Security and every policy — only our own Express server reaches
--     this database, using the password from DATABASE_URL. RLS existed to stop the
--     browser's anon key from seeing too much; that path no longer exists.
--   * storage.objects — uploads now live on the Railway volume, not in Supabase.
--   * agency_conversations / artist_conversations from 005 — absent from the live
--     database (404); leftovers of the agency chat that was never wired up.

create extension if not exists pgcrypto;   -- gen_random_uuid()

create table if not exists artist_accounts (
  id               uuid primary key default gen_random_uuid(),
  display_name     text,
  instagram_handle text,
  website_url      text,
  email            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create unique index if not exists artist_accounts_instagram_uq
  on artist_accounts (lower(trim(instagram_handle)))
  where instagram_handle is not null and trim(instagram_handle) != '';
create unique index if not exists artist_accounts_email_uq
  on artist_accounts (lower(trim(email)))
  where email is not null and trim(email) != '';
create unique index if not exists artist_accounts_website_uq
  on artist_accounts (lower(trim(website_url)))
  where website_url is not null and trim(website_url) != '';

create table if not exists artist_tokens (
  id                uuid primary key default gen_random_uuid(),
  artist_account_id uuid not null references artist_accounts(id) on delete cascade,
  token_hash        text not null unique,
  label             text,
  created_at        timestamptz default now(),
  last_seen_at      timestamptz,
  revoked_at        timestamptz
);
create index if not exists artist_tokens_artist_idx on artist_tokens (artist_account_id);

create table if not exists show_submissions (
  id                      uuid primary key default gen_random_uuid(),
  artist_genre            text,
  show_title              text not null,
  photo_urls              jsonb default '[]'::jsonb,
  video_urls              jsonb default '[]'::jsonb,
  duration_minutes        integer,
  language_options        jsonb default '[]'::jsonb,
  price_text              text,
  short_description_facts text,
  sales_pitch_text        text,
  social_links            text,
  artist_bio              text,
  submitter_email         text not null,
  artist_account_id       uuid references artist_accounts(id),
  status                  text not null default 'PENDING_REVIEW'
                            check (status in ('PENDING_REVIEW','APPROVED','REJECTED','CHANGES_REQUESTED')),
  submitted_at            timestamptz default now(),
  reviewed_at             timestamptz,
  review_notes            text
);

create table if not exists shows (
  id                      uuid primary key default gen_random_uuid(),
  short_id                text not null,
  slug                    text not null unique,
  artist_id               text not null,
  artist_name             text not null,
  title                   text not null,
  -- WORKSHOP covers the participatory formats: not an act the audience watches but
  -- one it takes part in — team days, retreats, birthdays, women's circles. Priced
  -- per group rather than per appearance, so those entries use price_type 'POA'.
  category                text not null check (category in ('CLASSICAL','BAND','ACROBATICS','DANCE','WORKSHOP')),
  instrumentation_text    text,
  extracted_tags          jsonb default '[]'::jsonb,
  vibe_tags               jsonb default '[]'::jsonb,
  short_description_facts text not null default '',
  sales_pitch_text        text not null default '',
  duration_minutes        integer not null default 0,
  language_options        jsonb default '[]'::jsonb,
  price_type              text not null default 'POA' check (price_type in ('RANGE','POA')),
  price_min               integer,
  price_max               integer,
  photo_urls              jsonb default '[]'::jsonb,
  video_urls              jsonb default '[]'::jsonb,
  status                  text not null default 'PUBLISHED' check (status in ('PUBLISHED','NEEDS_REVIEW')),
  original_submission_id  uuid references show_submissions(id),
  artist_account_id       uuid references artist_accounts(id),
  artist_email            text,
  artist_notified_at      timestamptz,
  "cast"                  text,
  ideal_for               text,
  placement               text,
  audience_range          text,
  stage_min               text,
  stage_ideal             text,
  ceiling_min             text,
  sound_short             text,
  light_short             text,
  timings_short           text,
  rider_pdf_url           text,
  testimonials            jsonb default '[]'::jsonb,
  faq_outdoor             text,
  faq_stage               text,
  faq_language            text,
  faq_custom              text,
  faq_travel              text,
  partner_link_url        text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  fts tsvector generated always as (
    to_tsvector('german',
      coalesce(title, '') || ' ' ||
      coalesce(artist_name, '') || ' ' ||
      coalesce(short_description_facts, '') || ' ' ||
      coalesce(sales_pitch_text, '') || ' ' ||
      coalesce("cast", '') || ' ' ||
      coalesce(ideal_for, '') || ' ' ||
      coalesce(vibe_tags::text, '')
    )
  ) stored
);
create index if not exists shows_fts_idx on shows using gin (fts);

create table if not exists kb_articles (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null unique,
  title    text not null,
  locale   text not null check (locale in ('de','en')),
  content  text not null,
  category text not null default 'general'
);

create table if not exists contact_requests (
  id              uuid primary key default gen_random_uuid(),
  show_id         uuid references shows(id) on delete set null,
  show_title      text,
  requester_name  text not null,
  requester_email text not null,
  message         text,
  event_date      text,
  created_at      timestamptz default now()
);

create table if not exists blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title_de        text not null,
  title_en        text not null,
  excerpt_de      text not null default '',
  excerpt_en      text not null default '',
  content_de      text not null default '',
  content_en      text not null default '',
  cover_image_url text,
  published_at    timestamptz,
  created_at      timestamptz default now()
);
