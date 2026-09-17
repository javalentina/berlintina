-- Poster billing: the order of names is a producer's decision, not a code change.
--
-- 1 is the headliner. NULL sinks to the bottom and falls back to created_at, so a
-- newly added artist appears without anyone having to rank them first.
--
-- Also repairs one row: Bühnenfeger carried "Akrobatik, Comedy" as its artist name —
-- a genre, not a name — which split Jim & John into two acts competing with each
-- other in the same catalogue. Both of their shows point at jim-john.de.

alter table shows add column if not exists billing_rank integer;

comment on column shows.billing_rank is
  'Position on the poster; 1 is the headliner, NULL sinks to the bottom.';

update shows set artist_name = 'Jim & John'
 where artist_name = 'Akrobatik, Comedy';

update shows set billing_rank = 1 where artist_name = 'Natalia Uchitel';
update shows set billing_rank = 2 where artist_name = 'Jim & John';
update shows set billing_rank = 3 where artist_name = 'Monoliza Live Band';
