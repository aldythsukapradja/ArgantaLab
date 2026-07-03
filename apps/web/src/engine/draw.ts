// ============================================================
//  DRAW — procedural sprites + the art seam.
//  Everything renders through art(); when pixel-art skin packs land,
//  the resolver checks a loaded atlas first and falls back to these
//  procedural draws, so games get prettier without engine changes.
// ============================================================

import type { HeroSpec, SidekickSpec } from './types'

type Ctx = CanvasRenderingContext2D

// ── Art seam ──────────────────────────────────────────────────
type AtlasHook = (ctx: Ctx, id: string, x: number, y: number, size: number, frame: number) => boolean
let atlasHook: AtlasHook | null = null
/** Future skin packs install a hook; returns true when it drew the sprite. */
export function installAtlas(hook: AtlasHook) { atlasHook = hook }
export function art(ctx: Ctx, id: string, x: number, y: number, size: number, frame: number, fallback: () => void) {
  if (atlasHook && atlasHook(ctx, id, x, y, size, frame)) return
  fallback()
}

// ── Small helpers ─────────────────────────────────────────────
export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.closePath()
}
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color); g.addColorStop(1, 'transparent')
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore()
}
export function txt(ctx: Ctx, s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', weight = 800) {
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px 'Segoe UI', system-ui, sans-serif`
  ctx.textAlign = align; ctx.textBaseline = 'middle'
  ctx.fillText(s, x, y)
}
export function emoji(ctx: Ctx, e: string, x: number, y: number, size: number) {
  ctx.font = `${size}px 'Segoe UI Emoji', system-ui`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(e, x, y)
}
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, v + amt))
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`
}

// ── The Hero — the kid's REAL Buddy avatar ────────────────────
// When the spec carries the serialized Buddy SVG (outfit and all), we
// rasterize it once and draw that; the chibi below is only a fallback
// for legacy games saved without an svg. `frame` drives a gentle bob;
// `facing` flips horizontally.
export interface HeroLook { a: string; b: string; skin: string; style: string; accessory: string; initial: string; svg?: string }

const buddyCache = new Map<string, HTMLImageElement>()
function buddyImage(svg: string): HTMLImageElement {
  let img = buddyCache.get(svg)
  if (!img) {
    // React-serialized SVG omits xmlns; data-URL images refuse to decode without it.
    const src = svg.includes('xmlns') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    img = new Image()
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(src)
    buddyCache.set(svg, img)
  }
  return img
}

