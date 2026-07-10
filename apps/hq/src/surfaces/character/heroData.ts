import { supabase, cloudEnabled } from '../../lib/supabase'

// Character data for the Forge. HQ reads + writes the SAME canonical character the
// games use (kingdom_characters / kingdom_character_appearance), so editing here is
// the single source of truth — LashiraBloom + Kingdom Heroes read it back.
//
// Multi-user: the operator-only admin RPCs (migration_hq_character_admin.sql) list
// every character and load/save ANY user's. Before that migration is deployed we
// fall back to the operator's OWN character via the games' own kingdom RPCs, so the
// Forge still works — it just can't reach other users yet.

export interface RosterEntry {
  profileId: string; characterId?: string; name: string; displayName: string
  email?: string; accountType?: string; pathId?: string; level?: number; hasHero: boolean
  guardianId?: string | null; guardianName?: string | null
}
export interface CharacterLoad { profileId: string; displayName: string; pathId: string; spec: any | null; hasHero: boolean }
export type RosterKind = 'all' | 'adult' | 'kid'
export interface RosterPage {
  entries: RosterEntry[]; total: number; counts: { all: number; adult: number; kid: number }
  page: number; pageSize: number; source: 'admin' | 'self' | 'offline'
}

// ---- roster (platform-wide, sourced from KinetikCircle profiles — paginated + searchable) ----
export async function loadRoster(opts: { search?: string; kind?: RosterKind; page?: number; pageSize?: number } = {}): Promise<RosterPage> {
  const { search = '', kind = 'all', page = 1, pageSize = 12 } = opts
  if (!cloudEnabled) return { entries: [], total: 0, counts: { all: 0, adult: 0, kid: 0 }, page, pageSize, source: 'offline' }
  // Preferred: the operator admin RPC — platform-wide, paginated, searchable.
  try {
    const { data, error } = await supabase.rpc('hq_character_roster', {
      p_search: search || null, p_kind: kind === 'all' ? null : kind,
      p_limit: pageSize, p_offset: (page - 1) * pageSize,
    })
    if (!error && data && Array.isArray(data.items)) {
      return {
        entries: data.items as RosterEntry[], total: data.total ?? 0,
        counts: data.counts ?? { all: 0, adult: 0, kid: 0 }, page, pageSize, source: 'admin',
      }
    }
  } catch { /* migration not deployed — fall through */ }
  // Fallback: just the operator's own character via the games' RPC (no pagination/search).
  const self = await loadOperatorSelf()
  const entries = self ? [self] : []
  return { entries, total: entries.length, counts: { all: entries.length, adult: entries.length, kid: 0 }, page: 1, pageSize, source: 'self' }
}

// ---- load one user's character ----
export async function getCharacter(profileId: string): Promise<CharacterLoad | null> {
  if (!cloudEnabled) return null
  try {
    const { data, error } = await supabase.rpc('hq_character_get', { p_profile_id: profileId })
    if (!error && data) {
      return {
        profileId, displayName: data.displayName || data.character?.name || 'Character',
        pathId: data.character?.pathId || 'warrior', spec: data.spec || null, hasHero: !!data.spec,
      }
    }
  } catch { /* fall through to self */ }
  // Fallback path (self only).
  const s = await loadOperatorSelf()
  return s && s.profileId === profileId ? { profileId, displayName: s.displayName, pathId: s.pathId || 'warrior', spec: (s as any).spec ?? null, hasHero: s.hasHero } : null
}

// ---- save a user's character (single source of truth for the games) ----
export async function saveCharacter(profileId: string, spec: any, path?: string): Promise<{ ok: boolean; message: string }> {
  if (!cloudEnabled) return { ok: false, message: 'Offline — sign in to save.' }
  // Preferred: admin save (any user).
  try {
    const { data, error } = await supabase.rpc('hq_character_save', { p_profile_id: profileId, p_spec: spec, p_path: path ?? null })
    if (!error && data) {
      if (data.ok) return { ok: true, message: 'Saved & synced — the games read this now.' }
      return { ok: false, message: data.message || 'Save failed.' }
    }
  } catch { /* fall through to self save */ }
  // Fallback: the operator's own character via the games' RPCs.
  try {
    const { error: e1 } = await supabase.rpc('kingdom_save_character_draft', { p_spec: spec })
    if (e1) return { ok: false, message: e1.message }
    const { error: e2 } = await supabase.rpc('kingdom_sync_character_build')
    if (e2) return { ok: true, message: 'Draft saved (admin/sync RPC not deployed).' }
    return { ok: true, message: 'Saved & synced (self) — the games read this now.' }
  } catch (e) {
    return { ok: false, message: (e as any)?.message || 'Save failed.' }
  }
}

