-- ============================================================
--  CIRCLE HQ · GROWTH ANALYTICS v2  (real activity, honest economy)
--  Run in Supabase → SQL Editor (whole file, or block by block).
--
--  WHY THIS EXISTS
--  v1 measured every engagement metric from `item_attempts` alone. But kids
--  are active through journeys, quests, drills, open-world play and games —
--  all of which write to `diamond_ledger` / `node_progress` / `quest_progress`,
--  not `item_attempts`. So DAU/WAU/MAU, retention and the funnel all read 0
--  even while the family is clearly active.
--
--  THE FIX
--  A single source of truth — `hq_activity()` — unions every real per-user
--  touchpoint into (user_id, ts). Every growth RPC now reads it, so the whole
--  dashboard lights up from the same honest signal. The economy RPC is also
--  corrected: the one-time 250k starter grant is separated from the recurring
--  earn loop, and sinks include `deduct` (not just `spend`).
--
--  Needs: hq_is_operator(), profiles, item_attempts, diamond_ledger,
--  node_progress, quest_progress (all already in schema.sql).
-- ============================================================

-- 0) UNIFIED ACTIVITY SIGNAL ---------------------------------
-- Every real per-user touchpoint, as (user_id, ts). SECURITY DEFINER so the
-- operator RPCs that call it can read the own-row-RLS progress tables. Kept
-- internal (no grant to anon/authenticated) — only the gated RPCs below use it.
create or replace function public.hq_activity()
returns table(user_id uuid, ts timestamptz)
language sql stable security definer set search_path = public as $$
  -- mastery attempts
  select user_id, created_at from public.item_attempts
    where user_id is not null and created_at is not null
  union all
  -- diamonds earned from journeys / quests / drills / games / rewards
  select to_user, created_at from public.diamond_ledger
    where to_user is not null and created_at is not null
  union all
  -- diamonds spent / deducted (the kid acting on the shop)
  select from_user, created_at from public.diamond_ledger
    where from_user is not null and created_at is not null and kind in ('spend','deduct')
  union all
  -- journey-node completions
  select user_id, completed_at from public.node_progress
    where user_id is not null and completed_at is not null
  union all
  -- LifeQuest progress
  select user_id, updated_at from public.quest_progress
    where user_id is not null and updated_at is not null;
$$;
revoke all on function public.hq_activity() from public;
revoke all on function public.hq_activity() from anon;
revoke all on function public.hq_activity() from authenticated;

-- 1) OVERVIEW ------------------------------------------------
create or replace function public.hq_growth_overview()
returns jsonb language sql stable security definer set search_path = public as $$
  with act as (select user_id, ts from public.hq_activity()),
  s as (
    select
      (select count(distinct user_id) from act where ts >= now() - interval '1 day')  as dau,
      (select count(distinct user_id) from act where ts >= now() - interval '7 days')  as wau,
      (select count(distinct user_id) from act where ts >= now() - interval '30 days') as mau,
      (select count(distinct user_id) from act where ts >= now() - interval '14 days' and ts < now() - interval '7 days') as wau_prev,
      (select count(*) from act where ts >= now() - interval '7 days') as ev7,
      (select count(*) from public.profiles where created_at >= now() - interval '7 days') as new7,
      (select count(*) from public.profiles where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days') as new_prev7
  )
  select case when public.hq_is_operator() then jsonb_build_object(
    'northStar', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(wk,'MM-DD'), 'value',
        (select count(distinct user_id) from act where ts >= wk and ts < wk + interval '7 days')) order by wk), '[]'::jsonb)
      from generate_series(date_trunc('week',now()) - interval '7 weeks', date_trunc('week',now()), interval '1 week') as wk),
    'dau', s.dau, 'wau', s.wau, 'mau', s.mau,
    'stickiness', case when s.mau > 0 then round(100.0*s.dau/s.mau,1) else null end,
    'wauPrev', s.wau_prev,
    'wowPct', case when s.wau_prev > 0 then round(100.0*(s.wau-s.wau_prev)/s.wau_prev,1) else null end,
    'depth', case when s.wau > 0 then round(s.ev7::numeric/s.wau,1) else 0 end,
    'accuracyPct', (select case when count(*) > 0 then round(100.0*count(*) filter (where correct)/count(*),1) else null end
                    from public.item_attempts where created_at >= now() - interval '30 days'),
    'newLearners7d', s.new7,
    'newWowPct', case when s.new_prev7 > 0 then round(100.0*(s.new7-s.new_prev7)/s.new_prev7,1) else null end,
    'learners', (select count(*) from public.profiles),
    'attempts7d', s.ev7,
    'attemptsTotal', (select count(*) from act),
    -- what kids actually do — earn-activity events by type, last 30d (drives the activity-mix chart)
    'activityMix', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'events', ev, 'actives', ac) order by ev desc), '[]'::jsonb)
       from (select kind, count(*) as ev, count(distinct to_user) as ac
             from public.diamond_ledger
             where created_at >= now() - interval '30 days' and kind not in ('starter','spend','deduct','gift')
             group by kind) m),
    'generatedAt', now()) end
  from s;
