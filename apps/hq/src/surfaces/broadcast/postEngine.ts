/**
 * POST ENGINE — the deterministic, zero-asset social-post renderer behind the
 * Content Builder's Post Studio. The static sibling of @arganta/video: that one
 * synthesizes moving frames, this one paints PIXEL-PERFECT square/portrait/story
 * artwork for Instagram, TikTok, X, LinkedIn, Pinterest & co. Pure function of
 * (doc, slide, W, H): the same doc always exports the same pixels.
 *
 * Design notes (from the 2026 research pass):
 *  · 1080×1350 (4:5) is the default — the biggest feed canvas on IG/FB/LinkedIn.
 *  · 9:16 covers IG Story, Reels covers, TikTok and Shorts in one preset.
 *  · Colors are stored as ROLES ('ink'|'soft'|'accent'|…) not hexes, so swapping
 *    the palette re-inks every slide at once — the "brand kit" behaviour.
 *  · Every layout number is normalized (xN/yN/size vs a 1080 reference), so
 *    switching format is a one-click "magic resize".
 */

// ── Platform presets ──────────────────────────────────────────
export interface PostFormat {
  id: string
  label: string          // short — lives in the top-bar segmented control
  platforms: string      // where this size is native
  w: number
  h: number
  aspect: string
}

export const POST_FORMATS: PostFormat[] = [
  { id: 'portrait', label: 'Post 4:5',      platforms: 'Instagram · Facebook · LinkedIn · Threads', w: 1080, h: 1350, aspect: '4:5' },
  { id: 'square',   label: 'Square',        platforms: 'Instagram · X · LinkedIn',                  w: 1080, h: 1080, aspect: '1:1' },
  { id: 'story',    label: 'Story / Reel',  platforms: 'IG Story · Reels · TikTok · Shorts',        w: 1080, h: 1920, aspect: '9:16' },
  { id: 'pin',      label: 'Pin',           platforms: 'Pinterest',                                 w: 1000, h: 1500, aspect: '2:3' },
  { id: 'wide',     label: 'Wide',          platforms: 'X · YouTube thumbnail',                     w: 1600, h: 900,  aspect: '16:9' },
  { id: 'link',     label: 'Link card',     platforms: 'LinkedIn · OpenGraph',                      w: 1200, h: 627,  aspect: '1.91:1' },
]
export const postFormat = (id: string): PostFormat => POST_FORMATS.find(f => f.id === id) || POST_FORMATS[0]

// ── Palettes (the brand kit) ──────────────────────────────────
export interface PostPalette {
  id: string
  label: string
  colors: [string, string]   // background gradient stops
  ink: string                // primary text
  soft: string               // secondary text
  accent: string             // highlight / badge / pager
  pillInk: string            // text sitting ON the accent
  dark: boolean
}

export const POST_PALETTES: PostPalette[] = [
  { id: 'kinetik', label: 'Kinetik',  colors: ['#101a3a', '#1b0f33'], ink: '#ffffff', soft: '#aab4d8', accent: '#22D3EE', pillInk: '#06121f', dark: true },
  { id: 'dusk',    label: 'Dusk',     colors: ['#182a44', '#241028'], ink: '#ffffff', soft: '#b3bdd6', accent: '#ff8a3d', pillInk: '#160a02', dark: true },
  { id: 'grape',   label: 'Grape',    colors: ['#2a1550', '#120826'], ink: '#f3ecff', soft: '#b7a6e0', accent: '#a68bff', pillInk: '#120826', dark: true },
  { id: 'mint',    label: 'Mint',     colors: ['#0f3d34', '#08221d'], ink: '#eafff6', soft: '#9fd0bf', accent: '#4fd98a', pillInk: '#062019', dark: true },
  { id: 'ember',   label: 'Ember',    colors: ['#3a0f12', '#1a0708'], ink: '#fff0ec', soft: '#d8a8a0', accent: '#ff6ea9', pillInk: '#1a0708', dark: true },
  { id: 'ocean',   label: 'Ocean',    colors: ['#07293a', '#04141d'], ink: '#e6f7ff', soft: '#9cc3d4', accent: '#33cfd6', pillInk: '#04141d', dark: true },
  { id: 'noir',    label: 'Noir',     colors: ['#101014', '#1c1c24'], ink: '#f5f5f7', soft: '#9c9ca8', accent: '#f5c518', pillInk: '#101014', dark: true },
  { id: 'paper',   label: 'Paper',    colors: ['#faf7f0', '#efe8db'], ink: '#221c14', soft: '#6f6656', accent: '#e2584b', pillInk: '#fff8ee', dark: false },
  { id: 'cloud',   label: 'Cloud',    colors: ['#eef2fb', '#dde5f7'], ink: '#101a3a', soft: '#5a6a94', accent: '#4f5bd5', pillInk: '#ffffff', dark: false },
  { id: 'sunrise', label: 'Sunrise',  colors: ['#ffe9d6', '#ffd6e0'], ink: '#3a1430', soft: '#8a5a6a', accent: '#ff5f6d', pillInk: '#fff4ec', dark: false },
]
export const postPalette = (id: string): PostPalette => POST_PALETTES.find(p => p.id === id) || POST_PALETTES[0]

