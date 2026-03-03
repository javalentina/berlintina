-- EPIC 4: Add original_submission_id to shows for publish pipeline
alter table public.shows add column if not exists original_submission_id uuid references public.show_submissions(id);
