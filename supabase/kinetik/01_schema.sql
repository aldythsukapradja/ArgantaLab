-- ============================================================
--  KINETIK · SCHEMA  (run FIRST, then 02_seed.sql)
--
--  Builds ON TOP of the existing ArgantaLab schema.
--  Does NOT touch any existing table except two additive changes
--  to `circles` (one new column + one new read policy).
--
--  New tables: only 3 genuinely new + 1 lightweight display table.
--  ← zero overlap with profiles, games, learn engine, hq_* etc.
-- ============================================================

-- ── 1. Extend the EXISTING `circles` table (additive, safe) ──
-- Add a Kinetik-specific accent colour. Existing rows get the default.
alter table public.circles add column if not exists accent text default '#F43F5E';

-- Allow anyone to READ circles (write stays owner-only).
-- Kinetik is a private family calendar; read-open is intentional for v1.
drop policy if exists "circles_read_all" on public.circles;
create policy "circles_read_all" on public.circles
  for select using (true);

-- ── 2. kinetik_people ─────────────────────────────────────────
-- Lightweight display profiles: name + colour + role.
-- Auth-free for v1. Will be phased out and replaced by
-- child_profiles / profiles once family members have auth accounts.
-- References the EXISTING circles table (not a new one).
create table if not exists public.kinetik_people (
  id        text primary key,                                     -- e.g. 'person_4v6ze8s'
  circle_id uuid not null references public.circles(id) on delete cascade,
  name      text not null,
  color     text not null default '#94A3B8',
  role      text not null default 'member'
            check (role in ('owner', 'coleader', 'member', 'viewer'))
);
create index if not exists kinetik_people_circle on public.kinetik_people(circle_id);

-- ── 3. kinetik_routines (genuinely new — no equivalent exists) ─
create table if not exists public.kinetik_routines (
  id           text primary key,
  circle_id    uuid not null references public.circles(id) on delete cascade,
  title        text not null,
  who          text[] not null default '{}',   -- kinetik_people.id array
  responsible  text,
  day          int  not null check (day between 0 and 6),         -- 0=Sun..6=Sat
  start_time   text not null,                                      -- 'HH:MM'
  end_time     text not null,
  duration_min int
);
create index if not exists kinetik_routines_circle on public.kinetik_routines(circle_id);

-- ── 4. kinetik_events (genuinely new) ──────────────────────────
create table if not exists public.kinetik_events (
  id           text primary key,
  circle_id    uuid not null references public.circles(id) on delete cascade,
  title        text not null,
  event_date   date not null,
  start_time   text not null,
  end_time     text not null,
  who          text[] not null default '{}',
  prep         text[] not null default '{}',
  duration_min int,
  end_date     date,
  created_at   timestamptz not null default now()
);
create index if not exists kinetik_events_circle on public.kinetik_events(circle_id);
create index if not exists kinetik_events_date   on public.kinetik_events(event_date);

-- ── 5. kinetik_moments (genuinely new) ─────────────────────────
create table if not exists public.kinetik_moments (
  id            text primary key,
  circle_id     uuid not null references public.circles(id) on delete cascade,
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

-- ── 6. RLS on the 4 new kinetik_* tables ───────────────────────
-- v1: open read+write (single private family, anon key ships in client).
-- Tighten to circle-membership check when auth is added.
alter table public.kinetik_people   enable row level security;
alter table public.kinetik_routines enable row level security;
alter table public.kinetik_events   enable row level security;
alter table public.kinetik_moments  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['kinetik_people','kinetik_routines','kinetik_events','kinetik_moments']
  loop
    execute format('drop policy if exists "%s_all" on public.%I;', t, t);
    execute format('create policy "%s_all" on public.%I for all using (true) with check (true);', t, t);
  end loop;
end $$;
