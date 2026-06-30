-- ============================================================
--  KINETIK · NATIVE APPS v2  (run AFTER 08_apps.sql)
--
--  Additive + idempotent. Extends the four native-app schemas to
--  match the premium rebuild: padel batches + session options,
--  vault finance fields, kitchen cook-mode, travel budget/notes,
--  and grocery (baskets + run history) folded into Kitchen.
--  New tables reuse the uniform RLS (read = member, write = can post).
--  Paste into Supabase → SQL Editor → Run.
-- ============================================================
begin;

-- ── Padel: session options (from the reference setup + more-options) ──
alter table public.kinetik_padel_session
  add column if not exists event_name      text,
  add column if not exists venue           text,
  add column if not exists duration        int     default 90,
  add column if not exists pace            text    default 'normal',
  add column if not exists americano_mode  text    default 'duration',
  add column if not exists mexicano_first  text    default 'roster',
  add column if not exists selected_courts int[]   not null default '{1}';

-- ── Padel: batches (Americano blocks / Mexicano ranking rounds) ──
create table if not exists public.kinetik_padel_batch (
  id uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles(id) on delete cascade,
  session_id uuid not null references public.kinetik_padel_session(id) on delete cascade,
  number int not null default 1,
  kind   text not null default 'americano',
  label  text,
  sitouts uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.kinetik_padel_match
  add column if not exists batch_id uuid references public.kinetik_padel_batch(id) on delete cascade;

-- ── Vault: finance detail ──
alter table public.kinetik_vault_expense
  add column if not exists paid_by text;
alter table public.kinetik_vault_sub
  add column if not exists billing_day int,
  add column if not exists category   text default 'Other';

-- ── Kitchen: step-by-step cook mode ──
alter table public.kinetik_recipe
  add column if not exists steps jsonb not null default '[]';

-- ── Travel: trip budget + notes ──
alter table public.kinetik_trip
  add column if not exists budget numeric,
  add column if not exists notes  text;

-- ── Grocery (folded into Kitchen): reusable baskets + run history ──
create table if not exists public.kinetik_grocery_basket (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_by uuid default auth.uid(),
  title text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create table if not exists public.kinetik_grocery_run (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  done_by uuid default auth.uid(),
  title text,
  item_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ── Uniform RLS for the NEW tables (read = member, write = can post) ──
do $$
declare t text;
begin
  foreach t in array array['kinetik_padel_batch','kinetik_grocery_basket','kinetik_grocery_run']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_rw" on public.%I;', t, t);
    execute format($p$create policy "%s_rw" on public.%I for all to authenticated
      using (public.kinetik_is_member(circle_id))
      with check (public.kinetik_can_post(circle_id));$p$, t, t);
    execute format('create index if not exists %I on public.%I(circle_id);', t || '_circle_idx', t);
  end loop;
  create index if not exists kinetik_padel_batch_session_idx on public.kinetik_padel_batch(session_id);
end $$;

commit;
