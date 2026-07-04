-- Kingdom MP-0 "Arena Duel" slice — run in the Supabase SQL editor
-- (KinetikCircle project bdagdxgpnlialkppjwor).
--
-- Deviation note vs docs/mmorpg-supabase-schema.md: that doc's `profiles`
-- table ALREADY EXISTS in this project (KinetikCircle owns it, including the
-- `diamonds` mirror column) — we use it as-is and prefix game tables with
-- `kingdom_`. Columns follow the handoff schema; extra loadout detail rides
-- in appearance_json so nothing is lost when later phases add columns.
--
-- Kids rule honored: account_type is stamped from the auth email domain
-- (@kids.argantalab.app => kid). No EXP/diamond writes exist in this slice.

create table if not exists kingdom_characters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,                -- auth.uid() == kinetik profiles.id
  account_type text not null default 'adult' check (account_type in ('adult','kid')),
  name text not null,
  path_id text not null default 'warrior',
  level int not null default 1,
  created_at timestamptz not null default now()
);
create unique index if not exists kingdom_characters_name_uq
  on kingdom_characters (lower(name));
create unique index if not exists kingdom_characters_profile_uq
  on kingdom_characters (profile_id);      -- one character per account in MP-0

create table if not exists kingdom_character_appearance (
  character_id uuid primary key references kingdom_characters(id) on delete cascade,
  body_part_id int,
  face_part_id int,
  hair_part_id int,
  coat_part_id int,
  weapon_part_id int,
  shield_part_id int,
  mount_id int,
  hair_palette_id int,
  coat_palette_id int,
  skin_palette_id int,
  appearance_json jsonb not null default '{}'::jsonb,  -- full composer spec
  updated_at timestamptz not null default now()
);

create table if not exists kingdom_character_position (
  character_id uuid primary key references kingdom_characters(id) on delete cascade,
  map_id text not null default 'map.60.buyaarena',
  x int not null default 8,
  y int not null default 8,
  direction text not null default 'South',
  updated_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table kingdom_characters enable row level security;
alter table kingdom_character_appearance enable row level security;
alter table kingdom_character_position enable row level security;

-- everyone signed-in can SEE characters (needed to render other players)
drop policy if exists kingdom_characters_read on kingdom_characters;
create policy kingdom_characters_read on kingdom_characters
  for select to authenticated using (true);
drop policy if exists kingdom_characters_write on kingdom_characters;
create policy kingdom_characters_write on kingdom_characters
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists kingdom_appearance_read on kingdom_character_appearance;
create policy kingdom_appearance_read on kingdom_character_appearance
  for select to authenticated using (true);
drop policy if exists kingdom_appearance_write on kingdom_character_appearance;
create policy kingdom_appearance_write on kingdom_character_appearance
  for all to authenticated
  using (character_id in (select id from kingdom_characters where profile_id = auth.uid()))
  with check (character_id in (select id from kingdom_characters where profile_id = auth.uid()));

drop policy if exists kingdom_position_read on kingdom_character_position;
create policy kingdom_position_read on kingdom_character_position
  for select to authenticated using (true);
drop policy if exists kingdom_position_write on kingdom_character_position;
create policy kingdom_position_write on kingdom_character_position
  for all to authenticated
  using (character_id in (select id from kingdom_characters where profile_id = auth.uid()))
  with check (character_id in (select id from kingdom_characters where profile_id = auth.uid()));
