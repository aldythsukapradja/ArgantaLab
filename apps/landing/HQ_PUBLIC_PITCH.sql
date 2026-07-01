-- ─────────────────────────────────────────────────────────────
--  hq_public_pitch()  —  PII-SAFE investor aggregate for the public landing pitch
--
--  The raw hq_* RPCs are operator-gated, so the public pitch can't call them.
--  This function returns ONLY aggregate, non-personal numbers and is granted to
--  anon. Run it in the Supabase SQL editor, then set in apps/landing/.env.local:
--     VITE_SUPABASE_URL=...    VITE_SUPABASE_ANON_KEY=...
--  The landing calls it via POST /rest/v1/rpc/hq_public_pitch (see src/lib/hq.ts).
--
--  NOTE: table/column names below follow the ArgantaLab schema conventions but may
--  need small tweaks to match your live DB. Wrap each metric in COALESCE so a
--  missing source degrades to null (the deck then shows "live soon", never a fake).
-- ─────────────────────────────────────────────────────────────

create or replace function public.hq_public_pitch()
returns json
language sql
security definer
set search_path = public
stable
as $$
  with
  d1 as (select count(distinct user_id) c from item_attempts where created_at >= now() - interval '1 day'),
  d7 as (select count(distinct user_id) c from item_attempts where created_at >= now() - interval '7 day'),
  d30 as (select count(distinct user_id) c from item_attempts where created_at >= now() - interval '30 day'),
  att7 as (select count(*) c from item_attempts where created_at >= now() - interval '7 day'),
  attT as (select count(*) c from item_attempts),
  acc as (select round(100.0 * avg(case when correct then 1 else 0 end)) p
          from item_attempts where created_at >= now() - interval '30 day'),
  econ as (
    select
      coalesce(sum(amount) filter (where amount > 0), 0) as minted,
      coalesce(-sum(amount) filter (where amount < 0), 0) as spent,
      coalesce(sum(amount), 0) as float
    from diamond_ledger
  )
  select json_build_object(
    'dau',            (select c from d1),
    'wau',            (select c from d7),
    'mau',            (select c from d30),
    'stickiness',     (select case when (select c from d30) > 0
                        then round(100.0 * (select c from d1) / (select c from d30)) end),
    'depth',          (select case when (select c from d7) > 0
                        then round((select c from att7)::numeric / (select c from d7), 1) end),
    'accuracyPct',    (select p from acc),
    'attemptsTotal',  (select c from attT),
    'learners',       (select count(*) from profiles),            -- ADJUST to your learner table
    'kids',           (select count(*) from child_profiles),      -- ADJUST if named differently
    'circles',        (select count(*) from circles),
    'worldsLive',     (select count(*) from worlds where status = 'live'),  -- ADJUST
    'itemsLive',      (select count(*) from items),                -- ADJUST
    'gamesPublic',    (select count(*) from games where visibility = 'public'),
    'flywheelCount',  (select count(distinct circle_id) from circle_members), -- proxy; ADJUST
    'familiesTotal',  (select count(*) from circles where kind = 'family'),
    'econFloat',      (select float from econ),
    'econMinted',     (select minted from econ),
    'econSpent',      (select spent from econ),
    'econCoverage',   (select case when minted > 0 then round(100.0 * spent / minted) end from econ),
    -- revenue/retention ratios stay null until instrumented (deck shows "live soon"):
    'd30', null, 'd1', null, 'activationRate', null, 'kFactor', null,
    'lessonsPerKidDay', null, 'screenMinPerKidDay', null, 'spentPerActiveKid', null,
    'wowPct', null, 'newLearners7d', (select count(*) from profiles where created_at >= now() - interval '7 day'),
    'generatedAt', now()
  );
$$;

grant execute on function public.hq_public_pitch() to anon, authenticated;
