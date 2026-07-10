-- Generative MUSIC library — the wire between Circle HQ's Music Forge (studio)
-- and the game. Twin of migration_audio_library.sql (SFX), but its OWN table so
-- an SFX publish and a MUSIC publish never clobber each other's active row.
-- Config is a { realm: themeOverride } map — a publish routes a theme straight
-- to a map. OPTIONAL: the game runs on package default themes without this.
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Security posture (mirrors audio_library): WRITE = operator only, READ = public
-- (themes are just synth numbers, no secrets).

begin;

create or replace function public.music_is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce((auth.jwt() ->> 'email'), '')) = 'aldhyt.sukapradja@gmail.com'
$$;

create table if not exists public.music_library (
  id            uuid primary key default gen_random_uuid(),
  version       int  not null default 1,
  config        jsonb not null,          -- { v, music:{realm:override}, published_at, note }
  active        boolean not null default false,
  published_by  uuid references auth.users(id),
  published_at  timestamptz not null default now()
);
create index if not exists music_library_active_idx on public.music_library (active) where active;

alter table public.music_library enable row level security;

drop policy if exists music_library_read on public.music_library;
create policy music_library_read on public.music_library
  for select using (auth.role() = 'authenticated');

-- The Music Forge "Publish → map" button: deactivate the previous active row,
-- insert the new one atomically. Operator only.
create or replace function public.hq_music_publish(p_config jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.music_is_operator() then
    raise exception 'not authorized: music library is operator-only';
  end if;
  update public.music_library set active = false where active;
  insert into public.music_library (version, config, active, published_by)
  values (coalesce((p_config ->> 'v')::int, 1), p_config, true, auth.uid())
  returning id into new_id;
  return new_id;
end $$;

-- The game's read: the currently active music config (or null → package themes).
create or replace function public.music_library_active()
returns jsonb language sql stable security definer set search_path = public as $$
  select config from public.music_library where active order by published_at desc limit 1
$$;

grant execute on function public.hq_music_publish(jsonb) to authenticated;
grant execute on function public.music_library_active() to authenticated, anon;

commit;

-- Rollback:
--   drop function if exists public.hq_music_publish(jsonb);
--   drop function if exists public.music_library_active();
--   drop function if exists public.music_is_operator();
--   drop table if exists public.music_library;
