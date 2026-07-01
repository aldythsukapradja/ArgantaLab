import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Buddy from './components/Buddy'
import { AGENTS } from './data/agents'

const OrgFlow = lazy(() => import('./components/OrgFlow'))

export type Tab = 'home' | 'products' | 'about' | 'pitch'
export type Launch = (deck: string, opt?: { present?: boolean; flight?: string }) => void

// ─────────────── HOME (fit-to-viewport) ───────────────
const PROOF = [
  ['2.5h', 'a day on screens'],
  ['124B', 'hours on Roblox'],
  ['50M+', 'daily Duolingo'],
  ['98M', 'families · Life360'],
]
export function Home({ onLaunch, onTab }: { onLaunch: Launch; onTab: (t: Tab) => void }) {
  return (
    <div className="scr scr-home">
      <div className="scr-hero">
        <div className="scr-hero-buddy"><Buddy mood="wave" size={112} /></div>
        <span className="scr-kick">Arganta</span>
        <h1 className="scr-h1">One trusted OS for<br /><em>the modern family.</em></h1>
        <p className="scr-lede">We turn the screen time families already spend into intelligence, connection and growth — inside circles you trust.</p>
        <div className="scr-cta">
          <button className="scr-btn primary" onClick={() => onLaunch('editorial', { present: true })}>▸ Watch the story</button>
          <button className="scr-btn" onClick={() => onTab('products')}>Explore products</button>
        </div>
      </div>
      <div className="scr-thesis"><span>Kids see play.</span><span className="g">Parents see growth.</span></div>
      <div className="scr-proof">{PROOF.map(([n, t]) => <div key={t} className="scr-proof-i"><b>{n}</b><span>{t}</span></div>)}</div>
    </div>
  )
}

// ─────────────── PRODUCTS (fit, each card → its presentation) ───────────────
const PRODUCTS = [
  { id: 'argantalab', name: 'ArgantaLab', color: '#8b5cf6', tag: 'Six-world learning', line: 'Learn, build, pitch & ship — parents see real growth.' },
  { id: 'kinetik', name: 'KinetikCircle', color: '#06b6d4', tag: 'The family OS', line: 'Routines, calendar, moments — the rhythm of family life.' },
  { id: 'circleapps', name: 'Circle Apps', color: '#10b981', tag: 'One platform, nine apps', line: 'Padel, kitchen, travel, vault — every task, one circle.' },
]
export function Products({ onLaunch }: { onLaunch: Launch }) {
  return (
    <div className="scr scr-products">
      <div className="scr-head"><span className="scr-kick">Products</span><h2 className="scr-h2">Three products, <em>one circle.</em></h2></div>
      <div className="prodlist">
        {PRODUCTS.map(p => (
          <button key={p.id} className="prodx" style={{ ['--wc' as string]: p.color }} onClick={() => onLaunch('general', { flight: p.id })}>
            <span className="prodx-dot" style={{ background: p.color }} />
            <div className="prodx-body">
              <span className="prodx-tag" style={{ color: p.color }}>{p.tag}</span>
              <h3 className="prodx-name">{p.name}</h3>
              <p className="prodx-line">{p.line}</p>
            </div>
            <span className="prodx-go" style={{ color: p.color }}>▸</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────── ABOUT (cinematic two-panel presentation) ───────────────
const ABOUT_STATS: [string, string][] = [
  ['1', 'human CEO'],
  [String(AGENTS.length), 'AI agents'],
  ['3', 'products'],
  ['24/7', 'always shipping'],
]
const MODEL_LEGEND: [string, string][] = [
  ['#0891b2', 'Sonnet — reasoning'],
  ['#059669', 'Haiku — execution'],
  ['#64748b', 'Deterministic'],
]

export function About() {
  const [i, setI] = useState(0)
  const N = 2
  const wheelAcc = useRef(0)
  const lastHop = useRef(0)
  const go = useCallback((d: number) => setI(v => Math.max(0, Math.min(N - 1, v + d))), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const onWheel = (e: React.WheelEvent) => {
    const now = performance.now()
    if (now - lastHop.current < 620) return
    wheelAcc.current += e.deltaY
    if (Math.abs(wheelAcc.current) > 70) { const d = wheelAcc.current > 0 ? 1 : -1; wheelAcc.current = 0; lastHop.current = now; go(d) }
  }
  const ts = useRef({ x: 0, y: 0 })
  const onTS = (e: React.TouchEvent) => { ts.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTE = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - ts.current.x, dy = e.changedTouches[0].clientY - ts.current.y
    const d = Math.abs(dx) > Math.abs(dy) ? -dx : -dy
    if (d > 45) go(1); else if (d < -45) go(-1)
  }
  const cls = (p: number) => p === i ? 'active' : p < i ? 'prev' : 'next'

  return (
    <div className="abx" onWheel={onWheel} onTouchStart={onTS} onTouchEnd={onTE}>
      <div className="abx-stage">
        <section className={`abx-panel ${cls(0)}`} aria-hidden={i !== 0}>
          <div className="abx-founder">
            <div className="abx-halo"><span className="abx-halo-ring" /><Buddy mood="happy" size={104} /></div>
            <span className="scr-kick">About Arganta</span>
            <h2 className="abx-lead">Built by <em>one parent</em>.<br />Run by <em>{AGENTS.length} agents</em>.</h2>
            <p className="abx-quote">"I wanted the calm, ambitious version of childhood screen time — so I built the company to make it, and staffed it with a full team of AI agents."</p>
            <div className="abx-sign"><b>Aldyth Sukapradja</b><span>Founder &amp; human CEO <em className="scr-note">· add photo + story</em></span></div>
          </div>
          <div className="abx-strip">
            {ABOUT_STATS.map(([n, l]) => <div key={l} className="abx-stat"><b>{n}</b><span>{l}</span></div>)}
          </div>
        </section>

        <section className={`abx-panel abx-team ${cls(1)}`} aria-hidden={i !== 1}>
          <div className="abx-teamhead">
            <span className="scr-kick">The company</span>
            <h2 className="abx-teamlead">A company that <em>runs itself.</em></h2>
          </div>
          {i === 1
            ? <Suspense fallback={<div className="orgflow" />}><OrgFlow /></Suspense>
            : <div className="orgflow" />}
          <div className="abx-legend">{MODEL_LEGEND.map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>
        </section>
      </div>

      <div className="abx-ctrl">
        <button className="abx-arrow" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous">‹</button>
        <div className="abx-dots">{Array.from({ length: N }, (_, p) => <button key={p} className={`abx-dot${p === i ? ' on' : ''}`} onClick={() => setI(p)} aria-label={`Panel ${p + 1}`} />)}</div>
        <button className="abx-arrow" onClick={() => go(1)} disabled={i === N - 1} aria-label="Next">›</button>
      </div>
    </div>
  )
}
