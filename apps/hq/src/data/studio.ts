// Content Studio data layer — operator-gated CRUD over the items catalog.
// Writes go straight to Supabase and require role operator/admin via RLS
// (items_operator policy). Every mutation bumps content_meta so player apps
// hot-swap their curriculum cache. Parents (role 'kid'/none) cannot write.

import { supabase, cloudEnabled } from '../lib/supabase'
import type { InteractionKey } from './curriculum'

export interface StudioItem {
  id: string
  world: string
  skill: string
  type: InteractionKey
  stage: string
  difficulty: number
  prompt: string
  payload: Record<string, unknown>
  hint?: string
  explanation?: string
  xp?: number
  diamonds?: number
  status: string
  updatedAt?: string
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

function rowToItem(r: Record<string, unknown>): StudioItem {
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
    status: (r.status as string) ?? 'live',
    updatedAt: (r.updated_at as string) ?? undefined,
  }
}

/** Bump the cloud content version so every player auto-refreshes. Best-effort. */
async function bumpContentVersion(): Promise<void> {
  if (!cloudEnabled) return
  try {
    const { data } = await supabase.from('content_meta').select('version').eq('id', 1).maybeSingle()
    const next = ((data?.version as number) ?? 0) + 1
    await supabase.from('content_meta').upsert({ id: 1, version: next, updated_at: new Date().toISOString() })
  } catch { /* table may not exist yet; ignore */ }
}

/** All items for a world (or all worlds), newest-edited first. null = not reachable. */
export async function studioListItems(world?: string): Promise<StudioItem[] | null> {
  if (!cloudEnabled) return null
  try {
    let q = supabase.from('items').select('*').order('updated_at', { ascending: false })
    if (world) q = q.eq('world_key', world)
    const { data, error } = await q
    if (error || !data) return null
    return (data as Record<string, unknown>[]).map(rowToItem)
  } catch { return null }
}

function toRow(d: ItemDraft): Record<string, unknown> {
  return {
    world_key: d.world_key, skill_key: d.skill_key, interaction_type: d.interaction_type,
    stage_key: d.stage_key ?? 'explorer', difficulty: d.difficulty ?? 2, prompt: d.prompt,
    payload: d.payload ?? {}, hint: d.hint ?? null, explanation: d.explanation ?? null,
    xp: d.xp ?? 10, diamonds: d.diamonds ?? 0, status: d.status ?? 'live',
  }
}

export async function studioUpsertItem(d: ItemDraft): Promise<{ ok: boolean; error?: string }> {
  if (!cloudEnabled) return { ok: false, error: 'No live connection' }
  try {
    const row = toRow(d)
    if (d.id) row.id = d.id
    const { error } = await supabase.from('items').upsert(row)
    await bumpContentVersion()
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (e) { return { ok: false, error: String(e) } }
}

export async function studioDeleteItem(id: string): Promise<boolean> {
  if (!cloudEnabled) return false
  try {
    const { error } = await supabase.from('items').delete().eq('id', id)
    await bumpContentVersion()
    return !error
  } catch { return false }
}

export async function studioSetStatus(id: string, status: string): Promise<boolean> {
  if (!cloudEnabled) return false
  try {
    const { error } = await supabase.from('items').update({ status }).eq('id', id)
    await bumpContentVersion()
    return !error
  } catch { return false }
}

export async function studioBulkInsert(items: ItemDraft[]): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!cloudEnabled) return { ok: false, count: 0, error: 'No live connection' }
  try {
    const rows = items.map(toRow)
    const { error, data } = await supabase.from('items').insert(rows).select('id')
    await bumpContentVersion()
    if (error) return { ok: false, count: 0, error: error.message }
    return { ok: true, count: data?.length ?? rows.length }
  } catch (e) { return { ok: false, count: 0, error: String(e) } }
}
