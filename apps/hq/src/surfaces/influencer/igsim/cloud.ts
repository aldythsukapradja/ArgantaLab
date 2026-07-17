// IG Simulator — Supabase persistence (P5).
//
// localStorage stays the fast, always-available cache (planStore reads/writes
// it synchronously so the UI never blocks on network); this module is the
// write-through/read-through to ig_plan_item so the plan survives a browser
// wipe once a real project is connected. Every function is a no-op when
// !cloudEnabled — planStore is the only caller and already guards on that,
// but each function guards again so it's safe to call from anywhere.
import { supabase, cloudEnabled } from '../../../lib/supabase'
import type { IgPlanItem } from './planStore'

function toRow(item: IgPlanItem) {
  return {
    id: item.id, creator_id: item.creatorId, kind: item.kind, day: item.day,
    slot: item.slot ?? null, media: item.media ?? null, look: item.look ?? null,
    caption: item.caption, hashtags: item.hashtags, pillar: item.pillar ?? null,
    highlight: item.highlight ?? null, platforms: item.platforms ?? ['ig'],
    platform_captions: item.platformCaptions ?? null, is_concept: !!item.isConcept,
    pinned: !!item.pinned, status: item.status, sent_draft_id: item.sentDraftId ?? null,
    created_at: item.createdAt, updated_at: item.updatedAt,
  }
}
function fromRow(r: any): IgPlanItem {
  return {
    id: r.id, creatorId: r.creator_id, kind: r.kind, day: r.day,
    slot: r.slot ?? undefined, media: r.media ?? undefined, look: r.look ?? undefined,
    caption: r.caption ?? '', hashtags: r.hashtags ?? '', pillar: r.pillar ?? undefined,
    highlight: r.highlight ?? undefined, platforms: Array.isArray(r.platforms) && r.platforms.length ? r.platforms : ['ig'],
    platformCaptions: r.platform_captions ?? undefined, isConcept: !!r.is_concept,
    pinned: !!r.pinned, status: r.status, sentDraftId: r.sent_draft_id ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

/** Every plan row, most recently touched first. Errors resolve to [] — a
 * failed cloud read must never wipe the local plan already on screen. */
export async function loadAllFromCloud(): Promise<IgPlanItem[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.from('ig_plan_item').select('*').order('updated_at', { ascending: false })
  if (error) { console.warn('[igsim/cloud] load', error.message); return [] }
  return (data || []).map(fromRow)
}

/** Fire-and-forget upsert — planStore already committed the optimistic local
 * write, so a network failure here is logged, not surfaced as a blocking error. */
export function upsertToCloud(item: IgPlanItem): void {
  if (!cloudEnabled) return
  void supabase.from('ig_plan_item').upsert(toRow(item)).then(({ error }) => {
    if (error) console.warn('[igsim/cloud] upsert', error.message)
  })
}

export function removeFromCloud(id: string): void {
  if (!cloudEnabled) return
  void supabase.from('ig_plan_item').delete().eq('id', id).then(({ error }) => {
    if (error) console.warn('[igsim/cloud] remove', error.message)
  })
}

export function upsertManyToCloud(items: IgPlanItem[]): void {
  if (!cloudEnabled || !items.length) return
  void supabase.from('ig_plan_item').upsert(items.map(toRow)).then(({ error }) => {
    if (error) console.warn('[igsim/cloud] upsert-many', error.message)
  })
}

/** Posted-status readback: an item sitting in 'sent' carries the content_draft
 * id it became; once that draft's published_to gains an entry (Post Studio
 * fanned it out), the plan item is genuinely posted. Returns the ids that
 * flipped so the caller can update local state + localStorage. */
export async function reconcilePosted(sentDraftIds: string[]): Promise<string[]> {
  if (!cloudEnabled || !sentDraftIds.length) return []
  const { data, error } = await supabase
    .from('content_draft')
    .select('id, published_to')
    .in('id', sentDraftIds)
  if (error) { console.warn('[igsim/cloud] reconcile', error.message); return [] }
  return (data || [])
    .filter(d => Array.isArray(d.published_to) && d.published_to.length > 0)
    .map(d => d.id as string)
}
