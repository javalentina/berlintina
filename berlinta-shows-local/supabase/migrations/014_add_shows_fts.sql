-- Full-text search column on shows
-- Covers: title, artist_name, description, sales pitch, cast, ideal_for, vibe_tags
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (
    to_tsvector('german',
      coalesce(title, '') || ' ' ||
      coalesce(artist_name, '') || ' ' ||
      coalesce(short_description_facts, '') || ' ' ||
      coalesce(sales_pitch_text, '') || ' ' ||
      coalesce("cast", '') || ' ' ||
      coalesce(ideal_for, '') || ' ' ||
      coalesce(vibe_tags::text, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS shows_fts_idx ON public.shows USING GIN (fts);
