-- Kingdom progression, guardians, sessions, and DB-backed player state.
-- Run after supabase/schema.sql, supabase/migration_spine.sql,
-- supabase/migration_friends.sql, and apps/kingdom/supabase/001_kingdom_mp0.sql.
--
-- Core rule:
--   profiles.xp / profiles.level are the single ArgantaLab level truth.
--   Kingdom can award adult XP only through capped RPCs.
--   Kids never receive Kingdom XP.

begin;

-- ---------- shared ArgantaLab level/rank helpers ----------
create or replace function public.argantalab_level_from_xp(p_xp bigint)
returns int
language sql
immutable
as $$
  select greatest(1, floor(greatest(coalesce(p_xp, 0), 0) / 500.0)::int + 1)
$$;

update public.profiles
set level = public.argantalab_level_from_xp(coalesce(xp, 0))
where coalesce(level, 1) <> public.argantalab_level_from_xp(coalesce(xp, 0));

-- Align the existing generic game grant with the same level formula.
create or replace function public.game_grant(p_game text, p_diamonds int default 0, p_xp int default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d int;
  v_x int;
  r record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  v_d := least(greatest(coalesce(p_diamonds, 0), 0), 500);
  v_x := least(greatest(coalesce(p_xp, 0), 0), 1000);

  update public.profiles
    set diamonds = coalesce(diamonds, 0) + v_d,
        xp = coalesce(xp, 0) + v_x,
        level = public.argantalab_level_from_xp(coalesce(xp, 0) + v_x)
    where id = auth.uid()
    returning diamonds, xp, level into r;

  return jsonb_build_object(
    'diamonds', r.diamonds,
    'xp', r.xp,
    'level', r.level,
    'granted', jsonb_build_object('diamonds', v_d, 'xp', v_x)
  );
end;
$$;
grant execute on function public.game_grant(text, int, int) to authenticated;

create table if not exists public.argantalab_rank_tiers (
  id text primary key,
  name text not null,
  xp_min bigint not null unique,
  color text not null,
  glyph text not null,
  icon_asset_key text,
  sort_order int not null
);
alter table public.argantalab_rank_tiers enable row level security;
drop policy if exists argantalab_rank_tiers_read on public.argantalab_rank_tiers;
create policy argantalab_rank_tiers_read on public.argantalab_rank_tiers
  for select to authenticated using (true);

insert into public.argantalab_rank_tiers (id, name, xp_min, color, glyph, icon_asset_key, sort_order)
values
  ('spark', 'Spark', 0, '#f0a83a', '*', 'rank.spark', 0),
  ('explorer', 'Explorer', 5000, '#5ec257', 'E', 'rank.explorer', 1),
  ('adventurer', 'Adventurer', 15000, '#37a8c4', 'A', 'rank.adventurer', 2),
  ('maker', 'Maker', 40000, '#7a4fd0', 'M', 'rank.maker', 3),
  ('sage', 'Sage', 85000, '#d9a520', 'S', 'rank.sage', 4),
  ('luminary', 'Luminary', 160000, '#d4476b', 'L', 'rank.luminary', 5)
on conflict (id) do update set
  name = excluded.name,
  xp_min = excluded.xp_min,
  color = excluded.color,
  glyph = excluded.glyph,
  icon_asset_key = excluded.icon_asset_key,
  sort_order = excluded.sort_order;

create or replace function public.argantalab_rank_for_xp(p_xp bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'xpMin', t.xp_min,
    'color', t.color,
    'glyph', t.glyph,
    'iconAssetKey', t.icon_asset_key
  )
  from public.argantalab_rank_tiers t
  where t.xp_min <= greatest(coalesce(p_xp, 0), 0)
  order by t.xp_min desc
  limit 1
$$;
grant execute on function public.argantalab_rank_for_xp(bigint) to authenticated;

-- ---------- appearance draft/synced build ----------
alter table public.kingdom_character_appearance
  add column if not exists synced_spec_json jsonb not null default '{}'::jsonb,
  add column if not exists draft_spec_json jsonb not null default '{}'::jsonb,
  add column if not exists synced_at timestamptz,
  add column if not exists draft_updated_at timestamptz;

update public.kingdom_character_appearance
set synced_spec_json = coalesce(nullif(synced_spec_json, '{}'::jsonb), appearance_json->'spec', '{}'::jsonb),
    draft_spec_json = coalesce(nullif(draft_spec_json, '{}'::jsonb), appearance_json->'spec', '{}'::jsonb),
    synced_at = coalesce(synced_at, updated_at),
    draft_updated_at = coalesce(draft_updated_at, updated_at)
where appearance_json ? 'spec';

create or replace function public.kingdom_apply_appearance_columns(p_character_id uuid, p_spec jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.kingdom_character_appearance
    set body_part_id = nullif(p_spec #>> '{body,id}', '')::int,
        face_part_id = nullif(p_spec #>> '{face,id}', '')::int,
        hair_part_id = nullif(p_spec #>> '{hair,id}', '')::int,
        coat_part_id = nullif(p_spec #>> '{coat,id}', '')::int,
        weapon_part_id = nullif(p_spec #>> '{weapon,id}', '')::int,
        shield_part_id = nullif(p_spec #>> '{shield,id}', '')::int,
        mount_id = nullif(p_spec #>> '{mount,id}', '')::int,
        hair_palette_id = nullif(p_spec #>> '{hair,palette}', '')::int,
        coat_palette_id = nullif(p_spec #>> '{coat,palette}', '')::int,
        skin_palette_id = nullif(p_spec #>> '{body,palette}', '')::int,
        appearance_json = jsonb_build_object('spec', p_spec),
        updated_at = now()
    where character_id = p_character_id;
end;
$$;

-- ---------- stat and XP policy ----------
create table if not exists public.kingdom_character_stats (
  character_id uuid primary key references public.kingdom_characters(id) on delete cascade,
  base_hp int not null default 100,
  base_mp int not null default 40,
  base_attack int not null default 10,
  base_magic int not null default 10,
  base_defense int not null default 5,
  updated_at timestamptz not null default now()
);
alter table public.kingdom_character_stats enable row level security;
drop policy if exists kingdom_character_stats_read on public.kingdom_character_stats;
create policy kingdom_character_stats_read on public.kingdom_character_stats
  for select to authenticated using (true);
drop policy if exists kingdom_character_stats_owner_write on public.kingdom_character_stats;
create policy kingdom_character_stats_owner_write on public.kingdom_character_stats
  for all to authenticated
  using (character_id in (select id from public.kingdom_characters where profile_id = auth.uid()))
  with check (character_id in (select id from public.kingdom_characters where profile_id = auth.uid()));

create table if not exists public.kingdom_stat_policy (
  id text primary key,
  path_id text not null unique,
  hp_per_level int not null,
  mp_per_level int not null,
  attack_per_level numeric not null,
  magic_per_level numeric not null,
  defense_per_level numeric not null,
  metadata_json jsonb not null default '{}'::jsonb
);
alter table public.kingdom_stat_policy enable row level security;
drop policy if exists kingdom_stat_policy_read on public.kingdom_stat_policy;
create policy kingdom_stat_policy_read on public.kingdom_stat_policy
  for select to authenticated using (true);

insert into public.kingdom_stat_policy
  (id, path_id, hp_per_level, mp_per_level, attack_per_level, magic_per_level, defense_per_level, metadata_json)
values
  ('path.warrior', 'warrior', 28, 8, 2.6, 0.7, 2.2, '{"role":"melee tank"}'),
  ('path.mage', 'mage', 14, 26, 0.8, 2.9, 0.9, '{"role":"spell damage"}'),
  ('path.poet', 'poet', 18, 22, 1.0, 2.2, 1.3, '{"role":"support"}'),
  ('path.rogue', 'rogue', 21, 14, 2.3, 1.1, 1.5, '{"role":"fast attack"}')
on conflict (path_id) do update set
  hp_per_level = excluded.hp_per_level,
  mp_per_level = excluded.mp_per_level,
  attack_per_level = excluded.attack_per_level,
  magic_per_level = excluded.magic_per_level,
  defense_per_level = excluded.defense_per_level,
  metadata_json = excluded.metadata_json;

create table if not exists public.kingdom_xp_policy (
  source text primary key,
  per_event_cap int not null,
  daily_cap int,
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb
);
alter table public.kingdom_xp_policy enable row level security;
drop policy if exists kingdom_xp_policy_read on public.kingdom_xp_policy;
create policy kingdom_xp_policy_read on public.kingdom_xp_policy
  for select to authenticated using (true);

insert into public.kingdom_xp_policy (source, per_event_cap, daily_cap, enabled, metadata_json)
values
  ('monster_kill', 250, 2000, true, '{"note":"adult arena monster kill"}'),
  ('quest', 500, 3000, true, '{"note":"future kingdom quest"}'),
  ('gm_adjustment', 10000, null, true, '{"note":"admin only future adjustment"}')
on conflict (source) do update set
  per_event_cap = excluded.per_event_cap,
  daily_cap = excluded.daily_cap,
  enabled = excluded.enabled,
  metadata_json = excluded.metadata_json;

create table if not exists public.kingdom_xp_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.kingdom_characters(id) on delete cascade,
  source text not null,
  source_id text,
  raw_xp int not null,
  granted_xp int not null,
  cap_reason text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kingdom_xp_ledger_profile_day_idx
  on public.kingdom_xp_ledger (profile_id, source, created_at);
alter table public.kingdom_xp_ledger enable row level security;
drop policy if exists kingdom_xp_ledger_own_read on public.kingdom_xp_ledger;
create policy kingdom_xp_ledger_own_read on public.kingdom_xp_ledger
  for select to authenticated using (profile_id = auth.uid() or public.is_guardian_of(profile_id) or public.is_admin());

-- ---------- monster and guardian truth ----------
create table if not exists public.kingdom_monster_templates (
  id text primary key,
  name text not null,
  default_experience int not null default 0,
  client_mob_id int,
  client_palette_id int,
  base_hp int not null default 100,
  base_attack int not null default 10,
  rarity text not null default 'common',
  enabled boolean not null default true,
  source_json jsonb not null default '{}'::jsonb
);
alter table public.kingdom_monster_templates enable row level security;
drop policy if exists kingdom_monster_templates_read on public.kingdom_monster_templates;
create policy kingdom_monster_templates_read on public.kingdom_monster_templates
  for select to authenticated using (enabled = true);

insert into public.kingdom_monster_templates
  (id, name, default_experience, client_mob_id, client_palette_id, base_hp, base_attack, rarity, enabled, source_json)
values
  ('monster.bluerabbit', 'Blue rabbit', 1, 125, 236, 90, 8, 'common', true, '{"seed":"starter_guardian"}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  default_experience = excluded.default_experience,
  client_mob_id = excluded.client_mob_id,
  client_palette_id = excluded.client_palette_id,
  base_hp = excluded.base_hp,
  base_attack = excluded.base_attack,
  rarity = excluded.rarity,
  enabled = excluded.enabled,
  source_json = excluded.source_json;

create table if not exists public.kingdom_guardian_templates (
  id text primary key,
  monster_template_id text references public.kingdom_monster_templates(id),
  base_name text not null,
  rarity text not null,
  base_hp int not null,
  base_mp int not null default 0,
  base_attack int not null,
  base_magic int not null default 0,
  client_mob_id int,
  client_palette_id int,
  metadata_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true
);
alter table public.kingdom_guardian_templates enable row level security;
drop policy if exists kingdom_guardian_templates_read on public.kingdom_guardian_templates;
create policy kingdom_guardian_templates_read on public.kingdom_guardian_templates
  for select to authenticated using (enabled = true);

insert into public.kingdom_guardian_templates
  (id, monster_template_id, base_name, rarity, base_hp, base_mp, base_attack, base_magic, client_mob_id, client_palette_id, metadata_json, enabled)
values
  ('guardian.blue_rabbit', 'monster.bluerabbit', 'Blue Rabbit', 'common', 90, 0, 8, 0, 125, 236, '{"starter":true}', true)
on conflict (id) do update set
  monster_template_id = excluded.monster_template_id,
  base_name = excluded.base_name,
  rarity = excluded.rarity,
  base_hp = excluded.base_hp,
  base_mp = excluded.base_mp,
  base_attack = excluded.base_attack,
  base_magic = excluded.base_magic,
  client_mob_id = excluded.client_mob_id,
  client_palette_id = excluded.client_palette_id,
  metadata_json = excluded.metadata_json,
  enabled = excluded.enabled;

create table if not exists public.kingdom_guardians (
  id uuid primary key default gen_random_uuid(),
  owner_character_id uuid not null references public.kingdom_characters(id) on delete cascade,
  template_id text not null references public.kingdom_guardian_templates(id),
  display_name text not null,
  equipped boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists kingdom_one_equipped_guardian_uq
  on public.kingdom_guardians(owner_character_id)
  where equipped = true;
alter table public.kingdom_guardians enable row level security;
drop policy if exists kingdom_guardians_read on public.kingdom_guardians;
create policy kingdom_guardians_read on public.kingdom_guardians
  for select to authenticated using (true);
drop policy if exists kingdom_guardians_owner_write on public.kingdom_guardians;
create policy kingdom_guardians_owner_write on public.kingdom_guardians
  for all to authenticated
  using (owner_character_id in (select id from public.kingdom_characters where profile_id = auth.uid()))
  with check (owner_character_id in (select id from public.kingdom_characters where profile_id = auth.uid()));

-- ---------- session authority ----------
create table if not exists public.kingdom_character_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.kingdom_characters(id) on delete cascade,
  session_token uuid not null unique default gen_random_uuid(),
  status text not null default 'active',
  device_label text,
  map_id text,
  connected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text,
  replaced_by_session_id uuid references public.kingdom_character_sessions(id),
  metadata_json jsonb not null default '{}'::jsonb,
  check (status in ('active', 'replaced', 'ended', 'expired'))
);
create unique index if not exists kingdom_one_active_character_session_uq
  on public.kingdom_character_sessions(character_id)
  where status = 'active';
create unique index if not exists kingdom_one_active_profile_session_uq
  on public.kingdom_character_sessions(profile_id)
  where status = 'active';
alter table public.kingdom_character_sessions enable row level security;
drop policy if exists kingdom_character_sessions_own_read on public.kingdom_character_sessions;
create policy kingdom_character_sessions_own_read on public.kingdom_character_sessions
  for select to authenticated using (profile_id = auth.uid());

create table if not exists public.kingdom_session_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.kingdom_characters(id) on delete cascade,
  target_session_id uuid references public.kingdom_character_sessions(id) on delete cascade,
  event_type text not null,
  message text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  check (event_type in ('force_logout', 'session_started', 'session_expired'))
);
create index if not exists kingdom_session_events_target_idx
  on public.kingdom_session_events(target_session_id, acknowledged_at);
alter table public.kingdom_session_events enable row level security;
drop policy if exists kingdom_session_events_own_read on public.kingdom_session_events;
create policy kingdom_session_events_own_read on public.kingdom_session_events
  for select to authenticated using (profile_id = auth.uid());

-- ---------- helpers ----------
create or replace function public.kingdom_ensure_character_defaults(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl record;
begin
  insert into public.kingdom_character_stats (character_id)
  values (p_character_id)
  on conflict (character_id) do nothing;

  insert into public.kingdom_character_appearance (character_id)
  values (p_character_id)
  on conflict (character_id) do nothing;

  update public.kingdom_character_appearance
  set synced_spec_json = coalesce(nullif(synced_spec_json, '{}'::jsonb), appearance_json->'spec', '{}'::jsonb),
      draft_spec_json = coalesce(nullif(draft_spec_json, '{}'::jsonb), appearance_json->'spec', '{}'::jsonb),
      synced_at = coalesce(synced_at, updated_at),
      draft_updated_at = coalesce(draft_updated_at, updated_at)
  where character_id = p_character_id;

  if not exists (select 1 from public.kingdom_guardians where owner_character_id = p_character_id) then
    select * into tpl
    from public.kingdom_guardian_templates
    where enabled = true
    order by (metadata_json->>'starter')::boolean desc nulls last, id
    limit 1;
    if tpl.id is not null then
      insert into public.kingdom_guardians (owner_character_id, template_id, display_name, equipped)
      values (p_character_id, tpl.id, tpl.base_name, true);
    end if;
  end if;
end;
$$;

create or replace function public.kingdom_computed_stats(p_character_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'maxHp', s.base_hp + pol.hp_per_level * greatest(coalesce(p.level, 1) - 1, 0),
    'maxMp', s.base_mp + pol.mp_per_level * greatest(coalesce(p.level, 1) - 1, 0),
    'attack', round(s.base_attack + pol.attack_per_level * greatest(coalesce(p.level, 1) - 1, 0))::int,
    'magic', round(s.base_magic + pol.magic_per_level * greatest(coalesce(p.level, 1) - 1, 0))::int,
    'defense', round(s.base_defense + pol.defense_per_level * greatest(coalesce(p.level, 1) - 1, 0))::int
  )
  from public.kingdom_characters ch
  join public.profiles p on p.id = ch.profile_id
  join public.kingdom_character_stats s on s.character_id = ch.id
  left join public.kingdom_stat_policy pol on pol.path_id = coalesce(ch.path_id, 'warrior')
  where ch.id = p_character_id
$$;

create or replace function public.kingdom_guardian_state(p_character_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', g.id,
    'displayName', g.display_name,
    'templateId', g.template_id,
    'level', coalesce(p.level, 1),
    'rarity', t.rarity,
    'maxHp', t.base_hp + greatest(coalesce(p.level, 1) - 1, 0) * case t.rarity when 'rare' then 18 when 'epic' then 24 else 12 end,
    'maxMp', t.base_mp + greatest(coalesce(p.level, 1) - 1, 0) * case when t.base_mp > 0 then 8 else 0 end,
    'attack', t.base_attack + greatest(coalesce(p.level, 1) - 1, 0) * case t.rarity when 'rare' then 3 when 'epic' then 4 else 2 end,
    'magic', t.base_magic,
    'clientMobId', t.client_mob_id,
    'clientPaletteId', t.client_palette_id,
    'metadata', g.metadata_json
  )
  from public.kingdom_guardians g
  join public.kingdom_guardian_templates t on t.id = g.template_id
  join public.kingdom_characters ch on ch.id = g.owner_character_id
  join public.profiles p on p.id = ch.profile_id
  where g.owner_character_id = p_character_id and g.equipped = true
  order by g.created_at
  limit 1
$$;

-- ---------- RPCs ----------
create or replace function public.kingdom_get_player_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pr record;
  ch record;
  ap record;
  st jsonb;
  gd jsonb;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select id, display_name, photo_url, diamonds, xp, level, role
    into pr
  from public.profiles
  where id = uid;

  if pr.id is null then
    return jsonb_build_object('profile', null, 'character', null);
  end if;

  select id, name, account_type, path_id
    into ch
  from public.kingdom_characters
  where profile_id = uid
  limit 1;

  if ch.id is null then
    return jsonb_build_object(
      'profile', jsonb_build_object(
        'id', pr.id,
        'displayName', coalesce(pr.display_name, 'Player'),
        'photoUrl', pr.photo_url,
        'diamonds', coalesce(pr.diamonds, 0),
        'xp', coalesce(pr.xp, 0),
        'level', coalesce(pr.level, 1),
        'role', coalesce(pr.role, 'user'),
        'rank', public.argantalab_rank_for_xp(coalesce(pr.xp, 0))
      ),
      'character', null
    );
  end if;

  perform public.kingdom_ensure_character_defaults(ch.id);

  select synced_spec_json, draft_spec_json, synced_at, draft_updated_at
    into ap
  from public.kingdom_character_appearance
  where character_id = ch.id;

  st := public.kingdom_computed_stats(ch.id);
  gd := public.kingdom_guardian_state(ch.id);

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', pr.id,
      'displayName', coalesce(pr.display_name, 'Player'),
      'photoUrl', pr.photo_url,
      'diamonds', coalesce(pr.diamonds, 0),
      'xp', coalesce(pr.xp, 0),
      'level', coalesce(pr.level, 1),
      'role', coalesce(pr.role, 'user'),
      'rank', public.argantalab_rank_for_xp(coalesce(pr.xp, 0))
    ),
    'character', jsonb_build_object(
      'id', ch.id,
      'name', ch.name,
      'accountType', ch.account_type,
      'pathId', ch.path_id
    ),
    'stats', st,
    'guardian', gd,
    'loadout', jsonb_build_object(
      'syncedSpec', coalesce(ap.synced_spec_json, '{}'::jsonb),
      'draftSpec', coalesce(ap.draft_spec_json, '{}'::jsonb),
      'syncedAt', ap.synced_at,
      'draftUpdatedAt', ap.draft_updated_at
    )
  );
end;
$$;
grant execute on function public.kingdom_get_player_state() to authenticated;

create or replace function public.kingdom_save_character_draft(p_spec jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ch record;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into ch from public.kingdom_characters where profile_id = uid limit 1;
  if ch.id is null then raise exception 'character not found'; end if;
  perform public.kingdom_ensure_character_defaults(ch.id);

  update public.kingdom_character_appearance
  set draft_spec_json = coalesce(p_spec, '{}'::jsonb),
      draft_updated_at = now(),
      updated_at = now()
  where character_id = ch.id;

  return public.kingdom_get_player_state();
end;
$$;
grant execute on function public.kingdom_save_character_draft(jsonb) to authenticated;

create or replace function public.kingdom_sync_character_build()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ch record;
  spec jsonb;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into ch from public.kingdom_characters where profile_id = uid limit 1;
  if ch.id is null then raise exception 'character not found'; end if;
  perform public.kingdom_ensure_character_defaults(ch.id);

  select coalesce(draft_spec_json, '{}'::jsonb) into spec
  from public.kingdom_character_appearance
  where character_id = ch.id;

  update public.kingdom_character_appearance
  set synced_spec_json = spec,
      synced_at = now(),
      appearance_json = jsonb_build_object('spec', spec),
      updated_at = now()
  where character_id = ch.id;
  perform public.kingdom_apply_appearance_columns(ch.id, spec);

  return public.kingdom_get_player_state();
end;
$$;
grant execute on function public.kingdom_sync_character_build() to authenticated;

create or replace function public.kingdom_reset_character_draft()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ch record;
  spec jsonb;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into ch from public.kingdom_characters where profile_id = uid limit 1;
  if ch.id is null then raise exception 'character not found'; end if;
  perform public.kingdom_ensure_character_defaults(ch.id);

  select coalesce(synced_spec_json, '{}'::jsonb) into spec
  from public.kingdom_character_appearance
  where character_id = ch.id;

  update public.kingdom_character_appearance
  set draft_spec_json = spec,
      draft_updated_at = now(),
      updated_at = now()
  where character_id = ch.id;

  return public.kingdom_get_player_state();
end;
$$;
grant execute on function public.kingdom_reset_character_draft() to authenticated;

create or replace function public.kingdom_rename_guardian(p_guardian uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := trim(coalesce(p_name, ''));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if length(clean) < 2 or length(clean) > 24 then raise exception 'guardian name must be 2-24 characters'; end if;

  update public.kingdom_guardians g
  set display_name = clean,
      updated_at = now()
  where g.id = p_guardian
    and g.owner_character_id in (select id from public.kingdom_characters where profile_id = uid);

  if not found then raise exception 'guardian not found'; end if;
  return public.kingdom_get_player_state();
end;
$$;
grant execute on function public.kingdom_rename_guardian(uuid, text) to authenticated;

create or replace function public.kingdom_equip_guardian(p_guardian uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ch_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select owner_character_id into ch_id
  from public.kingdom_guardians
  where id = p_guardian
    and owner_character_id in (select id from public.kingdom_characters where profile_id = uid);
  if ch_id is null then raise exception 'guardian not found'; end if;

  update public.kingdom_guardians set equipped = false where owner_character_id = ch_id;
  update public.kingdom_guardians set equipped = true, updated_at = now() where id = p_guardian;
  return public.kingdom_get_player_state();
end;
$$;
grant execute on function public.kingdom_equip_guardian(uuid) to authenticated;

create or replace function public.kingdom_start_character_session(p_character_id uuid, p_device_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ch record;
  new_session record;
  old record;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id, name into ch
  from public.kingdom_characters
  where id = p_character_id and profile_id = uid
  limit 1;
  if ch.id is null then raise exception 'character not found'; end if;

  for old in
    select * from public.kingdom_character_sessions
    where profile_id = uid and status = 'active'
    for update
  loop
    update public.kingdom_character_sessions
      set status = 'replaced',
          ended_at = now(),
          ended_reason = 'replaced'
      where id = old.id;

    insert into public.kingdom_session_events
      (profile_id, character_id, target_session_id, event_type, message, payload_json)
    values
      (old.profile_id, old.character_id, old.id, 'force_logout',
       'Your account was logged in somewhere else. This session has been closed.',
       jsonb_build_object('reason', 'replaced'));
  end loop;

  insert into public.kingdom_character_sessions (profile_id, character_id, device_label)
  values (uid, ch.id, nullif(trim(coalesce(p_device_label, '')), ''))
  returning * into new_session;

  return jsonb_build_object(
    'sessionId', new_session.id,
    'sessionToken', new_session.session_token,
    'status', new_session.status
  );
end;
$$;
grant execute on function public.kingdom_start_character_session(uuid, text) to authenticated;

create or replace function public.kingdom_heartbeat_session(p_session_token uuid, p_map_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sess record;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into sess
  from public.kingdom_character_sessions
  where session_token = p_session_token and profile_id = uid
  limit 1;
  if sess.id is null then
    return jsonb_build_object('ok', false, 'forceLogout', true, 'message', 'This Kingdom session is no longer active.');
  end if;
  if sess.status <> 'active' then
    return jsonb_build_object('ok', false, 'forceLogout', true, 'status', sess.status, 'message', 'Your account was logged in somewhere else. This session has been closed.');
  end if;

  update public.kingdom_character_sessions
  set last_seen_at = now(),
      map_id = coalesce(nullif(trim(coalesce(p_map_id, '')), ''), map_id)
  where id = sess.id;
  update public.profiles set last_seen = now() where id = uid;

  return jsonb_build_object('ok', true, 'forceLogout', false);
end;
$$;
grant execute on function public.kingdom_heartbeat_session(uuid, text) to authenticated;

create or replace function public.kingdom_end_character_session(p_session_token uuid, p_reason text default 'manual_exit')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  update public.kingdom_character_sessions
  set status = case when status = 'active' then 'ended' else status end,
      ended_at = coalesce(ended_at, now()),
      ended_reason = coalesce(nullif(trim(p_reason), ''), 'manual_exit')
  where session_token = p_session_token and profile_id = uid;
  return found;
end;
$$;
grant execute on function public.kingdom_end_character_session(uuid, text) to authenticated;

create or replace function public.kingdom_get_session_events(p_session_token uuid)
returns table(id uuid, event_type text, message text, payload_json jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.event_type, e.message, e.payload_json, e.created_at
  from public.kingdom_session_events e
  join public.kingdom_character_sessions s on s.id = e.target_session_id
  where s.session_token = p_session_token
    and s.profile_id = auth.uid()
    and e.acknowledged_at is null
  order by e.created_at asc
$$;
grant execute on function public.kingdom_get_session_events(uuid) to authenticated;

create or replace function public.kingdom_ack_session_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  update public.kingdom_session_events
  set acknowledged_at = now()
  where id = p_event_id and profile_id = uid;
  return found;
end;
$$;
grant execute on function public.kingdom_ack_session_event(uuid) to authenticated;

create or replace function public.kingdom_get_online_friends()
returns table(
  profile_id uuid,
  display_name text,
  photo_url text,
  role text,
  source text,
  character_id uuid,
  character_name text,
  rank_name text,
  rank_color text,
  map_id text,
  status text,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select * from public.my_friends()
  ),
  active as (
    select distinct on (s.profile_id)
      s.profile_id, s.character_id, s.map_id, s.last_seen_at
    from public.kingdom_character_sessions s
    where s.status = 'active'
    order by s.profile_id, s.last_seen_at desc
  )
  select
    f.id,
    f.display_name,
    f.photo_url,
    f.role,
    f.source,
    ch.id,
    ch.name,
    rt.name,
    rt.color,
    active.map_id,
    case
      when active.last_seen_at is null then 'offline'
      when active.last_seen_at >= now() - interval '45 seconds' then 'online'
      when active.last_seen_at >= now() - interval '5 minutes' then 'away'
      else 'offline'
    end,
    active.last_seen_at
  from f
  left join active on active.profile_id = f.id
  left join public.kingdom_characters ch on ch.id = active.character_id
  left join public.profiles p on p.id = f.id
  left join lateral (
    select name, color
    from public.argantalab_rank_tiers
    where xp_min <= coalesce(p.xp, 0)
    order by xp_min desc
    limit 1
  ) rt on true
  order by
    case
      when active.last_seen_at >= now() - interval '45 seconds' then 0
      when active.last_seen_at >= now() - interval '5 minutes' then 1
      else 2
    end,
    f.display_name
$$;
grant execute on function public.kingdom_get_online_friends() to authenticated;

create or replace function public.kingdom_enter_arena()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.kingdom_get_player_state();
end;
$$;
grant execute on function public.kingdom_enter_arena() to authenticated;

create or replace function public.kingdom_award_monster_xp(p_monster_template_id text, p_context jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pr record;
  ch record;
  mt record;
  pol record;
  raw int := 0;
  granted int := 0;
  today int := 0;
  daily_remaining int := null;
  level_cap int := 0;
  new_xp bigint;
  new_level int;
  reason text := 'ok';
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select id, role, xp, level into pr
  from public.profiles
  where id = uid
  for update;

  select id, account_type, name into ch
  from public.kingdom_characters
  where profile_id = uid
  limit 1;
  if ch.id is null then raise exception 'character not found'; end if;

  select * into mt
  from public.kingdom_monster_templates
  where id = p_monster_template_id and enabled = true;

  if mt.id is null then
    -- Data must be seeded for real rewards. Do not trust client XP.
    return jsonb_build_object(
      'ok', false,
      'grantedXp', 0,
      'rawXp', 0,
      'profileXp', coalesce(pr.xp, 0),
      'profileLevel', coalesce(pr.level, 1),
      'toast', 'You defeated ' || coalesce(p_context->>'monsterName', 'the monster') || '.',
      'reason', 'monster_template_missing'
    );
  end if;

  raw := greatest(coalesce(mt.default_experience, 0), 0);

  if coalesce(pr.role, '') = 'kid' or ch.account_type = 'kid' then
    return jsonb_build_object(
      'ok', true,
      'grantedXp', 0,
      'rawXp', raw,
      'profileXp', coalesce(pr.xp, 0),
      'profileLevel', coalesce(pr.level, 1),
      'rank', public.argantalab_rank_for_xp(coalesce(pr.xp, 0)),
      'toast', 'You defeated ' || mt.name || '.',
      'kid', true
    );
  end if;

  select * into pol from public.kingdom_xp_policy where source = 'monster_kill' and enabled = true;
  if pol.source is null then
    granted := 0;
    reason := 'policy_disabled';
  else
    select coalesce(sum(granted_xp), 0) into today
    from public.kingdom_xp_ledger
    where profile_id = uid
      and source = 'monster_kill'
      and created_at >= date_trunc('day', now());

    daily_remaining := case
      when pol.daily_cap is null then raw
      else greatest(pol.daily_cap - today, 0)
    end;
    level_cap := 25 + coalesce(pr.level, 1) * 25;
    granted := least(raw, pol.per_event_cap, level_cap, daily_remaining);

    if granted < raw then
      if daily_remaining <= 0 then reason := 'daily_cap';
      elsif granted = pol.per_event_cap then reason := 'event_cap';
      elsif granted = level_cap then reason := 'level_cap';
      else reason := 'cap';
      end if;
    end if;
  end if;

  insert into public.kingdom_xp_ledger
    (profile_id, character_id, source, source_id, raw_xp, granted_xp, cap_reason, metadata_json)
  values
    (uid, ch.id, 'monster_kill', mt.id, raw, granted, reason, coalesce(p_context, '{}'::jsonb));

  update public.profiles
  set xp = coalesce(xp, 0) + granted,
      level = public.argantalab_level_from_xp(coalesce(xp, 0) + granted)
  where id = uid
  returning xp, level into new_xp, new_level;

  return jsonb_build_object(
    'ok', true,
    'grantedXp', granted,
    'rawXp', raw,
    'capReason', reason,
    'profileXp', new_xp,
    'profileLevel', new_level,
    'rank', public.argantalab_rank_for_xp(new_xp),
    'toast', case when granted > 0 then '+' || granted::text || ' XP - ' || mt.name else 'You defeated ' || mt.name || '.' end,
    'kid', false
  );
end;
$$;
grant execute on function public.kingdom_award_monster_xp(text, jsonb) to authenticated;

commit;
