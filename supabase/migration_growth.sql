-- ============================================================
--  CIRCLE HQ - GROWTH ANALYTICS RPCs  (language sql, no variables)
--  Run in Supabase -> SQL Editor. Each is a single SQL statement -
--  no plpgsql, no declare/into, so editor splitting / variable errors
--  cannot happen. Operator-gated: returns null to non-operators.
--  Run the whole file, or each of the 4 blocks one at a time.
--  Needs: hq_is_operator(), profiles, item_attempts, skill_mastery,
--  diamond_ledger (already in the main schema).
-- ============================================================

-- 1) OVERVIEW ------------------------------------------------
create or replace function public.hq_growth_overview()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select
      (select count(distinct user_id) from public.item_attempts where created_at >= now() - interval '1 day') as dau,
      (select count(distinct user_id) from public.item_attempts where created_at >= now() - interval '7 days') as wau,
      (select count(distinct user_id) from public.item_attempts where created_at >= now() - interval '30 days') as mau,
      (select count(distinct user_id) from public.item_attempts where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days') as wau_prev,
      (select count(*) from public.item_attempts where created_at >= now() - interval '7 days') as att7,
      (select count(*) from public.profiles where created_at >= now() - interval '7 days') as new7,
      (select count(*) from public.profiles where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days') as new_prev7
  )
  select case when public.hq_is_operator() then jsonb_build_object(
    'northStar', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(wk,'MM-DD'), 'value',
        (select count(distinct user_id) from public.item_attempts where created_at >= wk and created_at < wk + interval '7 days')) order by wk), '[]'::jsonb)
      from generate_series(date_trunc('week',now()) - interval '7 weeks', date_trunc('week',now()), interval '1 week') as wk),
    'dau', s.dau, 'wau', s.wau, 'mau', s.mau,
    'stickiness', case when s.mau > 0 then round(100.0*s.dau/s.mau,1) else null end,
    'wauPrev', s.wau_prev,
    'wowPct', case when s.wau_prev > 0 then round(100.0*(s.wau-s.wau_prev)/s.wau_prev,1) else null end,
    'depth', case when s.wau > 0 then round(s.att7::numeric/s.wau,1) else 0 end,
    'accuracyPct', (select case when count(*) > 0 then round(100.0*count(*) filter (where correct)/count(*),1) else null end from public.item_attempts where created_at >= now() - interval '30 days'),
    'newLearners7d', s.new7,
    'newWowPct', case when s.new_prev7 > 0 then round(100.0*(s.new7-s.new_prev7)/s.new_prev7,1) else null end,
    'learners', (select count(*) from public.profiles),
    'attempts7d', s.att7,
    'attemptsTotal', (select count(*) from public.item_attempts),
    'generatedAt', now()) end
  from s;
$$;
grant execute on function public.hq_growth_overview() to authenticated;

-- 2) RETENTION ----------------------------------------------
create or replace function public.hq_retention()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.hq_is_operator() then jsonb_build_object(
    'horizons', jsonb_build_array('W0','W1','W2','W3','W4'),
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('label', to_char(cw,'MM-DD'), 'size', sz,
      'ret', (select jsonb_agg(case when cw + (k*interval '7 days') > now() then null when sz = 0 then null
              else round(100.0*(select count(distinct p.id) from public.profiles p
                where date_trunc('week',p.created_at)=cw and exists (select 1 from public.item_attempts a
                  where a.user_id=p.id and a.created_at >= cw + (k*interval '7 days') and a.created_at < cw + ((k+1)*interval '7 days')))/sz) end order by k)
        from generate_series(0,4) as k)) order by cw desc), '[]'::jsonb)
      from (select date_trunc('week',created_at) as cw, count(*) as sz from public.profiles
        where created_at >= date_trunc('week',now()) - interval '5 weeks' group by 1) c),
    'generatedAt', now()) end;
$$;
grant execute on function public.hq_retention() to authenticated;

-- 3) ACQUISITION --------------------------------------------
create or replace function public.hq_acquisition()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.hq_is_operator() then jsonb_build_object(
    'funnel', jsonb_build_array(
      jsonb_build_object('stage','Signed up','count',(select count(*) from public.profiles)),
      jsonb_build_object('stage','Activated - 1st lesson','count',(select count(distinct user_id) from public.item_attempts)),
      jsonb_build_object('stage','Mastery loop','count',(select count(distinct user_id) from public.skill_mastery)),
      jsonb_build_object('stage','Habit - 2+ weeks','count',(select count(*) from (select user_id from public.item_attempts group by user_id having count(distinct date_trunc('week',created_at)) >= 2) h))),
    'newWeekly', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(wk,'MM-DD'), 'value',
        (select count(*) from public.profiles where created_at >= wk and created_at < wk + interval '7 days')) order by wk), '[]'::jsonb)
      from generate_series(date_trunc('week',now()) - interval '7 weeks', date_trunc('week',now()), interval '1 week') as wk),
    'generatedAt', now()) end;
$$;
grant execute on function public.hq_acquisition() to authenticated;

-- 4) ECONOMY ------------------------------------------------
create or replace function public.hq_economy()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.hq_is_operator() then jsonb_build_object(
    'float', (select coalesce(sum(diamonds),0) from public.profiles),
    'minted', (select coalesce(sum(amount),0) from public.diamond_ledger where kind in ('starter','reward','earn')),
    'spent', (select coalesce(sum(amount),0) from public.diamond_ledger where kind = 'spend'),
    'gifted', (select coalesce(sum(amount),0) from public.diamond_ledger where kind = 'gift'),
    'coverage', (select case when minted > 0 then round(100.0*spent/minted,1) else null end from (select
        (select coalesce(sum(amount),0) from public.diamond_ledger where kind in ('starter','reward','earn')) as minted,
        (select coalesce(sum(amount),0) from public.diamond_ledger where kind = 'spend') as spent) x),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'amount', amt) order by amt desc), '[]'::jsonb)
      from (select kind, sum(amount) as amt from public.diamond_ledger group by kind) s),
    'ledgerRows', (select count(*) from public.diamond_ledger),
    'generatedAt', now()) end;
$$;
grant execute on function public.hq_economy() to authenticated;
