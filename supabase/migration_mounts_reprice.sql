-- ============================================================
--  ARGANTALAB · MOUNTS — prestige reprice + expansion (additive, idempotent)
--  Turns mounts into a long diamond SINK (a weeks-long goal that keeps kids
--  learning): a 10-mount ladder climbing smoothly 500 → 20,000 diamonds. Prices
--  live SERVER-SIDE (mount_catalog) so buy_mount can't be tricked. Run AFTER
--  migration_mounts.sql. Safe to re-run.
-- ============================================================
begin;

insert into public.mount_catalog (mount_key, price, rarity, gate) values
  ('mount:sandstrider',   500,   'common',    'none'),
  ('mount:meadowpony',    1500,  'common',    'none'),
  ('mount:stormfin',      3000,  'rare',      'swim'),
  ('mount:emberfox',      5000,  'rare',      'none'),
  ('mount:frostelk',      7500,  'rare',      'none'),
  ('mount:updrift',       10000, 'epic',      'flier'),
  ('mount:thunderram',    13000, 'epic',      'none'),
  ('mount:shadowpanther', 16000, 'epic',      'none'),
  ('mount:crystaldrake',  18000, 'legendary', 'flier'),
  ('mount:arganterion',   20000, 'legendary', 'none')
on conflict (mount_key) do update
  set price = excluded.price, rarity = excluded.rarity, gate = excluded.gate;

commit;
