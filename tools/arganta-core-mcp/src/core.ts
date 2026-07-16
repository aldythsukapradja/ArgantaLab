// arganta-core-mcp core — the actual work behind the MCP tools, kept separate
// from the transport so it's unit-testable. Talks to two things:
//   1. the Arganta Core Content Worker (copy + image generation)
//   2. Supabase (write the draft row; upload generated images to video-assets)
//
// The MCP runs headless, so it authenticates to Supabase with the SERVICE ROLE
// key (bypasses RLS) — that key is a secret, set via env, never committed.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ASSET_BUCKET = 'video-assets'

export interface Env {
  coreUrl: string           // VITE_ARGANTA_CORE_URL equivalent (Worker base)
  coreToken?: string        // CORE_TOKEN
  supabaseUrl: string
  serviceKey: string
}

export function readEnv(e = process.env): Env {
  const coreUrl = (e.ARGANTA_CORE_URL || '').replace(/\/+$/, '')
  const supabaseUrl = (e.SUPABASE_URL || '').replace(/\/+$/, '')
  const serviceKey = e.SUPABASE_SERVICE_KEY || e.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!coreUrl) throw new Error('Set ARGANTA_CORE_URL to the deployed Worker base URL.')
  if (!supabaseUrl || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY.')
  return { coreUrl, coreToken: e.ARGANTA_CORE_TOKEN, supabaseUrl, serviceKey }
}

export function makeClient(env: Env): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } })
}

