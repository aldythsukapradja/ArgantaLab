// arganta-core-mcp core — the actual work behind the MCP tools, kept separate
// from the transport so it's unit-testable. Talks to two things:
//   1. the Arganta Core Content Worker (copy + image generation)
//   2. Supabase (write the draft row; upload generated images to video-assets)
//
// The MCP runs headless, so it authenticates to Supabase with the SERVICE ROLE
// key (bypasses RLS) — that key is a secret, set via env, never committed.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  BRAND_BASES, DEFAULT_BRAND_ID, resolveBrand, voiceBlock,
  readiness, matrix, assertEditable, illegalOverlayPaths, deepMerge, LAYERS,
} from '@arganta/brand'

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

// ── Brands (BF-5) ─────────────────────────────────────────────
// The Brand OS splits a BrandDoc across two stores and that split IS the
// governance rule: the agent lane (identity, marks, templates) lives in git and
// only coding agents touch it; the founder lane (voice, spine, platform text)
// lives in brand_registry.overlay and the founder edits it in HQ. The MCP is an
// agent, so it may write both — but it still routes every write through
// assertEditable so a founder-lane table never quietly accumulates agent-lane
// fields that git would then fight over.

/** Resolve a brand: git base + the founder-lane overlay from Supabase. */
export async function loadBrand(client: SupabaseClient, brandId?: string): Promise<any> {
  const id = brandId || DEFAULT_BRAND_ID
  const base = BRAND_BASES[id]
  if (!base) {
    throw new Error(`Unknown brand "${id}". Canonized brands: ${Object.keys(BRAND_BASES).join(', ')}.`)
  }
  const { data } = await client.from('brand_registry').select('overlay').eq('brand_id', id).maybeSingle()
  const { doc, errors, dropped } = resolveBrand(base, (data?.overlay as any) || {})
  return { doc, errors, dropped, hasOverlay: !!data }
}

export interface BrandSummary {
  id: string; name: string; status: string
  readiness: any; layers: any[]; matrix: any[]; voice: any
  errors: string[]; hasOverlay: boolean
}

/** Everything Claude Code needs to reason about a brand in one payload. */
export async function getBrand(client: SupabaseClient, brandId?: string, lang?: string): Promise<BrandSummary> {
  const { doc, errors, hasOverlay } = await loadBrand(client, brandId)
  const r = readiness(doc)
  return {
    id: doc.id, name: doc.name, status: doc.status,
    readiness: { overall: r.overall, done: r.done, total: r.total, next: r.next },
    layers: LAYERS.map((l: any) => ({ n: l.n, id: l.id, label: l.label, lane: l.lane, ...r.layers[l.id] })),
    matrix: matrix(doc).map((row: any) => ({
      platform: row.platformId,
      cells: Object.fromEntries(Object.entries(row.cells).map(([k, v]: any) => [k, `${v.state}${v.note ? ` — ${v.note}` : ''}`])),
    })),
    voice: voiceBlock(doc, { lang }),
    errors,
    hasOverlay,
  }
}

/** List the canonized brands (cheap — no DB round-trip). */
export const listBrands = () =>
  Object.values(BRAND_BASES).map((b: any) => ({ id: b.id, name: b.name, status: b.status }))

/**
 * Patch a brand's founder-lane overlay. `patch` is a partial BrandDoc; every
 * leaf is checked against the lane rule before anything is written, so an
 * attempt to change a mark or a palette here fails loudly with the reason
 * rather than silently landing in a table git will overrule.
 */
export async function updateBrand(client: SupabaseClient, brandId: string, patch: Record<string, unknown>): Promise<{ id: string; changed: string[] }> {
  const id = brandId || DEFAULT_BRAND_ID
  if (!BRAND_BASES[id]) throw new Error(`Unknown brand "${id}".`)
  const illegal = illegalOverlayPaths(patch)
  if (illegal.length) {
    // Fail, don't drop: an agent asking to change a logo through the text door
    // has misunderstood something, and silently ignoring half the request would
    // be worse than refusing it.
    assertEditable(illegal[0], 'founder')
  }
  const { data } = await client.from('brand_registry').select('overlay').eq('brand_id', id).maybeSingle()
  const next = deepMerge((data?.overlay as any) || {}, patch)
  const { error } = await client.from('brand_registry').upsert({ brand_id: id, overlay: next }, { onConflict: 'brand_id' })
  if (error) throw new Error(`Brand update failed: ${error.message}`)
  return { id, changed: illegalOverlayPaths(patch).length ? [] : Object.keys(patch) }
}

