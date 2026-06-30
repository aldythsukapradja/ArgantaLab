-- ============================================================
--  KINETIK · BLOCKED DATES  (additive, idempotent)
--
--  A "block" is a multi-day span (e.g. a vacation) that lives in
--  kinetik_events: event_date = first day, end_date = last day,
--  is_block = true. It renders as a continuous bar across the month
--  and as an ambient banner on each covered day — it is NOT a timed
--  plan, so it never counts as a scheduling clash.
--
--  Existing event rows are unaffected (is_block defaults to false).
--  Paste into Supabase → SQL Editor → Run.
-- ============================================================
alter table public.kinetik_events
  add column if not exists is_block boolean not null default false;
