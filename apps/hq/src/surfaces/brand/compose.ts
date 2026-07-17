/**
 * COMPOSE — the Brand Kit's asset renderer.
 *
 * Every non-mark asset the Fitting Room shows (a LinkedIn banner, a YouTube
 * channel header, an OG card, the splash sequence) is COMPOSED HERE, from the
 * registry, by one function — and the very same function produces the PNG the
 * [PNG] button hands you. The mirror is not a preview of the asset; it IS the
 * asset, drawn at preview scale (Law 03 — the demo is real; Law 06 — one
 * source, two renderers).
 *
 * Composition obeys Law 16: dark ground, one lit subject, vast calm negative
 * space. No stock, no neon wash, no gradient soup.
 *
 * A note on safe areas: composeAsset never draws the safe-area guide. The guide
 * is an INSTRUMENT (drawn in DOM, over the canvas) — baking it into the pixels
 * would ship a channel banner with a diagnostic rectangle across it. It lays
 * content *inside* the safe box; it never advertises where the box is.
 */
import { drawMark, variantForSize } from '@arganta/brand'

export type ComposeKind = 'banner' | 'og' | 'splash' | 'post' | 'story' | 'feature'

export interface Box { x: number; y: number; w: number; h: number }

/** #rrggbb → rgba(). Canvas gradients need explicit alpha stops; the string
 *  'transparent' is not a valid colour stop everywhere. */
export function hexA(hex: string, a: number): string {
  if (!hex || !hex.startsWith('#')) return `rgba(136,136,136,${a})`
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6)
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

const pal = (doc: any) => doc?.identity?.palette || {}

/** The ground every composed asset stands on: the brand's own bg, lit once from
 *  behind the subject. `cx/cy` are 0..1 — where the light sits. */
