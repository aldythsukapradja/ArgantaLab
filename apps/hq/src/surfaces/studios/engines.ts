// Deterministic, zero-cost (Stage-0) generators for the studio segments that
// produce HTML/brand artifacts. Same brief → same output. No providers, no API.
// These make Website / Brand / Deck tangible; Scene (3D) and Analytics have
// their own React modules.

import { PALETTES } from '@arganta/media-core'

const PAL_KEYS = Object.keys(PALETTES)
const hex = (rgb: number[]) => '#' + rgb.map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('')

function hash(s: string) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) } return h >>> 0 }

const FONT_PAIRS = [
  { head: 'Georgia, "Times New Roman", serif', body: 'system-ui, sans-serif', name: 'Editorial' },
  { head: '"Trebuchet MS", system-ui, sans-serif', body: 'system-ui, sans-serif', name: 'Geometric' },
  { head: '"Courier New", monospace', body: 'system-ui, sans-serif', name: 'Mono-lede' },
  { head: 'system-ui, sans-serif', body: 'Georgia, serif', name: 'Humanist' },
]

export interface BrandKit {
  name: string; palette: string; fonts: { head: string; body: string; name: string }
  colors: { bg: string; mid: string; accent: string; ink: string; paper: string }
  seed: number
}

export function makeBrand(brief: string): BrandKit {
  const seed = hash(brief || 'arganta')
  const palette = PAL_KEYS[seed % PAL_KEYS.length]
  const stops = PALETTES[palette] as number[][]
  const fonts = FONT_PAIRS[(seed >> 3) % FONT_PAIRS.length]
  const name = (brief.split(/[—\-,.\n]/)[0] || 'Arganta').trim().slice(0, 28) || 'Arganta'
  return {
    name, palette, fonts, seed,
    colors: { bg: hex(stops[0]), mid: hex(stops[1]), accent: hex(stops[2]), ink: '#f7f5ff', paper: '#ffffff' },
  }
}

/** Split a brief into a headline + supporting points. */
function parts(brief: string) {
  const segs = brief.split(/[.\n]+/).map(s => s.trim()).filter(Boolean)
  const headline = segs[0] || 'Build the future, playfully.'
  const rest = segs.slice(1)
  const feats = (rest.length ? rest : ['Fast', 'Delightful', 'Yours']).slice(0, 3)
  return { headline, feats }
}

/** AI-provided copy (S1) that can override the deterministic extraction below. */
export interface WebsiteCopy { headline: string; features: string[] }

/** Self-contained landing-page HTML from a brief. Renders in an iframe; exports
 *  as one file. `aiCopy` (S1, optional) overrides the deterministic headline/
 *  features when present — the deterministic extraction is always the fallback,
 *  never a hard dependency. */
export function makeWebsite(brief: string, brand = makeBrand(brief), aiCopy?: WebsiteCopy | null): string {
  const extracted = parts(brief)
  const headline = aiCopy?.headline || extracted.headline
  const feats = aiCopy?.features?.length ? aiCopy.features : extracted.feats
  const c = brand.colors
  const cards = feats.map((f, i) => `<div class="card"><div class="n">0${i + 1}</div><h3>${esc(f.split(' ').slice(0, 4).join(' '))}</h3><p>${esc(f)}</p></div>`).join('')
  return `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{margin:0;box-sizing:border-box}body{font-family:${brand.fonts.body};color:${c.ink};background:${c.bg}}
.hero{min-height:62vh;display:grid;place-items:center;text-align:center;padding:8vh 6vw;background:radial-gradient(120% 90% at 70% 10%,${c.accent}44,transparent),linear-gradient(160deg,${c.bg},${c.mid})}
.badge{font-size:12px;letter-spacing:.28em;text-transform:uppercase;opacity:.75;margin-bottom:18px}
h1{font-family:${brand.fonts.head};font-size:clamp(30px,6vw,64px);line-height:1.05;max-width:16ch;margin:0 auto}
.sub{margin:20px auto 0;max-width:48ch;opacity:.82;font-size:clamp(15px,2vw,19px)}
.cta{display:inline-block;margin-top:30px;background:${c.accent};color:#1a1030;padding:14px 30px;border-radius:999px;font-weight:700;text-decoration:none}
.feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;padding:7vh 6vw;background:${c.mid}}
.card{background:#ffffff12;border:1px solid #ffffff20;border-radius:18px;padding:26px}
.card .n{font-family:${brand.fonts.head};opacity:.5;font-size:14px}.card h3{margin:8px 0;font-size:21px}.card p{opacity:.8;font-size:14px}
footer{padding:5vh 6vw;text-align:center;opacity:.6;font-size:13px;background:${c.bg}}
</style></head><body>
<section class="hero"><div><div class="badge">${esc(brand.name)}</div><h1>${esc(headline)}</h1><p class="sub">${esc(brief.slice(0, 140))}</p><a class="cta" href="#">Get started →</a></div></section>
<section class="feats">${cards}</section>
<footer>© ${new Date().getFullYear()} ${esc(brand.name)} · generated deterministically by Media Center</footer>
</body></html>`
}

/** Self-contained cinematic slide deck HTML from an outline. Arrow-key + auto
 *  nav. `aiScenes` (S2, optional) overrides the deterministic comma/line split
 *  with AI-expanded "Title: supporting sentence" entries — same fallback rule
 *  as makeWebsite: deterministic extraction never depends on AI succeeding. */
export function makeDeck(outline: string, brand = makeBrand(outline), aiScenes?: string[] | null): string {
  const c = brand.colors
  const scenes = aiScenes?.length ? aiScenes : outline.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
  const list = (scenes.length ? scenes : ['Problem', 'Insight', 'Product', 'Traction', 'The ask'])
  const slides = list.map((s, i) => {
    const [title, ...rest] = s.split(':')
    return `<section class="slide"><div class="idx">${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}</div><h2>${esc(title.trim())}</h2>${rest.length ? `<p>${esc(rest.join(':').trim())}</p>` : ''}</section>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf8"><style>
*{margin:0;box-sizing:border-box}html,body{height:100%}body{font-family:${brand.fonts.body};color:${c.ink};background:${c.bg};overflow:hidden}
.deck{height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory;scroll-behavior:smooth}
.slide{height:100vh;scroll-snap-align:start;display:grid;place-items:center;text-align:center;padding:10vh 8vw;background:radial-gradient(90% 70% at 30% 20%,${c.accent}33,transparent),linear-gradient(160deg,${c.bg},${c.mid})}
.idx{position:absolute;top:5vh;font-size:12px;letter-spacing:.3em;opacity:.6}
h2{font-family:${brand.fonts.head};font-size:clamp(32px,7vw,72px);max-width:18ch}
.slide p{margin-top:22px;max-width:44ch;opacity:.82;font-size:clamp(16px,2.2vw,22px)}
</style></head><body><div class="deck" id="d">${slides}</div><script>
var d=document.getElementById('d'),n=${list.length},i=0;
function go(k){i=Math.max(0,Math.min(n-1,k));d.scrollTo({top:i*innerHeight,behavior:'smooth'})}
addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();go(i+1)}if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();go(i-1)}});
var t=setInterval(function(){if(i<n-1)go(i+1);else clearInterval(t)},3200);
</script></body></html>`
}

function esc(s: string) { return String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]!)) }
