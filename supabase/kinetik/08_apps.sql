-- ============================================================
--  KINETIK · NATIVE APPS  (Travel · Padel · Kitchen · Vault)
--  run AFTER 04_moments.sql (reuses kinetik_is_member / kinetik_can_post)
--
--  Every table carries circle_id (denormalised onto children too) so RLS is a
--  single uniform rule: read = circle member, write = can post. created_by =
--  auth.uid() for attribution. Idempotent. Paste into Supabase → SQL Editor.
-- ============================================================
begin;

-- ── Travel Planner ───────────────────────────────────────────
create table if not exists public.kinetik_trip (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_by uuid default auth.uid(),
  title text not null, emoji text default '✈️', destination text,
  start_date date, end_date date, status text default 'planning',
  travelers text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.kinetik_trip_activity (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  trip_id uuid not null references public.kinetik_trip(id) on delete cascade,
  day_date date, at_time text, emoji text default '📍', name text not null, note text,
  sort int default 0, created_at timestamptz not null default now()
);
create table if not exists public.kinetik_pack_item (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  trip_id uuid not null references public.kinetik_trip(id) on delete cascade,
  category text default 'General', name text not null, person text, checked boolean default false,
  created_at timestamptz not null default now()
);
create table if not exists public.kinetik_trip_expense (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  trip_id uuid not null references public.kinetik_trip(id) on delete cascade,
  category text default 'Other', name text, icon text default '💸', amount numeric default 0,
  created_at timestamptz not null default now()
);

-- ── Padel Matchday ───────────────────────────────────────────
create table if not exists public.kinetik_padel_session (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_by uuid default auth.uid(),
  format text default 'americano', points int default 24, courts int default 1,
  status text default 'setup', created_at timestamptz not null default now()
);
create table if not exists public.kinetik_padel_player (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  session_id uuid not null references public.kinetik_padel_session(id) on delete cascade,
  name text not null, member_id text, sort int default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.kinetik_padel_match (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  session_id uuid not null references public.kinetik_padel_session(id) on delete cascade,
  court int default 1, match_no int default 1,
  team_a uuid[] not null default '{}', team_b uuid[] not null default '{}',
  score_a int, score_b int, status text default 'pending',
  created_at timestamptz not null default now()
);

-- ── Kitchen ──────────────────────────────────────────────────
create table if not exists public.kinetik_recipe (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_by uuid default auth.uid(),
  emoji text default '🍽️', name text not null, category text default 'Mains',
  minutes int default 30, servings int default 4, ingredients jsonb default '[]',
  created_at timestamptz not null default now()
);
create table if not exists public.kinetik_meal_plan (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  plan_date date not null, recipe_id uuid references public.kinetik_recipe(id) on delete set null,
  note text, created_at timestamptz not null default now(),
  unique (circle_id, plan_date)
);
create table if not exists public.kinetik_shop_item (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_by uuid default auth.uid(),
  name text not null, aisle text default 'Other', qty text, done boolean default false,
  created_at timestamptz not null default now()
);

-- ── Family Vault ─────────────────────────────────────────────
create table if not exists public.kinetik_vault_doc (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_by uuid default auth.uid(),
  category text default 'Documents', name text not null, icon text default '📄',
  fields jsonb default '[]', expiry date, file_path text,
  created_at timestamptz not null default now()
);
create table if not exists public.kinetik_vault_budget (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  category text not null, icon text default '💵', monthly numeric default 0,
  created_at timestamptz not null default now(),
  unique (circle_id, category)
);
create table if not exists public.kinetik_vault_expense (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_by uuid default auth.uid(),
  descr text, category text default 'Other', icon text default '🧾', amount numeric default 0,
  spent_at date default current_date, created_at timestamptz not null default now()
);
create table if not exists public.kinetik_vault_sub (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  name text not null, icon text default '📺', amount numeric default 0, period text default 'month',
  created_at timestamptz not null default now()
);

-- ── Uniform RLS: read = member, write = can post ─────────────
do $$
declare t text;
begin
  foreach t in array array[
    'kinetik_trip','kinetik_trip_activity','kinetik_pack_item','kinetik_trip_expense',
    'kinetik_padel_session','kinetik_padel_player','kinetik_padel_match',
    'kinetik_recipe','kinetik_meal_plan','kinetik_shop_item',
    'kinetik_vault_doc','kinetik_vault_budget','kinetik_vault_expense','kinetik_vault_sub'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_rw" on public.%I;', t, t);
    execute format($p$create policy "%s_rw" on public.%I for all to authenticated
      using (public.kinetik_is_member(circle_id))
      with check (public.kinetik_can_post(circle_id));$p$, t, t);
    execute format('create index if not exists %I on public.%I(circle_id);', t || '_circle_idx', t);
  end loop;
end $$;

commit;
