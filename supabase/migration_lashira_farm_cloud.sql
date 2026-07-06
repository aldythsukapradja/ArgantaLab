-- ============================================================
--  LashiraBloom / KinFarm cloud saves + art overrides
--  Idempotent, additive. Personal farm saves do not depend on public.games
--  rows, and circle farm saves are owned by circle membership.
-- ============================================================
begin;

-- Personal logged-in LashiraBloom saves.
create table if not exists public.lashira_farm_saves (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_id    text not null default 'builtin:kinfarm',
  slot       text not null default 'default',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, slot)
);

alter table public.lashira_farm_saves enable row level security;

drop policy if exists lashira_farm_saves_own on public.lashira_farm_saves;
create policy lashira_farm_saves_own on public.lashira_farm_saves
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.save_lashira_farm_state(
  p_game text,
  p_slot text,
  p_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  insert into public.lashira_farm_saves(user_id, game_id, slot, data, updated_at)
  values (auth.uid(), coalesce(nullif(p_game, ''), 'builtin:kinfarm'), coalesce(nullif(p_slot, ''), 'default'), coalesce(p_data, '{}'::jsonb), now())
  on conflict (user_id, game_id, slot)
  do update set data = excluded.data, updated_at = now();

  return true;
end;
$$;

grant execute on function public.save_lashira_farm_state(text, text, jsonb) to authenticated;

create or replace function public.load_lashira_farm_state(
  p_game text,
  p_slot text default 'default'
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select data
  from public.lashira_farm_saves
  where user_id = auth.uid()
    and game_id = coalesce(nullif(p_game, ''), 'builtin:kinfarm')
    and slot = coalesce(nullif(p_slot, ''), 'default');
$$;

grant execute on function public.load_lashira_farm_state(text, text) to authenticated;

-- Shared circle farm saves. Reuses the canonical spine helper public.is_member.
create table if not exists public.circle_game_saves (
  circle_id  uuid not null references public.circles(id) on delete cascade,
  game_id    text not null,
  slot       text not null default 'default',
  data       jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (circle_id, game_id, slot)
);

alter table public.circle_game_saves enable row level security;

drop policy if exists circle_game_saves_member_rw on public.circle_game_saves;
create policy circle_game_saves_member_rw on public.circle_game_saves
  for all
  using (public.is_member(circle_id))
  with check (public.is_member(circle_id));

create or replace function public.save_circle_game_state(
  p_circle uuid,
  p_game text,
  p_slot text,
  p_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_member(p_circle) then raise exception 'not a member of this circle'; end if;

  insert into public.circle_game_saves(circle_id, game_id, slot, data, updated_by, updated_at)
  values (p_circle, coalesce(nullif(p_game, ''), 'builtin:kinfarm'), coalesce(nullif(p_slot, ''), 'default'), coalesce(p_data, '{}'::jsonb), auth.uid(), now())
  on conflict (circle_id, game_id, slot)
  do update set data = excluded.data, updated_by = auth.uid(), updated_at = now();

  return true;
end;
$$;

grant execute on function public.save_circle_game_state(uuid, text, text, jsonb) to authenticated;

create or replace function public.load_circle_game_state(
  p_circle uuid,
  p_game text,
  p_slot text default 'default'
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare v_data jsonb;
begin
  if auth.uid() is null then return null; end if;
  if not public.is_member(p_circle) then raise exception 'not a member of this circle'; end if;

  select data into v_data
  from public.circle_game_saves
  where circle_id = p_circle
    and game_id = coalesce(nullif(p_game, ''), 'builtin:kinfarm')
    and slot = coalesce(nullif(p_slot, ''), 'default');

  return v_data;
end;
$$;

grant execute on function public.load_circle_game_state(uuid, text, text) to authenticated;

-- LashiraBloom-specific pixel-art CRUD. Command Center can manage these item by
-- item; the game reads active rows and falls back to built-in canvas art.
create table if not exists public.lashira_pixel_art (
  slot_key    text primary key,
  label       text not null,
  category    text not null,
  status      text not null default 'placeholder',
  expected_w  int,
  expected_h  int,
  renderer    text not null default 'procedural',
  source_file text,
  notes       text,
  image_data  text,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.lashira_pixel_art enable row level security;

drop policy if exists lashira_pixel_art_read on public.lashira_pixel_art;
drop policy if exists lashira_pixel_art_write on public.lashira_pixel_art;
create policy lashira_pixel_art_read on public.lashira_pixel_art
  for select using (auth.uid() is not null);
create policy lashira_pixel_art_write on public.lashira_pixel_art
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_lashira_pixel_art()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists lashira_pixel_art_touch on public.lashira_pixel_art;
create trigger lashira_pixel_art_touch
before insert or update on public.lashira_pixel_art
for each row execute function public.touch_lashira_pixel_art();

commit;