export function drawGround(ctx: CanvasRenderingContext2D, doc: any, w: number, h: number, cx = 0.5, cy = 0.45) {
  const p = pal(doc)
  ctx.fillStyle = p.bg || '#0A0D14'
  ctx.fillRect(0, 0, w, h)
  const accent = p.accent || '#888888'
  const g = ctx.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, Math.max(w, h) * 0.62)
  g.addColorStop(0, hexA(accent, 0.20))
  g.addColorStop(0.55, hexA(accent, 0.05))
  g.addColorStop(1, hexA(accent, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function markAt(ctx: CanvasRenderingContext2D, doc: any, x: number, y: number, size: number) {
  const mark = doc?.identity?.mark
  if (!mark) return false
  drawMark(ctx, mark, x, y, size, variantForSize(mark, size))
  return true
}

/** The dashed "no mark yet" frame, in pixels — the canvas twin of
 *  .bs-mark-pending. A composed asset for a brand with no mark must look
 *  unfinished, not quietly ship a blank square (Law 02 / Law 04). */
function markGap(ctx: CanvasRenderingContext2D, doc: any, x: number, y: number, size: number) {
  const p = pal(doc)
  ctx.save()
  ctx.strokeStyle = hexA(p.accent || '#888', 0.5)
  ctx.setLineDash([size * 0.06, size * 0.05])
  ctx.lineWidth = Math.max(1.5, size * 0.015)
  ctx.strokeRect(x, y, size, size)
  ctx.setLineDash([])
  ctx.fillStyle = hexA(p.accent || '#888', 0.85)
  ctx.font = `600 ${Math.round(size * 0.13)}px ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('MARK · P0', x + size / 2, y + size / 2)
  ctx.restore()
}

/** Wrap text to a width, returning the lines actually drawn. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 3): string[] {
  const words = String(text).split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? line + ' ' + word : word
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) return lines
    } else line = next
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

const tagline = (doc: any) => doc?.voice?.taglines?.en || null

/**
 * One asset, composed. `safe` constrains the layout to a box (YouTube's
 * 1546×423) without ever drawing it.
 *
 * @param t 0..1 — animation position, only meaningful for 'splash'.
 */
export function composeAsset(
  ctx: CanvasRenderingContext2D, doc: any, w: number, h: number,
  kind: ComposeKind, opts: { safe?: Box; t?: number } = {},
) {
  const p = pal(doc)
  const ink = p.ink || '#F8FAFF'
  const soft = p.soft || '#9AA8BF'

  if (kind === 'splash') {
    // The launch sequence, as a still at time t: ground holds, the mark arrives.
    // Same grammar as the cockpit's own ignition (Law 11) — announce once, then
    // get out of the way — which is why the brand system's splash and Brand
    // Studio's ignition are visibly the same gesture.
    const t = Math.max(0, Math.min(1, opts.t ?? 1))
    const ease = 1 - Math.pow(1 - t, 3)
    drawGround(ctx, doc, w, h, 0.5, 0.44)
    const size = Math.min(w, h) * 0.30
    const scale = 0.86 + ease * 0.14
    const s = size * scale
    ctx.save()
    ctx.globalAlpha = Math.min(1, ease * 1.4)
    if (!markAt(ctx, doc, (w - s) / 2, h * 0.44 - s / 2, s)) markGap(ctx, doc, (w - s) / 2, h * 0.44 - s / 2, s)
    ctx.restore()
    const tl = tagline(doc)
    if (tl && ease > 0.55) {
      ctx.save()
      ctx.globalAlpha = (ease - 0.55) / 0.45
      ctx.fillStyle = soft
      ctx.font = `500 ${Math.round(Math.min(w, h) * 0.036)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(tl, w / 2, h * 0.44 + size * 0.78)
      ctx.restore()
    }
    return
  }

  const box: Box = opts.safe || { x: 0, y: 0, w, h }
  const short = Math.min(box.w, box.h)

  if (kind === 'og' || kind === 'feature') {
    // A share card is read at thumbnail size in a feed — the mark and the name
    // carry it; the tagline is a bonus, never the message.
    drawGround(ctx, doc, w, h, 0.5, 0.42)
    const size = short * (kind === 'feature' ? 0.42 : 0.30)
    const cx = box.x + box.w / 2
    const top = box.y + box.h * 0.5 - size * 0.78
    if (!markAt(ctx, doc, cx - size / 2, top, size)) markGap(ctx, doc, cx - size / 2, top, size)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = ink
    ctx.font = `700 ${Math.round(short * 0.105)}px system-ui, -apple-system, sans-serif`
    ctx.fillText(doc?.name || '', cx, top + size + short * 0.055)
    const tl = tagline(doc)
    if (tl) {
      ctx.fillStyle = soft
      ctx.font = `500 ${Math.round(short * 0.05)}px system-ui, sans-serif`
      ctx.fillText(tl, cx, top + size + short * 0.185)
    }
    return
  }

  if (kind === 'post' || kind === 'story') {
    drawGround(ctx, doc, w, h, 0.5, 0.4)
    const size = Math.min(w, h) * 0.26
    if (!markAt(ctx, doc, (w - size) / 2, h * 0.34 - size / 2, size)) markGap(ctx, doc, (w - size) / 2, h * 0.34 - size / 2, size)
    const tl = tagline(doc) || doc?.name || ''
    ctx.textAlign = 'center'
    ctx.fillStyle = ink
    ctx.font = `700 ${Math.round(w * 0.075)}px system-ui, sans-serif`
    ctx.textBaseline = 'top'
    let y = h * 0.34 + size * 0.72
    for (const line of wrap(ctx, tl, w * 0.78, 3)) { ctx.fillText(line, w / 2, y); y += w * 0.092 }
    return
  }

  // 'banner' — a wide lockup: mark left, name + tagline beside it. Everything
  // inside `safe` when a platform crops (YouTube's per-device crop is brutal).
  drawGround(ctx, doc, w, h, 0.42, 0.5)
  const size = Math.min(box.h * 0.52, box.w * 0.14)
  const mx = box.x + box.w * 0.5 - (size + box.w * 0.34) / 2
  const my = box.y + box.h / 2 - size / 2
  if (!markAt(ctx, doc, mx, my, size)) markGap(ctx, doc, mx, my, size)
  const tx = mx + size + size * 0.42
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = ink
  ctx.font = `700 ${Math.round(size * 0.42)}px system-ui, -apple-system, sans-serif`
  const tl = tagline(doc)
  ctx.fillText(doc?.name || '', tx, my + size * (tl ? 0.5 : 0.62))
  if (tl) {
    ctx.fillStyle = soft
    ctx.font = `500 ${Math.round(size * 0.2)}px system-ui, sans-serif`
    ctx.fillText(tl, tx, my + size * 0.78)
  }
}

// ── Export ────────────────────────────────────────────────────
/** Which composition a kit asset wants. Mirrors kit.js ids. */
export function composeKindFor(assetId: string): ComposeKind {
  if (assetId === 'og') return 'og'
  if (assetId === 'feature') return 'feature'
  if (assetId === 'sequence') return 'splash'
  if (assetId === 'story' || assetId === 'video' || assetId === 'screenshot') return 'story'
  if (assetId === 'post' || assetId === 'square' || assetId === 'thumbnail') return 'post'
  return 'banner'
}

/**
 * Render one kit asset at its EXACT spec size and hand back a PNG blob.
 *
 * Opaque by default: the App Store rejects an icon with an alpha channel, and
 * Google Play requires 32-bit opaque for the listing. `asset.transparent` opts
 * out for the two assets that genuinely need alpha — the Android adaptive
 * foreground layer (it composites over its own background layer) and favicons.
 */
export async function exportAsset(doc: any, asset: any): Promise<Blob> {
  const cv = document.createElement('canvas')
  cv.width = asset.w
  cv.height = asset.h
  const ctx = cv.getContext('2d')!
  if (asset.kind === 'mark') {
    if (!asset.transparent) {
      ctx.fillStyle = pal(doc).bg || '#0A0D14'
      ctx.fillRect(0, 0, asset.w, asset.h)
    }
    const size = Math.min(asset.w, asset.h) * (asset.transparent ? 0.86 : 0.62)
    const x = (asset.w - size) / 2, y = (asset.h - size) / 2
    if (!markAt(ctx, doc, x, y, size)) markGap(ctx, doc, x, y, size)
  } else {
    composeAsset(ctx, doc, asset.w, asset.h, composeKindFor(asset.id), { safe: asset.safe ? centredSafe(asset) : undefined, t: 1 })
  }
  return new Promise((resolve, reject) =>
    cv.toBlob(b => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))), 'image/png'))
}

