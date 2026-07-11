-- ============================================================
--  CIRCLE HQ · ENGAGEMENT / TIME-ON-PAGE PIPELINE
--  Run in Supabase → SQL Editor (whole file). Idempotent — safe to re-run.
--
--  WHAT THIS IS
--  Every Arganta app (ArgantaLab web, KinetikCircle, LashiraBloom, HQ,
--  Landing) sends a tiny usage "beat" every ~20s of real, visible,
--  non-idle time: which app, which page, how many seconds, who (auth user
--  when signed in, an anonymous stable client id otherwise).
--
--  The `hq_engagement()` RPC rolls those beats into the Portfolio's
--  "where time goes" read: time per app, per page, per day, per hour-of-
--  week, and per user — so the founder can see engagement gaps directly.
--
--  Needs: hq_is_operator(), profiles (both already in schema.sql).
-- ============================================================

-- 0) THE BEAT TABLE ------------------------------------------
create table if not exists public.app_usage_beats (
  id          bigint generated always as identity primary key,
  app         text not null,                        -- 'arganta' | 'kinetik' | 'lashira' | 'hq' | 'landing' | future
  page        text not null default 'home',         -- app-defined page/tab/scene key
  secs        int  not null check (secs between 1 and 300),
  user_id     uuid,                                 -- auth.uid() when signed in
  client_id   text,                                 -- stable anonymous device id (localStorage)
  session_id  text,                                 -- one per page-load
  local_hour  smallint check (local_hour between 0 and 23),  -- client-local, for the punch card
  local_dow   smallint check (local_dow between 0 and 6),    -- 0 = Sunday (JS getDay())
  occurred_at timestamptz not null default now()
);
create index if not exists idx_usage_beats_time on public.app_usage_beats (occurred_at desc);
create index if not exists idx_usage_beats_app  on public.app_usage_beats (app, occurred_at desc);
create index if not exists idx_usage_beats_user on public.app_usage_beats (user_id) where user_id is not null;

alter table public.app_usage_beats enable row level security;

-- Anyone (guests included — the landing page has no login) may APPEND beats;
-- nobody reads the table directly. Reads go through the operator RPC below.
drop policy if exists usage_beats_insert_anon on public.app_usage_beats;
create policy usage_beats_insert_anon on public.app_usage_beats
  for insert to anon with check (secs between 1 and 300);
drop policy if exists usage_beats_insert_auth on public.app_usage_beats;
create policy usage_beats_insert_auth on public.app_usage_beats
  for insert to authenticated with check (secs between 1 and 300);

-- 1) THE ENGAGEMENT ROLLUP -----------------------------------
-- One operator-gated read: apps → pages → days → hour-of-week → users.
-- "users" counts distinct people: auth user when known, else anonymous client.
create or replace function public.hq_engagement(p_days int default 14)
returns jsonb language sql stable security definer set search_path = public as $$
  with b as (
    select app, page, secs,
           coalesce(user_id::text, 'guest:' || coalesce(client_id, 'unknown')) as who,
           user_id, session_id, local_hour, local_dow, occurred_at
    from public.app_usage_beats
    where occurred_at >= now() - make_interval(days => greatest(1, p_days))
  )
  select case when public.hq_is_operator() then jsonb_build_object(
    'days', greatest(1, p_days),
    'totalSeconds', coalesce((select sum(secs) from b), 0),
    'totalUsers',   coalesce((select count(distinct who) from b), 0),

    -- per app: total time, distinct people, distinct sessions
    'apps', (select coalesce(jsonb_agg(jsonb_build_object(
        'app', app, 'seconds', s, 'users', u, 'sessions', se) order by s desc), '[]'::jsonb)
      from (select app, sum(secs) as s, count(distinct who) as u, count(distinct session_id) as se
            from b group by app) a),

    -- per page within app (top 60 by time — enough for every current surface)
    'pages', (select coalesce(jsonb_agg(jsonb_build_object(
        'app', app, 'page', page, 'seconds', s, 'users', u) order by s desc), '[]'::jsonb)
      from (select app, page, sum(secs) as s, count(distinct who) as u
            from b group by app, page order by sum(secs) desc limit 60) p),

    -- daily stack per app (for the stacked time-trend)
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d, 'MM-DD'), 'app', app, 'seconds', s) order by d), '[]'::jsonb)
      from (select occurred_at::date as d, app, sum(secs) as s
            from b group by 1, 2) t),

    -- hour-of-week punch card (client-local hour, 0=Sun..6=Sat)
    'punch', (select coalesce(jsonb_agg(jsonb_build_object(
        'dow', local_dow, 'hour', local_hour, 'seconds', s)), '[]'::jsonb)
      from (select local_dow, local_hour, sum(secs) as s
            from b where local_dow is not null and local_hour is not null
            group by 1, 2) w),

    -- who spends the time: top people (auth users named via profiles; guests kept honest)
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

-- ============================================================
--  END CIRCLE HQ · ENGAGEMENT PIPELINE
-- ============================================================
