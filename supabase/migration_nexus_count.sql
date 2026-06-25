-- ============================================================
--  ARGANTALAB · NEXUS COUNT + HARVEST  — additive migration
--  Paste into Supabase → SQL Editor → Run. Idempotent (re-runnable).
--  Builds on migration_nexus.sql (person_creatures) + migration_spine.sql
--  (profiles.diamonds + diamond_ledger). Nothing is dropped.
--
--  WHY: befriending the same kin TYPE used to insert a duplicate row. Now there
--  is ONE row per (owner, kin) carrying a `count`; re-befriending increments it.
--  Each kin then trickles a tiny stream of diamonds — scaled by RARITY (rarer =
--  more) and by how loved it is (happiness) — that the child collects in the
--  Nexus. The accrual rate lives in a SERVER table (nexus_kin_catalog), never
--  trusted from the client, and diamonds are MINTED through the same immutable
--  ledger as every other earn (from_user = null). Diamonds buy cosmetics only —
--  this stays a gentle idle reward, never pay-to-win, never a real-money path.
-- ============================================================
begin;

-- ─────────────────────────────────────────────────────────────
--  1 · COUNT — collapse duplicate kin into one row with a tally
--  Runs EXACTLY ONCE (guarded on the unique constraint) so a re-run can never
--  reset counts that gameplay has since grown.
-- ─────────────────────────────────────────────────────────────
alter table public.person_creatures
  add column if not exists count int not null default 1 check (count >= 1);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'person_creatures_owner_kin_uniq'
  ) then
    -- fold every duplicate (owner, kin) into the earliest row, summing the tally
    update public.person_creatures pc
       set count = sub.cnt
      from (select owner_id, kin_key, count(*) cnt, min(id) keep_id
              from public.person_creatures group by owner_id, kin_key) sub
     where pc.id = sub.keep_id;

    delete from public.person_creatures pc
     using (select owner_id, kin_key, min(id) keep_id
              from public.person_creatures group by owner_id, kin_key) sub
     where pc.owner_id = sub.owner_id and pc.kin_key = sub.kin_key
       and pc.id <> sub.keep_id;

    alter table public.person_creatures
      add constraint person_creatures_owner_kin_uniq unique (owner_id, kin_key);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
--  2 · CATALOG — server-side rarity → daily diamond rate
--  The client knows a kin's rarity too, but it is spoofable; harvest reads the
--  rate from HERE so the payout can never be forged. daily_rate = diamonds per
--  day per kin at full happiness. Rarer kin are worth meaningfully more, so a
--  legendary catch keeps paying off. Tune these one-liners freely — they are the
--  whole economy. (A 0-row kin still works: COALESCE falls back to the common rate.)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.nexus_kin_catalog (
  kin_key    text primary key,
  rarity     text not null,
  daily_rate numeric(8,4) not null default 0.5 check (daily_rate >= 0)
);
-- readable by anyone signed in (it's just balance data, no PII)
alter table public.nexus_kin_catalog enable row level security;
drop policy if exists nexus_kin_catalog_read on public.nexus_kin_catalog;
create policy nexus_kin_catalog_read on public.nexus_kin_catalog for select using (true);

insert into public.nexus_kin_catalog (kin_key, rarity, daily_rate) values
  ('kin:countfox',  'common',     0.5),
  ('kin:addbug',    'common',     0.5),
  ('kin:letterowl', 'common',     0.5),
  ('kin:moodlamb',  'common',     0.5),
  ('kin:mapturtle', 'common',     0.5),
  ('kin:cloudcat',  'common',     0.5),
  ('kin:pixelslime','common',     0.5),
  ('kin:tenturtle', 'rare',       1.2),
  ('kin:multimoth', 'rare',       1.2),
  ('kin:zerolion',  'epic',       3.0),
  ('kin:primeroc',  'legendary',  8.0)
on conflict (kin_key) do update
  set rarity = excluded.rarity, daily_rate = excluded.daily_rate;

-- ─────────────────────────────────────────────────────────────
--  3 · STATE — per-owner fractional wallet + harvest clock
--  diamonds_pending banks the sub-1 trickle between collects (a common kin earns
--  half a diamond a day — you can't mint a fraction, so it accrues here until it
--  crosses a whole). last_harvest is the accrual clock.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.nexus_state (
  owner_id         uuid primary key references public.profiles(id) on delete cascade,
  diamonds_pending numeric(12,4) not null default 0 check (diamonds_pending >= 0),
  last_harvest     timestamptz not null default now()
);
alter table public.nexus_state enable row level security;
drop policy if exists nexus_state_select on public.nexus_state;
create policy nexus_state_select on public.nexus_state
  for select using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles k where k.id = nexus_state.owner_id and k.guardian_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
--  4 · BEFRIEND (UPSERT) — one row per kin type, count++ on a repeat
--  Replaces the insert-always writer. A fresh kin starts at count 1; re-
--  befriending the same type just bumps the tally and nudges happiness. Also
--  guarantees the owner has a nexus_state row so harvest always has a clock.
-- ─────────────────────────────────────────────────────────────
create or replace function public.befriend_kin(
  p_kin_key text, p_world text default null, p_nickname text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rid bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_kin_key is null or length(p_kin_key) = 0 then raise exception 'kin required'; end if;

  insert into public.nexus_state(owner_id) values (uid) on conflict (owner_id) do nothing;

  insert into public.person_creatures(owner_id, kin_key, world_key, nickname)
    values (uid, p_kin_key, p_world, nullif(p_nickname, ''))
  on conflict (owner_id, kin_key) do update
    set count      = public.person_creatures.count + 1,
        happiness  = least(100, public.person_creatures.happiness + 4),
        world_key  = coalesce(public.person_creatures.world_key, excluded.world_key)
  returning id into rid;

  return (select to_jsonb(c) from public.person_creatures c where c.id = rid);
end; $$;
grant execute on function public.befriend_kin(text,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  5 · ROSTER — now carries `count` (to_jsonb already includes it, but keep the
--  explicit reload contract documented). No body change needed beyond column.
-- ─────────────────────────────────────────────────────────────
create or replace function public.nexus_roster(p_person uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); who uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  who := coalesce(p_person, uid);
  if not (who = uid or exists(select 1 from public.profiles k where k.id = who and k.guardian_id = uid)) then
    raise exception 'not authorized';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.befriended_at)
                   from public.person_creatures c where c.owner_id = who), '[]'::jsonb);
