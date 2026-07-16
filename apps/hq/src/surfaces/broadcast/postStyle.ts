/**
 * POST STYLE RECIPE — a design you drew by hand, minus the words.
 *
 * A recipe is a PostDoc with the CONTENT lifted out and replaced by slot tokens
 * ({title}, {body}, {pill1}, {image}…) while every styling decision survives
 * byte-for-byte: format, palette, brand, per-slide template + background, and
 * each layer's position, size, font, weight, color role, highlight, dim, radius.
 *
 * Why not just reuse a template? Templates are code — nine fixed layouts that
 * stamp their own numbers. A recipe is DATA captured from a slide you actually
 * composed, so "make 20 more like this one" reproduces your pixels rather than
 * approximating them with the nearest template.
 *
 * The contract both ends rely on:
 *  · extractStyle(doc) → recipe   (Post Studio's "Save style")
 *  · fillStyle(recipe, rows) → doc (the post-batch skill, one row per slide)
 *  · applyStyle(recipe, doc) → doc (pour a recipe over what's on the canvas)
 * fillStyle is PURE and dependency-free on purpose: Claude Code runs it in a
 * script to emit drafts, and HQ runs it in the browser — same function, same
 * pixels, no divergence between batch and manual.
 */
import type { PostDoc, PostSlide, PostLayer, SlideBg } from './postEngine'
import { pid } from './postEngine'
import { TITLE_NAMES, BODY_NAMES, HANDLE_NAME } from './compose'

export const STYLE_STORE_KEY = 'hq_post_styles_v1'

// ── slot vocabulary ───────────────────────────────────────────
export const SLOT_TITLE = '{title}'
export const SLOT_BODY = '{body}'
export const SLOT_SOURCE = '{source}'
export const SLOT_IMAGE = '{image}'
export const slotPill = (i: number) => `{pill${i + 1}}`

/** One row of content poured into a recipe slide. */
export interface ContentRow {
  title?: string
  body?: string
  source?: string
  /** URL of a background image, or a prompt the caller resolved to one already. */
  image?: string
  pills?: string[]
}

export interface PostStyleRecipe {
  v: 1
  id: string
  name: string
  createdAt: string
  format: string
  palette: string
  brandId?: string
  /** B1 — the design's global font. A recipe that dropped this would reproduce
   *  every position and size faithfully and then render in the wrong typeface,
   *  which is the one thing a "reproduce my design" feature may not do. */
  fontId?: string
  /** Slot-bearing skeletons, in order. slides.length is the recipe's slide count. */
  slides: PostSlide[]
  /** Captions are content, but the SHAPE of a caption is style — kept as a
   *  slot-bearing template so batch runs inherit your hook/CTA rhythm. */
  caption: string
  hashtags: string
}

// ── extract ───────────────────────────────────────────────────
/** Which slot (if any) a text layer's words belong in. */
function textSlot(name: string): string | null {
  if (TITLE_NAMES.includes(name)) return SLOT_TITLE
  if (BODY_NAMES.includes(name)) return SLOT_BODY
  if (name === 'Source' || name === 'Author') return SLOT_SOURCE
  return null // decorative (the quote mark, a kicker, the handle) — keep literal
}

function stripLayer(l: PostLayer, pillIndex: { n: number }): PostLayer {
  const c: any = JSON.parse(JSON.stringify(l))
  if (c.type === 'text') {
    // The handle is brand-lane text, not per-post content: it must survive a
    // batch run verbatim, so it is never slotted.
    if (c.name !== HANDLE_NAME) {
      const slot = textSlot(c.name)
      if (slot) c.text = slot
    }
  } else if (c.type === 'image') {
    if (c.mode === 'bg') c.url = SLOT_IMAGE
  } else if (c.type === 'badge') {
    c.text = slotPill(pillIndex.n++)
  }
  return c as PostLayer
}

export function extractStyle(doc: PostDoc, name: string): PostStyleRecipe {
  return {
    v: 1,
    id: pid('sty'),
    name: name.trim() || 'Untitled style',
    createdAt: new Date().toISOString(),
    format: doc.format,
    palette: doc.palette,
    brandId: doc.brandId,
    fontId: doc.fontId,
    slides: doc.slides.map(s => {
      const pillIndex = { n: 0 }
      return {
        id: pid('sl'),
        template: s.template,
        bg: JSON.parse(JSON.stringify(s.bg)) as SlideBg,
        layers: s.layers.map(l => stripLayer(l, pillIndex)),
      }
    }),
    caption: doc.caption,
    hashtags: doc.hashtags,
  }
}

// ── fill ──────────────────────────────────────────────────────
/** Substitute every slot in one layer from a row. Returns null to DROP the
 *  layer — an unfilled slot must never ship as a literal "{title}" on a post. */