/** A layer color is a palette ROLE or a raw hex. Roles re-ink on palette switch. */
export type Role = 'ink' | 'soft' | 'accent' | 'pillInk' | string
export const resolveColor = (c: Role, pal: PostPalette): string =>
  c === 'ink' ? pal.ink : c === 'soft' ? pal.soft : c === 'accent' ? pal.accent : c === 'pillInk' ? pal.pillInk : c

// ── Background ────────────────────────────────────────────────
export type BgVariant = 'gradient' | 'aurora' | 'mesh' | 'rays' | 'solid'
export const BG_VARIANTS: BgVariant[] = ['gradient', 'aurora', 'mesh', 'rays', 'solid']
export interface SlideBg {
  variant: BgVariant
  angle: number       // gradient direction
  seed: number        // deterministic blob/ray placement
  grain: boolean      // film-grain overlay
  vignette: boolean
}

// ── Layers ────────────────────────────────────────────────────
export type PostFont = 'sans' | 'serif' | 'mono'
export type Highlight = 'none' | 'pill' | 'underline'

export interface TextLayer {
  id: string; type: 'text'; name: string
  text: string
  xN: number; yN: number
  size: number            // px vs a 1080-wide reference
  weight: number
  color: Role
  align: CanvasTextAlign
  font: PostFont
  maxWidthN: number
  lineHeight: number
  upper?: boolean
  highlight: Highlight
  hidden?: boolean
}
export interface EmojiLayer {
  id: string; type: 'emoji'; name: string
  char: string
  xN: number; yN: number
  size: number
  hidden?: boolean
}
export interface ImageLayer {
  id: string; type: 'image'; name: string
  url: string
  mode: 'bg' | 'card'     // full-bleed cover vs rounded framed block
  xN: number; yN: number
  wN: number; hN: number  // card box (fractions of canvas)
  radius: number          // corner radius px @1080 ref (card mode)
  dim: number             // 0..0.8 darkening scrim (bg mode)
  opacity: number
  hidden?: boolean
}
export interface BadgeLayer {
  id: string; type: 'badge'; name: string
  text: string
  xN: number; yN: number
  size: number
  bg: Role; color: Role
  hidden?: boolean
}
export interface BrandLayer {
  id: string; type: 'brand'; name: string
  xN: number; yN: number
  size: number            // mark size px @1080 ref
  wordmark: boolean
  hidden?: boolean
}
export interface PagerLayer {
  id: string; type: 'pager'; name: string
  style: 'dots' | 'count' | 'arrow'
  xN: number; yN: number
  size: number
  hidden?: boolean
}
export interface DividerLayer {
  id: string; type: 'divider'; name: string
  xN: number; yN: number
  wN: number
  color: Role
  thick: number
  hidden?: boolean
}
export type PostLayer = TextLayer | EmojiLayer | ImageLayer | BadgeLayer | BrandLayer | PagerLayer | DividerLayer

export interface PostSlide {
  id: string
  template: string        // which template stamped it (for the copilot + UI)
  bg: SlideBg
  layers: PostLayer[]
}

export interface PostDoc {
  v: 1
  format: string          // PostFormat id
  palette: string         // PostPalette id
  slides: PostSlide[]
  caption: string
  hashtags: string
  alt?: string            // accessibility alt text (IG-ready checklist)
  brand: { name: string; handle: string }
}

