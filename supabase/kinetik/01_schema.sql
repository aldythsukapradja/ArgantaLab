-- ============================================================
--  KINETIK · SCHEMA  (run FIRST, then 02_seed.sql)
--
--  Real relational tables — the SINGLE SOURCE OF TRUTH for the
--  Kinetik app. No JSON blobs, no baked snapshots. The app reads
--  from here and writes back here; the browser only keeps a
--  read-only cache for offline.
--
--  Namespaced `kinetik_*` so it never collides with ArgantaLab's
--  own tables in the shared Supabase project. Idempotent.
-- ============================================================

-- ---- circles (a family / friends / class group) ----
create table if not exists public.kinetik_circles (
  id         text primary key,
  name       text not null,
  accent     text not null default '#F43F5E',
  kind       text not null default 'family'
             check (kind in ('family', 'friends', 'class')),
  created_at timestamptz not null default now()
);

-- ---- people (members of a circle) ----
create table if not exists public.kinetik_people (
  id        text primary key,
  circle_id text not null references public.kinetik_circles(id) on delete cascade,
  name      text not null,
  color     text not null default '#94A3B8',
  role      text not null default 'member'
            check (role in ('owner', 'coleader', 'member', 'viewer'))
);
create index if not exists kinetik_people_circle on public.kinetik_people(circle_id);

-- ---- routines (weekly recurring activities; day 0=Sun..6=Sat) ----
create table if not exists public.kinetik_routines (
  id           text primary key,
  circle_id    text not null references public.kinetik_circles(id) on delete cascade,
  title        text not null,
  who          text[] not null default '{}',   -- person ids attending
  responsible  text,                            -- person id who owns it
  day          int  not null check (day between 0 and 6),
  start_time   text not null,                   -- 'HH:MM'
  end_time     text not null,                   -- 'HH:MM'
  duration_min int
);
create index if not exists kinetik_routines_circle on public.kinetik_routines(circle_id);

-- ---- events (one-off, dated activities) ----
create table if not exists public.kinetik_events (
  id           text primary key,
  circle_id    text not null references public.kinetik_circles(id) on delete cascade,
  title        text not null,
  event_date   date not null,
  start_time   text not null,                   -- 'HH:MM'
  end_time     text not null,                   -- 'HH:MM'
  who          text[] not null default '{}',
  prep         text[] not null default '{}',
  duration_min int,
  end_date     date,
  created_at   timestamptz not null default now()
);
create index if not exists kinetik_events_circle on public.kinetik_events(circle_id);
create index if not exists kinetik_events_date   on public.kinetik_events(event_date);

-- ---- moments (the social / celebration feed) ----
create table if not exists public.kinetik_moments (
  id            text primary key,
  circle_id     text not null references public.kinetik_circles(id) on delete cascade,
  author_id     text references public.kinetik_people(id) on delete set null,
  body          text not null,
  kind          text not null default 'kudos'
                check (kind in ('photo', 'kudos', 'memory')),
  tag           text,
  tone          text,
  reward_energy text,
  hearts        int  not null default 0,
  comments      int  not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists kinetik_moments_circle on public.kinetik_moments(circle_id);

-- ============================================================
--  Row-Level Security
--
--  v1 (single private family): this is a low-sensitivity family
--  calendar and the anon key already ships inside the client, so
--  the realistic threat model is "whoever has the app". We keep it
--  frictionless — anyone with the key may READ and WRITE — so the
--  app just works with no login wall.
--
--  >>> SECURITY FOLLOW-UP (next step): when multiple members sign
--  in on their own devices, switch the write policy to
--  `to authenticated` + a circle-membership check, and add a
--  proper auth flow. Tracked in apps/kinetik/README.md.
-- ============================================================
alter table public.kinetik_circles  enable row level security;
alter table public.kinetik_people   enable row level security;
alter table public.kinetik_routines enable row level security;
alter table public.kinetik_events   enable row level security;
alter table public.kinetik_moments  enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'kinetik_circles','kinetik_people','kinetik_routines','kinetik_events','kinetik_moments'
  ] loop
    execute format('drop policy if exists "%s_read"  on public.%I;', t, t);
    execute format('drop policy if exists "%s_write" on public.%I;', t, t);
    execute format('drop policy if exists "%s_all"   on public.%I;', t, t);
    -- v1: open read + write for the family app.
    execute format('create policy "%s_all" on public.%I for all using (true) with check (true);', t, t);
  end loop;
end $$;
