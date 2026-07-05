-- LashiraBloom core schema (OPTIONAL — for cloud save).
-- The game runs fully on localStorage without this. Run it in the ArgantaLab
-- Supabase project to enable per-circle cloud farms later.
--
-- Depends on: public.profiles, public.circles (+ membership), and the Kingdom
-- progression helpers already in apps/kingdom/supabase/002_*.sql
-- (argantalab_level_from_xp, game_grant). Farm content unlocks from a circle's
-- combined learning rings; XP/diamonds stay per the platform rule
-- (adults level by play, kids by learning).

begin;

-- One farm per circle (shared, co-op).
create table if not exists public.lashira_farm (
  id uuid primary key default gen_random_uuid(),
  circle_id text not null unique,
  house_stage int not null default 1,
  barn_level int not null default 1,
  coop_level int not null default 1,
  bloom_balance int not null default 120,      -- shared soft-currency purse
  season int not null default 0,
  day_index int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lashira_plot (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.lashira_farm(id) on delete cascade,
  x int not null, y int not null,
  crop_id text,
  planted_at timestamptz,
  watered boolean not null default false,
  growth int not null default 0,
  unique (farm_id, x, y)
);

create table if not exists public.lashira_livestock (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.lashira_farm(id) on delete cascade,
  species text not null,
  name text not null,
  affection int not null default 40,
  fed boolean not null default false,
  produce_ready boolean not null default false
);

-- Kin (person_creatures) assigned as Harvest Sprites to a farm chore.
create table if not exists public.lashira_kin_assignment (
  person_creature_id uuid not null,
  farm_id uuid not null references public.lashira_farm(id) on delete cascade,
  task text,                                   -- null | 'water' | 'harvest'
  assigned_at timestamptz not null default now(),
  primary key (person_creature_id, farm_id)
);

-- Bloom ledger — RPC-only writes; there is NO path from here to diamonds.
create table if not exists public.lashira_bloom_ledger (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.lashira_farm(id) on delete cascade,
  delta int not null,
  reason text not null,
  by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Content unlocks gated by the circle's combined ring progress.
create table if not exists public.lashira_unlock_gate (
  farm_id uuid not null references public.lashira_farm(id) on delete cascade,
  gate_id text not null,
  satisfied boolean not null default false,
  primary key (farm_id, gate_id)
);

-- RLS: a farm is visible/editable to members of its circle.
-- NOTE: adjust the membership subquery to match your actual circles schema.
alter table public.lashira_farm enable row level security;
alter table public.lashira_plot enable row level security;
alter table public.lashira_livestock enable row level security;
alter table public.lashira_kin_assignment enable row level security;
alter table public.lashira_bloom_ledger enable row level security;
alter table public.lashira_unlock_gate enable row level security;

-- Placeholder policy: authenticated users can read/write. Tighten to real
-- circle membership before multi-tenant launch.
do $$
declare t text;
begin
  foreach t in array array[
    'lashira_farm','lashira_plot','lashira_livestock',
    'lashira_kin_assignment','lashira_bloom_ledger','lashira_unlock_gate'
  ] loop
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format(
      'create policy %I_rw on public.%I for all to authenticated using (true) with check (true);',
      t, t);
  end loop;
end $$;

commit;
