-- ============================================================
--  ARGANTALAB · OPENWORLD · MOUNT SHOP  (additive, idempotent)
--  Mounts are bought with diamonds (cosmetic + a small battle perk, never
--  pay-to-win on learning). Ownership + equip live in the cloud; the PRICE lives
--  SERVER-SIDE (mount_catalog) so a tampering client can't forge a cheap buy.
--  Buying is ONE atomic RPC: it checks the balance, burns diamonds into the
--  immutable ledger, and records ownership together — no spent-but-not-owned gap.
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

-- 1 · server-side price list (tamper-proof; client catalog mirrors it for art)
create table if not exists public.mount_catalog (
  mount_key text primary key,
  price     int  not null,
  rarity    text,
  gate      text default 'none'
);
alter table public.mount_catalog enable row level security;
drop policy if exists mount_catalog_read on public.mount_catalog;
create policy mount_catalog_read on public.mount_catalog for select using (true);

insert into public.mount_catalog (mount_key, price, rarity, gate) values
  ('mount:sandstrider', 60,  'common',    'none'),
  ('mount:stormfin',    120, 'rare',      'swim'),
  ('mount:updrift',     180, 'epic',      'flier'),
  ('mount:arganterion', 320, 'legendary', 'none')
on conflict (mount_key) do update set price = excluded.price, rarity = excluded.rarity, gate = excluded.gate;

-- 2 · who owns what (content-as-data: no FK on mount_key)
create table if not exists public.person_mounts (
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  mount_key   text not null,
  acquired_at timestamptz default now(),
  primary key (owner_id, mount_key)
);
alter table public.person_mounts enable row level security;
drop policy if exists person_mounts_select on public.person_mounts;
create policy person_mounts_select on public.person_mounts for select using (
  auth.uid() = owner_id or public.is_guardian_of(owner_id) or public.is_admin()
);  -- no write policy: only the security-definer RPCs below mutate it

-- 3 · the currently-equipped mount (the one the avatar rides)
alter table public.profiles add column if not exists equipped_mount text;

-- 4 · BUY — atomic: server reads the price, burns diamonds, records ownership
create or replace function public.buy_mount(p_mount_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cost int; bal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price into cost from public.mount_catalog where mount_key = p_mount_key;
  if cost is null then raise exception 'unknown mount'; end if;
  if exists (select 1 from public.person_mounts where owner_id = uid and mount_key = p_mount_key) then
    return jsonb_build_object('ok', true, 'already', true,
      'balance', (select diamonds from public.profiles where id = uid));
  end if;
  select coalesce(diamonds,0) into bal from public.profiles where id = uid for update;
  if bal < cost then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'balance', bal);
  end if;
  update public.profiles set diamonds = diamonds - cost where id = uid;
  insert into public.diamond_ledger (from_user, to_user, amount, kind, reason)
    values (uid, null, cost, 'spend', 'mount:' || p_mount_key);
  insert into public.person_mounts (owner_id, mount_key) values (uid, p_mount_key)
    on conflict do nothing;
  return jsonb_build_object('ok', true, 'balance', (select diamonds from public.profiles where id = uid));
end; $$;
grant execute on function public.buy_mount(text) to authenticated;

-- 5 · EQUIP — only a mount you own (null = ride on foot). Returns the equipped key.
create or replace function public.equip_mount(p_mount_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_mount_key is not null and
     not exists (select 1 from public.person_mounts where owner_id = uid and mount_key = p_mount_key) then
    raise exception 'mount not owned';
  end if;
  update public.profiles set equipped_mount = p_mount_key where id = uid;
  return jsonb_build_object('ok', true, 'equipped', p_mount_key);
end; $$;
grant execute on function public.equip_mount(text) to authenticated;

-- 6 · READ — my (or my kid's) owned mounts + the equipped one
create or replace function public.my_mounts(p_person uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); target uuid := coalesce(p_person, auth.uid());
begin
  if uid is null then return jsonb_build_object('owned', '[]'::jsonb, 'equipped', null); end if;
  if target <> uid and not public.is_guardian_of(target) and not public.is_admin() then
    return jsonb_build_object('owned', '[]'::jsonb, 'equipped', null);
  end if;
  return jsonb_build_object(
    'owned', coalesce((select jsonb_agg(mount_key order by acquired_at) from public.person_mounts where owner_id = target), '[]'::jsonb),
    'equipped', (select equipped_mount from public.profiles where id = target)
  );
end; $$;
grant execute on function public.my_mounts(uuid) to authenticated;

commit;