function fillLayer(l: PostLayer, row: ContentRow): PostLayer | null {
  const c: any = JSON.parse(JSON.stringify(l))
  c.id = pid(c.type.slice(0, 2))
  if (c.type === 'text') {
    if (c.text === SLOT_TITLE) { if (!row.title?.trim()) return null; c.text = row.title }
    else if (c.text === SLOT_BODY) { if (!row.body?.trim()) return null; c.text = row.body }
    else if (c.text === SLOT_SOURCE) { if (!row.source?.trim()) return null; c.text = row.source }
  } else if (c.type === 'image' && c.url === SLOT_IMAGE) {
    // No image for this row → drop the layer so the slide falls back to its
    // designed background rather than rendering a broken/blank picture.
    if (!row.image) return null
    c.url = row.image
  } else if (c.type === 'badge') {
    const m = /^\{pill(\d+)\}$/.exec(c.text)
    if (m) {
      const v = (row.pills || [])[+m[1] - 1]
      if (!v?.trim()) return null
      c.text = v
    }
  }
  return c as PostLayer
}

/** Pour rows into a recipe — one row per slide, in order. Extra rows are
 *  ignored; missing rows leave that slide's slots unfilled (layers dropped). */
export function fillStyle(recipe: PostStyleRecipe, rows: ContentRow[], meta?: { caption?: string; hashtags?: string; alt?: string; brand?: { name: string; handle: string } }): PostDoc {
  return {
    v: 1,
    format: recipe.format,
    palette: recipe.palette,
    brandId: recipe.brandId,
    fontId: recipe.fontId,
    slides: recipe.slides.map((s, i) => ({
      id: pid('sl'),
      template: s.template,
      bg: JSON.parse(JSON.stringify(s.bg)) as SlideBg,
      imagePrompt: s.imagePrompt,
      layers: s.layers.map(l => fillLayer(l, rows[i] || {})).filter((l): l is PostLayer => l !== null),
    })),
    caption: meta?.caption ?? recipe.caption,
    hashtags: meta?.hashtags ?? recipe.hashtags,
    alt: meta?.alt,
    brand: meta?.brand || { name: '', handle: '' },
  }
}

// ── apply over the live canvas ────────────────────────────────
/** Read the content currently on a slide, in recipe terms. */
export function rowFromSlide(s: PostSlide): ContentRow {
  const t = s.layers.find(l => l.type === 'text' && TITLE_NAMES.includes(l.name)) as any
  const b = s.layers.find(l => l.type === 'text' && BODY_NAMES.includes(l.name)) as any
  const src = s.layers.find(l => l.type === 'text' && (l.name === 'Source' || l.name === 'Author')) as any
  const bg = s.layers.find(l => l.type === 'image' && (l as any).mode === 'bg') as any
  return {
    title: t?.text, body: b?.text, source: src?.text, image: bg?.url,
    pills: s.layers.filter(l => l.type === 'badge').map(l => (l as any).text),
  }
}

/** Re-cut the current doc to a recipe, keeping its words. The doc's own slide
 *  count wins when it has MORE slides than the recipe: a 3-slide style applied
 *  to a 5-slide carousel cycles the style's slides rather than deleting your
 *  content (the last recipe slide — usually a CTA — is reserved for the end). */
export function applyStyle(recipe: PostStyleRecipe, doc: PostDoc): PostDoc {
  const rows = doc.slides.map(rowFromSlide)
  const n = Math.max(doc.slides.length, 1)
  const R = recipe.slides.length
  const pick = (i: number): PostSlide => {
    if (R === 0) return recipe.slides[0]
    if (i === n - 1) return recipe.slides[R - 1]          // end card stays the end card
    if (i < R - 1) return recipe.slides[i]                 // 1:1 while the style has slides
    const mid = R > 2 ? recipe.slides.slice(1, R - 1) : [recipe.slides[0]]
    return mid[(i - 1) % mid.length]                       // then cycle the middles
  }
  const next = fillStyle(recipe, [], { caption: doc.caption, hashtags: doc.hashtags, alt: doc.alt, brand: doc.brand })
  next.slides = Array.from({ length: n }, (_, i) => {
    const proto = pick(i)
    return {
      id: pid('sl'),
      template: proto.template,
      bg: JSON.parse(JSON.stringify(proto.bg)) as SlideBg,
      layers: proto.layers.map(l => fillLayer(l, rows[i] || {})).filter((l): l is PostLayer => l !== null),
    }
  })
  return next
}

// ── the saved-styles shelf (localStorage; Supabase can back this later) ──
export function listStyles(): PostStyleRecipe[] {
  try {
    const raw = localStorage.getItem(STYLE_STORE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter(s => s && s.v === 1) : []
  } catch { return [] }
}
export function saveStyle(r: PostStyleRecipe): PostStyleRecipe[] {
  const next = [r, ...listStyles().filter(s => s.id !== r.id)].slice(0, 30)
  try { localStorage.setItem(STYLE_STORE_KEY, JSON.stringify(next)) } catch { /* quota */ }
  return next
}
export function deleteStyle(id: string): PostStyleRecipe[] {
  const next = listStyles().filter(s => s.id !== id)
  try { localStorage.setItem(STYLE_STORE_KEY, JSON.stringify(next)) } catch { /* quota */ }
  return next
}
/** Accept a recipe pasted back from Claude/a file. Throws on anything unusable. */
export function parseStyle(json: string): PostStyleRecipe {
  const r = JSON.parse(json)
  if (!r || r.v !== 1 || !Array.isArray(r.slides) || !r.slides.length) throw new Error('Not a v1 style recipe.')
  if (!r.id) r.id = pid('sty')
  if (!r.name) r.name = 'Imported style'
  if (!r.createdAt) r.createdAt = new Date().toISOString()
  return r as PostStyleRecipe
}
