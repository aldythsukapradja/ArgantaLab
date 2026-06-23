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

-- ============================================================
--  AVATAR COSMETICS — equipped loadout + owned items (mirror)
--  Local-first; this single row syncs the wardrobe across devices.
-- ============================================================
create table if not exists public.avatar_state (
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  outfit    jsonb default '{}'::jsonb,    -- slot -> cosmetic id
  owned     jsonb default '[]'::jsonb,    -- owned cosmetic ids
  updated_at timestamptz default now()
);
alter table public.avatar_state enable row level security;
drop policy if exists "avatar_state_own" on public.avatar_state;
create policy "avatar_state_own" on public.avatar_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
--  CIRCLES & KID PROFILES  (KinetikCircle-compatible)
--  A parent owns circles and child profiles. Kids sign in with a
--  username + PIN locally; `linked_email` upgrades them to Google
--  login when they grow up. The same circles/circle_members graph
--  will power the future KinetikCircle social app.
-- ============================================================
create table if not exists public.circles (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references public.profiles(id) on delete cascade,
  name        text,
  kind        text default 'family',     -- 'family' | 'kids' | 'class' | 'friends'
  emoji       text,
  invite_code text,
  created_at  timestamptz default now()
);

create table if not exists public.child_profiles (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.profiles(id) on delete cascade,
  username      text,
  pin_hash      text,                     -- bcrypt/argon hash (server) — plain only stays local
  display_name  text,
  color         text,
  emoji         text,
  age           int,
  linked_email  text,                     -- set when upgraded to Gmail
  created_at    timestamptz default now()
);
create unique index if not exists child_username_idx on public.child_profiles(parent_id, username);

create table if not exists public.circle_members (
  circle_id  uuid references public.circles(id) on delete cascade,
  member_id  uuid,                         -- profile id OR child profile id
  member_kind text default 'child',        -- 'parent' | 'child'
  role       text default 'member',        -- 'admin' | 'member'
  joined_at  timestamptz default now(),
  primary key (circle_id, member_id)
);

-- RLS: a parent owns their circles, members, and child profiles
alter table public.circles enable row level security;
drop policy if exists "circles_own" on public.circles;
create policy "circles_own" on public.circles
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

alter table public.child_profiles enable row level security;
drop policy if exists "child_profiles_own" on public.child_profiles;
create policy "child_profiles_own" on public.child_profiles
  for all using (auth.uid() = parent_id) with check (auth.uid() = parent_id);

alter table public.circle_members enable row level security;
drop policy if exists "circle_members_own" on public.circle_members;
create policy "circle_members_own" on public.circle_members
  for all using (
    exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())
  );

-- ============================================================
--  CLOUD ACCOUNTS  (Step 2)  — kids & adults are unified profiles
--  Kids sign in with username+PIN via SYNTHETIC EMAIL auth:
--    client creates auth user  <username>@kids.argantalab.app
--    with the PIN (padded) as the password → kid IS an auth.user,
--    so every per-user RLS policy (auth.uid()) just works.
--  A guardian (Google account) links a kid by friend_code.
--  ⚠ In Supabase → Authentication → Providers → Email, turn OFF
--    "Confirm email" so kids can sign in immediately.
-- ============================================================

-- profile is the single identity table for BOTH kids and adults
alter table public.profiles add column if not exists username     text;
alter table public.profiles add column if not exists dob          date;
alter table public.profiles add column if not exists gender       text;   -- 'boy' | 'girl' (kids)
alter table public.profiles add column if not exists friend_code  text;
alter table public.profiles add column if not exists guardian_id  uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists last_seen    timestamptz;

create unique index if not exists profiles_username_idx    on public.profiles (lower(username)) where username is not null;
create unique index if not exists profiles_friend_code_idx on public.profiles (friend_code)     where friend_code is not null;
create index        if not exists profiles_guardian_idx    on public.profiles (guardian_id);

