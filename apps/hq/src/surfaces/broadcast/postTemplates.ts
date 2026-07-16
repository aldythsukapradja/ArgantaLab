/**
 * POST TEMPLATES — one function per proven social layout. Templates stamp
 * role-colored layers (never raw hexes), so a palette switch re-inks any slide.
 * The set mirrors what the research pass says wins in 2026: a HOOK slide, value
 * slides (fact / tip / list / quote / number / this-or-that / photo), and a CTA
 * end card — the classic carousel arc.
 */
import {
  pid, blankBg, type PostDoc, type PostSlide, type PostLayer, type TextLayer,
  POST_PALETTES,
} from './postEngine'
import { LIBRARY } from '../../data/broadcast'

export interface TemplateDef {
  id: string
  label: string
  emoji: string
  blurb: string
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'hook',    label: 'Hook',        emoji: '🪝', blurb: 'Giant curiosity-gap headline — slide 1 of every carousel.' },
  { id: 'fact',    label: 'Fact card',   emoji: '💡', blurb: 'Emoji + title + body + source. The Discover classic.' },
  { id: 'tip',     label: 'Tip',         emoji: '✅', blurb: 'TIP badge + one actionable move.' },
  { id: 'list',    label: 'List',        emoji: '🔢', blurb: 'Title + numbered lines (each body line = one item).' },
  { id: 'quote',   label: 'Quote',       emoji: '❝', blurb: 'Big serif quote + author.' },
  { id: 'number',  label: 'Big number',  emoji: '💯', blurb: 'One striking number, huge, with its story.' },
  { id: 'versus',  label: 'This or That', emoji: '⚖️', blurb: 'Two option pills — the vote magnet.' },
  { id: 'photo',   label: 'Photo',       emoji: '🖼️', blurb: 'Full-bleed image + scrim + headline. Add media below.' },
  { id: 'cta',     label: 'CTA end card', emoji: '🚀', blurb: 'Brand + follow prompt — always close the loop.' },
]

export interface TemplateContent {
  headline?: string
  body?: string
  emoji?: string
  badge?: string
  source?: string
  /** The account this post closes on. BF-3: was hard-coded '@kinetikcircle',
   *  which signed every ArgantaLab carousel with the wrong handle. Callers pass
   *  the doc's own brand handle. */
  handle?: string
}

const T = (over: Partial<TextLayer>): TextLayer => ({
  id: pid('tx'), type: 'text', name: over.name || 'Text',
  text: '', xN: 0.5, yN: 0.45, size: 64, weight: 700, color: 'ink', align: 'center',
  // Pill by default: every generated line rides a solid plate so it never
  // disappears into the background image. Decorative marks opt out (highlight:'none').
  font: 'sans', maxWidthN: 0.8, lineHeight: 1.18, highlight: 'pill',
  ...over,
})

const brand = (yN: number, wordmark = true): PostLayer =>
  ({ id: pid('br'), type: 'brand', name: 'Brand', xN: 0.5, yN, size: wordmark ? 56 : 72, wordmark })

const pager = (yN: number, style: 'dots' | 'count' | 'arrow' = 'dots'): PostLayer =>
  ({ id: pid('pg'), type: 'pager', name: 'Pager', style, xN: 0.5, yN, size: 26 })

const badge = (text: string, yN: number): PostLayer =>
  ({ id: pid('bd'), type: 'badge', name: 'Badge', text, xN: 0.5, yN, size: 30, bg: 'accent', color: 'pillInk' })

let seedTick = 3
const nextSeed = () => (seedTick = (seedTick * 16807) % 2147483647)