$$;
grant execute on function public.hq_growth_overview() to authenticated;

-- 2) RETENTION ----------------------------------------------
create or replace function public.hq_retention()
returns jsonb language sql stable security definer set search_path = public as $$
  with act as (select user_id, ts from public.hq_activity())
  select case when public.hq_is_operator() then jsonb_build_object(
    'horizons', jsonb_build_array('W0','W1','W2','W3','W4'),
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('label', to_char(cw,'MM-DD'), 'size', sz,
      'ret', (select jsonb_agg(case when cw + (k*interval '7 days') > now() then null when sz = 0 then null
              else round(100.0*(select count(distinct p.id) from public.profiles p
                where date_trunc('week',p.created_at)=cw and exists (select 1 from act a
                  where a.user_id=p.id and a.ts >= cw + (k*interval '7 days') and a.ts < cw + ((k+1)*interval '7 days')))/sz) end order by k)
        from generate_series(0,4) as k)) order by cw desc), '[]'::jsonb)
      from (select date_trunc('week',created_at) as cw, count(*) as sz from public.profiles
        where created_at >= date_trunc('week',now()) - interval '5 weeks' group by 1) c),
    'generatedAt', now()) end;
$$;
grant execute on function public.hq_retention() to authenticated;

-- 3) ACQUISITION --------------------------------------------
create or replace function public.hq_acquisition()
returns jsonb language sql stable security definer set search_path = public as $$
  with act as (select user_id, ts from public.hq_activity())
  select case when public.hq_is_operator() then jsonb_build_object(
    'funnel', jsonb_build_array(
      jsonb_build_object('stage','Signed up','count',(select count(*) from public.profiles)),
      jsonb_build_object('stage','Activated · first action','count',(select count(distinct user_id) from act)),
      jsonb_build_object('stage','Engaged · 5+ actions','count',(select count(*) from (select user_id from act group by user_id having count(*) >= 5) e)),
      jsonb_build_object('stage','Habit · 2+ weeks','count',(select count(*) from (select user_id from act group by user_id having count(distinct date_trunc('week',ts)) >= 2) h))),
    'newWeekly', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(wk,'MM-DD'), 'value',
        (select count(*) from public.profiles where created_at >= wk and created_at < wk + interval '7 days')) order by wk), '[]'::jsonb)
      from generate_series(date_trunc('week',now()) - interval '7 weeks', date_trunc('week',now()), interval '1 week') as wk),
    'generatedAt', now()) end;
$$;
grant execute on function public.hq_acquisition() to authenticated;

-- 4) ECONOMY ------------------------------------------------
-- Mint = every positive flow except the sinks. Sinks = spend + deduct.
-- The one-time `starter` grant is split out so the *recurring* earn loop and a
-- meaningful sink-coverage (burn ÷ recurring-mint) are visible, instead of the
-- 250k onboarding floor flattening the whole picture.
create or replace function public.hq_economy()
returns jsonb language sql stable security definer set search_path = public as $$
  with led as (select kind, amount, created_at from public.diamond_ledger),
  agg as (
    select
      (select coalesce(sum(diamonds),0) from public.profiles)                       as float,
      (select coalesce(sum(amount),0) from led where kind not in ('spend','deduct')) as minted,
      (select coalesce(sum(amount),0) from led where kind in ('spend','deduct'))      as spent,
      (select coalesce(sum(amount),0) from led where kind = 'starter')               as starter,
      (select coalesce(sum(amount),0) from led where kind = 'gift')                   as gifted
  )
  select case when public.hq_is_operator() then jsonb_build_object(
    'float',           agg.float,
    'minted',          agg.minted,
    'spent',           agg.spent,
    'starterGrant',    agg.starter,
    'recurringMinted', agg.minted - agg.starter,
    'gifted',          agg.gifted,
    -- coverage against the recurring loop, not the one-time starter floor
    'coverage', case when (agg.minted - agg.starter) > 0
                     then round(100.0*agg.spent/(agg.minted - agg.starter),1) else null end,
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'amount', amt,
        'flow', case when kind in ('spend','deduct') then 'sink' else 'mint' end) order by amt desc), '[]'::jsonb)
      from (select kind, sum(amount) as amt from led group by kind) s),
    -- weekly mint vs burn — the real economic pulse (starter excluded)
    'mintBurn', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(wk,'MM-DD'),
        'mint', (select coalesce(sum(amount),0) from led where kind not in ('spend','deduct','starter') and created_at >= wk and created_at < wk + interval '7 days'),
        'burn', (select coalesce(sum(amount),0) from led where kind in ('spend','deduct') and created_at >= wk and created_at < wk + interval '7 days')) order by wk), '[]'::jsonb)
      from generate_series(date_trunc('week',now()) - interval '7 weeks', date_trunc('week',now()), interval '1 week') as wk),
    'ledgerRows', (select count(*) from led),
    'generatedAt', now()) end
  from agg;
