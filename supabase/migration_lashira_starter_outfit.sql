-- LashiraBloom onboarding — free "starter outfit" grant.
--
-- The onboarding wizard's Outfit step now shows ONLY real shop_cosmetic_catalog
-- coat items (migration_character_shop.sql), not the raw art-engine part list —
-- but every catalog coat costs 2,000-10,000 diamonds, and a brand-new player has
-- none. So whichever coat they pick during onboarding is granted to them free,
-- ONCE, via this RPC — a real ownership row (not a client-side fake), so the
-- in-game Shop correctly shows it as already owned/equippable/enhanceable.
--
-- Guarded server-side (not just "don't call it twice" on the client): refuses if
-- the caller already owns ANY coat item (bought or previously granted) — so this
-- can only ever hand out one free coat per player, no matter how it's called.
--
-- Paste into Supabase → SQL Editor → Run. Safe to re-run. Requires
-- migration_character_shop.sql to already be applied (reads shop_cosmetic_catalog
-- / writes person_cosmetic_items, both defined there).
begin;

create or replace function public.grant_starter_outfit(p_item_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  item_cat text;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select cat into item_cat from public.shop_cosmetic_catalog where item_key = p_item_key;
  if item_cat is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_item');
  end if;
  if item_cat <> 'coat' then
    return jsonb_build_object('ok', false, 'error', 'not_a_starter_slot');
  end if;

  if exists (select 1 from public.person_cosmetic_items where owner_id = uid and item_key = p_item_key) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- one free coat grant per player, ever — refuse if they already own any coat.
  if exists (
    select 1 from public.person_cosmetic_items pci
    join public.shop_cosmetic_catalog c on c.item_key = pci.item_key
    where pci.owner_id = uid and c.cat = 'coat'
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_granted');
  end if;

  insert into public.person_cosmetic_items (owner_id, item_key) values (uid, p_item_key)
    on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.grant_starter_outfit(text) to authenticated;

commit;
