-- ============================================================================
-- migration_command_graph.sql — Circle HQ COMMAND read-side RPCs
-- Additive + idempotent. Run AFTER the existing migration chain.
-- All functions are SECURITY DEFINER and operator-gated via hq_is_operator().
--
-- These turn the grey graph live WITHOUT new instrumentation — they read tables
-- that already exist (learn_event, kinetik_*, guardianships, circles, invites).
-- Reuse note: the spec's `product_event` is NOT created — we reuse `hq_event`
-- (already defined with product/type/tab_id/feature_id/payload). surface_health
-- reads it once the three apps start emitting.
--
-- ⚠ VALIDATE w2f_weekly() against real learn_event + kinetik tables before the
--   client flips its source badge from 'partial' to 'live'.
-- ============================================================================

-- ── North Star: Weekly Two-Hook Families ────────────────────────────────────
-- A family circle counts in a week iff a child member had >=1 learn_event AND
-- an adult logged >=1 calendar/moment/post in that same ISO week.
create or replace function public.w2f_weekly()
returns table(week date, families integer, w2f integer)
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  with weeks as (
    select generate_series(date_trunc('week', now()) - interval '11 weeks',
                           date_trunc('week', now()), interval '1 week')::date as wk
  ),
  fam as (select id from circles where kind = 'family'),
  kid_hook as (
    select date_trunc('week', le.created_at)::date as wk, cm.circle_id
    from learn_event le
    join circle_members cm on cm.member_id = le.user_id
    join fam on fam.id = cm.circle_id
    group by 1, 2
  ),
  parent_hook as (
    select date_trunc('week', e.created_at)::date as wk, e.circle_id
    from (
      select circle_id, created_at from kinetik_events
      union all
      select circle_id, created_at from kinetik_post
    ) e
    join fam on fam.id = e.circle_id
    group by 1, 2
  )
  select w.wk,
         (select count(*) from fam)::int,
         coalesce((
           select count(distinct k.circle_id)
           from kid_hook k
           join parent_hook p on p.circle_id = k.circle_id and p.wk = k.wk
           where k.wk = w.wk
         ), 0)::int
  from weeks w
  order by w.wk;
end $$;

-- ── CURR: New / Current / At-risk / Dormant family states ───────────────────
create or replace function public.curr_states()
returns table(state text, families integer)
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  with fam as (select id, created_at from circles where kind = 'family'),
  lastk as (
    select cm.circle_id, max(le.created_at) lk
    from learn_event le join circle_members cm on cm.member_id = le.user_id
    group by 1
  ),
  lastp as (
    select circle_id, max(created_at) lp from (
      select circle_id, created_at from kinetik_events
      union all
      select circle_id, created_at from kinetik_post
    ) x group by 1
  ),
  cls as (
    select case
      when f.created_at > now() - interval '7 days' then 'New'
      when coalesce(lk.lk, 'epoch') > now() - interval '7 days'
       and coalesce(lp.lp, 'epoch') > now() - interval '7 days' then 'Current'
      when greatest(coalesce(lk.lk, 'epoch'), coalesce(lp.lp, 'epoch')) > now() - interval '30 days' then 'At-risk'
      else 'Dormant'
    end as state
    from fam f
    left join lastk lk on lk.circle_id = f.id
    left join lastp lp on lp.circle_id = f.id
  )
  select c.state, count(*)::int from cls c group by c.state;
end $$;

-- ── k-factor: circle-invite virality (the free growth rail) ─────────────────
create or replace function public.k_factor()
returns table(sent integer, accepted integer, k numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  select
    (select count(*) from circle_invites)::int,
    (select count(*) from circle_invites where status = 'accepted')::int,
    case when (select count(*) from circle_invites) > 0
      then round((select count(*) from circle_invites where status = 'accepted')::numeric
                 / (select count(*) from circle_invites), 3)
      else 0 end;
end $$;

-- ── surface_health: per-surface activity from the hq_event sink ─────────────
-- Empty until the three apps emit feature_view/lesson_done/... into hq_event.
create or replace function public.surface_health()
returns table(surface_id text, events bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  select coalesce(nullif(e.feature_id, ''), e.tab_id, e.product) as surface_id, count(*)
  from hq_event e
  where e.ts > now() - interval '30 days'
  group by 1
  order by 2 desc;
end $$;

grant execute on function public.w2f_weekly()     to authenticated;
grant execute on function public.curr_states()     to authenticated;
grant execute on function public.k_factor()        to authenticated;
grant execute on function public.surface_health()  to authenticated;
