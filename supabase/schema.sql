-- ============================================================
--  ARGANTALAB · SUPABASE SCHEMA  (run in Supabase → SQL Editor)
--  Increment 4: user profiles + progress + diamonds
-- ============================================================

create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  display_name      text,
  photo_url         text,
  birthday          date,
  gender            text,
  circle_id         text,                       -- links to the external Circle app (later)
  role              text    default 'user',     -- 'user' | 'admin'
  xp                integer default 0,
  level             integer default 1,
  diamonds          integer default 0,          -- cached; Circle app is source of truth later
  completed_lessons jsonb   default '[]'::jsonb,
  badges            jsonb   default '[]'::jsonb,
  games_played      jsonb   default '[]'::jsonb,
  unlocks           jsonb   default '[]'::jsonb, -- purchased shop items
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- If profiles already existed (Increment 4), add the new column.
alter table public.profiles add column if not exists unlocks jsonb default '[]'::jsonb;

-- Row Level Security: each user can only see and edit their own row.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row the moment a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, photo_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh on every change.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================
--  GAMES  (kids' saved creations: Wizard + Pro-Code)
-- ============================================================
create table if not exists public.games (
  id          text primary key,          -- same id as the local creation
  user_id     uuid references auth.users(id) on delete cascade,
  title       text,
  source      text,                       -- 'wizard' | 'procode'
  config      jsonb,                      -- wizard choices (null for procode)
  html        text,                       -- self-contained game
  visibility  text default 'private',     -- 'private' | 'circle' | 'public'
  creator_name text,                       -- denormalised for the public share page
  plays       int  default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.games add column if not exists creator_name text;
alter table public.games add column if not exists slug text;
create unique index if not exists games_slug_idx on public.games(slug) where slug is not null;

alter table public.games enable row level security;

-- Owners manage their own games; anyone can read PUBLIC games (for the
-- future share page /play/:id).
drop policy if exists "games_select" on public.games;
create policy "games_select" on public.games
  for select using (visibility = 'public' or auth.uid() = user_id);

drop policy if exists "games_insert_own" on public.games;
create policy "games_insert_own" on public.games
  for insert with check (auth.uid() = user_id);

drop policy if exists "games_update_own" on public.games;
create policy "games_update_own" on public.games
  for update using (auth.uid() = user_id);

drop policy if exists "games_delete_own" on public.games;
create policy "games_delete_own" on public.games
  for delete using (auth.uid() = user_id);

drop trigger if exists games_touch on public.games;
create trigger games_touch
  before update on public.games
  for each row execute function public.touch_updated_at();

-- Anyone (even logged-out players on the share page) can bump the play count
-- of a PUBLIC game, without write access to the table.
create or replace function public.bump_play(game_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.games set plays = plays + 1 where id = game_id and visibility = 'public';
end;
$$;
grant execute on function public.bump_play(text) to anon, authenticated;

-- ============================================================
--  LEADERBOARD  (cross-user, privacy-safe: no emails exposed)
--  SECURITY DEFINER so it can read across profiles despite RLS.
-- ============================================================
create or replace function public.get_leaderboard(top int default 20)
returns table(id uuid, display_name text, photo_url text, xp int, level int, games bigint)
language sql security definer set search_path = public stable
as $$
  select p.id, p.display_name, p.photo_url, p.xp, p.level,
    (select count(*) from public.games g where g.user_id = p.id) as games
  from public.profiles p
  order by p.xp desc
  limit top;
$$;
grant execute on function public.get_leaderboard(int) to anon, authenticated;

-- ============================================================
--  LEARN ENGINE  (content-driven: add a row, not code)
--  Curriculum tree → items → journeys → progress.
--  CONTENT tables: anyone can READ (guests play); only admins WRITE.
--  PROGRESS tables: each user owns their own rows (RLS).
-- ============================================================

-- Helper: is the current user an admin? (reads profiles.role)
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ── Curriculum tree ─────────────────────────────────────────
create table if not exists public.stages (
  key       text primary key,            -- 'tiny','starter','explorer','builder','champion','legend'
  label     text,
  min_age   int, max_age int,
  order_idx int default 0
);

create table if not exists public.worlds (
  key           text primary key,        -- 'NUM','WRD','WON','LOG','WLD','LIF'
  name          text,
  color         text,
  icon          text,                     -- emoji or short glyph
  signature_tab text,                     -- 'Drill','Lab','CS','Trail','Party'
  status        text default 'live',      -- 'live' | 'soon'
  order_idx     int default 0
);

create table if not exists public.strands (
  id        uuid primary key default gen_random_uuid(),
  world_key text references public.worlds(key) on delete cascade,
  key       text, label text, order_idx int default 0
);

create table if not exists public.topics (
  id         uuid primary key default gen_random_uuid(),
  strand_id  uuid references public.strands(id) on delete cascade,
  key        text, label text, order_idx int default 0
);

create table if not exists public.skills (
  id              uuid primary key default gen_random_uuid(),
  topic_id        uuid references public.topics(id) on delete cascade,
  world_key       text references public.worlds(key) on delete cascade, -- denormalised for easy lookup
  key             text,                       -- natural key, unique within a world (e.g. 'mult-2-5-10')
  label           text,
  difficulty_band int default 2,
  order_idx       int default 0
);
create unique index if not exists skills_world_key_idx on public.skills(world_key, key);

-- ── Interaction-type registry (documents the payload shape) ──
create table if not exists public.interaction_types (
  key            text primary key,        -- 'mcq','speed','bank',...
  name           text,
  payload_schema jsonb,                    -- documents items.payload shape
  notes          text
);

-- ── ★ Master content table — fill THIS to add anything ★ ─────
create table if not exists public.items (
  id               uuid primary key default gen_random_uuid(),
  world_key        text references public.worlds(key) on delete cascade,
  skill_key        text,                   -- natural ref to skills.key within the world
  interaction_type text references public.interaction_types(key),
  stage_key        text references public.stages(key),
  difficulty       int default 2,          -- 1-5, drives the adaptive engine
  prompt           text,
  payload          jsonb default '{}'::jsonb,
  media_url        text, hint text, explanation text,
  xp               int default 10,
  diamonds         int default 0,
  tags             text[] default '{}',
  status           text default 'live',    -- 'draft' | 'live'
  order_idx        int default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists items_lookup_idx on public.items(world_key, skill_key, difficulty) where status = 'live';

-- ── Journey path ────────────────────────────────────────────
create table if not exists public.journey_units (
  id        uuid primary key default gen_random_uuid(),
  world_key text references public.worlds(key) on delete cascade,
  key       text, title text, color text, order_idx int default 0
);

create table if not exists public.journey_nodes (
  id              uuid primary key default gen_random_uuid(),
  unit_id         uuid references public.journey_units(id) on delete cascade,
  world_key       text references public.worlds(key) on delete cascade,
  title           text,
  type            text default 'practice',  -- 'lesson'|'practice'|'boss'|'chest'
  skill_keys      text[] default '{}',      -- natural refs to skills.key
  item_count      int default 5,
  reward_diamonds int default 5,
  unlock_rule     jsonb default '{}'::jsonb,
  order_idx       int default 0
);

-- ── Badges (data-driven unlock rules) ───────────────────────
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  world_key   text references public.worlds(key) on delete cascade,
  key         text, name text, icon text,
  unlock_rule jsonb default '{}'::jsonb,    -- {"type":"strand_mastery","strand":"fractions","pct":80}
  order_idx   int default 0
);

-- Keep updated_at fresh on items
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- ── RLS: content is world-readable, admin-writable ──────────
do $$
declare t text;
begin
  foreach t in array array['stages','worlds','strands','topics','skills','interaction_types','journey_units','journey_nodes','badges']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select using (true)', t, t);
    execute format('drop policy if exists "%s_admin" on public.%I', t, t);
    execute format('create policy "%s_admin" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- items: live rows are public; admins see + write everything
alter table public.items enable row level security;
drop policy if exists "items_read" on public.items;
create policy "items_read" on public.items for select using (status = 'live' or public.is_admin());
drop policy if exists "items_admin" on public.items;
create policy "items_admin" on public.items for all using (public.is_admin()) with check (public.is_admin());

-- ── Progress tables (each user owns their rows) ─────────────
create table if not exists public.world_progress (
  user_id         uuid references public.profiles(id) on delete cascade,
  world_key       text references public.worlds(key) on delete cascade,
  ring_pct        numeric default 0,
  skills_mastered int default 0,
  xp              int default 0,
  streak          int default 0,
  accuracy        numeric default 0,
  updated_at      timestamptz default now(),
  primary key (user_id, world_key)
);

create table if not exists public.item_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,
  item_id    uuid references public.items(id) on delete cascade,
  correct    boolean,
  time_ms    int,
  created_at timestamptz default now()
);

create table if not exists public.skill_mastery (
  user_id    uuid references public.profiles(id) on delete cascade,
  world_key  text,
  skill_key  text,                          -- natural ref to skills.key
  mastery    numeric default 0,             -- 0..1
  box        int default 1,                 -- Leitner box for spaced repetition
  last_seen  timestamptz,
  primary key (user_id, world_key, skill_key)
);

create table if not exists public.node_progress (
  user_id      uuid references public.profiles(id) on delete cascade,
  node_id      uuid references public.journey_nodes(id) on delete cascade,
  status       text default 'open',         -- 'locked'|'open'|'done'
  stars        int default 0,
  completed_at timestamptz,
  primary key (user_id, node_id)
);

create table if not exists public.user_badges (
  user_id   uuid references public.profiles(id) on delete cascade,
  badge_id  uuid references public.badges(id) on delete cascade,
  earned_at timestamptz default now(),
  primary key (user_id, badge_id)
);

-- LifeQuest quests (fake self-approval until the Circle API lands)
create table if not exists public.quest_progress (
  user_id     uuid references public.profiles(id) on delete cascade,
  item_id     uuid references public.items(id) on delete cascade,
  state       text default 'todo',          -- 'todo'|'submitted'|'approved'
  approved_by text,                          -- 'self' for now, Circle later
  updated_at  timestamptz default now(),
  primary key (user_id, item_id)
);

-- Learn-engine state mirror (cross-device). The runtime engine is key-based and
-- local-first; this single row per user mirrors the two localStorage blobs
-- (node completion + skill mastery) for sync, sidestepping uuid-FK coupling.
create table if not exists public.learn_state (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  nodes      jsonb default '{}'::jsonb,
  mastery    jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- RLS: own-row only on every progress table
do $$
declare t text;
begin
  foreach t in array array['world_progress','item_attempts','skill_mastery','node_progress','user_badges','quest_progress','learn_state']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;
