-- ============================================================
--  CIRCLE HQ · ENGAGEMENT v3 — sensors + Mission Control reads
--  SELF-CONTAINED: supersedes migration_hq_engagement.sql — run
--  THIS file once in Supabase → SQL Editor and you're done
--  (safe to run whether or not v1 was ever applied; idempotent).
--
--  Adds over v1:
--   • sensor columns: tz, locale, device, vw, clicks, entry, ref
--     (coarse, first-party, kid-safe — no GPS/IP, no fingerprints)
--   • hq_power_curve()     — a16z L14 histogram (days active / user)
--   • hq_audience()        — role / age-band / gender / device splits
--   • hq_geo()             — coarse regions from client timezone
--   • hq_engagement() unchanged shape + avg-session + clicks totals
--
--  Needs: hq_is_operator(), profiles, hq_activity() (growth_v2).
-- ============================================================

-- 0) THE BEAT TABLE ------------------------------------------
create table if not exists public.app_usage_beats (
  id          bigint generated always as identity primary key,
  app         text not null,
  page        text not null default 'home',
  secs        int  not null check (secs between 1 and 300),
  user_id     uuid,
  client_id   text,
  session_id  text,
  local_hour  smallint check (local_hour between 0 and 23),
  local_dow   smallint check (local_dow between 0 and 6),
  occurred_at timestamptz not null default now()
);

-- v3 sensor columns (additive, nullable — old clients keep working)
alter table public.app_usage_beats add column if not exists tz     text;      -- IANA timezone → coarse region
alter table public.app_usage_beats add column if not exists locale text;      -- navigator.language
alter table public.app_usage_beats add column if not exists device text;      -- 'mobile' | 'tablet' | 'desktop'
alter table public.app_usage_beats add column if not exists vw     smallint;  -- viewport width bucket
alter table public.app_usage_beats add column if not exists clicks smallint;  -- interactions in the beat window
alter table public.app_usage_beats add column if not exists entry  boolean;   -- first beat of the session
alter table public.app_usage_beats add column if not exists ref    text;      -- referrer host (landing only)

create index if not exists idx_usage_beats_time on public.app_usage_beats (occurred_at desc);
create index if not exists idx_usage_beats_app  on public.app_usage_beats (app, occurred_at desc);
create index if not exists idx_usage_beats_user on public.app_usage_beats (user_id) where user_id is not null;

alter table public.app_usage_beats enable row level security;
drop policy if exists usage_beats_insert_anon on public.app_usage_beats;
create policy usage_beats_insert_anon on public.app_usage_beats
  for insert to anon with check (secs between 1 and 300);
drop policy if exists usage_beats_insert_auth on public.app_usage_beats;
create policy usage_beats_insert_auth on public.app_usage_beats
  for insert to authenticated with check (secs between 1 and 300);

-- 1) ENGAGEMENT ROLLUP ---------------------------------------
create or replace function public.hq_engagement(p_days int default 14)
returns jsonb language sql stable security definer set search_path = public as $$
  with b as (
    select app, page, secs, clicks,
           coalesce(user_id::text, 'guest:' || coalesce(client_id, 'unknown')) as who,
           user_id, session_id, local_hour, local_dow, occurred_at
    from public.app_usage_beats
    where occurred_at >= now() - make_interval(days => greatest(1, p_days))
  )
  select case when public.hq_is_operator() then jsonb_build_object(
    'days', greatest(1, p_days),
    'totalSeconds', coalesce((select sum(secs) from b), 0),
    'totalUsers',   coalesce((select count(distinct who) from b), 0),
    'totalClicks',  coalesce((select sum(clicks) from b), 0),

    'apps', (select coalesce(jsonb_agg(jsonb_build_object(
        'app', app, 'seconds', s, 'users', u, 'sessions', se, 'clicks', ck,
        'avgSession', case when se > 0 then round(s::numeric / se) else null end) order by s desc), '[]'::jsonb)
      from (select app, sum(secs) as s, count(distinct who) as u,
                   count(distinct session_id) as se, coalesce(sum(clicks),0) as ck
            from b group by app) a),

    'pages', (select coalesce(jsonb_agg(jsonb_build_object(
        'app', app, 'page', page, 'seconds', s, 'users', u, 'clicks', ck) order by s desc), '[]'::jsonb)
      from (select app, page, sum(secs) as s, count(distinct who) as u, coalesce(sum(clicks),0) as ck
            from b group by app, page order by sum(secs) desc limit 60) p),

    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d, 'MM-DD'), 'app', app, 'seconds', s) order by d), '[]'::jsonb)
      from (select occurred_at::date as d, app, sum(secs) as s
            from b group by 1, 2) t),

    'punch', (select coalesce(jsonb_agg(jsonb_build_object(
        'dow', local_dow, 'hour', local_hour, 'seconds', s)), '[]'::jsonb)
      from (select local_dow, local_hour, sum(secs) as s
            from b where local_dow is not null and local_hour is not null
            group by 1, 2) w),

    'users', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', who,
        'name', coalesce(pr.display_name, pr.email, case when u.user_id is null then 'Guest device' else 'Unknown' end),
        'role', coalesce(pr.role, 'guest'),
        'seconds', u.s, 'sessions', u.se, 'lastSeen', u.last_seen,
        'topApp', u.top_app, 'topPage', u.top_page,
        'perApp', u.per_app) order by u.s desc), '[]'::jsonb)
      from (
        select who, max(user_id::text)::uuid as user_id, sum(secs) as s,
               count(distinct session_id) as se, max(occurred_at) as last_seen,
               (select app from b b2 where b2.who = b1.who group by app order by sum(secs) desc limit 1) as top_app,
               (select app || ' · ' || page from b b3 where b3.who = b1.who group by app, page order by sum(secs) desc limit 1) as top_page,
               (select jsonb_agg(jsonb_build_object('app', app, 'seconds', s2) order by s2 desc)
                  from (select app, sum(secs) as s2 from b b4 where b4.who = b1.who group by app) pa) as per_app
        from b b1 group by who order by sum(secs) desc limit 14
      ) u left join public.profiles pr on pr.id = u.user_id),

    'generatedAt', now()) end;
