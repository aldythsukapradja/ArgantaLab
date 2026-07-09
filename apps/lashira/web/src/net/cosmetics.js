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

export async function loadOwnedCosmetics() {
  if (!hasSupabase) return new Set();
  try {
    const { data, error } = await supabase.rpc('my_cosmetic_items', { p_person: null });
    if (error || !data) return new Set();
    return new Set(data.owned || []);
  } catch { return new Set(); }
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