// ---- 🛍️ cosmetic shop (migration_character_shop.sql) ----
// Server-priced catalog (public read) + per-person ownership + one atomic buy RPC —
// mirrors the mount shop exactly. Buys spend the CURRENTLY signed-in operator's own
// diamonds (same self-referential design as buy_mount); a real end-user storefront in
// Kingdom/LashiraBloom would call the same RPC as the player themselves.
export interface ShopItem {
  itemKey: string; cat: string; partId: number; setLabel: string
  price: number; atk: number; def: number; hp: number
}
export async function loadShopCatalog(): Promise<ShopItem[]> {
  if (!cloudEnabled) return []
  try {
    const { data, error } = await supabase.from('shop_cosmetic_catalog').select('*').order('price')
    if (error || !data) return []
    return data.map((r: any) => ({
      itemKey: r.item_key, cat: r.cat, partId: r.part_id, setLabel: r.set_label,
      price: r.price, atk: r.atk || 0, def: r.def || 0, hp: r.hp || 0,
    }))
  } catch { return [] }
}
// Owned item keys for the signed-in operator, or (guardian/admin only) a specific
// roster user — mirrors my_mounts(p_person). Used to lock/unlock the Lab's picker.
export async function loadOwnedCosmetics(profileId?: string): Promise<Set<string>> {
  if (!cloudEnabled) return new Set()
  try {
    const { data, error } = await supabase.rpc('my_cosmetic_items', { p_person: profileId ?? null })
    if (error || !data) return new Set()
    return new Set((data.owned || []) as string[])
  } catch { return new Set() }
}
export async function buyCosmeticItem(itemKey: string): Promise<{ ok: boolean; message: string; balance?: number }> {
  if (!cloudEnabled) return { ok: false, message: 'Offline — sign in to buy.' }
  try {
    const { data, error } = await supabase.rpc('buy_cosmetic_item', { p_item_key: itemKey })
    if (error) return { ok: false, message: error.message }
    if (!data?.ok) {
      const text = data?.error === 'insufficient' ? `Not enough diamonds — need ${data.cost}, have ${data.balance}.` : 'Purchase failed.'
      return { ok: false, message: text, balance: data?.balance }
    }
    return { ok: true, message: data.already ? 'Already owned.' : 'Purchased!', balance: data.balance }
  } catch (e) { return { ok: false, message: (e as any)?.message || 'Purchase failed.' } }
}
// Equip = wear it. Patches ONE slot in the OPERATOR'S OWN composer spec (same self-
// referential scope as buy_cosmetic_item / equip_mount — mirrors
// apps/lashira/web/src/net/cosmetics.js's equipCosmeticItem exactly, same RPC). The
// Lab's roster view loads a DIFFERENT user's spec, so a reload here is what actually
// shows the change if you're looking at your own character afterward.
export async function equipCosmeticItem(itemKey: string): Promise<{ ok: boolean; message: string }> {
  if (!cloudEnabled) return { ok: false, message: 'Offline — sign in to equip.' }
  try {
    const { data, error } = await supabase.rpc('equip_cosmetic_item', { p_item_key: itemKey })
    if (error) return { ok: false, message: error.message }
    if (!data?.ok) {
      const text = data?.error === 'no_character' ? (data.message || 'No character yet.') : 'Equip failed.'
      return { ok: false, message: text }
    }
    return { ok: true, message: 'Equipped!' }
  } catch (e) { return { ok: false, message: (e as any)?.message || 'Equip failed.' } }
}
export async function getMyDiamondBalance(): Promise<number> {
  if (!cloudEnabled) return 0
  try {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return 0
    const { data } = await supabase.from('profiles').select('diamonds').eq('id', auth.user.id).maybeSingle()
    return Number((data as any)?.diamonds || 0)
  } catch { return 0 }
}

// ---- self helper (fallback + identity) ----
async function loadOperatorSelf(): Promise<(RosterEntry & { spec?: any }) | null> {
  try {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return null
    const { data, error } = await supabase.rpc('kingdom_get_player_state')
    if (error || !data) {
      // Signed in but no kingdom RPC / character — still show the operator as an entry.
      return { profileId: auth.user.id, name: 'You', displayName: auth.user.email || 'You', hasHero: false }
    }
    const loadout = data.loadout || {}
    const spec = loadout.syncedSpec || loadout.draftSpec || data.character?.spec || null
    return {
      profileId: auth.user.id,
      name: data.character?.name || 'You',
      displayName: data.profile?.display_name || data.profile?.displayName || auth.user.email || 'You',
      accountType: data.character?.account_type, pathId: data.character?.path_id || data.character?.pathId || 'warrior',
      level: data.profile?.level, hasHero: !!data.character, spec,
    }
  } catch { return null }
}
