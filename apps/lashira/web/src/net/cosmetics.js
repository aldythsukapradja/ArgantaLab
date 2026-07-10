// 🛍️ Cosmetic shop client (migration_character_shop.sql +
// migration_character_shop_equip.sql). Mirrors apps/hq/src/surfaces/character/
// heroData.ts's shop functions exactly — same tables, same RPCs, same Supabase
// project — so a purchase here shows owned in HQ's Character Forge Shop and
// vice versa. The ONE addition beyond HQ's mirror: equipCosmeticItem(), a
// self-service door into the composer spec HQ's admin-only save can't offer a
// player directly.
import { supabase, hasSupabase } from './supabase.js';

export async function loadShopCatalog() {
  if (!hasSupabase) return [];
  try {
    const { data, error } = await supabase.from('shop_cosmetic_catalog').select('*').order('price');
    if (error || !data) return [];
    return data.map((r) => ({
      itemKey: r.item_key, cat: r.cat, partId: r.part_id, setLabel: r.set_label,
      price: r.price, atk: r.atk || 0, def: r.def || 0, hp: r.hp || 0,
    }));
  } catch { return []; }
}

// Returns BOTH ownership (Set of item_keys) and each item's enhance level (0-5,
// migration_character_shop_enhance.sql) from the same call.
export async function loadOwnedCosmetics() {
  if (!hasSupabase) return { owned: new Set(), levels: {} };
  try {
    const { data, error } = await supabase.rpc('my_cosmetic_items', { p_person: null });
    if (error || !data) return { owned: new Set(), levels: {} };
    return { owned: new Set(data.owned || []), levels: data.levels || {} };
  } catch { return { owned: new Set(), levels: {} }; }
}

export async function buyCosmeticItem(itemKey) {
  if (!hasSupabase) return { ok: false, message: 'Offline — sign in to buy.' };
  try {
    const { data, error } = await supabase.rpc('buy_cosmetic_item', { p_item_key: itemKey });
    if (error) return { ok: false, message: error.message };
    if (!data?.ok) {
      const text = data?.error === 'insufficient' ? `Not enough diamonds — need ${data.cost}, have ${data.balance}.` : 'Purchase failed.';
      return { ok: false, message: text, balance: data?.balance };
    }
    return { ok: true, message: data.already ? 'Already owned.' : 'Purchased!', balance: data.balance };
  } catch (e) { return { ok: false, message: e?.message || 'Purchase failed.' }; }
}

// Equip = wear it. Patches ONE slot in the player's own composer spec (never a
// full rewrite); requires ownership. The player's rendered sprite is loaded once
// at session start (fetchHeroState in net/hero.js), so the caller should reload
// after a successful equip to actually see the new look — cheap and safe (the
// farm/circle save is cloud-backed either way).
export async function equipCosmeticItem(itemKey) {
  if (!hasSupabase) return { ok: false, message: 'Offline — sign in to equip.' };
  try {
    const { data, error } = await supabase.rpc('equip_cosmetic_item', { p_item_key: itemKey });
    if (error) return { ok: false, message: error.message };
    if (!data?.ok) {
      const text = data?.error === 'no_character' ? (data.message || 'No character yet.') : 'Equip failed.';
      return { ok: false, message: text };
    }
    return { ok: true, message: 'Equipped!' };
  } catch (e) { return { ok: false, message: e?.message || 'Equip failed.' }; }
}

// ENHANCE_MAX levels, +10% of the item's own base stat per level (cumulative). Cost
// is checked + spent CLIENT-SIDE (wood/stone/bloom — see the migration header for
// why); this RPC only bumps the shared level itself, requires ownership, caps at 5.
export const ENHANCE_MAX = 5;
export const enhanceCost = (nextLevel) => ({ wood: nextLevel * 8, stone: nextLevel * 10, bloom: nextLevel * 150 });
export async function enhanceCosmeticItem(itemKey) {
  if (!hasSupabase) return { ok: false, message: 'Offline — sign in to enhance.' };
  try {
    const { data, error } = await supabase.rpc('enhance_cosmetic_item', { p_item_key: itemKey });
    if (error) return { ok: false, message: error.message };
    if (!data?.ok) {
      const text = data?.error === 'max_level' ? 'Already max level.' : data?.error === 'not_owned' ? "You don't own this yet." : 'Enhance failed.';
      return { ok: false, message: text };
    }
    return { ok: true, level: data.level, message: `✨ Enhanced to Lv${data.level}!` };
  } catch (e) { return { ok: false, message: e?.message || 'Enhance failed.' }; }
}
