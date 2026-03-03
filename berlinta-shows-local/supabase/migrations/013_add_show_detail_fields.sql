-- Add show detail fields for marketing funnel pages
-- Run in Supabase SQL Editor

alter table public.shows
  add column if not exists "cast" text,
  add column if not exists ideal_for text,
  add column if not exists placement text,
  add column if not exists audience_range text,
  add column if not exists stage_min text,
  add column if not exists stage_ideal text,
  add column if not exists ceiling_min text,
  add column if not exists sound_short text,
  add column if not exists light_short text,
  add column if not exists timings_short text,
  add column if not exists rider_pdf_url text,
  add column if not exists testimonials jsonb default '[]'::jsonb,
  add column if not exists faq_outdoor text,
  add column if not exists faq_stage text,
  add column if not exists faq_language text,
  add column if not exists faq_custom text,
  add column if not exists faq_travel text;

comment on column public.shows."cast" is 'e.g. 2 performers (option: +1 support)';
comment on column public.shows.ideal_for is 'e.g. corporate events, galas, festivals';
comment on column public.shows.placement is 'e.g. Opener / nach Pause / Finale';
comment on column public.shows.audience_range is 'e.g. 50–2,000+';
comment on column public.shows.stage_min is 'e.g. 6×4 m';
comment on column public.shows.stage_ideal is 'e.g. 8×6 m';
comment on column public.shows.ceiling_min is 'e.g. 3.5 m+';
comment on column public.shows.testimonials is '[{quote, name}]';
