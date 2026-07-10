-- Audio-library pipeline — the wire between Circle HQ (Music Builder) and the
-- LashiraBloom game. HQ publishes ONE active override; the game reads it on
-- boot. OPTIONAL: the game runs fully on package defaults without this table.
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor) to enable
-- live-tunable sound.
--
-- Security posture (mirrors migration_combat_tuning.sql exactly):
--   • WRITE (publish) = operator only (aldhyt.sukapradja@gmail.com), server-side.
--   • READ (active override) = any authed user (kids' games need it). Config
--     carries NO secrets — just synth params — so a public read is fine.

begin;

create or replace function public.audio_is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce((auth.jwt() ->> 'email'), '')) = 'aldhyt.sukapradja@gmail.com'
$$;

create table if not exists public.audio_library (
  id            uuid primary key default gen_random_uuid(),
  version       int  not null default 1,
  config        jsonb not null,          -- { v, override, published_at, note }
  active        boolean not null default false,
  published_by  uuid references auth.users(id),
  published_at  timestamptz not null default now()
);
create index if not exists audio_library_active_idx on public.audio_library (active) where active;

alter table public.audio_library enable row level security;

drop policy if exists audio_library_read on public.audio_library;
create policy audio_library_read on public.audio_library
  for select using (auth.role() = 'authenticated');

-- The Music Builder "Save" button: deactivates the previous active row and
-- inserts the new one atomically. Operator only.
create or replace function public.hq_audio_publish(p_config jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.audio_is_operator() then
    raise exception 'not authorized: audio library is operator-only';
  end if;
  update public.audio_library set active = false where active;
  insert into public.audio_library (version, config, active, published_by)
  values (coalesce((p_config ->> 'v')::int, 1), p_config, true, auth.uid())
  returning id into new_id;
  return new_id;
end $$;

-- The game's read: the currently active override (or null → game uses defaults).
create or replace function public.audio_library_active()
returns jsonb language sql stable security definer set search_path = public as $$
  select config from public.audio_library where active order by published_at desc limit 1
$$;

grant execute on function public.hq_audio_publish(jsonb) to authenticated;
grant execute on function public.audio_library_active() to authenticated, anon;

commit;

-- Rollback:
--   drop function if exists public.hq_audio_publish(jsonb);
--   drop function if exists public.audio_library_active();
--   drop function if exists public.audio_is_operator();
--   drop table if exists public.audio_library;
