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

-- ---------- SEED · recursive product north stars ----------
insert into public.hq_product_northstar (product, label, formula, input_metric_keys, parent) values
  ('portfolio', 'Weekly engaged accounts', 'sum of product north stars', array['arganta_ns','kinetik_ns'], null),
  ('arganta',   'Weekly mastery-loop learners', 'learners completing >=1 mastery loop / week',
     array['lessons_done','ring_gain','streak_ret','games_built','diamond_cycle'], 'portfolio'),
  ('kinetik',   'Weekly core-loop circles', 'circles completing plan->live->remember / week',
     array['plans','moments','kin_assists','members_active','cross_app'], 'portfolio')
on conflict (product) do nothing;
-- ============================================================
--  END CIRCLE HQ
-- ============================================================