export interface DraftOptions {
  format?: string; palette?: string; platform?: string; withImages?: boolean
  /** Which brand writes this post. Its persona, pillars, CTAs, hashtag banks and
   *  art direction are injected into generation, so the copy sounds like the
   *  brand and the slide backgrounds look like it. */
  brand?: string
  /** Language for the copy — the brand must declare it (bilingual EN/ID). */
  lang?: string
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
export async function createDraft(env: Env, client: SupabaseClient, brief: string, opts: DraftOptions = {}): Promise<{ id: string; slides: number; images: number; brand?: string }> {
  const withImages = opts.withImages !== false
  const format = opts.format || 'portrait'
  const platform = opts.platform || 'instagram'

  // 0) the brand this post speaks as. Resolved here (the MCP owns the DB
  //    credentials) and handed to the Worker as a compact voice block — the
  //    Worker stays a stateless generator that knows no brands.
  let brandDoc: any = null
  let voice: any = null
  if (opts.brand) {
    const loaded = await loadBrand(client, opts.brand)
    brandDoc = loaded.doc
    voice = voiceBlock(brandDoc, { lang: opts.lang, platform })
    if (opts.lang && !(brandDoc.voice?.languages || []).includes(opts.lang)) {
      throw new Error(
        `"${brandDoc.name}" doesn't declare the language "${opts.lang}" (it has: ${(brandDoc.voice?.languages || ['en']).join(', ')}). ` +
        `Add it in Brand Forge before writing copy in it — generating in an undeclared language would invent a voice nobody approved.`,
      )
    }
  }

  // 1) copy
  const copyRes = await callWorker(env, {
    kind: 'copy', brief,
    context: { format, palette: opts.palette, platform, wantImages: withImages, brand: voice },
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
        const img = await callWorker(env, {
          kind: 'image', prompt: slide.imagePrompt, format,
          // The brand's art direction (its distilled L0.5 knowledge base) rides
          // along, so backgrounds look like the brand rather than like generic
          // stock photography.
          context: { palette: opts.palette, artDirection: brandDoc?.kb?.artDirection || undefined },
        })
        if (img && img.imageBase64) {
          const url = await uploadImage(client, env, img.imageBase64, { width: img.width, height: img.height, mime: img.mime })
          if (url) { slide.imageUrl = url; images++ }
        }
      } catch { /* one image failing never blocks the draft */ }
    }
  }

  // 3) persist the draft (+ publish intents, if any — never acted on here)
  //
  // The brand rides INSIDE the copy blob rather than in its own column: `copy`
  // is our own jsonb, so this needs no migration, and HQ's openDraft reads it
  // back to set doc.brandId. Without it a draft written as ArgantaLab would
  // render under whatever brand the studio happened to be showing — i.e. the
  // wrong logo, which is the exact bug BF-3 just closed.
  if (opts.brand) copy.brandId = opts.brand
  const { data, error } = await client.from('content_draft').insert({
    brief, status: 'ready', copy, format,
    palette: copy.palette || opts.palette, platform,
    provenance: copyRes.provenance,
    publish_to: opts.publishTo || [],
  }).select('id').single()
  if (error) throw new Error(`Draft write failed: ${error.message}`)
  return { id: data.id as string, slides: copy.slides.length, images, brand: opts.brand }
}

// ── M4: composed drafts (the verbatim channel) ────────────────
// createDraft turns a BRIEF into a design (the model picks templates, HQ coerces
// them). createComposedDraft is the opposite direction: the design already
// exists — a PostDoc filled from a style recipe the founder saved — and must
// reach the canvas untouched. HQ's openDraft honours copy.docJson by skipping
// coercePost entirely, so anything this function writes is what the founder sees.
//
// The doc rides inside `copy` (our own jsonb) exactly like brandId does, so this
// needs no migration. `copy.slides` is still populated with a plain summary,
// because the inbox list and content_status read it for slide counts.