-- unique 6-char friend code generator
create or replace function public.gen_friend_code()
returns text language plpgsql as $$
declare c text; taken boolean;
begin
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    select exists(select 1 from public.profiles where friend_code = c) into taken;
    exit when not taken;
  end loop;
  return c;
end; $$;

-- new-user trigger now captures kid metadata + mints a friend code
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, photo_url, username, role, dob, gender, friend_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    nullif(new.raw_user_meta_data->>'dob', '')::date,
    new.raw_user_meta_data->>'gender',
    public.gen_friend_code()
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- backfill friend codes for any existing rows
update public.profiles set friend_code = public.gen_friend_code() where friend_code is null;

-- guardians may READ their linked kids' profiles (for the family dashboard)
drop policy if exists "profiles_select_guardian" on public.profiles;
create policy "profiles_select_guardian" on public.profiles
  for select using (guardian_id = auth.uid());

-- look up a profile by friend code (minimal public fields, for linking/friends)
create or replace function public.find_by_code(p_code text)
returns table(id uuid, display_name text, role text, photo_url text, friend_code text)
language sql security definer set search_path = public stable as $$
  select id, display_name, role, photo_url, friend_code
  from public.profiles where friend_code = upper(p_code) limit 1;
$$;
grant execute on function public.find_by_code(text) to anon, authenticated;

-- a guardian links a kid (by code) → sets the kid's guardian_id to the caller
create or replace function public.link_kid(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare kid_id uuid;
begin
  select id into kid_id from public.profiles where friend_code = upper(p_code) and role = 'kid';
  if kid_id is null then return false; end if;
  update public.profiles set guardian_id = auth.uid() where id = kid_id;
  return true;
end; $$;
grant execute on function public.link_kid(text) to authenticated;

-- presence heartbeat (the caller marks themselves seen-now)
create or replace function public.touch_presence()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;
grant execute on function public.touch_presence() to authenticated;

-- KIDS-ONLY leaderboard (no adults on the board)
create or replace function public.get_kid_leaderboard(top int default 20)
returns table(id uuid, display_name text, photo_url text, xp int, level int, dob date)
language sql security definer set search_path = public stable as $$
  select id, display_name, photo_url, xp, level, dob
  from public.profiles where role = 'kid'
  order by xp desc limit top;
$$;
grant execute on function public.get_kid_leaderboard(int) to anon, authenticated;

-- ============================================================
-- ============================================================
--  CIRCLE HQ  ·  operator command center (apps/hq)
--  100% ADDITIVE — only hq_* objects; reads ArgantaLab tables read-only.
--  Nothing above this line is modified. Safe to re-run.
-- ============================================================
-- ============================================================

-- ---------- who counts as an operator ----------
-- Operators are flagged in profiles.role. Reuse 'admin' or add 'operator'.
--   update public.profiles set role='operator' where email='you@example.com';
create or replace function public.hq_is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('operator', 'admin')
  );
$$;

-- ---------- CONTRACT TABLES (the 3 plug-in contracts) ----------
create table if not exists public.hq_app (              -- AppManifest
  id            text primary key,
  name          text not null,
  product       text not null,                           -- 'kinetik' | 'arganta' | future
  category      text,
  audience      text[],
  circle_types  text[],
  status        text default 'live',
  owner         text,
  metrics       text[],
  economy_hooks jsonb default '{}'::jsonb,
  agent_surfaces text[],
  created_at    timestamptz default now()
);

create table if not exists public.hq_feature (          -- FeatureMap rows
  app_id     text references public.hq_app(id) on delete cascade,
  tab_id     text not null,
  feature_id text not null,
  label      text,
  primary key (app_id, tab_id, feature_id)
);

create table if not exists public.hq_product_northstar ( -- ProductNorthStar (recursive via parent)
  product           text primary key,
  label             text,
  formula           text,
  input_metric_keys text[],
  parent            text
);

