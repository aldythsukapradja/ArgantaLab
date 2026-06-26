-- ============================================================
--  KINETIK · ROUTINE REPEAT END  (additive, idempotent)
--  A weekly routine can now stop after a chosen horizon (4 weeks /
--  3 months / 6 months) instead of repeating forever. NULL = always.
--  Read-only existing rows are unaffected (they stay "always").
--  Paste into Supabase → SQL Editor → Run.
-- ============================================================
alter table public.kinetik_routines
  add column if not exists repeat_until date;