end; $$;
grant execute on function public.nexus_roster(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  6 · HARVEST — accrue the trickle, optionally mint the whole diamonds
--  rate/day = Σ over the caller's kin of (daily_rate × count × happiness/100).
--  Reading (p_collect = false) computes the live pending WITHOUT writing, so the
--  UI can show "+N ready" any time. Collecting banks the whole part to the wallet
--  through the immutable ledger (from_user = null = a mint, kind 'harvest') and
--  keeps the fractional remainder. Operates on auth.uid() only — a guardian can
--  READ a kid's town but only the child collects their own town's diamonds.
-- ─────────────────────────────────────────────────────────────
create or replace function public.nexus_harvest(p_collect boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  st  public.nexus_state;
  rate_sum numeric;
  elapsed_days numeric;
  pending_total numeric;
  minted int := 0;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  insert into public.nexus_state(owner_id) values (uid) on conflict (owner_id) do nothing;
  select * into st from public.nexus_state where owner_id = uid for update;

  -- diamonds/day at the current loved-state of the town (server-side rate)
  select coalesce(sum(
           coalesce(cat.daily_rate, 0.5) * c.count * (c.happiness / 100.0)
         ), 0)
    into rate_sum
    from public.person_creatures c
    left join public.nexus_kin_catalog cat on cat.kin_key = c.kin_key
   where c.owner_id = uid;

  elapsed_days  := extract(epoch from (now() - st.last_harvest)) / 86400.0;
  pending_total := st.diamonds_pending + rate_sum * greatest(elapsed_days, 0);

  if p_collect then
    minted := floor(pending_total)::int;
    if minted > 0 then
      update public.profiles set diamonds = coalesce(diamonds,0) + minted where id = uid;
      insert into public.diamond_ledger (from_user, to_user, amount, kind, reason)
        values (null, uid, minted, 'harvest', 'nexus harvest');
    end if;
    update public.nexus_state
       set diamonds_pending = pending_total - minted,
           last_harvest     = now()
     where owner_id = uid;
  end if;

  return jsonb_build_object(
    'ok', true,
    'ratePerDay', round(rate_sum, 4),
    'pending',    round(pending_total, 4),
    'minted',     minted,
    'balance',    (select coalesce(diamonds,0) from public.profiles where id = uid)
  );
end; $$;
grant execute on function public.nexus_harvest(boolean) to authenticated;

commit;
