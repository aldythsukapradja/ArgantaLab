-- ============================================================
--  ARGANTALAB · CLEAR DEFAULT FEATURED GAMES  (one-time)
--  Removes the auto-seeded built-in games from the Ship "picks" rail.
--  After this, the rail is empty until an operator features a game in
--  Circle HQ (insert into public.hq_featured). Safe & idempotent.
-- ============================================================
delete from public.hq_featured where game_ref like 'builtin:%';

-- To feature a game later (from Circle HQ or here):
--   insert into public.hq_featured (game_ref, rank) values ('builtin:strike', 0);
--   insert into public.hq_featured (game_ref, rank) values ('<games.id>', 1);
-- ============================================================
