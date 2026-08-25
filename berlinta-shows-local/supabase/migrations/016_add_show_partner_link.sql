-- Kuratierter Partner-Link auf der Showseite (Cross-Marketing, Issue #14)
-- Run in Supabase SQL Editor
--
-- WICHTIG: Diese Migration muss laufen, BEVOR der zugehörige Code auf `main` landet.
-- Der Code nimmt `partner_link_url` in die öffentliche Spalten-Allowlist auf; fehlt die
-- Spalte, antwortet Postgres auf jede Shows-Abfrage mit einem Fehler — der Katalog, die
-- Showseiten, der Prerender-Build und die KI-Empfehlung fielen gleichzeitig aus.
--
-- Bewusst EIN Feld und kein zusätzliches Label: ein freies Beschriftungsfeld lädt dazu
-- ein, Marketing-Text zu erfinden. Der Anzeigetext wird aus der Domain abgeleitet.
--
-- Bewusst NICHT gelöst über einen Join auf `artist_accounts` (dort liegen `website_url`
-- und `instagram_handle` aus dem Onboarding): Was ein Künstler im Anmeldegespräch als
-- Kontaktweg angibt, ist keine Freigabe zur Veröffentlichung auf seiner Showseite.
-- Dieses Feld setzt ausschließlich die Redaktion im CMS, pro Show, bewusst.

alter table public.shows
  add column if not exists partner_link_url text;

comment on column public.shows.partner_link_url is
  'Optionaler kuratierter Link von der Showseite nach außen, z. B. zur eigenen Seite des Künstlers. Wird nur von der Redaktion im CMS gesetzt, nie automatisch aus dem Onboarding übernommen. Leer = auf der Seite erscheint nichts.';