/** A platform's safe box, centred in the full asset (YouTube's 1546×423 sits
 *  dead centre of the 2560×1440 upload). */
export function centredSafe(asset: { w: number; h: number; safe?: { w: number; h: number } }): Box | undefined {
  if (!asset.safe) return undefined
  return { x: (asset.w - asset.safe.w) / 2, y: (asset.h - asset.safe.h) / 2, w: asset.safe.w, h: asset.safe.h }
}

/**
 * Copy text, honestly. The async clipboard API rejects with NotAllowedError
 * without user activation or document focus, and the caller MUST know: a COPY
 * button that fails silently is worse than no button, because you walk away
 * believing you have the bio on your clipboard. Falls back to the legacy
 * execCommand path (no permission needed), and returns false if both fail so
 * the surface can say so.
 */
export async function copyPlainText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch { return false }
}

/**
 * Put a blob on the clipboard, falling back to a download.
 *
 * Clipboard image write is Chromium-only and needs a secure context; Firefox
 * and Safari will throw. The fallback is not a degradation — for a 1024×1024
 * app icon a file is what you actually wanted anyway.
 */
export async function copyOrDownload(blob: Blob, filename: string): Promise<'copied' | 'downloaded'> {
  try {
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'copied'
    }
  } catch { /* fall through — a download always works */ }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