async function callWorker(env: Env, body: unknown): Promise<any> {
  const res = await fetch(`${env.coreUrl}/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(env.coreToken ? { Authorization: `Bearer ${env.coreToken}` } : {}) },
    body: JSON.stringify(body),
  })
  const data: any = await res.json().catch(() => null)
  if (!res.ok || !data || data.ok === false) {
    throw new Error((data && data.error && data.error.message) || `Worker HTTP ${res.status}`)
  }
  return data
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = Buffer.from(b64, 'base64')
  return new Uint8Array(bin)
}

// The Worker sniffs real magic bytes rather than trusting a model's documented
// (sometimes wrong) contentType — confirmed live that SDXL-Lightning's catalog
// schema claims PNG but actually returns JPEG. Never assume .png here.
const EXT_FOR_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }

/** Upload a generated image to the media library (video-assets bucket + index
 * row), returning its public URL so the draft's PostDoc can reference it. */
async function uploadImage(client: SupabaseClient, env: Env, base64: string, meta: { width: number; height: number; mime: string }): Promise<string | null> {
  try {
    const mime = meta.mime || 'image/png'
    const ext = EXT_FOR_MIME[mime] || 'png'
    const path = `upload/image/core-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`
    const up = await client.storage.from(ASSET_BUCKET).upload(path, b64ToBytes(base64), { contentType: mime, upsert: false })
    if (up.error) return null
    await client.from('hq_video_asset').insert({
      kind: 'image', bucket: ASSET_BUCKET, path, name: 'arganta-core', mime,
      width: meta.width, height: meta.height, source: 'upload', tags: ['arganta-core'],
    })
    return `${env.supabaseUrl}/storage/v1/object/public/${ASSET_BUCKET}/${path}`
  } catch { return null }
}

export interface DraftOptions {
  format?: string; palette?: string; platform?: string; withImages?: boolean
  // Path C (Content-Workflow.md §3): intents recorded on the draft, NOT acted
  // on here — createDraft never publishes anything itself. The operator opens
  // the draft in HQ's inbox and clicks "Approve & publish everywhere" once
  // these are visible as intent badges. Mirrors apps/hq/src/lib/contentDrafts.ts's
  // PublishIntent shape (kept as a plain literal here — no cross-package import).
  // NOTE: 'shareNow' is intentionally absent — same rule as McpBufferMode below,
  // Claude Code can only ever queue or bump-next, never fire an instant IG publish.
  publishTo?: ({ dest: 'moment'; circleId: string } | { dest: 'buffer'; channelId: string; mode?: McpBufferMode })[]
}

/**
 * The full content_draft flow: generate copy, optionally generate + upload an
 * image per slide (attaching its URL to that slide), then insert a draft row.
 * Returns the inserted draft id. Throws with a real reason on any hard failure.
 */
export async function createDraft(env: Env, client: SupabaseClient, brief: string, opts: DraftOptions = {}): Promise<{ id: string; slides: number; images: number }> {
  const withImages = opts.withImages !== false
  const format = opts.format || 'portrait'

  // 1) copy
  const copyRes = await callWorker(env, {
    kind: 'copy', brief,
    context: { format, palette: opts.palette, platform: opts.platform, wantImages: withImages },
  })
  const copy = copyRes.copy
  if (!copy || !Array.isArray(copy.slides) || copy.slides.length === 0) {
    // record the failure as a draft so the operator sees it in the inbox
    const { data } = await client.from('content_draft').insert({
      brief, status: 'error', error: 'Arganta Core returned no usable slides', format,
      palette: opts.palette, platform: opts.platform, provenance: copyRes.provenance,
    }).select('id').single()
    throw new Error(`No usable slides (draft ${data?.id ?? '?'} recorded as error).`)
  }

  // 2) images (best-effort, per slide with a brief)
  let images = 0
  if (withImages) {
    for (const slide of copy.slides) {
      if (!slide.imagePrompt) continue
      try {
        const img = await callWorker(env, { kind: 'image', prompt: slide.imagePrompt, format, context: { palette: opts.palette } })
        if (img && img.imageBase64) {
          const url = await uploadImage(client, env, img.imageBase64, { width: img.width, height: img.height, mime: img.mime })
          if (url) { slide.imageUrl = url; images++ }
        }
      } catch { /* one image failing never blocks the draft */ }
    }
  }

  // 3) persist the draft (+ publish intents, if any — never acted on here)
  const { data, error } = await client.from('content_draft').insert({
    brief, status: 'ready', copy, format,
    palette: copy.palette || opts.palette, platform: opts.platform,
    provenance: copyRes.provenance,
    publish_to: opts.publishTo || [],
  }).select('id').single()
  if (error) throw new Error(`Draft write failed: ${error.message}`)
  return { id: data.id as string, slides: copy.slides.length, images }
}

export async function listDrafts(client: SupabaseClient, limit = 20): Promise<any[]> {
  const { data, error } = await client
    .from('content_draft')
    .select('id, brief, status, format, slides:copy, consumed_at, created_at, publish_to, published_to')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: r.id, brief: r.brief, status: r.status, format: r.format,
    slideCount: Array.isArray(r.slides?.slides) ? r.slides.slides.length : 0,
    consumed: !!r.consumed_at, createdAt: r.created_at,
    // Path C: what was requested vs what actually went out — lets Claude Code
    // see at a glance whether a hybrid draft still needs the operator's approval.
    publishTo: r.publish_to || [], publishedTo: r.published_to || [],
  }))
}

export async function getDraft(client: SupabaseClient, id: string): Promise<any | null> {
  const { data, error } = await client.from('content_draft').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// ── BF4: Claude Code → Buffer (via the SAME Worker routes HQ's bufferClient
// uses — the Buffer API token itself stays a Worker secret, never touches here) ──

export interface BufferChannel { id: string; name: string; service: string; type?: string | null }

export async function listBufferChannels(env: Env): Promise<BufferChannel[]> {
  const res = await fetch(`${env.coreUrl}/v1/buffer/channels`, {
    headers: env.coreToken ? { Authorization: `Bearer ${env.coreToken}` } : {},
  })
  const data: any = await res.json().catch(() => null)
  if (!res.ok || !data || data.ok === false) {
    throw new Error((data && data.error && data.error.message) || `Worker HTTP ${res.status}`)
  }
  return data.channels || []
}

// Claude Code is NEVER allowed to fire an immediate publish to a live Instagram
// account — only queue it for the human to review in Buffer, or bump it to the
// next queue slot. 'shareNow' simply isn't in this type; the tool layer can't
// pass it through even if asked to.
export type McpBufferMode = 'addToQueue' | 'shareNext'

/**
 * Publish a content_draft's carousel to Buffer. IMPORTANT LIMITATION: this
 * runs headless (no browser canvas), so it sends the raw AI-generated
 * BACKGROUND images per slide — NOT the fully composed HQ carousel (headline
 * text, brand mark, badges baked in via postEngine's canvas renderer). For the
 * polished, on-brand version, open the draft in HQ's Drafts inbox and use
 * "Send to Buffer" from Post Studio instead.
 */
export async function publishDraftToBuffer(
  env: Env, client: SupabaseClient, draftId: string, channelId: string, mode: McpBufferMode = 'addToQueue',
): Promise<{ postId: string; images: number; mode: string }> {
  const draft = await getDraft(client, draftId)
  if (!draft) throw new Error(`No draft ${draftId}.`)
  if (draft.status !== 'ready') throw new Error(`Draft ${draftId} is status "${draft.status}", not ready to publish.`)
  const slides = draft.copy?.slides || []
  const imageUrls: string[] = slides.map((s: any) => s.imageUrl).filter((u: any): u is string => typeof u === 'string' && u.length > 0)
  if (!imageUrls.length) throw new Error('This draft has no generated images to publish (it was created with withImages:false, or image generation failed).')

  const text = [draft.copy.caption, draft.copy.hashtags].filter(Boolean).join('\n\n')
  const res = await fetch(`${env.coreUrl}/v1/buffer/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(env.coreToken ? { Authorization: `Bearer ${env.coreToken}` } : {}) },
    body: JSON.stringify({ channelId, text, imageUrls, mode }),
  })
  const data: any = await res.json().catch(() => null)
  if (!res.ok || !data || data.ok === false) {
    throw new Error((data && data.error && data.error.message) || `Worker HTTP ${res.status}`)
  }
  return { postId: data.postId, images: data.images, mode: data.mode }
}
