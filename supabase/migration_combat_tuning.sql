-- Combat tuning pipeline — the wire between Circle HQ (Battle Builder) and the
-- LashiraBloom game. HQ publishes ONE active config; the game reads it on boot.
-- OPTIONAL: the game runs fully on package defaults without this table. Run in
-- the ArgantaLab Supabase project (bdagdxgpnlialkppjwor) to enable live tuning.
--
-- Security posture (mirrors apps/hq's operator gate + apps/lashira operator email):
--   • WRITE (publish) = operator only (aldhyt.sukapradja@gmail.com), server-side.
--   • READ (active config) = any authed user (kids' games need it). Config carries
--     NO secrets — just damage numbers — so a public read is fine.

begin;

-- Who may publish tuning. Kept as a function so the allowlist lives in one place.
create or replace function public.combat_is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce((auth.jwt() ->> 'email'), '')) = 'aldhyt.sukapradja@gmail.com'
$$;

-- Append-only-ish history; exactly one row is active at a time.
create table if not exists public.combat_tuning (
  id            uuid primary key default gen_random_uuid(),
  version       int  not null default 1,
  config        jsonb not null,          -- { v, override, fairness, published_at, note }
  fairness_score int,                     -- denormalised for quick listing
  active        boolean not null default false,
  published_by  uuid references auth.users(id),
  published_at  timestamptz not null default now()
);
create index if not exists combat_tuning_active_idx on public.combat_tuning (active) where active;

alter table public.combat_tuning enable row level security;

-- Read the active config: everyone authed (the game needs it). No write via table.
drop policy if exists combat_tuning_read on public.combat_tuning;
create policy combat_tuning_read on public.combat_tuning
  for select using (auth.role() = 'authenticated');

-- The "single button to set them all": validate-on-client, then this deactivates
-- the previous active row and inserts the new one atomically. Operator only.
create or replace function public.hq_combat_publish(p_config jsonb, p_score int)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.combat_is_operator() then
    raise exception 'not authorized: combat tuning is operator-only';
  end if;
  update public.combat_tuning set active = false where active;
  insert into public.combat_tuning (version, config, fairness_score, active, published_by)
  values (coalesce((p_config ->> 'v')::int, 1), p_config, p_score, true, auth.uid())
  returning id into new_id;
  return new_id;
end $$;

-- The game's read: the currently active config (or null → game uses defaults).
create or replace function public.combat_tuning_active()
returns jsonb language sql stable security definer set search_path = public as $$
  select config from public.combat_tuning where active order by published_at desc limit 1
$$;

grant execute on function public.hq_combat_publish(jsonb, int) to authenticated;
grant execute on function public.combat_tuning_active() to authenticated, anon;

commit;

-- Rollback:
--   drop function if exists public.hq_combat_publish(jsonb,int);
--   drop function if exists public.combat_tuning_active();
--   drop function if exists public.combat_is_operator();
--   drop table if exists public.combat_tuning;
