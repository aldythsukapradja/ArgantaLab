-- ============================================================
--  ARGANTALAB · OPENWORLD · Phase H — full kin rosters (harvest rates)
--  Phase H grows every world from a single starter kin into a full Openworld
--  roster (common → legendary). This migration seeds the SERVER-side harvest
--  rate for each new kin so that, once befriended, it trickles diamonds in the
--  Nexus at its rarity tier — exactly like the original 11 (migration_nexus_count).
--
--  Rate ladder (same as the MVP seed; one-line tunable here, never client-side):
--    common 0.5 · rare 1.2 · epic 3.0 · legendary 8.0  (diamonds/day/kin @100% happy)
--
--  Additive + idempotent: pure UPSERT on the existing nexus_kin_catalog. Safe to
--  re-run; touches nothing else. Run AFTER migration_nexus_count.sql.
-- ============================================================

insert into public.nexus_kin_catalog (kin_key, rarity, daily_rate) values
  -- WORDVEIL (wrd)
  ('kin:rhymefrog',   'rare',       1.2),
  ('kin:storyfox',    'epic',       3.0),
  ('kin:grammargon',  'legendary',  8.0),
  -- LIFE (lif)
  ('kin:pulsepup',    'rare',       1.2),
  ('kin:breezedeer',  'epic',       3.0),
  ('kin:auroracrane', 'legendary',  8.0),
  -- WORLD (wld)
  ('kin:dunecamel',   'rare',       1.2),
  ('kin:riverotter',  'epic',       3.0),
  ('kin:globewhale',  'legendary',  8.0),
  -- WONDER (won)
  ('kin:cometcolt',   'rare',       1.2),
  ('kin:galaxyfawn',  'epic',       3.0),
  ('kin:novabear',    'legendary',  8.0),
  -- LOGIC (log)
  ('kin:mechmouse',   'rare',       1.2),
  ('kin:ciphercat',   'epic',       3.0),
  ('kin:datadragon',  'legendary',  8.0)
on conflict (kin_key) do update
  set rarity = excluded.rarity, daily_rate = excluded.daily_rate;
