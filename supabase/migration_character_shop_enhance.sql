-- ============================================================
--  ARGANTALAB · COSMETIC SHOP · PER-ITEM ENHANCEMENT  (additive, idempotent)
--  Requires migration_character_shop.sql already run (shop_cosmetic_catalog,
--  person_cosmetic_items, buy_cosmetic_item, my_cosmetic_items).
--
--  A NEW, per-item power axis (docs/CHARACTER-FORGE-SHOP-CONCEPT.md §8c) — separate
--  from the existing ACCOUNT-level weaponTier/armorTier Blacksmith upgrade, which is
--  untouched. Each cosmetic item you own gets its own enhancement level (0-5),
--  tracked per (owner_id, item_key). Diamonds buy the starting piece; enhancing it
--  is earned by playing (wood/stone/bloom), never diamonds — "buying never beats
--  crafting at the ceiling," same principle as the base shop.
--
--  Materials are spent CLIENT-SIDE before calling this RPC (net/cosmetics.js) — this
--  matches the trust model EVERY other LashiraBloom material spend already uses
--  (mine()/chop()/toolCost()/houseCost() are all local-state, unverified server-side;
--  wood/stone aren't a real synced column an RPC could check+spend atomically like
--  diamonds — that's a separate, bigger project, not required to ship this). So this
--  RPC only does the one thing that's real cross-app shared state: the level itself.
--  No fail/destroy risk — guaranteed success, matching this game's consistently
--  gentle design (see the Dungeon panel: "Faint = you just leave, keep what you
--  gathered").
--
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

alter table public.person_cosmetic_items add column if not exists enhance_level int not null default 0;

create or replace function public.enhance_cosmetic_item(p_item_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cur_level int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select enhance_level into cur_level from public.person_cosmetic_items where owner_id = uid and item_key = p_item_key;
  if cur_level is null then
    return jsonb_build_object('ok', false, 'error', 'not_owned');
  end if;
  if cur_level >= 5 then
    return jsonb_build_object('ok', false, 'error', 'max_level');
  end if;
  update public.person_cosmetic_items set enhance_level = cur_level + 1 where owner_id = uid and item_key = p_item_key;
  return jsonb_build_object('ok', true, 'level', cur_level + 1);
end; $$;
grant execute on function public.enhance_cosmetic_item(text) to authenticated;

-- Extend my_cosmetic_items with a `levels` map (item_key -> enhance_level), additive
-- alongside the existing `owned` array so every current caller (HQ's Lab lock-gate,
-- LashiraBloom's ownership Set) keeps working unmodified.
create or replace function public.my_cosmetic_items(p_person uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); target uuid := coalesce(p_person, auth.uid());
begin
  if uid is null then return jsonb_build_object('owned', '[]'::jsonb, 'levels', '{}'::jsonb); end if;
  if target <> uid and not public.is_guardian_of(target) and not public.is_admin() then
    return jsonb_build_object('owned', '[]'::jsonb, 'levels', '{}'::jsonb);
  end if;
  return jsonb_build_object(
    'owned', coalesce((select jsonb_agg(item_key order by acquired_at) from public.person_cosmetic_items where owner_id = target), '[]'::jsonb),
    'levels', coalesce((select jsonb_object_agg(item_key, enhance_level) from public.person_cosmetic_items where owner_id = target), '{}'::jsonb)
  );
end; $$;
grant execute on function public.my_cosmetic_items(uuid) to authenticated;

commit;