$$;
grant execute on function public.hq_economy() to authenticated;

-- 5) PORTFOLIO / INSIGHTS — active counts now read real activity ----
create or replace function public.hq_schema_insights()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'learners',         (select count(*) from public.profiles),
    'kids',             (select count(*) from public.profiles where role = 'kid'),
    'attemptsTotal',    (select count(*) from public.hq_activity()),
    'attempts7d',       (select count(*) from public.hq_activity() where ts >= now() - interval '7 days'),
    'activeLearners7d', (select count(distinct user_id) from public.hq_activity() where ts >= now() - interval '7 days'),
    'accuracyPct',      (select case when count(*) > 0
                                then round(100.0 * count(*) filter (where correct) / count(*), 1) else null end
                         from public.item_attempts where created_at >= now() - interval '30 days'),
    'gamesTotal',       (select count(*) from public.games),
    'gamesPublic',      (select count(*) from public.games where visibility = 'public'),
    'diamondsFloat',    (select coalesce(sum(diamonds), 0) from public.profiles),
    'worldsLive',       (select count(*) from public.worlds where status = 'live'),
    'itemsLive',        (select count(*) from public.items where status = 'live'),
    'circles',          (select count(*) from public.circles),
    'generatedAt', now()
  ) into r;
  return r;
end;
$$;
grant execute on function public.hq_schema_insights() to authenticated;