export function makeSlide(template: string, c: TemplateContent = {}): PostSlide {
  const bg = blankBg(nextSeed())
  const L: PostLayer[] = []
  switch (template) {
    case 'hook': {
      bg.variant = 'aurora'
      L.push(brand(0.09))
      if (c.badge) L.push(badge(c.badge, 0.2))
      L.push(T({ name: 'Headline', text: c.headline || 'The hook goes here.\nMake them stop.', yN: 0.46, size: 108, weight: 800, maxWidthN: 0.84 }))
      if (c.body) L.push(T({ name: 'Subline', text: c.body, yN: 0.68, size: 40, weight: 500, color: 'soft', maxWidthN: 0.74, lineHeight: 1.4 }))
      L.push(pager(0.9, 'arrow'))
      break
    }
    case 'fact': {
      bg.variant = 'gradient'
      if (c.emoji) L.push({ id: pid('em'), type: 'emoji', name: 'Emoji', char: c.emoji, xN: 0.5, yN: 0.2, size: 150 })
      L.push(T({ name: 'Title', text: c.headline || 'The surprising fact', yN: 0.42, size: 78, weight: 800, maxWidthN: 0.82 }))
      L.push(T({ name: 'Body', text: c.body || 'The two-line explanation that makes it land.', yN: 0.62, size: 42, weight: 500, color: 'soft', maxWidthN: 0.76, lineHeight: 1.42 }))
      if (c.source) L.push(T({ name: 'Source', text: '— ' + c.source, yN: 0.78, size: 30, weight: 500, color: 'soft', font: 'mono' }))
      L.push(brand(0.92, true))
      L.push(pager(0.86, 'dots'))
      break
    }
    case 'tip': {
      bg.variant = 'mesh'
      L.push(badge(c.badge || 'TIP', 0.16))
      L.push(T({ name: 'Title', text: c.headline || 'Name it to tame it', yN: 0.38, size: 88, weight: 800, maxWidthN: 0.82 }))
      L.push(T({ name: 'Body', text: c.body || 'Try this: one concrete move, written like a friend texted it.', yN: 0.6, size: 44, weight: 500, color: 'soft', maxWidthN: 0.74, lineHeight: 1.45 }))
      L.push(brand(0.92, true))
      L.push(pager(0.86, 'dots'))
      break
    }
    case 'list': {
      bg.variant = 'gradient'
      L.push(T({ name: 'Title', text: c.headline || '5 dinner questions that actually work', yN: 0.18, size: 70, weight: 800, maxWidthN: 0.84 }))
      const items = (c.body || '1. First thing\n2. Second thing\n3. Third thing').split('\n').filter(s => s.trim())
      L.push(T({
        name: 'Items', text: items.join('\n'), yN: 0.55, size: 46, weight: 600,
        align: 'left', xN: 0.12, maxWidthN: 0.78, lineHeight: 1.75,
      }))
      L.push(brand(0.93, true))
      break
    }
    case 'quote': {
      bg.variant = 'rays'
      L.push(T({ name: 'Mark', text: '❝', yN: 0.16, size: 130, weight: 700, color: 'accent', font: 'serif', highlight: 'none' }))
      L.push(T({ name: 'Quote', text: c.headline || 'Play is the work of the child.', yN: 0.45, size: 84, weight: 700, font: 'serif', maxWidthN: 0.8, lineHeight: 1.3 }))
      L.push({ id: pid('dv'), type: 'divider', name: 'Divider', xN: 0.5, yN: 0.66, wN: 0.12, color: 'accent', thick: 8 })
      L.push(T({ name: 'Author', text: c.source || c.body || 'Maria Montessori', yN: 0.72, size: 36, weight: 500, color: 'soft', font: 'mono' }))
      L.push(brand(0.9, true))
      break
    }
    case 'number': {
      bg.variant = 'mesh'
      L.push(T({ name: 'Kicker', text: (c.badge || 'BY THE NUMBERS'), yN: 0.16, size: 30, weight: 700, color: 'accent', font: 'mono', upper: true }))
      L.push(T({ name: 'Number', text: c.headline || '100,000', yN: 0.42, size: 190, weight: 800 }))
      L.push(T({ name: 'Body', text: c.body || 'times your heart beats every single day — without you thinking about it once.', yN: 0.65, size: 44, weight: 500, color: 'soft', maxWidthN: 0.72, lineHeight: 1.45 }))
      L.push(brand(0.92, true))
      L.push(pager(0.86, 'dots'))
      break
    }
    case 'versus': {
      bg.variant = 'aurora'
      L.push(T({ name: 'Title', text: c.headline || 'Pancakes or waffles?', yN: 0.24, size: 84, weight: 800, maxWidthN: 0.84 }))
      const [a, b] = (c.body || 'Pancakes\nWaffles').split('\n')
      L.push(T({ name: 'Option A', text: (a || 'Option A').trim(), yN: 0.48, size: 60, weight: 800, highlight: 'pill' }))
      L.push(T({ name: 'or', text: 'or', yN: 0.585, size: 34, weight: 500, color: 'soft', font: 'serif', highlight: 'none' }))
      L.push(T({ name: 'Option B', text: (b || 'Option B').trim(), yN: 0.69, size: 60, weight: 800, highlight: 'pill' }))
      L.push(T({ name: 'Prompt', text: 'tap your side ↓', yN: 0.82, size: 30, weight: 500, color: 'soft', font: 'mono' }))
      L.push(brand(0.92, true))
      break
    }
    case 'photo': {
      bg.variant = 'solid'; bg.grain = false
      L.push({
        id: pid('im'), type: 'image', name: 'Photo', url: '', mode: 'bg',
        xN: 0.5, yN: 0.5, wN: 1, hN: 1, radius: 0, dim: 0.55, opacity: 1,
      })
      L.push(T({ name: 'Headline', text: c.headline || 'A headline over\nthe photo', yN: 0.78, size: 84, weight: 800, maxWidthN: 0.84 }))
      if (c.body) L.push(T({ name: 'Subline', text: c.body, yN: 0.89, size: 36, weight: 500, color: 'soft', maxWidthN: 0.8 }))
      L.push(brand(0.08, true))
      break
    }
    case 'cta': {
      bg.variant = 'aurora'
      L.push(brand(0.36, false))
      L.push(T({ name: 'Title', text: c.headline || 'Enjoyed this?', yN: 0.53, size: 84, weight: 800 }))
      L.push(T({ name: 'Body', text: c.body || 'Follow for one great family moment every day.', yN: 0.65, size: 42, weight: 500, color: 'soft', maxWidthN: 0.7, lineHeight: 1.4 }))
      L.push(T({ name: 'Handle', text: c.handle || '', yN: 0.78, size: 40, weight: 700, color: 'accent', font: 'mono' }))
      break
    }
    default: return makeSlide('fact', c)
  }
  return { id: pid('sl'), template, bg, layers: L }
}

