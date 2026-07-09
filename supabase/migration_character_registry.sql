-- Character-appearance registry — the wire between Circle HQ (Character Builder)
-- and the games (Kingdom Heroes + LashiraBloom). HQ publishes ONE active registry
-- of canonical preset specs; the games read it on boot for their shared/default
-- and NPC looks. OPTIONAL: both games run fully on @arganta/character package
-- defaults without this table. Run in the ArgantaLab Supabase project
-- (bdagdxgpnlialkppjwor) to make the presets operator-editable live.
--
-- Security posture (identical to migration_combat_tuning.sql):
--   • WRITE (publish) = operator only (aldhyt.sukapradja@gmail.com), server-side.
--   • READ (active registry) = any authed user AND anon (kids' games need it).
--     The registry carries NO secrets — just appearance ids/palettes — so a
--     public read is fine.

begin;

-- Who may publish the registry. Reuses the same operator allowlist as combat.
create or replace function public.character_is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce((auth.jwt() ->> 'email'), '')) = 'aldhyt.sukapradja@gmail.com'
$$;

-- Append-only-ish history; exactly one row is active at a time.
create table if not exists public.character_registry (
  id            uuid primary key default gen_random_uuid(),
  version       int  not null default 1,
  config        jsonb not null,          -- { v, override, presetCount, published_at, note }
  preset_count  int,                      -- denormalised for quick listing
  active        boolean not null default false,
  published_by  uuid references auth.users(id),
  published_at  timestamptz not null default now()
);
create index if not exists character_registry_active_idx on public.character_registry (active) where active;

alter table public.character_registry enable row level security;

-- Read the active registry: everyone authed (the games need it). No write via table.
drop policy if exists character_registry_read on public.character_registry;
create policy character_registry_read on public.character_registry
  for select using (auth.role() = 'authenticated');

-- The "single button to set them all": deactivates the previous active row and
-- inserts the new one atomically. Operator only.
create or replace function public.hq_character_publish(p_config jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.character_is_operator() then
    raise exception 'not authorized: character registry is operator-only';
  end if;
  update public.character_registry set active = false where active;
  insert into public.character_registry (version, config, preset_count, active, published_by)
  values (
    coalesce((p_config ->> 'v')::int, 1),
    p_config,
    coalesce((p_config ->> 'presetCount')::int, null),
    true,
    auth.uid()
  )
  returning id into new_id;
  return new_id;
end $$;

-- The games' read: the currently active registry (or null → games use defaults).
create or replace function public.character_registry_active()
returns jsonb language sql stable security definer set search_path = public as $$
  select config from public.character_registry where active order by published_at desc limit 1
$$;

grant execute on function public.hq_character_publish(jsonb) to authenticated;
grant execute on function public.character_registry_active() to authenticated, anon;

commit;

-- Rollback:
--   drop function if exists public.hq_character_publish(jsonb);
--   drop function if exists public.character_registry_active();
--   drop function if exists public.character_is_operator();
--   drop table if exists public.character_registry;