-- hq_portfolio_rollup + hq_dau_mau also read the unified signal ------
create or replace function public.hq_portfolio_rollup(p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_learners int; v_active int; v_diamonds bigint; v_games int;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  select count(*) into v_learners from public.profiles;
  select count(distinct user_id) into v_active from public.hq_activity()
    where ts >= now() - make_interval(days => p_days);
  select coalesce(sum(diamonds), 0) into v_diamonds from public.profiles;
  select count(*) into v_games from public.games;
  return jsonb_build_object('arganta', jsonb_build_object(
    'learners', v_learners, 'weeklyActiveLearners', v_active,
    'diamondFloat', v_diamonds, 'games', v_games));
end;
$$;
grant execute on function public.hq_portfolio_rollup(int) to authenticated;

create or replace function public.hq_dau_mau()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_dau int; v_mau int;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  select count(distinct user_id) into v_dau from public.hq_activity() where ts >= now() - interval '1 day';
  select count(distinct user_id) into v_mau from public.hq_activity() where ts >= now() - interval '30 days';
  return jsonb_build_object('dau', v_dau, 'mau', v_mau,
    'ratio', case when v_mau > 0 then round(100.0 * v_dau / v_mau, 1) else 0 end);
end;
$$;
grant execute on function public.hq_dau_mau() to authenticated;

-- 6) KINETIKCIRCLE PORTFOLIO STATS --------------------------
-- The Portfolio card counted circle_members via a direct anon/authenticated
-- query (`select id` — a column that doesn't exist; PK is (circle_id,member_id))
-- AND under own-row RLS, so Members always read 0. This definer RPC counts the
-- whole ecosystem, and Members = distinct people (memberships ∪ circle owners).
create or replace function public.hq_kinetik_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.hq_is_operator() then jsonb_build_object(
    'circles', (select count(*) from public.circles),
    'members', (select count(*) from (
        select member_id as id from public.circle_members where member_id is not null
        union
        select owner_id from public.circles where owner_id is not null) u),
    'posts',   (select count(*) from public.kinetik_post),
    'posts7d', (select count(*) from public.kinetik_post where created_at >= now() - interval '7 days'),
    'reactions', (select coalesce(sum(reaction_count),0) from public.kinetik_post),
    'broadcastsPublished', (select count(*) from public.kinetik_broadcast where status = 'published'),
    'broadcastViews',      (select coalesce(sum(view_count),0) from public.kinetik_broadcast where status = 'published'),
    'broadcastReactions',  (select coalesce(sum(reaction_count),0) from public.kinetik_broadcast where status = 'published'),
    'generatedAt', now()) end;
$$;
grant execute on function public.hq_kinetik_stats() to authenticated;

-- 7) PORTFOLIO · VC SCORECARD -------------------------------
-- Cross-cutting metrics the AARRR Portfolio needs beyond growth/economy:
-- activation, lessons completed, a return-rate retention proxy, diamonds spent
-- per active kid (pay-intent), the cross-app flywheel, and the invite funnel.
-- plpgsql + to_regclass guard so it still installs where circle_invites (the
-- friends/invites migration) hasn't been applied yet.
create or replace function public.hq_portfolio_vc()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_ref jsonb;
begin
  if not public.hq_is_operator() then return null; end if;

  select jsonb_build_object(
    -- ACTIVATION — of all signups, % that took a first action within 48h of joining
    'activationRate', (select case when count(*) > 0 then round(100.0*count(*) filter (where activated)/count(*),1) else null end
       from (select p.id, exists(select 1 from public.hq_activity() a
                where a.user_id = p.id and a.ts >= p.created_at and a.ts < p.created_at + interval '48 hours') as activated
             from public.profiles p) q),
    -- ENGAGEMENT — journey nodes completed (the "lessons done" signal)
    'lessonsCompleted7d',    (select count(*) from public.node_progress where completed_at >= now() - interval '7 days'),
    'lessonsCompletedTotal', (select count(*) from public.node_progress where completed_at is not null),
    -- RETENTION proxy — of accounts older than 30d, % still active in the last 30d
    'returnRate', (select case when count(*) > 0 then round(100.0*count(*) filter (where retained)/count(*),1) else null end
       from (select p.id, exists(select 1 from public.hq_activity() a where a.user_id = p.id and a.ts >= now() - interval '30 days') as retained
             from public.profiles p where p.created_at < now() - interval '30 days') r2),
    -- D1 RETENTION — of the days a user is active (last 14d), share they came back the next day.
    -- The live, daily-habit retention signal (no 30-day wait, populates from day two).
    'd1Retention', (
      with ad as (select distinct user_id, ts::date as d from public.hq_activity() where ts >= now() - interval '14 days')
      select case when count(*) > 0 then round(100.0*count(*) filter (where cb)/count(*),1) else null end
      from (select a.user_id, exists(select 1 from ad b where b.user_id = a.user_id and b.d = a.d + 1) as cb
            from ad a where a.d < current_date) p),
    -- count of active-day observations behind D1 (so the UI can show the sample size)
    'd1Sample', (
      with ad as (select distinct user_id, ts::date as d from public.hq_activity() where ts >= now() - interval '14 days')
      select count(*) from ad a where a.d < current_date),
    -- MONETIZATION proxy — diamonds spent per active kid (30d), the pay-intent leading indicator
    'spentPerActiveKid', (select case when k.cnt > 0 then round(s.spent::numeric/k.cnt) else null end
       from (select coalesce(sum(amount),0) as spent from public.diamond_ledger where kind in ('spend','deduct') and created_at >= now() - interval '30 days') s,
            (select count(distinct a.user_id) as cnt from public.hq_activity() a join public.profiles p on p.id = a.user_id
             where p.role = 'kid' and a.ts >= now() - interval '30 days') k),
    -- FLYWHEEL — circles that contain an active learner (the cross-app moat)
    'familiesTotal', (select count(*) from public.circles),
    'flywheelCount', (select count(*) from public.circles c where exists(
        select 1 from public.hq_activity() a where a.ts >= now() - interval '30 days' and a.user_id in (
          select c.owner_id union all select cm.member_id from public.circle_members cm where cm.circle_id = c.id))),
    'generatedAt', now()
  ) into r;

  -- REFERRAL — invite funnel (only if the invites table exists)
  if to_regclass('public.circle_invites') is not null then
    execute 'select jsonb_build_object(
      ''invitesSent'', count(*),
      ''invitesAccepted'', count(*) filter (where status = ''accepted''),
      ''kFactor'', case when count(distinct invited_by) > 0
                        then round((count(*) filter (where status = ''accepted''))::numeric / count(distinct invited_by), 2) else null end)
      from public.circle_invites' into v_ref;
  else
    v_ref := jsonb_build_object('invitesSent', 0, 'invitesAccepted', 0, 'kFactor', null);
  end if;

  return r || v_ref;
end;
$$;
grant execute on function public.hq_portfolio_vc() to authenticated;
