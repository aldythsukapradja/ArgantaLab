/**
 * COMPOSE BINDING — the manual mode's bridge between a plain form and the
 * engine's layer model.
 *
 * The Compose tab is deliberately NOT a layer toolbox: it shows the same five
 * fields for every slide (image · title · subtitle · pills · toggles) and binds
 * each to a layer looked up BY NAME, exactly the way slideContent() already
 * reads a slide back. Templates name their layers differently for the same
 * semantic role ('Headline' on hook, 'Title' on fact, 'Quote' on quote), so a
 * role resolves through an alias list and writes to whichever layer the current
 * template stamped — that is what lets you re-template a slide without the form
 * losing its grip on the words.
 *
 * Rules that keep the form honest:
 *  · read is pure (no mutation on render),
 *  · write creates the layer on first edit and removes it when cleared,
 *  · a created layer copies the shape a template would have stamped, so a
 *    manually-built slide and a generated one are the same kind of object.
 */
import { pid, type PostSlide, type PostLayer, type TextLayer, type ImageLayer, type BadgeLayer, type PagerLayer } from './postEngine'

// Alias lists — mirror slideContent()'s in PostStudio.tsx. Order matters: the
// first name present wins, and a newly-created layer takes the FIRST name.
export const TITLE_NAMES = ['Headline', 'Title', 'Quote', 'Number']
export const BODY_NAMES = ['Body', 'Subline', 'Items']
export const HANDLE_NAME = 'Handle'

const texts = (s: PostSlide) => s.layers.filter((l): l is TextLayer => l.type === 'text')

/** The layer currently playing a role on this slide, if any. */
export function findText(s: PostSlide, names: string[]): TextLayer | undefined {
  for (const n of names) { const hit = texts(s).find(t => t.name === n); if (hit) return hit }
  return undefined
}
export const findBg = (s: PostSlide): ImageLayer | undefined =>
  s.layers.find((l): l is ImageLayer => l.type === 'image' && l.mode === 'bg')
export const findBrand = (s: PostSlide) => s.layers.find(l => l.type === 'brand')
export const findHandle = (s: PostSlide) => findText(s, [HANDLE_NAME])
export const findPager = (s: PostSlide, style: PagerLayer['style']) =>
  s.layers.find((l): l is PagerLayer => l.type === 'pager' && l.style === style)
export const badges = (s: PostSlide): BadgeLayer[] => s.layers.filter((l): l is BadgeLayer => l.type === 'badge')

/** What the Compose form displays for a slide. Pure read. */
export interface ComposeView {
  imageUrl: string
  dim: number
  title: string
  titleSize: number
  subtitle: string
  pills: { id: string; text: string }[]
  hasBrand: boolean
  hasHandle: boolean
  hasSwipe: boolean
  hasDots: boolean
}
export function readCompose(s: PostSlide): ComposeView {
  const t = findText(s, TITLE_NAMES)
  const b = findText(s, BODY_NAMES)
  const bg = findBg(s)
  return {
    imageUrl: bg?.url || '',
    dim: bg?.dim ?? 0.5,
    title: t?.text || '',
    titleSize: t?.size ?? 84,
    subtitle: b?.text || '',
    pills: badges(s).map(x => ({ id: x.id, text: x.text })),
    hasBrand: !!findBrand(s),
    hasHandle: !!findHandle(s),
    hasSwipe: !!findPager(s, 'arrow'),
    hasDots: !!findPager(s, 'dots'),
  }
}

// ── writers — each takes the slide draft and mutates it in place ──
// (callers wrap these in PostStudio's patchSlide, which already deep-clones.)