let _n = 0
export const pid = (p = 'l') => p + '_' + Date.now().toString(36) + '_' + (_n++).toString(36)

export const blankBg = (seed = 7): SlideBg => ({ variant: 'aurora', angle: 155, seed, grain: true, vignette: true })

// ── Deterministic PRNG (mulberry32) ───────────────────────────
function rng(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Canvas helpers ────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const FONT_STACK: Record<PostFont, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", ui-serif, serif',
  mono: 'ui-monospace, "Cascadia Code", Consolas, Menlo, monospace',
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of String(text).split('\n')) {
    const words = para.split(' ')
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w }
      else line = test
    }
    out.push(line)
  }
  return out
}

// ── Background painters (all seeded → reproducible) ───────────
function drawBg(ctx: CanvasRenderingContext2D, bg: SlideBg, pal: PostPalette, W: number, H: number) {
  const [c1, c2] = pal.colors
  // base gradient
  const a = (bg.angle * Math.PI) / 180
  const dx = Math.cos(a), dy = Math.sin(a)
  const g = ctx.createLinearGradient(W / 2 - dx * W, H / 2 - dy * H, W / 2 + dx * W, H / 2 + dy * H)
  g.addColorStop(0, c1); g.addColorStop(1, c2)
  ctx.fillStyle = bg.variant === 'solid' ? c1 : g
  ctx.fillRect(0, 0, W, H)

  const r = rng(bg.seed)
  if (bg.variant === 'aurora') {
    // 3 soft luminous blobs — accent-tinted, seeded positions
    const tints = [pal.accent, pal.dark ? '#ffffff' : pal.ink, pal.accent]
    for (let i = 0; i < 3; i++) {
      const cx = W * (0.15 + r() * 0.7), cy = H * (0.12 + r() * 0.76)
      const rad = Math.max(W, H) * (0.28 + r() * 0.3)
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
      rg.addColorStop(0, hexA(tints[i], pal.dark ? 0.16 : 0.22))
      rg.addColorStop(1, hexA(tints[i], 0))
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H)
    }
  } else if (bg.variant === 'mesh') {
    // 4 corner-ish radial pools — the “mesh gradient” look
    const pool = [pal.accent, c2, pal.dark ? '#ffffff' : pal.ink, pal.accent]
    for (let i = 0; i < 4; i++) {
      const cx = W * r(), cy = H * r()
      const rad = Math.max(W, H) * (0.35 + r() * 0.35)
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
      rg.addColorStop(0, hexA(pool[i], pal.dark ? 0.22 : 0.3))
      rg.addColorStop(1, hexA(pool[i], 0))
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H)
    }
  } else if (bg.variant === 'rays') {
    // sunburst from a seeded anchor
    const cx = W * (0.3 + r() * 0.4), cy = H * (0.2 + r() * 0.25)
    const n = 12
    ctx.save()
    ctx.globalAlpha = pal.dark ? 0.07 : 0.1
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + r() * 0.2
      const a1 = a0 + (Math.PI / n) * 0.9
      const R = Math.max(W, H) * 1.6
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R)
      ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R)
      ctx.closePath()
      ctx.fillStyle = i % 2 ? pal.accent : (pal.dark ? '#ffffff' : pal.ink)
      ctx.fill()
    }
    ctx.restore()
  }

  if (bg.grain) {
    // deterministic sparse grain — cheap and export-stable
    const gr = rng(bg.seed * 31 + 7)
    ctx.save()
    ctx.globalAlpha = pal.dark ? 0.05 : 0.04
    ctx.fillStyle = pal.dark ? '#ffffff' : '#000000'
    const n = Math.round((W * H) / 900)
    for (let i = 0; i < n; i++) ctx.fillRect(gr() * W, gr() * H, 1.5, 1.5)
    ctx.restore()
  }
  if (bg.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, pal.dark ? 'rgba(0,0,0,0.34)' : 'rgba(60,40,20,0.14)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
  }
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ── Layer painters ────────────────────────────────────────────
function drawTextLayer(ctx: CanvasRenderingContext2D, l: TextLayer, pal: PostPalette, W: number, H: number) {
  const k = W / 1080
  const size = l.size * k
  const text = l.upper ? l.text.toUpperCase() : l.text
  ctx.font = `${l.weight} ${size}px ${FONT_STACK[l.font]}`
  ctx.textAlign = l.align
  ctx.textBaseline = 'middle'
  const maxW = l.maxWidthN * W
  const lines = wrapLines(ctx, text, maxW)
  const lh = size * l.lineHeight
  const cx = l.xN * W
  const y0 = l.yN * H - ((lines.length - 1) * lh) / 2
  const color = resolveColor(l.color, pal)

  lines.forEach((line, i) => {
    const y = y0 + i * lh
    const lw = ctx.measureText(line).width
    const lx = l.align === 'left' ? cx : l.align === 'right' ? cx - lw : cx - lw / 2
    if (l.highlight === 'pill' && line.trim()) {
      const padX = size * 0.28, padY = size * 0.16
      ctx.fillStyle = resolveColor('accent', pal)
      roundRect(ctx, lx - padX, y - size / 2 - padY, lw + padX * 2, size + padY * 2, size * 0.24)
      ctx.fill()
    }
    if (l.highlight === 'underline' && line.trim()) {
      ctx.fillStyle = resolveColor('accent', pal)
      roundRect(ctx, lx, y + size * 0.42, lw, size * 0.14, size * 0.07)
      ctx.fill()
    }
    if (l.highlight !== 'pill' && pal.dark) {
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = size * 0.1; ctx.shadowOffsetY = size * 0.02
    }
    ctx.fillStyle = l.highlight === 'pill' ? resolveColor('pillInk', pal) : color
    ctx.fillText(line, l.align === 'center' ? cx : lx + (l.align === 'right' ? lw : 0), y)
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  })
}

