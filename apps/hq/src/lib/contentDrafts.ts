// contentDrafts — the browser-side read of the `content_draft` table (O5's
// bridge). The MCP (tools/arganta-core-mcp) writes rows with a service-role
// key; this is the operator-authenticated read/consume side, gated by the same
// hq_is_operator() RLS policy every other HQ table uses.
//
// No realtime channel — HQ has no existing postgres_changes subscription
// anywhere, so this follows the Model Rack's own convention (poll on an
// interval + manual refresh) rather than introducing a new pattern for one
// surface.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface DraftSlide {
  template: string; headline?: string; body?: string; emoji?: string; badge?: string; source?: string
  imagePrompt?: string; imageUrl?: string
}
export interface DraftCopy { palette?: string; slides: DraftSlide[]; caption: string; hashtags: string }

// Path C (Content-Workflow.md §3) — publish intents Claude Code attaches at
// draft-creation time, and the ACTUAL results after "Approve & publish
// everywhere". A destination present in publishTo but absent from publishedTo
// hasn't been published yet (or last attempt failed — failures aren't stored
// here, the inbox surfaces the error live and lets you retry).
export type PublishIntent =
  | { dest: 'moment'; circleId: string }
  | { dest: 'buffer'; channelId: string; mode?: 'addToQueue' | 'shareNext' | 'shareNow' }
export interface PublishResult { dest: 'moment' | 'buffer'; postId: string; publishedAt: string; circleId?: string; channelId?: string; mode?: string }

export interface ContentDraft {
  id: string; brief: string; status: 'ready' | 'error'; copy: DraftCopy
  format: string | null; palette: string | null; platform: string | null
  provenance: { provider: string; model: string; latencyMs: number; neurons: number; estimated: boolean } | null
  error: string | null; consumedAt: string | null; createdAt: string
  publishTo: PublishIntent[]; publishedTo: PublishResult[]
}

function mapRow(r: any): ContentDraft {
  return {
    id: r.id, brief: r.brief, status: r.status, copy: r.copy || { slides: [], caption: '', hashtags: '' },
    format: r.format ?? null, palette: r.palette ?? null, platform: r.platform ?? null,
    provenance: r.provenance ?? null, error: r.error ?? null,
    consumedAt: r.consumed_at ?? null, createdAt: r.created_at,
    publishTo: Array.isArray(r.publish_to) ? r.publish_to : [],
    publishedTo: Array.isArray(r.published_to) ? r.published_to : [],
  }
}

/** Most recent drafts (open + already-consumed both shown so the operator sees history). */
export async function listContentDrafts(client: SupabaseClient, limit = 20): Promise<ContentDraft[]> {
  const { data, error } = await client
    .from('content_draft')
    .select('id, brief, status, copy, format, palette, platform, provenance, error, consumed_at, created_at, publish_to, published_to')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.warn('[contentDrafts]', error.message); return [] }
  return (data || []).map(mapRow)
}

/** Append one publish result to a draft's published_to (read-modify-write —
 * this table has no concurrent-writer scenario, one operator drives the inbox). */
export async function recordDraftPublish(client: SupabaseClient, id: string, result: PublishResult): Promise<void> {
  const { data } = await client.from('content_draft').select('published_to').eq('id', id).maybeSingle()
  const existing: PublishResult[] = Array.isArray(data?.published_to) ? data.published_to : []
  await client.from('content_draft').update({ published_to: [...existing, result] }).eq('id', id)
}

/** Mark a draft opened — best-effort, never blocks loading it onto the canvas. */
export async function markDraftConsumed(client: SupabaseClient, id: string): Promise<void> {
  try { await client.from('content_draft').update({ consumed_at: new Date().toISOString() }).eq('id', id) }
  catch { /* non-fatal — the draft still loads either way */ }
}
