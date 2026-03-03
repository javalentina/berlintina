-- Blog posts table — bilingual, admin-authored
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title_de      text NOT NULL,
  title_en      text NOT NULL,
  excerpt_de    text NOT NULL DEFAULT '',
  excerpt_en    text NOT NULL DEFAULT '',
  content_de    text NOT NULL DEFAULT '',
  content_en    text NOT NULL DEFAULT '',
  cover_image_url text,
  published_at  timestamptz,   -- NULL = draft; set to publish
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public: only published posts visible
CREATE POLICY "Public reads published blog posts"
  ON public.blog_posts FOR SELECT
  USING (published_at IS NOT NULL AND published_at <= now());
