-- NPC registry — the shared cast Circle HQ's Character Forge (NPC Studio tab)
-- composes once, for both games to place. Unlike player characters, NPCs have no
-- owning profile — they're world content, so write is operator-only (the same
-- hq_is_operator() gate as the character-admin + combat-tuning migrations) while
-- read is public (both games need the roster to render townsfolk).
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).

begin;

create table if not exists public.kingdom_npcs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text not null default 'villager',   -- shop | quest | guard | healer | smith | villager | ...
  notes       text,
  spec_json   jsonb not null default '{}'::jsonb, -- the compositor loadout
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists kingdom_npcs_name_uq on public.kingdom_npcs (lower(name));

alter table public.kingdom_npcs enable row level security;

-- Anyone authed (or anon — the games need it for kids' guest sessions) can read
-- the cast; only the operator can write. No direct table write policy — all
-- writes go through hq_npc_save/hq_npc_delete below.
drop policy if exists kingdom_npcs_read on public.kingdom_npcs;
create policy kingdom_npcs_read on public.kingdom_npcs for select using (true);

-- Operator roster + CRUD, mirroring hq_character_roster/get/save.
create or replace function public.hq_npc_roster()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'role', role, 'notes', notes,
      'hasSpec', (spec_json <> '{}'::jsonb), 'updatedAt', updated_at
    ) order by lower(name))
    from public.kingdom_npcs
  ), '[]'::jsonb)
$$;

create or replace function public.hq_npc_get(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name, 'role', role, 'notes', notes, 'spec', spec_json)
  from public.kingdom_npcs where id = p_id
$$;

-- Upsert: p_id null => create new (name must be unique); non-null => update that row.
create or replace function public.hq_npc_save(p_id uuid, p_name text, p_role text, p_notes text, p_spec jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not public.hq_is_operator() then raise exception 'operator only'; end if;
  if p_name is null or btrim(p_name) = '' then
    return jsonb_build_object('ok', false, 'message', 'NPC needs a name.');
  end if;
  if p_id is null then
    insert into public.kingdom_npcs (name, role, notes, spec_json)
    values (btrim(p_name), coalesce(nullif(btrim(p_role), ''), 'villager'), p_notes, coalesce(p_spec, '{}'::jsonb))
    returning id into rid;
  else
    update public.kingdom_npcs
       set name = btrim(p_name), role = coalesce(nullif(btrim(p_role), ''), 'villager'),
           notes = p_notes, spec_json = coalesce(p_spec, '{}'::jsonb), updated_at = now()
     where id = p_id
    returning id into rid;
  end if;
  return jsonb_build_object('ok', true, 'id', rid);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'message', 'An NPC with that name already exists.');
end $$;

create or replace function public.hq_npc_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.hq_is_operator() then raise exception 'operator only'; end if;
  delete from public.kingdom_npcs where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.hq_npc_roster() to authenticated, anon;
grant execute on function public.hq_npc_get(uuid) to authenticated, anon;
grant execute on function public.hq_npc_save(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.hq_npc_delete(uuid) to authenticated;

commit;

-- Rollback:
--   drop function if exists public.hq_npc_roster();
--   drop function if exists public.hq_npc_get(uuid);
--   drop function if exists public.hq_npc_save(uuid, text, text, text, jsonb);
--   drop function if exists public.hq_npc_delete(uuid);
--   drop table if exists public.kingdom_npcs;
