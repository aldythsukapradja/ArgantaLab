-- ============================================================
--  ARGANTALAB · CHARACTER FORGE · COSMETIC SHOP  (additive, idempotent)
--  Mirrors migration_mounts.sql exactly: a tamper-proof server-side price list,
--  an ownership table, and ONE atomic buy RPC (checks balance, burns diamonds,
--  records ownership together — no spent-but-not-owned gap).
--
--  Catalog v1 (see docs/CHARACTER-FORGE-SHOP-CONCEPT.md): 4 categories capped at
--  10 items each (the raw "set" groupings are 15-130 items — too big for a shop
--  bundle), price 2,000-10,000 diamonds, stats scale with price ("more expensive
--  = more stat") anchored against the real Blacksmith gear ladder in
--  packages/combat/src/gear.js so the ceiling item (10k) ~= a real Tier-3 piece —
--  a real option, never a shortcut past the top Tier-4/5 crafted gear.
--
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

-- 1 · server-side price + stat list (tamper-proof; client mirrors it for art only)
create table if not exists public.shop_cosmetic_catalog (
  item_key   text primary key,      -- 'helmet:15', 'sword:0', … (cat:part_id)
  cat        text not null,         -- helmet | coat | sword | shield
  part_id    int  not null,         -- real char-part id from the extracted catalog
  set_label  text,                  -- 'Helmet Set 1' — display grouping only
  price      int  not null,
  atk        int  not null default 0,
  def        int  not null default 0,
  hp         int  not null default 0
);
alter table public.shop_cosmetic_catalog enable row level security;
drop policy if exists shop_cosmetic_catalog_read on public.shop_cosmetic_catalog;
create policy shop_cosmetic_catalog_read on public.shop_cosmetic_catalog for select using (true);

-- Helmet Set 1 (ids 15-24 of 15-29) — DEF only, smallest slot.
insert into public.shop_cosmetic_catalog (item_key, cat, part_id, set_label, price, def) values
  ('helmet:15', 'helmet', 15, 'Helmet Set 1', 2000, 5),
  ('helmet:16', 'helmet', 16, 'Helmet Set 1', 2900, 10),
  ('helmet:17', 'helmet', 17, 'Helmet Set 1', 3800, 15),
  ('helmet:18', 'helmet', 18, 'Helmet Set 1', 4700, 20),
  ('helmet:19', 'helmet', 19, 'Helmet Set 1', 5600, 25),
  ('helmet:20', 'helmet', 20, 'Helmet Set 1', 6500, 30),
  ('helmet:21', 'helmet', 21, 'Helmet Set 1', 7400, 35),
  ('helmet:22', 'helmet', 22, 'Helmet Set 1', 8300, 40),
  ('helmet:23', 'helmet', 23, 'Helmet Set 1', 9200, 45),
  ('helmet:24', 'helmet', 24, 'Helmet Set 1', 10000, 50)
on conflict (item_key) do update set price = excluded.price, def = excluded.def, set_label = excluded.set_label;

-- Coat Set 1 (ids 33-42 of 33-64) — DEF + HP, the torso slot.
insert into public.shop_cosmetic_catalog (item_key, cat, part_id, set_label, price, def, hp) values
  ('coat:33', 'coat', 33, 'Coat Set 1', 2000, 10, 100),
  ('coat:34', 'coat', 34, 'Coat Set 1', 2900, 20, 200),
  ('coat:35', 'coat', 35, 'Coat Set 1', 3800, 30, 300),
  ('coat:36', 'coat', 36, 'Coat Set 1', 4700, 40, 400),
  ('coat:37', 'coat', 37, 'Coat Set 1', 5600, 50, 500),
  ('coat:38', 'coat', 38, 'Coat Set 1', 6500, 60, 600),
  ('coat:39', 'coat', 39, 'Coat Set 1', 7400, 70, 700),
  ('coat:40', 'coat', 40, 'Coat Set 1', 8300, 80, 800),
  ('coat:41', 'coat', 41, 'Coat Set 1', 9200, 90, 900),
  ('coat:42', 'coat', 42, 'Coat Set 1', 10000, 100, 1000)
on conflict (item_key) do update set price = excluded.price, def = excluded.def, hp = excluded.hp, set_label = excluded.set_label;

-- Sword Set 0 (ids 0-9 of 0-129) — ATK only.
insert into public.shop_cosmetic_catalog (item_key, cat, part_id, set_label, price, atk) values
  ('sword:0', 'sword', 0, 'Sword Set 0', 2000, 20),
  ('sword:1', 'sword', 1, 'Sword Set 0', 2900, 40),
  ('sword:2', 'sword', 2, 'Sword Set 0', 3800, 60),
  ('sword:3', 'sword', 3, 'Sword Set 0', 4700, 80),
  ('sword:4', 'sword', 4, 'Sword Set 0', 5600, 100),
  ('sword:5', 'sword', 5, 'Sword Set 0', 6500, 120),
  ('sword:6', 'sword', 6, 'Sword Set 0', 7400, 140),
  ('sword:7', 'sword', 7, 'Sword Set 0', 8300, 160),
  ('sword:8', 'sword', 8, 'Sword Set 0', 9200, 180),
  ('sword:9', 'sword', 9, 'Sword Set 0', 10000, 200)
on conflict (item_key) do update set price = excluded.price, atk = excluded.atk, set_label = excluded.set_label;

-- Shield Set 0 (ids 0-9 of 0-55, the whole cat is one set) — DEF only.
insert into public.shop_cosmetic_catalog (item_key, cat, part_id, set_label, price, def) values
  ('shield:0', 'shield', 0, 'Shield Set 0', 2000, 8),
  ('shield:1', 'shield', 1, 'Shield Set 0', 2900, 16),
  ('shield:2', 'shield', 2, 'Shield Set 0', 3800, 24),
  ('shield:3', 'shield', 3, 'Shield Set 0', 4700, 32),
  ('shield:4', 'shield', 4, 'Shield Set 0', 5600, 40),
  ('shield:5', 'shield', 5, 'Shield Set 0', 6500, 48),
  ('shield:6', 'shield', 6, 'Shield Set 0', 7400, 56),
  ('shield:7', 'shield', 7, 'Shield Set 0', 8300, 64),
  ('shield:8', 'shield', 8, 'Shield Set 0', 9200, 72),
  ('shield:9', 'shield', 9, 'Shield Set 0', 10000, 80)
on conflict (item_key) do update set price = excluded.price, def = excluded.def, set_label = excluded.set_label;

-- 2 · who owns what (content-as-data: no FK on item_key)
create table if not exists public.person_cosmetic_items (
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  item_key    text not null,
  acquired_at timestamptz default now(),
  primary key (owner_id, item_key)
);
alter table public.person_cosmetic_items enable row level security;
drop policy if exists person_cosmetic_items_select on public.person_cosmetic_items;
create policy person_cosmetic_items_select on public.person_cosmetic_items for select using (
  auth.uid() = owner_id or public.is_guardian_of(owner_id) or public.is_admin()
);  -- no write policy: only the security-definer RPC below mutates it

-- 3 · BUY — atomic: server reads the price, burns diamonds, records ownership
create or replace function public.buy_cosmetic_item(p_item_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cost int; bal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price into cost from public.shop_cosmetic_catalog where item_key = p_item_key;
  if cost is null then raise exception 'unknown cosmetic item'; end if;
  if exists (select 1 from public.person_cosmetic_items where owner_id = uid and item_key = p_item_key) then
    return jsonb_build_object('ok', true, 'already', true,
      'balance', (select diamonds from public.profiles where id = uid));
  end if;
  select coalesce(diamonds,0) into bal from public.profiles where id = uid for update;
  if bal < cost then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'balance', bal, 'cost', cost);
  end if;
  update public.profiles set diamonds = diamonds - cost where id = uid;
  insert into public.diamond_ledger (from_user, to_user, amount, kind, reason)
    values (uid, null, cost, 'spend', 'cosmetic:' || p_item_key);
  insert into public.person_cosmetic_items (owner_id, item_key) values (uid, p_item_key)
    on conflict do nothing;
  return jsonb_build_object('ok', true, 'balance', (select diamonds from public.profiles where id = uid));
end; $$;
grant execute on function public.buy_cosmetic_item(text) to authenticated;

-- 4 · READ — my (or, for a guardian/admin, a specific person's) owned cosmetic items.
--     Lets Character Forge's Lab check what the SELECTED roster user owns, same as
--     my_mounts(p_person) already does for mounts.
create or replace function public.my_cosmetic_items(p_person uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); target uuid := coalesce(p_person, auth.uid());
begin
  if uid is null then return jsonb_build_object('owned', '[]'::jsonb); end if;
  if target <> uid and not public.is_guardian_of(target) and not public.is_admin() then
    return jsonb_build_object('owned', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'owned', coalesce((select jsonb_agg(item_key order by acquired_at) from public.person_cosmetic_items where owner_id = target), '[]'::jsonb)
  );
end; $$;
grant execute on function public.my_cosmetic_items(uuid) to authenticated;

commit;
