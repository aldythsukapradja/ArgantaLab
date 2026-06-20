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
  plays       int  default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

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
