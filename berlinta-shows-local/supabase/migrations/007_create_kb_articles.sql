-- EPIC 5.2: Knowledge Base for curated platform/FAQ content
create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  locale text not null check (locale in ('de', 'en')),
  content text not null,
  category text not null default 'general'
);

alter table public.kb_articles enable row level security;

-- Public read for KB
create policy "Public can read kb_articles"
  on public.kb_articles for select
  using (true);
