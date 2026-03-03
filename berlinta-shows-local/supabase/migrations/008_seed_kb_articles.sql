-- EPIC 5.2: Seed sample KB articles (optional - run after 007)
insert into public.kb_articles (slug, title, locale, content, category) values
  ('was-ist-berlintina', 'Was ist Berlintina?', 'de', 'Berlintina verbindet Eventplaner mit kuratierten Shows und Künstlern in Berlin. Jede Show ist persönlich geprüft. Unser KI-Concierge hilft, die passende Show für Ihr Event zu finden.', 'platform'),
  ('what-is-berlintina', 'What is Berlintina?', 'en', 'Berlintina connects event planners with curated shows and artists in Berlin. Every show is personally vetted. Our AI concierge helps find the right show for your event.', 'platform'),
  ('buchung', 'Wie buche ich?', 'de', 'Beschreiben Sie Ihr Event – Datum, Budget, Stimmung. Unser Concierge schlägt passende Shows vor. Kontaktieren Sie den Künstler direkt über die Show-Seite.', 'booking'),
  ('booking', 'How do I book?', 'en', 'Describe your event – date, budget, vibe. Our concierge suggests matching shows. Contact the artist directly via the show page.', 'booking')
on conflict (slug) do nothing;
