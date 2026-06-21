import { supabase } from './supabase'
import { LOCAL_ITEMS, type Item, type InteractionKey } from '@/data/learn'

// Content service. Tries the Supabase `items` table first (so your Admin edits
// take effect with zero deploys); falls back to the bundled local pack so the
// app is always playable even before the backend is seeded.

let _cloudCache: Item[] | null | undefined  // undefined = not tried, null = unavailable

function rowToItem(r: Record<string, unknown>): Item {
  return {
    id: r.id as string,
    world: r.world_key as string,
    skill: (r.skill_key as string) ?? '',
    type: (r.interaction_type as InteractionKey) ?? 'mcq',
    stage: (r.stage_key as string) ?? 'explorer',
    difficulty: (r.difficulty as number) ?? 2,
    prompt: (r.prompt as string) ?? '',
    payload: (r.payload as Record<string, unknown>) ?? {},
    hint: (r.hint as string) ?? undefined,
    explanation: (r.explanation as string) ?? undefined,
    xp: (r.xp as number) ?? 10,
    diamonds: (r.diamonds as number) ?? 0,
  }
}

/** Load all live cloud items once (cached). Returns null if backend not ready. */
export async function loadCloudItems(force = false): Promise<Item[] | null> {
  if (!force && _cloudCache !== undefined) return _cloudCache ?? null
  try {
    const { data, error } = await supabase.from('items').select('*').eq('status', 'live')
    if (error || !data) { _cloudCache = null; return null }
    _cloudCache = (data as Record<string, unknown>[]).map(rowToItem)
    return _cloudCache
  } catch { _cloudCache = null; return null }
}

export function invalidateContentCache() { _cloudCache = undefined }

/** Items for a node: cloud (if available) else local, filtered by world + skills + stage. */
export async function getItems(world: string, skills: string[], stage = 'explorer'): Promise<Item[]> {
  const cloud = await loadCloudItems()
  const pool = cloud && cloud.length ? cloud : LOCAL_ITEMS
  return pool.filter(i => i.world === world && i.stage === stage && skills.includes(i.skill))
}

// ── Admin CRUD (writes go to cloud; require admin role via RLS) ──
export async function adminListItems(world?: string): Promise<Item[] | null> {
  try {
    let q = supabase.from('items').select('*').order('updated_at', { ascending: false })
    if (world) q = q.eq('world_key', world)
    const { data, error } = await q
    if (error || !data) return null
    return (data as Record<string, unknown>[]).map(rowToItem)
  } catch { return null }
}

export interface ItemDraft {
  id?: string
  world_key: string
  skill_key: string
  interaction_type: string
  stage_key: string
  difficulty: number
  prompt: string
  payload: Record<string, unknown>
  hint?: string
  explanation?: string
  xp?: number
  diamonds?: number
  status?: string
}

export async function adminUpsertItem(d: ItemDraft): Promise<{ ok: boolean; error?: string }> {
  try {
    const row: Record<string, unknown> = {
      world_key: d.world_key, skill_key: d.skill_key, interaction_type: d.interaction_type,
      stage_key: d.stage_key, difficulty: d.difficulty, prompt: d.prompt, payload: d.payload,
      hint: d.hint ?? null, explanation: d.explanation ?? null, xp: d.xp ?? 10,
      diamonds: d.diamonds ?? 0, status: d.status ?? 'live',
    }
    if (d.id) row.id = d.id
    const { error } = await supabase.from('items').upsert(row)
    invalidateContentCache()
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) { return { ok: false, error: String(e) } }
}

export async function adminDeleteItem(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('items').delete().eq('id', id); invalidateContentCache(); return !error } catch { return false }
}

/** Bulk insert items from a parsed JSON array (the LLM authoring format). */
export async function adminBulkInsert(items: ItemDraft[]): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const rows = items.map(d => ({
      world_key: d.world_key, skill_key: d.skill_key, interaction_type: d.interaction_type,
      stage_key: d.stage_key ?? 'explorer', difficulty: d.difficulty ?? 2, prompt: d.prompt,
      payload: d.payload ?? {}, hint: d.hint ?? null, explanation: d.explanation ?? null,
      xp: d.xp ?? 10, diamonds: d.diamonds ?? 0, status: d.status ?? 'live',
    }))
    const { error, data } = await supabase.from('items').insert(rows).select('id')
    invalidateContentCache()
    if (error) return { ok: false, count: 0, error: error.message }
    return { ok: true, count: data?.length ?? rows.length }
  } catch (e) { return { ok: false, count: 0, error: String(e) } }
}
