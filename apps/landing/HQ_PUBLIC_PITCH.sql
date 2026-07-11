-- ─────────────────────────────────────────────────────────────
--  hq_public_pitch()  —  PII-SAFE investor aggregate for the public landing pitch
--
--  The raw hq_* RPCs are operator-gated, so the public pitch can't call them.
--  This function returns ONLY aggregate, non-personal numbers and is granted to
--  anon. HOW TO RUN: Supabase dashboard → your project (bdagdxgpnlialkppjwor)
--  → SQL Editor → New query → paste this whole file → Run.
--  Then set env on the Vercel `landing` project (and apps/landing/.env.local):
--     VITE_SUPABASE_URL=https://bdagdxgpnlialkppjwor.supabase.co
--     VITE_SUPABASE_ANON_KEY=<anon key>
--  The landing calls it via POST /rest/v1/rpc/hq_public_pitch (see src/lib/hq.ts).
--
--  PREREQUISITE: supabase/migration_growth_v2.sql must already be applied — this
--  function reads public.hq_activity() (the unified activity union). That
--  migration is what fixed the "everything reads 0" item_attempts gotcha; if
--  hq_activity() is missing, run migration_growth_v2.sql first.
--
--  v2 (2026-07-11): rewritten against the live schema —
--   · engagement now reads hq_activity() (diamond_ledger ∪ node_progress ∪
--     quest_progress ∪ item_attempts), NOT item_attempts alone (the zeros bug)
--   · economy split by KIND, not sign — diamond_ledger.amount is always > 0
--     (check constraint), sinks are kind in ('spend','deduct'); starter grant
--     excluded from recurring mint so coverage is meaningful
--   · added wowPct, d1 (next-day comeback over 14d), lessonsPerKidDay,
--     spentPerActiveKid — same definitions as the operator RPCs
--   · d30 / activationRate / kFactor / screenMinPerKidDay stay null for now
--     (the deck badges them ○ pending — never faked)
-- ─────────────────────────────────────────────────────────────

create or replace function public.hq_public_pitch()
returns json
language sql
security definer
set search_path = public
stable
as $$
  with
  act as (select user_id, ts from public.hq_activity()),
  s as (
    select
      (select count(distinct user_id) from act where ts >= now() - interval '1 day')   as dau,
      (select count(distinct user_id) from act where ts >= now() - interval '7 days')  as wau,
      (select count(distinct user_id) from act where ts >= now() - interval '30 days') as mau,
      (select count(distinct user_id) from act
        where ts >= now() - interval '14 days' and ts < now() - interval '7 days')     as wau_prev,
      (select count(*) from act where ts >= now() - interval '7 days')                 as ev7
  ),
  -- next-day comeback over the last 14 days (the same D1 the operator Portfolio shows)
  days as (
    select distinct user_id, date_trunc('day', ts) d from act
    where ts >= now() - interval '15 days' and ts < date_trunc('day', now())
  ),
  d1 as (
    select count(*) filter (where exists (
             select 1 from days n where n.user_id = days.user_id and n.d = days.d + interval '1 day'
           ))::numeric as back,
           count(*)::numeric as base
    from days
    where d < date_trunc('day', now()) - interval '1 day'
  ),
  acc as (
    select round(100.0 * avg(case when correct then 1 else 0 end)) p
    from item_attempts where created_at >= now() - interval '30 days'
  ),
  -- lessons = earning events from real learning loops (same kinds the operator RPC counts)
  les as (
    select count(*)::numeric n, count(distinct to_user)::numeric kids
    from diamond_ledger
    where kind in ('journey','reward','drill','quest')
      and created_at >= now() - interval '30 days'
  ),
  econ as (
    select
      coalesce(sum(amount) filter (where kind not in ('spend','deduct')), 0)                          as minted,
      coalesce(sum(amount) filter (where kind not in ('spend','deduct') and kind <> 'starter'), 0)     as recurring,
      coalesce(sum(amount) filter (where kind in ('spend','deduct')), 0)                              as spent
    from diamond_ledger
  ),
  spend30 as (
    select coalesce(sum(amount), 0)::numeric total, count(distinct from_user)::numeric spenders
    from diamond_ledger
    where kind in ('spend','deduct') and created_at >= now() - interval '30 days'
  )
  select json_build_object(
    'dau',            (select dau from s),
    'wau',            (select wau from s),
    'mau',            (select mau from s),
    'stickiness',     (select case when mau > 0 then round(100.0 * dau / mau) end from s),
    'wowPct',         (select case when wau_prev > 0 then round(100.0 * (wau - wau_prev) / wau_prev) end from s),
    'depth',          (select case when wau > 0 then round(ev7::numeric / wau, 1) end from s),
    'accuracyPct',    (select p from acc),
    'd1',             (select case when base > 0 then round(100.0 * back / base) end from d1),
    'lessonsPerKidDay', (select case when kids > 0 then round(n / kids / 30.0, 1) end from les),
    'spentPerActiveKid', (select case when spenders > 0 then round(total / spenders) end from spend30),
    'learners',       (select count(*) from profiles),
    'kids',           (select count(*) from child_profiles),
    'circles',        (select count(*) from circles),
    'familiesTotal',  (select count(*) from circles where kind = 'family'),
    'worldsLive',     (select count(*) from worlds where status = 'live'),
    'itemsLive',      (select count(*) from items),
    'gamesPublic',    (select count(*) from games where visibility = 'public'),
    -- W2F proxy: circles with a member active in the last 7 days
    'flywheelCount',  (select count(distinct cm.circle_id) from circle_members cm
                        where cm.member_id in (select distinct user_id from act
                                               where ts >= now() - interval '7 days')),
    'econFloat',      (select minted - spent from econ),
    'econMinted',     (select minted from econ),
    'econSpent',      (select spent from econ),
    'econCoverage',   (select case when recurring > 0 then round(100.0 * spent / recurring) end from econ),
    -- not yet instrumented for public view — the deck badges these ○ pending, never fakes:
    'd30', null, 'activationRate', null, 'kFactor', null, 'screenMinPerKidDay', null,
    'newLearners7d',  (select count(*) from profiles where created_at >= now() - interval '7 days'),
    'attemptsTotal',  (select count(*) from item_attempts),
    'generatedAt',    now()
  );
$$;

revoke all on function public.hq_public_pitch() from public;
grant execute on function public.hq_public_pitch() to anon, authenticated;