create table if not exists public.hq_metric_def (
  key text primary key, label text, source text,
  benchmark_green numeric, benchmark_amber numeric,
  higher_better boolean default true, unit text
);

create table if not exists public.hq_insight_rule (
  id text primary key, type text, enabled boolean default true,
  thresholds jsonb default '{}'::jsonb, severity text default 'info'
);

-- ---------- THE UNIVERSAL EVENT SINK ----------
create table if not exists public.hq_event (
  id         bigint generated always as identity primary key,
  ts         timestamptz default now(),
  product    text, app_id text,
  person_ref text, circle_ref text,          -- hashed, no PII
  type       text,                           -- feature_view | lesson_done | plan_created | diamond_earned | agent_action
  tab_id     text, feature_id text,
  payload    jsonb default '{}'::jsonb
);
create index if not exists hq_event_ptt_idx on public.hq_event (product, type, ts);
create index if not exists hq_event_app_idx on public.hq_event (app_id, ts);

-- ---------- RLS: operator-only read on every hq_ table ----------
alter table public.hq_event             enable row level security;
alter table public.hq_app               enable row level security;
alter table public.hq_feature           enable row level security;
alter table public.hq_product_northstar enable row level security;
drop policy if exists hq_event_read   on public.hq_event;
drop policy if exists hq_app_read     on public.hq_app;
drop policy if exists hq_feature_read on public.hq_feature;
drop policy if exists hq_ns_read      on public.hq_product_northstar;
create policy hq_event_read   on public.hq_event             for select using (public.hq_is_operator());
create policy hq_app_read     on public.hq_app               for select using (public.hq_is_operator());
create policy hq_feature_read on public.hq_feature           for select using (public.hq_is_operator());
create policy hq_ns_read      on public.hq_product_northstar for select using (public.hq_is_operator());
-- Operator may upsert app manifests (P0 self-seed from the client).
drop policy if exists hq_app_write on public.hq_app;
create policy hq_app_write on public.hq_app for all
  using (public.hq_is_operator()) with check (public.hq_is_operator());
-- hq_event writes happen server-side with the service-role key (bypasses RLS).

