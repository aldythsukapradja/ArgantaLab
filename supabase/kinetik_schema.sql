-- ============================================================
--  KINETIK · SUPABASE SCHEMA  (run in Supabase → SQL Editor)
--  Shares ArgantaLab's project. KINETIK tables are namespaced
--  `kinetik_*` so they never collide with ArgantaLab's own
--  circles / circle_members / profiles tables.
--
--  v1 uses a single blob-mirror row per account holder (the same
--  pattern as ArgantaLab's learn_state / avatar_state): the local
--  store is the source of truth and this row mirrors it for
--  cross-device sync. Relational per-member tables come later when
--  multiple members sign in on their own devices.
-- ============================================================

create table if not exists public.kinetik_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  circles    jsonb default '[]'::jsonb,   -- circle graph (name, accent, members, roles)
  events     jsonb default '[]'::jsonb,   -- calendar events
  moments    jsonb default '[]'::jsonb,   -- moments feed
  updated_at timestamptz default now()
);

alter table public.kinetik_state enable row level security;

drop policy if exists "kinetik_state_own" on public.kinetik_state;
create policy "kinetik_state_own" on public.kinetik_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- keep updated_at fresh
create or replace function public.kinetik_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists kinetik_state_touch on public.kinetik_state;
create trigger kinetik_state_touch
  before update on public.kinetik_state
  for each row execute function public.kinetik_touch();