function drawEmojiLayer(ctx: CanvasRenderingContext2D, l: EmojiLayer, W: number, H: number) {
  const size = l.size * (W / 1080)
  ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(l.char, l.xN * W, l.yN * H)
}

function drawImageLayer(ctx: CanvasRenderingContext2D, l: ImageLayer, pal: PostPalette, W: number, H: number, img: HTMLImageElement | null) {
  const k = W / 1080
  if (l.mode === 'bg') {
    if (img && img.complete && img.naturalWidth) {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight)
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s
      ctx.save(); ctx.globalAlpha = l.opacity
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
      ctx.restore()
    }
    if (l.dim > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, `rgba(0,0,0,${l.dim * 0.55})`)
      g.addColorStop(0.45, `rgba(0,0,0,${l.dim * 0.35})`)
      g.addColorStop(1, `rgba(0,0,0,${l.dim})`)
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    }
    return
  }
  // card mode — rounded, covered crop
  const bw = l.wN * W, bh = l.hN * H
  const bx = l.xN * W - bw / 2, by = l.yN * H - bh / 2
  const r = l.radius * k
  ctx.save()
  roundRect(ctx, bx, by, bw, bh, r)
  ctx.fillStyle = hexA(pal.dark ? '#ffffff' : '#000000', 0.06)
  ctx.fill()
  ctx.clip()
  if (img && img.complete && img.naturalWidth) {
    const s = Math.max(bw / img.naturalWidth, bh / img.naturalHeight)
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s
    ctx.globalAlpha = l.opacity
    ctx.drawImage(img, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = resolveColor('soft', pal)
    ctx.font = `500 ${34 * k}px ${FONT_STACK.sans}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('image loading…', bx + bw / 2, by + bh / 2)
  }
  ctx.restore()
}

function drawBadgeLayer(ctx: CanvasRenderingContext2D, l: BadgeLayer, pal: PostPalette, W: number, H: number) {
  const k = W / 1080
  const size = l.size * k
  ctx.font = `800 ${size}px ${FONT_STACK.sans}`
  const text = l.text.toUpperCase()
  const tw = ctx.measureText(text).width
  const padX = size * 0.7, padY = size * 0.42
  const bw = tw + padX * 2, bh = size + padY * 2
  const x = l.xN * W - bw / 2, y = l.yN * H - bh / 2
  ctx.fillStyle = resolveColor(l.bg, pal)
  roundRect(ctx, x, y, bw, bh, bh / 2)
  ctx.fill()
  ctx.fillStyle = resolveColor(l.color, pal)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, l.xN * W, l.yN * H + size * 0.04)
}

/** The KinetikCircle mark (mirrors public/icon.svg) + optional wordmark. */
function drawBrandLayer(ctx: CanvasRenderingContext2D, l: BrandLayer, pal: PostPalette, W: number, H: number, brandName: string) {
  const k = W / 1080
  const s = l.size * k                    // mark edge
  ctx.font = `700 ${s * 0.52}px ${FONT_STACK.sans}`
  const totalW = s + (l.wordmark ? s * 0.3 + ctx.measureText(brandName).width : 0)
  const x0 = l.xN * W - totalW / 2
  const y0 = l.yN * H - s / 2
  // rounded-square gradient tile
  const g = ctx.createLinearGradient(x0, y0, x0 + s, y0 + s)
  g.addColorStop(0, '#22D3EE'); g.addColorStop(1, '#8B5CF6')
  ctx.fillStyle = g
  roundRect(ctx, x0, y0, s, s, s * 0.23)
  ctx.fill()
  // ring + satellite + core (the K-mark geometry, scaled from 512)
  const u = s / 512
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 40 * u
  ctx.beginPath(); ctx.arc(x0 + 256 * u, y0 + 256 * u, 106 * u, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(x0 + 332 * u, y0 + 180 * u, 34 * u, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(x0 + 256 * u, y0 + 256 * u, 22 * u, 0, Math.PI * 2); ctx.fill()
  if (l.wordmark) {
    ctx.fillStyle = resolveColor('ink', pal)
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(brandName, x0 + s + s * 0.3, l.yN * H + s * 0.03)
  }
}

function drawPagerLayer(ctx: CanvasRenderingContext2D, l: PagerLayer, pal: PostPalette, W: number, H: number, index: number, total: number) {
  const k = W / 1080
  const size = l.size * k
  const cx = l.xN * W, cy = l.yN * H
  const accent = resolveColor('accent', pal)
  const soft = resolveColor('soft', pal)
  if (l.style === 'dots') {
    const gap = size * 0.9
    const x0 = cx - ((total - 1) * gap) / 2
    for (let i = 0; i < total; i++) {
      ctx.fillStyle = i === index ? accent : hexA(soft.startsWith('#') ? soft : '#888888', 0.5)
      ctx.beginPath(); ctx.arc(x0 + i * gap, cy, i === index ? size * 0.3 : size * 0.2, 0, Math.PI * 2); ctx.fill()
    }
  } else if (l.style === 'count') {
    ctx.font = `700 ${size}px ${FONT_STACK.mono}`
    ctx.fillStyle = soft
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${index + 1} / ${total}`, cx, cy)
  } else {
    // arrow — the “swipe” affordance
    ctx.font = `800 ${size}px ${FONT_STACK.sans}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const label = 'swipe'
    const tw = ctx.measureText(label).width
    ctx.fillStyle = soft
    ctx.fillText(label, cx - size * 0.8, cy)
    ctx.strokeStyle = accent; ctx.lineWidth = size * 0.14; ctx.lineCap = 'round'
    const ax = cx + tw / 2 - size * 0.1, ay = cy
    ctx.beginPath()
    ctx.moveTo(ax, ay); ctx.lineTo(ax + size * 1.3, ay)
    ctx.moveTo(ax + size * 0.9, ay - size * 0.4); ctx.lineTo(ax + size * 1.3, ay)
    ctx.lineTo(ax + size * 0.9, ay + size * 0.4)
    ctx.stroke()
  }
}

function drawDividerLayer(ctx: CanvasRenderingContext2D, l: DividerLayer, pal: PostPalette, W: number, H: number) {
  const k = W / 1080
  const w = l.wN * W, t = l.thick * k
  ctx.fillStyle = resolveColor(l.color, pal)
  roundRect(ctx, l.xN * W - w / 2, l.yN * H - t / 2, w, t, t / 2)
  ctx.fill()
}

// ── The one entry point ───────────────────────────────────────
export interface RenderEnv {
  getImg: (url: string) => HTMLImageElement | null
}

// ── Direct manipulation: hit-testing + selection outline ──────────────────
// Approximate pixel bounds (top-left x/y + w/h) for a layer, used to click-
// select and to draw a selection frame. Pass `ctx` so text can be measured;
// without it, text falls back to its max-width box.
export function layerBounds(l: PostLayer, W: number, H: number, ctx?: CanvasRenderingContext2D): { x: number; y: number; w: number; h: number } {
  const k = W / 1080
  const box = (w: number, h: number) => ({ x: l.xN * W - w / 2, y: l.yN * H - h / 2, w, h })
  switch (l.type) {
    case 'text': {
      const size = l.size * k
      let lineW = l.maxWidthN * W, lines = Math.max(1, (l.text.match(/\n/g)?.length ?? 0) + 1)
      if (ctx) {
        ctx.font = `${l.weight} ${size}px ${FONT_STACK[l.font]}`
        const wrapped = wrapLines(ctx, l.upper ? l.text.toUpperCase() : l.text, l.maxWidthN * W)
        lines = Math.max(1, wrapped.length)
        lineW = Math.min(l.maxWidthN * W, Math.max(1, ...wrapped.map(t => ctx.measureText(t).width)))
      }
      const lh = size * l.lineHeight
      return box(lineW + size * 0.4, (lines - 1) * lh + size * 1.5)
    }
    case 'emoji': { const s = l.size * k; return box(s, s) }
    case 'image': return box(l.wN * W, l.hN * H)
    case 'badge': { const s = l.size * k; return box(l.text.length * s * 0.62 + s * 1.4, s * 1.9) }
    case 'brand': { const s = l.size * k; return box(l.wordmark ? s * 6.5 : s * 1.5, s * 1.5) }
    case 'pager': { const s = l.size * k; return box(s * 5, s * 1.6) }
    case 'divider': { const t = Math.max(l.thick * k, 8); return box(l.wN * W, t * 3) }
  }
}

/** Topmost non-hidden layer whose bounds contain the point (canvas pixels), or
 * null. Iterates top→bottom so a headline over a bg image is selected first. */
export function hitTestLayer(slide: PostSlide, px: number, py: number, W: number, H: number, ctx?: CanvasRenderingContext2D): string | null {
  for (let i = slide.layers.length - 1; i >= 0; i--) {
    const l = slide.layers[i]
    if (l.hidden) continue
    const b = layerBounds(l, W, H, ctx)
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return l.id
  }
  return null
}

/** Draw a dashed selection frame around one layer (call after drawSlide). */
export function drawLayerSelection(ctx: CanvasRenderingContext2D, slide: PostSlide, layerId: string, W: number, H: number) {
  const l = slide.layers.find(x => x.id === layerId)
  if (!l) return
  const b = layerBounds(l, W, H, ctx)
  ctx.save()
  ctx.strokeStyle = 'rgba(120,180,255,0.95)'
  ctx.lineWidth = Math.max(2, W / 540)
  ctx.setLineDash([W / 90, W / 130])
  ctx.strokeRect(b.x, b.y, b.w, b.h)
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(120,180,255,0.95)'
  const r = Math.max(5, W / 150)
  for (const [cx, cy] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]] as const) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

export function drawSlide(ctx: CanvasRenderingContext2D, doc: PostDoc, index: number, W: number, H: number, env: RenderEnv) {
  const slide = doc.slides[index]
  if (!slide) return
  const pal = postPalette(doc.palette)
  ctx.clearRect(0, 0, W, H)
  drawBg(ctx, slide.bg, pal, W, H)
  for (const l of slide.layers) {
    if (l.hidden) continue
    ctx.save()
    if (l.type === 'image') drawImageLayer(ctx, l, pal, W, H, env.getImg(l.url))
    else if (l.type === 'text') drawTextLayer(ctx, l, pal, W, H)
    else if (l.type === 'emoji') drawEmojiLayer(ctx, l, W, H)
    else if (l.type === 'badge') drawBadgeLayer(ctx, l, pal, W, H)
    else if (l.type === 'brand') drawBrandLayer(ctx, l, pal, W, H, doc.brand.name)
    else if (l.type === 'pager') drawPagerLayer(ctx, l, pal, W, H, index, doc.slides.length)
    else if (l.type === 'divider') drawDividerLayer(ctx, l, pal, W, H)
    ctx.restore()
  }
}

/** Safe-area guides for the 9:16 story canvas (IG/TikTok UI chrome zones). */
export function drawGuides(ctx: CanvasRenderingContext2D, formatId: string, W: number, H: number) {
  const k = W / 1080
  ctx.save()
  // Story/Reel: the big platform-UI zones top (profile/close) + bottom (caption,
  // send bar) that get overlaid by IG/TikTok chrome. Keep headlines out of them.
  if (formatId === 'story') {
    const top = H * 0.13, bottom = H * 0.163           // ≈250px / 310px on 1920
    ctx.fillStyle = 'rgba(255,61,114,0.09)'
    ctx.fillRect(0, 0, W, top)
    ctx.fillRect(0, H - bottom, W, bottom)
    ctx.setLineDash([10, 8])
    ctx.strokeStyle = 'rgba(255,61,114,0.55)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, H - bottom); ctx.lineTo(W, H - bottom); ctx.stroke()
    ctx.font = `600 ${26 * k}px ${FONT_STACK.mono}`
    ctx.fillStyle = 'rgba(255,61,114,0.8)'
    ctx.textAlign = 'center'
    ctx.fillText('platform UI — keep clear', W / 2, top - 12 * k)
  }
  // Every format: a 5% "keep it inside" frame — content nearer the edge risks
  // cropping across viewers (grid thumbnails, in-app previews).
  const mx = W * 0.05, my = H * 0.05
  ctx.setLineDash([14 * k, 10 * k])
  ctx.strokeStyle = 'rgba(120,180,255,0.5)'
  ctx.lineWidth = 2
  ctx.strokeRect(mx, my, W - mx * 2, H - my * 2)
  ctx.restore()
}

// ── Export ────────────────────────────────────────────────────
export async function renderSlideBlob(doc: PostDoc, index: number, env: RenderEnv, mime: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Blob> {
  const f = postFormat(doc.format)
  const cv = document.createElement('canvas')
  cv.width = f.w; cv.height = f.h
  const ctx = cv.getContext('2d')!
  // JPEG has no alpha — paint an opaque base first so any transparency renders
  // as solid (Instagram's publishing API only accepts JPEG, so Buffer uploads
  // use this path). PNG keeps its transparency for exports/moments.
  if (mime === 'image/jpeg') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, f.w, f.h) }
  drawSlide(ctx, doc, index, f.w, f.h, env)
  return await new Promise<Blob>((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), mime, mime === 'image/jpeg' ? 0.92 : undefined))
}

// ── Caption intelligence (2026 platform rules) ────────────────
export interface CaptionRule {
  id: string
  label: string
  limit: number
  hook: number            // chars shown before the fold
  sweet: string           // the research-backed sweet spot
  tags: string
}
export const CAPTION_RULES: CaptionRule[] = [
  { id: 'instagram', label: 'Instagram', limit: 2200, hook: 125, sweet: '138–150 chars', tags: '3–5 hashtags (IG’s own advice)' },
  { id: 'tiktok',    label: 'TikTok',    limit: 4000, hook: 100, sweet: '50–150 chars',  tags: '3–5 niche hashtags' },
  { id: 'x',         label: 'X',         limit: 280,  hook: 280, sweet: 'short wins',     tags: '1–2 hashtags max' },
  { id: 'linkedin',  label: 'LinkedIn',  limit: 3000, hook: 210, sweet: '1200–1600 chars (dwell time)', tags: '3–5 hashtags' },
  { id: 'facebook',  label: 'Facebook',  limit: 63206, hook: 477, sweet: '40–80 chars',   tags: '1–3 hashtags' },
  { id: 'pinterest', label: 'Pinterest', limit: 500,  hook: 100, sweet: 'keyword-rich',   tags: 'keywords > hashtags' },
]
export const captionRule = (id: string): CaptionRule => CAPTION_RULES.find(r => r.id === id) || CAPTION_RULES[0]

// ── Sticker bank ──────────────────────────────────────────────
export const STICKERS = [
  '✨', '🔥', '💡', '🤯', '🎯', '❤️', '🏆', '🚀', '🌟', '⚡', '🎉', '👀',
  '🧠', '💎', '🌈', '☀️', '🌙', '🪐', '🌍', '🐾', '🦩', '🐙', '🍯', '🥇',
  '📅', '⏰', '📣', '💬', '✅', '❌', '👉', '💪', '🫶', '🙌', '😴', '🎲',
]