export interface ComposedDraftOptions {
  brand?: string
  platform?: string
  publishTo?: DraftOptions['publishTo']
  /** Per-slide image briefs, positionally zipped onto the doc's slides. A slide
   *  whose entry is empty keeps whatever its doc already had. */
  imagePrompts?: (string | undefined)[]
}

/** Read a slide's headline/body back out of a composed PostDoc for the summary. */
function summarizeSlide(s: any): { template: string; headline?: string; body?: string; imageUrl?: string } {
  const text = (names: string[]) => s.layers?.find((l: any) => l.type === 'text' && names.includes(l.name))?.text
  const bg = s.layers?.find((l: any) => l.type === 'image' && l.mode === 'bg')
  return {
    template: s.template || 'custom',
    headline: text(['Headline', 'Title', 'Quote', 'Number']),
    body: text(['Body', 'Subline', 'Items']),
    imageUrl: bg?.url,
  }
}

/** Place a generated image as a slide's background, matching the engine's own
 *  bg-layer shape (one bg per slide — replace, never stack). */
function setDocSlideBg(slide: any, url: string) {
  const old = slide.layers?.find((l: any) => l.type === 'image' && l.mode === 'bg')
  if (old) { old.url = url; return }
  slide.layers = slide.layers || []
  slide.layers.unshift({
    id: 'im_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    type: 'image', name: 'Arganta Core', url, mode: 'bg',
    xN: 0.5, yN: 0.5, wN: 1, hN: 1, radius: 0, dim: 0.5, opacity: 1,
  })
}

export async function createComposedDraft(
  env: Env, client: SupabaseClient, brief: string, doc: any, opts: ComposedDraftOptions = {},
): Promise<{ id: string; slides: number; images: number }> {
  if (!doc || doc.v !== 1 || !Array.isArray(doc.slides) || doc.slides.length === 0) {
    throw new Error('doc must be a v1 PostDoc with at least one slide (build it with fillStyle from a saved style recipe).')
  }
  if (doc.slides.length > 10) {
    throw new Error(`A carousel can hold at most 10 slides (got ${doc.slides.length}) — Instagram rejects more.`)
  }

  // Fail loudly on unfilled slots. Shipping a literal "{title}" to the inbox
  // would look like a working draft and read as a bug on the founder's canvas.
  const leftover = JSON.stringify(doc).match(/\{(title|body|source|image|pill\d+)\}/g)
  if (leftover) {
    throw new Error(`The doc still has unfilled slots: ${[...new Set(leftover)].join(', ')}. Fill every slot (or drop the layer) before sending it.`)
  }

  const brandDoc = opts.brand ? (await loadBrand(client, opts.brand)).doc : null
  if (opts.brand) doc.brandId = opts.brand

  // images — best-effort per slide, same contract as createDraft
  let images = 0
  if (opts.imagePrompts?.length) {
    for (let i = 0; i < doc.slides.length; i++) {
      const prompt = opts.imagePrompts[i]
      if (!prompt) continue
      try {
        const img = await callWorker(env, {
          kind: 'image', prompt, format: doc.format || 'portrait',
          context: { palette: doc.palette, artDirection: brandDoc?.kb?.artDirection || undefined },
        })
        if (img?.imageBase64) {
          const url = await uploadImage(client, env, img.imageBase64, { width: img.width, height: img.height, mime: img.mime })
          if (url) { setDocSlideBg(doc.slides[i], url); images++ }
        }
      } catch { /* one image failing never blocks the draft */ }
    }
  }

  const copy = {
    docJson: doc,
    brandId: opts.brand,
    palette: doc.palette,
    slides: doc.slides.map(summarizeSlide),
    caption: doc.caption || '',
    hashtags: doc.hashtags || '',
  }
  const { data, error } = await client.from('content_draft').insert({
    brief, status: 'ready', copy,
    format: doc.format, palette: doc.palette, platform: opts.platform || 'instagram',
    provenance: { provider: 'style-recipe', model: 'composed', latencyMs: 0, neurons: 0, estimated: false },
    publish_to: opts.publishTo || [],
  }).select('id').single()
  if (error) throw new Error(`Draft write failed: ${error.message}`)
  return { id: data.id as string, slides: doc.slides.length, images }
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