$$;
grant execute on function public.hq_engagement(int) to authenticated;

-- 2) POWER-USER CURVE ----------------------------------------
-- The a16z "L14": for everyone active in the window, how many distinct days
-- were they active? Learning activity ∪ usage beats — the honest habit read.
create or replace function public.hq_power_curve(p_days int default 14)
returns jsonb language sql stable security definer set search_path = public as $$
  with act as (
    select user_id::text as who, ts::date as d from public.hq_activity()
      where ts >= now() - make_interval(days => greatest(1, p_days))
    union
    select coalesce(user_id::text, 'guest:' || coalesce(client_id, 'unknown')), occurred_at::date
      from public.app_usage_beats
      where occurred_at >= now() - make_interval(days => greatest(1, p_days))
  ),
  per_user as (select who, count(distinct d) as days_active from act group by who)
  select case when public.hq_is_operator() then jsonb_build_object(
    'days', greatest(1, p_days),
    'histogram', (select coalesce(jsonb_agg(jsonb_build_object('daysActive', k, 'users',
        (select count(*) from per_user where days_active = k)) order by k), '[]'::jsonb)
      from generate_series(1, greatest(1, p_days)) as k),
    'totalUsers', (select count(*) from per_user),
    'generatedAt', now()) end;
$$;
grant execute on function public.hq_power_curve(int) to authenticated;

-- 3) AUDIENCE ------------------------------------------------
-- Aggregate-only splits from parent-entered profile data + beat sensors.
create or replace function public.hq_audience()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.hq_is_operator() then jsonb_build_object(
    'roles', (select coalesce(jsonb_agg(jsonb_build_object('role', r, 'count', c) order by c desc), '[]'::jsonb)
      from (select coalesce(role, 'user') as r, count(*) as c from public.profiles group by 1) x),
    'ageBands', (select coalesce(jsonb_agg(jsonb_build_object('band', band, 'count', c) order by band), '[]'::jsonb)
      from (select case
              when birthday is null then 'unknown'
              when extract(year from age(birthday)) < 6  then '<6'
              when extract(year from age(birthday)) < 9  then '6–8'
              when extract(year from age(birthday)) < 13 then '9–12'
              when extract(year from age(birthday)) < 18 then '13–17'
              else '18+' end as band, count(*) as c
            from public.profiles group by 1) y),
    'genders', (select coalesce(jsonb_agg(jsonb_build_object('gender', g, 'count', c) order by c desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(gender), ''), 'unspecified') as g, count(*) as c from public.profiles group by 1) z),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('device', d, 'seconds', s) order by s desc), '[]'::jsonb)
      from (select coalesce(device, 'unknown') as d, sum(secs) as s
            from public.app_usage_beats
            where occurred_at >= now() - interval '30 days' group by 1) w),
    'generatedAt', now()) end;
$$;
grant execute on function public.hq_audience() to authenticated;

-- 4) GEO (coarse, kid-safe) ----------------------------------
-- Region = the client's IANA timezone (e.g. Asia/Jakarta). Never GPS/IP.
create or replace function public.hq_geo(p_days int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.hq_is_operator() then jsonb_build_object(
    'regions', (select coalesce(jsonb_agg(jsonb_build_object(
        'tz', tz, 'users', u, 'seconds', s) order by s desc), '[]'::jsonb)
      from (select tz, count(distinct coalesce(user_id::text, client_id)) as u, sum(secs) as s
            from public.app_usage_beats
            where tz is not null and occurred_at >= now() - make_interval(days => greatest(1, p_days))
            group by tz limit 20) g),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'sessions', c) order by c desc), '[]'::jsonb)
      from (select ref, count(distinct session_id) as c
            from public.app_usage_beats
            where ref is not null and ref <> '' and occurred_at >= now() - make_interval(days => greatest(1, p_days))
            group by ref limit 12) r),
    'generatedAt', now()) end;
$$;
grant execute on function public.hq_geo(int) to authenticated;

-- ============================================================
--  END v3 — after running, the HQ Portfolio Mission Control
--  lights up as beats accumulate (minutes, not days).
-- ============================================================