-- ---------- AGGREGATE RPCs (operator-only; read ArgantaLab tables) ----------
create or replace function public.hq_portfolio_rollup(p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_learners int; v_active int; v_diamonds bigint; v_games int;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  select count(*) into v_learners from public.profiles;
  select count(distinct user_id) into v_active from public.item_attempts
    where created_at >= now() - make_interval(days => p_days);
  select coalesce(sum(diamonds), 0) into v_diamonds from public.profiles;
  select count(*) into v_games from public.games;
  return jsonb_build_object('arganta', jsonb_build_object(
    'learners', v_learners, 'weeklyActiveLearners', v_active,
    'diamondFloat', v_diamonds, 'games', v_games));
end;
$$;

create or replace function public.hq_dau_mau()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_dau int; v_mau int;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  select count(distinct user_id) into v_dau from public.item_attempts
    where created_at >= now() - interval '1 day';
  select count(distinct user_id) into v_mau from public.item_attempts
    where created_at >= now() - interval '30 days';
  return jsonb_build_object('dau', v_dau, 'mau', v_mau,
    'ratio', case when v_mau > 0 then round(100.0 * v_dau / v_mau, 1) else 0 end);
end;
$$;

create or replace function public.hq_game_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  return (select jsonb_object_agg(coalesce(visibility,'private'), n)
          from (select visibility, count(*) n from public.games group by visibility) s);
end;
$$;

grant execute on function public.hq_is_operator()         to authenticated;
grant execute on function public.hq_portfolio_rollup(int) to authenticated;
grant execute on function public.hq_dau_mau()             to authenticated;
grant execute on function public.hq_game_stats()          to authenticated;

-- Operator: list ALL games (bypasses RLS so operators see every row)
create or replace function public.hq_list_games()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  return coalesce(
    (select jsonb_agg(row_to_json(g) order by g.created_at desc)
     from public.games g),
    '[]'::jsonb
  );
end;
$$;
grant execute on function public.hq_list_games() to authenticated;

-- ---------- SEED · recursive product north stars ----------
insert into public.hq_product_northstar (product, label, formula, input_metric_keys, parent) values
  ('portfolio', 'Weekly engaged accounts', 'sum of product north stars', array['arganta_ns','kinetik_ns'], null),
  ('arganta',   'Weekly mastery-loop learners', 'learners completing >=1 mastery loop / week',
     array['lessons_done','ring_gain','streak_ret','games_built','diamond_cycle'], 'portfolio'),
  ('kinetik',   'Weekly core-loop circles', 'circles completing plan->live->remember / week',
     array['plans','moments','kin_assists','members_active','cross_app'], 'portfolio')
on conflict (product) do nothing;

-- ============================================================
--  CIRCLE HQ · LIVE DATA-MODEL + INSIGHTS  (additive, operator-only)
--  The dashboard introspects the catalog so the ERD, tables, and
--  insights stay in lock-step with the real schema — add a table in
--  Supabase and it shows up with zero dashboard changes.
-- ============================================================

-- Full live data model: every public table, its columns, PK/FK flags,
-- live row estimate, and all foreign-key relationships → drives the ERD.
create or replace function public.hq_schema_model()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;

  with cols as (
    select c.table_name, c.column_name, c.data_type, c.ordinal_position
    from information_schema.columns c
    where c.table_schema = 'public'
  ),
  pks as (
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = 'public'
  ),
  fks as (
    select tc.table_name as src_table, kcu.column_name as src_col,
           ccu.table_name as ref_table, ccu.column_name as ref_col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
  ),
  tbls as (
    select t.table_name,
           greatest(coalesce(cl.reltuples, 0)::bigint, 0) as row_est
    from information_schema.tables t
    left join pg_class cl
      on cl.relname = t.table_name and cl.relnamespace = 'public'::regnamespace
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
  )
  select jsonb_build_object(
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', tb.table_name,
        'rows', tb.row_est,
        'columns', (
          select jsonb_agg(jsonb_build_object(
            'name', co.column_name,
            'type', co.data_type,
            'pk', exists(select 1 from pks p where p.table_name = tb.table_name and p.column_name = co.column_name),
            'fk', (select f.ref_table from fks f where f.src_table = tb.table_name and f.src_col = co.column_name limit 1)
          ) order by co.ordinal_position)
          from cols co where co.table_name = tb.table_name
        )
      ) order by tb.table_name)
      from tbls tb
    ), '[]'::jsonb),
    'relationships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from', f.src_table, 'fromCol', f.src_col,
        'to', f.ref_table, 'toCol', f.ref_col))
      from fks f
    ), '[]'::jsonb),
    'generatedAt', now()
  ) into result;

  return result;
end;
$$;

-- Live row preview for any public table (operator-only, read-only, clamped).
create or replace function public.hq_table_preview(p_table text, p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_ok boolean;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  select exists(
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = p_table and table_type = 'BASE TABLE'
  ) into v_ok;
  if not v_ok then raise exception 'unknown table %', p_table; end if;
  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from public.%I limit %s) t',
    p_table, least(greatest(p_limit, 1), 100)
  ) into v;
  return v;
end;
$$;

-- Headline insights computed from REAL data (no dummy values anywhere).
create or replace function public.hq_schema_insights()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'learners',         (select count(*) from public.profiles),
    'kids',             (select count(*) from public.profiles where role = 'kid'),
    'attemptsTotal',    (select count(*) from public.item_attempts),
    'attempts7d',       (select count(*) from public.item_attempts where created_at >= now() - interval '7 days'),
    'activeLearners7d', (select count(distinct user_id) from public.item_attempts where created_at >= now() - interval '7 days'),
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