/** The default document: a ready 3-slide starter carousel. */
export function starterDoc(): PostDoc {
  return {
    v: 1,
    format: 'portrait',
    palette: 'kinetik',
    slides: [
      makeSlide('hook', { headline: 'Your family calendar\nknows 3 secrets', body: 'and the third one is huge', badge: 'NEW' }),
      makeSlide('fact', { emoji: '🤯', headline: 'It rains diamonds on two planets', body: 'On Neptune and Uranus, pressure turns carbon into diamonds that fall like rain.', source: 'planetary science' }),
      makeSlide('cta', { handle: '@kinetikcircle' }),
    ],
    caption: 'Three things your family calendar quietly nailed this week — and the third one is huge. 🤯\n\nSave this for tonight’s dinner conversation.',
    hashtags: '#familytime #funfacts #parentinghacks #kidsactivities',
    brandId: 'kinetikcircle',
    brand: { name: 'KinetikCircle', handle: '@kinetikcircle' },
  }
}

// ── Copilot: prompt → carousel ────────────────────────────────
// JSON contract for the LLM (mirrors @arganta/ai's storyboard pattern).
export const POST_SCHEMA = {
  type: 'object',
  required: ['slides', 'caption'],
  properties: {
    palette: { type: 'string', enum: POST_PALETTES.map(p => p.id) },
    slides: {
      type: 'array',
      items: {
        type: 'object',
        required: ['template'],
        properties: {
          template: { type: 'string', enum: TEMPLATES.map(t => t.id) },
          headline: { type: 'string' },
          body: { type: 'string' },
          emoji: { type: 'string' },
          badge: { type: 'string' },
          source: { type: 'string' },
        },
      },
    },
    caption: { type: 'string' },
    hashtags: { type: 'string' },
  },
}