/** Set a role's text. Empty string removes the layer; first edit creates it. */
export function setRoleText(s: PostSlide, role: 'title' | 'subtitle', text: string) {
  const names = role === 'title' ? TITLE_NAMES : BODY_NAMES
  const existing = findText(s, names)
  if (!text.trim()) {
    if (existing) s.layers = s.layers.filter(l => l.id !== existing.id)
    return
  }
  if (existing) { existing.text = text; return }
  s.layers.push(role === 'title'
    ? { id: pid('tx'), type: 'text', name: TITLE_NAMES[0], text, xN: 0.5, yN: 0.42, size: 84, weight: 800, color: 'ink', align: 'center', font: 'sans', maxWidthN: 0.82, lineHeight: 1.18, highlight: 'pill' }
    : { id: pid('tx'), type: 'text', name: BODY_NAMES[0], text, xN: 0.5, yN: 0.62, size: 42, weight: 500, color: 'soft', align: 'center', font: 'sans', maxWidthN: 0.76, lineHeight: 1.42, highlight: 'pill' })
}

/** B1 retired the drawer's title-size slider — sizing is a visual call and now
 *  lives on the canvas toolbar. Kept exported: the binding is the same one the
 *  toolbar needs if it ever addresses a role rather than a layer id. */
export function setTitleSize(s: PostSlide, size: number) {
  const t = findText(s, TITLE_NAMES); if (t) t.size = size
}

/** Place/replace the slide's background image. One bg per slide, by design. */
export function setBgImage(s: PostSlide, url: string, name = 'Photo') {
  const bg = findBg(s)
  if (bg) { bg.url = url; return }
  s.layers.unshift({ id: pid('im'), type: 'image', name, url, mode: 'bg', xN: 0.5, yN: 0.5, wN: 1, hN: 1, radius: 0, dim: 0.5, opacity: 1 })
}
export function setBgDim(s: PostSlide, dim: number) { const bg = findBg(s); if (bg) bg.dim = dim }
export function clearBg(s: PostSlide) { const bg = findBg(s); if (bg) s.layers = s.layers.filter(l => l.id !== bg.id) }

// ── pills (badge layers) ──
// Stacked left-to-right across a row so two pills never land on one spot; the
// founder drags from there if they want a different arrangement.
export function addPill(s: PostSlide, text: string) {
  const n = badges(s).length
  s.layers.push({
    id: pid('bd'), type: 'badge', name: 'Badge', text: text || 'NEW',
    xN: Math.min(0.82, 0.5 + (n % 2 ? 0.18 : -0.18) * Math.ceil((n + 1) / 2)),
    yN: 0.16 + Math.floor(n / 2) * 0.07,
    size: 30, bg: 'accent', color: 'pillInk',
  })
}
export function setPillText(s: PostSlide, id: string, text: string) {
  const b = badges(s).find(x => x.id === id); if (b) b.text = text
}
export function removePill(s: PostSlide, id: string) { s.layers = s.layers.filter(l => l.id !== id) }

// ── toggles ──
export type ComposeToggle = 'brand' | 'handle' | 'swipe' | 'dots'

export function toggleElement(s: PostSlide, kind: ComposeToggle, on: boolean, handle?: string) {
  const drop = (l?: PostLayer) => { if (l) s.layers = s.layers.filter(x => x.id !== l.id) }
  if (kind === 'brand') {
    const cur = findBrand(s)
    if (!on) return drop(cur)
    if (!cur) s.layers.push({ id: pid('br'), type: 'brand', name: 'Brand', xN: 0.5, yN: 0.09, size: 56, wordmark: true })
  } else if (kind === 'handle') {
    const cur = findHandle(s)
    if (!on) return drop(cur)
    if (!cur) s.layers.push({ id: pid('tx'), type: 'text', name: HANDLE_NAME, text: handle || '@arganta', xN: 0.5, yN: 0.94, size: 30, weight: 600, color: 'soft', align: 'center', font: 'mono', maxWidthN: 0.8, lineHeight: 1.2, highlight: 'none' })
  } else {
    const style: PagerLayer['style'] = kind === 'swipe' ? 'arrow' : 'dots'
    const cur = findPager(s, style)
    if (!on) return drop(cur)
    if (!cur) s.layers.push({ id: pid('pg'), type: 'pager', name: kind === 'swipe' ? 'Swipe' : 'Pager', style, xN: 0.5, yN: 0.9, size: kind === 'swipe' ? 30 : 26 })
  }
}