-- Ontology snapshots (semantic layer for agents). Regenerated on demand;
-- the dashboard always reads the latest snapshot.
create table if not exists public.hq_ontology (
  id           bigint generated always as identity primary key,
  created_at   timestamptz default now(),
  generated_by text default 'deterministic',
  model        jsonb not null
);
alter table public.hq_ontology enable row level security;
drop policy if exists hq_ontology_rw on public.hq_ontology;
create policy hq_ontology_rw on public.hq_ontology for all
  using (public.hq_is_operator()) with check (public.hq_is_operator());

create or replace function public.hq_latest_ontology()
returns jsonb language sql stable security definer set search_path = public as $$
  select model from public.hq_ontology
  where public.hq_is_operator()
  order by created_at desc limit 1;
$$;

grant execute on function public.hq_schema_model()          to authenticated;
grant execute on function public.hq_table_preview(text,int) to authenticated;
grant execute on function public.hq_schema_insights()       to authenticated;
grant execute on function public.hq_latest_ontology()       to authenticated;
-- ============================================================
--  END CIRCLE HQ
-- ============================================================

-- ============================================================
--  GAME PLATFORM SPINE  ·  metadata · versions · leaderboard ·
--  saves · economy.  Powers the pro-code Game Builder and the
--  Circle Game SDK runtime bridge.  Additive & idempotent.
-- ============================================================

-- ── Richer catalog metadata (drives Discover filtering) ─────
alter table public.games add column if not exists category    text;
alter table public.games add column if not exists description text;
alter table public.games add column if not exists tags        text[] default '{}';
alter table public.games add column if not exists age_min     int;
alter table public.games add column if not exists age_max     int;
alter table public.games add column if not exists thumbnail   text;          -- emoji or data-url
alter table public.games add column if not exists version     int default 1;

-- ── Version history: every publish snapshots html + config ──
create table if not exists public.game_versions (
  id         uuid primary key default gen_random_uuid(),
  game_id    text references public.games(id) on delete cascade,
  version    int  not null,
  title      text,
  html       text,
  config     jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (game_id, version)
);
alter table public.game_versions enable row level security;
drop policy if exists "game_versions_select" on public.game_versions;
create policy "game_versions_select" on public.game_versions
  for select using (
    exists (select 1 from public.games g where g.id = game_id
            and (g.visibility = 'public' or g.user_id = auth.uid()))
  );
drop policy if exists "game_versions_insert_own" on public.game_versions;
create policy "game_versions_insert_own" on public.game_versions
  for insert with check (
    exists (select 1 from public.games g where g.id = game_id and g.user_id = auth.uid())
  );

-- ── Per-game leaderboard (real cross-user; SDK submitScore target) ──
create table if not exists public.game_scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text references public.games(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  score      bigint not null,
  meta       jsonb  default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists game_scores_board_idx on public.game_scores (game_id, score desc);
create unique index if not exists game_scores_user_idx on public.game_scores (game_id, user_id);
alter table public.game_scores enable row level security;
-- board is world-readable (public play pages); each user writes only own row
drop policy if exists "game_scores_select" on public.game_scores;
create policy "game_scores_select" on public.game_scores for select using (true);
drop policy if exists "game_scores_own" on public.game_scores;
create policy "game_scores_own" on public.game_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Per-game per-user save slots (SDK saveState/loadState target) ──
create table if not exists public.game_saves (
  user_id    uuid references public.profiles(id) on delete cascade,
  game_id    text references public.games(id) on delete cascade,
  slot       text default 'default',
  data       jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, game_id, slot)
);
alter table public.game_saves enable row level security;
drop policy if exists "game_saves_own" on public.game_saves;
create policy "game_saves_own" on public.game_saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── SPINE RPCs — the trusted host (ArgantaLab) calls these on the
--    game's behalf after receiving CIRCLE_GAME_EVENT via postMessage ──

