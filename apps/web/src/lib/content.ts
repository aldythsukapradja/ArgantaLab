import { supabase, cloudEnabled } from './supabase'
import { LOCAL_ITEMS, type Item, type InteractionKey } from '@/data/learn'

// ============================================================
//  CONTENT DELIVERY  (Duolingo-style)
//  Supabase `items` is the source of truth. The curriculum is
//  cached in localStorage (this is CONTENT, not user data) and
//  served instantly, then revalidated in the background against a
//  `content_meta` version — when it changes, we refetch & swap.
//  The bundled local pack is the offline / first-launch fallback.
// ============================================================

const CACHE_KEY = 'argantalab_content_v1'   // curriculum cache (safe to store)
interface ContentCache { sig: string; items: Item[] }

let _pool: Item[] | null = null             // active in-memory pool; null → bundled
let _booted = false

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

function readCache(): ContentCache | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null }
}
function writeCache(c: ContentCache) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* ignore */ } }

/** The active question pool: cloud cache if we have one, else the bundled pack. */
function activePool(): Item[] { return _pool && _pool.length ? _pool : LOCAL_ITEMS }

// content version from the single-row content_meta table (cheap)
async function cloudSig(): Promise<string | null> {
  if (!cloudEnabled) return null
  try {
    const { data, error } = await supabase.from('content_meta').select('version,updated_at').eq('id', 1).maybeSingle()
    if (error || !data) return null
    return `${data.version}:${data.updated_at}`
  } catch { return null }
}

async function fetchAllItems(): Promise<Item[] | null> {
  if (!cloudEnabled) return null
  try {
    const { data, error } = await supabase.from('items').select('*').eq('status', 'live')
    if (error || !data || !data.length) return null
    return (data as Record<string, unknown>[]).map(rowToItem)
  } catch { return null }
}

const listeners = new Set<() => void>()
/** Subscribe to "content refreshed" so a screen can re-pull questions. */
export function onContentUpdate(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn) }
function notify() {
  listeners.forEach(fn => { try { fn() } catch { /* ignore */ } })
  try { window.dispatchEvent(new CustomEvent('alab:content')) } catch { /* ignore */ }
}

/** Boot the content layer: serve cache instantly, then revalidate in background. */
export async function initContent(): Promise<void> {
  if (_booted) return
  _booted = true
  const cache = readCache()
  if (cache?.items?.length) _pool = cache.items          // instant, offline-capable
  const sig = await cloudSig()
  if (!sig) return                                       // not seeded / offline → keep cache or bundled
  if (cache && cache.sig === sig) return                 // already current
  const items = await fetchAllItems()                    // version changed (or no cache) → refresh
  if (items && items.length) {
    _pool = items
    writeCache({ sig, items })
    notify()
  }
}

/** Force a re-check now (e.g. after admin edits or pull-to-refresh). */
export async function refreshContent(): Promise<void> { _booted = false; await initContent() }

export function invalidateContentCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
  _pool = null; _booted = false
}

/** Bump the cloud content version so every client auto-refreshes (admin only). */
export async function bumpContentVersion(): Promise<void> {
  if (!cloudEnabled) return
  try {
    const { data } = await supabase.from('content_meta').select('version').eq('id', 1).maybeSingle()
    const next = ((data?.version as number) ?? 0) + 1
    await supabase.from('content_meta').upsert({ id: 1, version: next, updated_at: new Date().toISOString() })
  } catch { /* ignore */ }
}

// Stage neighbours, nearest-first, so a thin stage borrows from adjacent ones.
const STAGE_ORDER = ['tiny', 'starter', 'explorer', 'builder', 'champion', 'legend']
function stageFallback(stage: string): string[] {
  const i = STAGE_ORDER.indexOf(stage)
  if (i < 0) return ['explorer']
  const out: string[] = []
  for (let d = 0; d < STAGE_ORDER.length; d++) {
    if (STAGE_ORDER[i - d]) out.push(STAGE_ORDER[i - d])
    if (d && STAGE_ORDER[i + d]) out.push(STAGE_ORDER[i + d])
  }
  return out
}

/** Items for a node: cloud (if available) else local, filtered by world + skills,
 *  preferring the player's stage but broadening to neighbours so a node is never
 *  starved (a Starter kid still gets a full session even on a thin skill). */
export async function getItems(world: string, skills: string[], stage = 'explorer', want = 6): Promise<Item[]> {
  const inWorld = activePool().filter(i => i.world === world && skills.includes(i.skill))
  const out: Item[] = []
  const seen = new Set<string>()
  for (const st of stageFallback(stage)) {
    for (const it of inWorld) {
      if (it.stage === st && !seen.has(it.id)) { seen.add(it.id); out.push(it) }
    }
    if (out.length >= want) break   // enough variety from near stages — stop widening
  }
  return out
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
    invalidateContentCache(); await bumpContentVersion()
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) { return { ok: false, error: String(e) } }
}

export async function adminDeleteItem(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('items').delete().eq('id', id); invalidateContentCache(); await bumpContentVersion(); return !error } catch { return false }
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
    invalidateContentCache(); await bumpContentVersion()
    if (error) return { ok: false, count: 0, error: error.message }
    return { ok: true, count: data?.length ?? rows.length }
  } catch (e) { return { ok: false, count: 0, error: String(e) } }
}