export function postMessages(prompt: string) {
  const sys = `You are a social content designer for a family app. Output ONLY a JSON object (no prose, no markdown):
{"palette":"${POST_PALETTES.map(p => p.id).join('|')}",
 "slides":[{"template":"${TEMPLATES.map(t => t.id).join('|')}","headline":"short, punchy","body":"1-2 lines (for list: numbered lines separated by \\n; for versus: two options separated by \\n)","emoji":"one emoji (fact only)","badge":"short label (hook/tip/number only)","source":"attribution (fact/quote only)"}],
 "caption":"the post caption — hook in the first 125 chars, 1-3 short paragraphs, 1-2 emoji",
 "hashtags":"#three #to #five #relevant #hashtags"}
Rules: 3-6 slides. Slide 1 = template "hook" with a curiosity gap. Last slide = template "cta". Headlines ≤ 9 words. Bodies ≤ 25 words. Concrete beats clever.`
  const example = {
    palette: 'dusk',
    slides: [
      { template: 'hook', headline: 'Animals with actual superpowers', body: 'no. 3 survives space', badge: 'WOW' },
      { template: 'fact', headline: 'Octopuses have three hearts', body: 'Two pump to the gills, one to the body — and it stops when they swim.', emoji: '🐙' },
      { template: 'number', headline: '3 years', body: 'how long a snail can sleep waiting for rain.', badge: 'BY THE NUMBERS' },
      { template: 'cta', headline: 'Want one of these daily?', body: 'Follow for a family wow-moment every day.' },
    ],
    caption: 'Your kids will not believe #2. 🐙 Three animal superpowers that sound fake but are 100% real — save this for the dinner table.',
    hashtags: '#animalfacts #funfactsforkids #familytime #didyouknow',
  }
  return [
    { role: 'system', content: sys },
    { role: 'user', content: 'a carousel about animal superpowers for families' },
    { role: 'assistant', content: JSON.stringify(example) },
    { role: 'user', content: prompt },
  ]
}

/** Never-throws: whatever the model returned → a valid PostDoc patch. */
export function coercePost(raw: unknown, prompt: string, current: PostDoc): PostDoc {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const tpl = new Set(TEMPLATES.map(t => t.id))
  let slides = Array.isArray(o.slides) ? (o.slides as Record<string, string>[]) : []
  slides = slides.filter(s => s && tpl.has(String(s.template))).slice(0, 8)
  const made = slides.map(s => makeSlide(String(s.template), {
    headline: s.headline ? String(s.headline).slice(0, 140) : undefined,
    body: s.body ? String(s.body).slice(0, 400) : undefined,
    emoji: s.emoji ? String(s.emoji).slice(0, 4) : undefined,
    badge: s.badge ? String(s.badge).slice(0, 24) : undefined,
    source: s.source ? String(s.source).slice(0, 60) : undefined,
    // The end card signs off as THIS doc's brand — never a baked-in handle.
    handle: current.brand?.handle,
  }))
  const doc = made.length ? { ...current, slides: made } : localPost(prompt, current)
  const palId = String(o.palette || '')
  if (POST_PALETTES.some(p => p.id === palId)) doc.palette = palId
  if (typeof o.caption === 'string' && o.caption.trim()) doc.caption = o.caption.slice(0, 2200)
  if (typeof o.hashtags === 'string' && o.hashtags.trim()) doc.hashtags = o.hashtags.slice(0, 300)
  return doc
}

/** Deterministic offline fallback: mines the broadcast LIBRARY for the topic. */
export function localPost(prompt: string, current: PostDoc): PostDoc {
  const words = prompt.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3)
  const scored = LIBRARY.map(it => {
    const hay = (it.title + ' ' + it.body + ' ' + it.theme + ' ' + it.format).toLowerCase()
    return { it, score: words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0) }
  }).sort((a, b) => b.score - a.score)
  const picks = (scored[0]?.score ? scored.filter(x => x.score > 0) : scored).slice(0, 3).map(x => x.it)
  const title = prompt.trim() ? prompt.trim() : 'Three things worth sharing'
  const slides = [
    makeSlide('hook', { headline: title.length > 60 ? title.slice(0, 57) + '…' : title, body: 'swipe — no. ' + picks.length + ' is the good one', badge: 'TODAY' }),
    ...picks.map(it => makeSlide(
      it.format === 'quote' ? 'quote' : it.format === 'top10' ? 'list' : it.format === 'this_or_that' ? 'versus' : it.format === 'by_numbers' ? 'number' : it.format === 'tip' ? 'tip' : 'fact',
      { headline: it.title, body: it.body, emoji: it.emoji, source: it.source },
    )),
    makeSlide('cta', { handle: current.brand?.handle }),
  ]
  return {
    ...current,
    slides,
    caption: `${title} — save this one. ✨\n\nWhich one surprised you? Tell us below.`,
    hashtags: '#funfacts #familytime #didyouknow #kidsfacts',
  }
}