export function drawHero(ctx: Ctx, x: number, y: number, size: number, look: HeroLook, frame = 0, facing = 1) {
  if (look.svg) {
    const img = buddyImage(look.svg)
    if (img.complete && img.naturalWidth > 0) {
      const bob = Math.sin(frame * 0.12) * size * 0.03
      const s = size * 1.15 // buddy art breathes inside its viewBox
      ctx.save()
      ctx.translate(x, y + bob)
      if (facing < 0) ctx.scale(-1, 1)
      ctx.drawImage(img, -s / 2, -s / 2, s, s)
      ctx.restore()
      return
    }
    // not decoded yet — fall through to the chibi for a frame or two
  }
  art(ctx, `hero.${look.style}`, x, y, size, frame, () => {
    const s = size / 32 // design grid 32
    const bob = Math.sin(frame * 0.35) * 1.5 * s
    ctx.save()
    ctx.translate(x, y + bob)
    if (facing < 0) ctx.scale(-1, 1)

    // aura (legendary accessory) behind everything
    if (look.accessory === 'aura') glow(ctx, 0, -2 * s, 22 * s, '#fde68a', 0.55)

    // feet
    ctx.fillStyle = shade(look.b, -30)
    const step = Math.sin(frame * 0.35) * 2 * s
    rr(ctx, -7 * s, 10 * s + step * 0.4, 6 * s, 4 * s, 2 * s); ctx.fill()
    rr(ctx, 1 * s, 10 * s - step * 0.4, 6 * s, 4 * s, 2 * s); ctx.fill()

    // body capsule
    const grad = ctx.createLinearGradient(0, -4 * s, 0, 12 * s)
    grad.addColorStop(0, look.a); grad.addColorStop(1, look.b)
    ctx.fillStyle = grad
    rr(ctx, -8 * s, -4 * s, 16 * s, 16 * s, 7 * s); ctx.fill()

    // style flourishes on the body
    if (look.style === 'shadow') { ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, -8 * s, -4 * s, 16 * s, 8 * s, 7 * s); ctx.fill() }
    if (look.style === 'royal') { ctx.fillStyle = shade(look.a, 60); rr(ctx, -9 * s, -3 * s, 4 * s, 14 * s, 2 * s); ctx.fill() } // cape edge
    if (look.style === 'neon') { ctx.strokeStyle = look.a; ctx.lineWidth = 1.6 * s; ctx.shadowColor = look.a; ctx.shadowBlur = 6 * s; rr(ctx, -8 * s, -4 * s, 16 * s, 16 * s, 7 * s); ctx.stroke(); ctx.shadowBlur = 0 }
    if (look.style === 'cosmic') {
      ctx.fillStyle = 'rgba(255,255,255,.8)'
      for (let i = 0; i < 5; i++) { const a = i * 2.4 + 1; ctx.fillRect((Math.sin(a) * 5) * s, (2 + Math.cos(a * 1.7) * 5) * s, 1.4 * s, 1.4 * s) }
    }
    if (look.style === 'golden') { ctx.fillStyle = 'rgba(255,235,150,.45)'; rr(ctx, -8 * s, -4 * s, 16 * s, 16 * s, 7 * s); ctx.fill() }

    // head
    ctx.fillStyle = look.skin
    ctx.beginPath(); ctx.arc(0, -12 * s, 9 * s, 0, Math.PI * 2); ctx.fill()
    // hair/hood hint in costume color
    ctx.fillStyle = look.style === 'shadow' ? shade(look.b, -40) : look.b
    ctx.beginPath(); ctx.arc(0, -13.5 * s, 9 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.fill()

    // face
    ctx.fillStyle = '#1e293b'
    ctx.beginPath(); ctx.arc(-3 * s, -12 * s, 1.3 * s, 0, Math.PI * 2); ctx.arc(3 * s, -12 * s, 1.3 * s, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.1 * s
    ctx.beginPath(); ctx.arc(0, -10.5 * s, 2.6 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()

    // initial badge on the chest — it's YOU
    ctx.fillStyle = 'rgba(255,255,255,.92)'
    ctx.beginPath(); ctx.arc(0, 3 * s, 4.2 * s, 0, Math.PI * 2); ctx.fill()
    txt(ctx, look.initial, 0, 3.4 * s, 5.5 * s, shade(look.b, -40))

    // accessories on top
    if (look.accessory === 'cap') { ctx.fillStyle = look.a; rr(ctx, -8 * s, -22 * s, 16 * s, 6 * s, 3 * s); ctx.fill(); rr(ctx, 2 * s, -19 * s, 10 * s, 3 * s, 1.5 * s); ctx.fill() }
    if (look.accessory === 'scarf') { ctx.fillStyle = shade(look.a, 40); rr(ctx, -8 * s, -5 * s, 16 * s, 4 * s, 2 * s); ctx.fill(); rr(ctx, 3 * s, -4 * s, 4 * s, 9 * s, 2 * s); ctx.fill() }
    if (look.accessory === 'halo') { ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(0, -24 * s, 7 * s, 2.4 * s, 0, 0, Math.PI * 2); ctx.stroke() }
    if (look.accessory === 'crown') {
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.moveTo(-6 * s, -20 * s); ctx.lineTo(-6 * s, -26 * s); ctx.lineTo(-3 * s, -22 * s); ctx.lineTo(0, -27 * s)
      ctx.lineTo(3 * s, -22 * s); ctx.lineTo(6 * s, -26 * s); ctx.lineTo(6 * s, -20 * s); ctx.closePath(); ctx.fill()
    }
    ctx.restore()
  })
}

// ── Sidekick — a bubbly critter that tags along ───────────────
export function drawSidekick(ctx: Ctx, x: number, y: number, size: number, sk: SidekickSpec, frame = 0) {
  art(ctx, `sidekick.${sk.key}`, x, y, size, frame, () => {
    const s = size / 24
    const bob = Math.sin(frame * 0.25 + 2) * 2 * s
    ctx.save(); ctx.translate(x, y + bob)
    glow(ctx, 0, 0, 14 * s, sk.color, 0.35)
    ctx.fillStyle = sk.color
    ctx.beginPath(); ctx.arc(0, 0, 9 * s, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.25)'
    ctx.beginPath(); ctx.arc(-3 * s, -3 * s, 4 * s, 0, Math.PI * 2); ctx.fill()
    emoji(ctx, sk.emoji, 0, -0.5 * s, 11 * s)
    ctx.restore()
  })
}

export function heroLook(h: HeroSpec, palettes: Record<string, { a: string; b: string; skin: string }>): HeroLook {
  const p = palettes[h.palette] ?? { a: '#3b82f6', b: '#06b6d4', skin: '#fcd9b8' }
  return { a: p.a, b: p.b, skin: p.skin, style: h.style, accessory: h.accessory, initial: (h.initial || 'P').slice(0, 1).toUpperCase(), svg: h.svg }
}

// Costume palettes baked into the engine (mirror of data catalogue).
export const ENGINE_PALETTES: Record<string, { a: string; b: string; skin: string }> = {
  ember:   { a: '#ef4444', b: '#f97316', skin: '#fcd9b8' },
  ocean:   { a: '#3b82f6', b: '#06b6d4', skin: '#fcd9b8' },
  forest:  { a: '#22c55e', b: '#84cc16', skin: '#e8b98a' },
  berry:   { a: '#a855f7', b: '#ec4899', skin: '#fcd9b8' },
  sunny:   { a: '#eab308', b: '#f59e0b', skin: '#a16a3c' },
  frost:   { a: '#67e8f9', b: '#a5b4fc', skin: '#fcd9b8' },
  shadow:  { a: '#475569', b: '#1e293b', skin: '#e8b98a' },
  rainbow: { a: '#f472b6', b: '#38bdf8', skin: '#fcd9b8' },
}
