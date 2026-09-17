-- Point every stored image at our own /media route instead of the old Supabase bucket.
-- The filenames are unchanged, so each URL still names the same file — only the host
-- in front of it moves. Relative on purpose: correct on berlintina.de and on Railway's
-- preview hostnames alike.

update shows
   set photo_urls = replace(
         photo_urls::text,
         'https://frhntbdimtkoifhrehhx.supabase.co/storage/v1/object/public/submissions-media/',
         '/media/submissions-media/')::jsonb
 where photo_urls::text like '%frhntbdimtkoifhrehhx.supabase.co%';

update show_submissions
   set photo_urls = replace(
         photo_urls::text,
         'https://frhntbdimtkoifhrehhx.supabase.co/storage/v1/object/public/submissions-media/',
         '/media/submissions-media/')::jsonb
 where photo_urls::text like '%frhntbdimtkoifhrehhx.supabase.co%';