-- Snapshot the current game into game_versions and bump games.version.
create or replace function public.snapshot_game_version(p_game text)
returns int language plpgsql security definer set search_path = public as $$
declare v_next int; g record;
begin
  select * into g from public.games where id = p_game and user_id = auth.uid();
  if g is null then raise exception 'game not found or not owned'; end if;
  v_next := coalesce(g.version, 1);
  insert into public.game_versions (game_id, version, title, html, config, created_by)
  values (p_game, v_next, g.title, g.html, g.config, auth.uid())
  on conflict (game_id, version) do update
    set title = excluded.title, html = excluded.html, config = excluded.config, created_at = now();
  update public.games set version = v_next + 1 where id = p_game;
  return v_next;
end; $$;
grant execute on function public.snapshot_game_version(text) to authenticated;

-- Submit a score: keeps the user's best only; returns rank + high-score flag.
create or replace function public.submit_game_score(p_game text, p_score bigint, p_meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_prev bigint; v_best bigint; v_high boolean; v_rank bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select score into v_prev from public.game_scores where game_id = p_game and user_id = auth.uid();
  v_high := v_prev is null or p_score > v_prev;
  v_best := greatest(coalesce(v_prev, 0), p_score);
  if v_high then
    insert into public.game_scores (game_id, user_id, score, meta)
    values (p_game, auth.uid(), p_score, coalesce(p_meta, '{}'::jsonb))
    on conflict (game_id, user_id) do update
      set score = excluded.score, meta = excluded.meta, created_at = now();
  end if;
  select count(*) + 1 into v_rank from public.game_scores
    where game_id = p_game and score > v_best;
  return jsonb_build_object('rank', v_rank, 'isHighScore', v_high, 'best', v_best);
end; $$;
grant execute on function public.submit_game_score(text, bigint, jsonb) to authenticated;

-- Read a game's leaderboard (privacy-safe: names + avatars only, no emails).
create or replace function public.get_game_leaderboard(p_game text, top int default 10)
returns table(rank bigint, user_id uuid, name text, avatar text, score bigint, at timestamptz)
language sql security definer set search_path = public stable as $$
  select row_number() over (order by s.score desc, s.created_at asc) as rank,
         s.user_id, coalesce(p.display_name, 'Player') as name, p.photo_url as avatar,
         s.score, s.created_at as at
  from public.game_scores s
  left join public.profiles p on p.id = s.user_id
  where s.game_id = p_game
  order by s.score desc, s.created_at asc
  limit least(greatest(top, 1), 100);
$$;
grant execute on function public.get_game_leaderboard(text, int) to anon, authenticated;

-- The caller's own rank in a game.
create or replace function public.get_my_game_rank(p_game text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_score bigint; v_rank bigint;
begin
  if auth.uid() is null then return null; end if;
  select score into v_score from public.game_scores where game_id = p_game and user_id = auth.uid();
  if v_score is null then return null; end if;
  select count(*) + 1 into v_rank from public.game_scores where game_id = p_game and score > v_score;
  return jsonb_build_object('rank', v_rank, 'score', v_score);
end; $$;
grant execute on function public.get_my_game_rank(text) to authenticated;

-- Save / load a per-game slot (cross-device persistence for the SDK).
create or replace function public.save_game_state(p_game text, p_slot text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.game_saves (user_id, game_id, slot, data, updated_at)
  values (auth.uid(), p_game, coalesce(p_slot, 'default'), coalesce(p_data, '{}'::jsonb), now())
  on conflict (user_id, game_id, slot) do update set data = excluded.data, updated_at = now();
  return true;
end; $$;
grant execute on function public.save_game_state(text, text, jsonb) to authenticated;

create or replace function public.load_game_state(p_game text, p_slot text default 'default')
returns jsonb language sql security definer set search_path = public stable as $$
  select data from public.game_saves
  where user_id = auth.uid() and game_id = p_game and slot = coalesce(p_slot, 'default');
$$;
grant execute on function public.load_game_state(text, text) to authenticated;

-- Award diamonds + XP from gameplay (CAPPED to curb runaway/cheating games).
-- The trusted host calls this; per-call caps keep a buggy/abusive game bounded.
create or replace function public.game_grant(p_game text, p_diamonds int default 0, p_xp int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_d int; v_x int; r record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  v_d := least(greatest(coalesce(p_diamonds, 0), 0), 500);   -- max 500 💎 per call
  v_x := least(greatest(coalesce(p_xp, 0), 0), 1000);        -- max 1000 XP per call
  update public.profiles
    set diamonds = coalesce(diamonds, 0) + v_d,
        xp       = coalesce(xp, 0) + v_x,
        level    = greatest(1, floor(1 + sqrt((coalesce(xp, 0) + v_x) / 100.0))::int)
    where id = auth.uid()
    returning diamonds, xp, level into r;
  return jsonb_build_object('diamonds', r.diamonds, 'xp', r.xp, 'level', r.level,
                            'granted', jsonb_build_object('diamonds', v_d, 'xp', v_x));
end; $$;
grant execute on function public.game_grant(text, int, int) to authenticated;

-- ── Featured games registry (operator-curated, manually ranked) ──
-- game_ref is either 'builtin:<id>' (a static ArgantaLab game) or a games.id.
-- World-readable so ArgantaLab can consume the ranking; operator-write only.
-- `rank` is the manual order (lower = higher up); a smarter ranking can later
-- compute and write these values.
create table if not exists public.hq_featured (
  game_ref   text primary key,
  rank       integer not null default 0,
  created_at timestamptz default now()
);
alter table public.hq_featured enable row level security;
drop policy if exists hq_featured_read on public.hq_featured;
create policy hq_featured_read on public.hq_featured for select using (true);
drop policy if exists hq_featured_write on public.hq_featured;
create policy hq_featured_write on public.hq_featured for all
  using (public.hq_is_operator()) with check (public.hq_is_operator());

-- Seed the 4 built-in flagship games as featured by default (idempotent).
insert into public.hq_featured (game_ref, rank) values
  ('builtin:strike',   0),
  ('builtin:nitro',    1),
  ('builtin:critter',  2),
  ('builtin:kincatch', 3)
on conflict (game_ref) do nothing;

-- ============================================================
--  END GAME PLATFORM SPINE
-- ============================================================


-- ============================================================
--  CIRCLE HQ — CONTENT RICHNESS
--  Operator-gated aggregate over the items catalog. Returns the
--  world × stage coverage matrix that drives the Content surface.
--  100% additive · no dummy data · reads only real items rows.
-- ============================================================
create or replace function public.hq_content_matrix()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'stages', (select coalesce(jsonb_agg(jsonb_build_object(
                 'key', key, 'label', label, 'minAge', min_age,
                 'maxAge', max_age, 'order', order_idx
               ) order by order_idx), '[]'::jsonb) from public.stages),
    'worlds', (select coalesce(jsonb_agg(jsonb_build_object(
                 'key', key, 'name', name, 'order', order_idx
               ) order by order_idx), '[]'::jsonb)
               from public.worlds where status = 'live'),
    'cells',  (select coalesce(jsonb_agg(c), '[]'::jsonb) from (
                 select
                   world_key                                   as world,
                   stage_key                                   as stage,
                   count(*)                                    as authored,
                   count(*) filter (where status = 'live')     as live,
                   count(distinct interaction_type)            as interactions,
                   count(distinct difficulty)                  as rungs,
                   count(distinct skill_key)                   as skills,
                   max(updated_at)                             as "lastUpdated"
                 from public.items
                 where world_key is not null and stage_key is not null
                 group by world_key, stage_key
               ) c),
    'totals', jsonb_build_object(
       'authored', (select count(*) from public.items),
       'live',     (select count(*) from public.items where status = 'live')
    ),
    'generatedAt', now()
  ) into r;
  return r;
end;
$$;
grant execute on function public.hq_content_matrix() to authenticated;
-- ============================================================
--  END CONTENT RICHNESS
-- ============================================================
