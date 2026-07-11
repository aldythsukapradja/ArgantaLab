import { useCallback, useEffect, useRef, useState } from 'react'
import Buddy from './components/Buddy'
import OrgFlow from './components/OrgFlow'
import { JarvisOrb } from './components/JarvisOrb'
import { AGENTS, OFFICES } from './data/agents'
import { SITE } from './lib/site'

export type Tab = 'home' | 'products' | 'about' | 'pitch' | 'command'
export type Launch = (deck: string, opt?: { present?: boolean; flight?: string }) => void

// ─────────────── HOME (fit-to-viewport) ───────────────
export function Home({ onLaunch, onTab }: { onLaunch: Launch; onTab: (t: Tab) => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return
    // waitlist table not wired yet → mailto fallback so no signup is ever lost
    window.location.href = `mailto:${SITE.brand.email}?subject=Waitlist&body=${encodeURIComponent(email)}`
    setSent(true)
  }
  return (
    <div className="scr scr-home">
      <div className="scr-hero">
        <div className="scr-hero-buddy"><Buddy mood="wave" size={112} /></div>
        <span className="scr-kick">{SITE.hero.kicker}</span>
        <h1 className="scr-h1">{SITE.hero.title[0]}<br /><em>{SITE.hero.title[1]}.</em></h1>
        <p className="scr-lede">{SITE.hero.lede}</p>
        <div className="scr-cta">
          <button className="scr-btn primary" onClick={() => onLaunch('editorial', { present: true })}>▸ Watch the story</button>
          <button className="scr-btn" onClick={() => onTab('products')}>Explore products</button>
        </div>
        <form className="scr-wait" onSubmit={submit}>
          {sent ? <span className="scr-wait-ok">✓ Thanks — check your mail app to confirm.</span> : <>
            <input className="scr-wait-in" type="email" inputMode="email" placeholder="you@family.com" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email for the waitlist" />
            <button className="scr-wait-btn" type="submit">Join the waitlist</button>
          </>}
        </form>
      </div>
      <div className="scr-trust">
        <span className="scr-trust-l">{SITE.trust.line}</span>
        <div className="scr-trust-chips">{SITE.trust.chips.map(c => <span key={c} className="scr-trust-chip">{c}</span>)}</div>
      </div>
      <div className="scr-proof">{SITE.proof.map(([n, t]) => <div key={t} className="scr-proof-i"><b>{n}</b><span>{t}</span></div>)}</div>
    </div>
  )
}

// ─────────────── PRODUCTS (fit, each card → its presentation) ───────────────
export function Products({ onLaunch }: { onLaunch: Launch }) {
  return (
    <div className="scr scr-products">
      <div className="scr-head"><span className="scr-kick">Products</span><h2 className="scr-h2">Four surfaces, <em>one circle.</em></h2></div>
      <div className="prodlist">
        {SITE.products.map(p => (
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

// ─────────────── ABOUT (cinematic three-panel presentation) ───────────────
const ABOUT_STATS: [string, string][] = [
  ['1', 'human CEO'],
  [String(AGENTS.length), 'AI agents'],
  [String(OFFICES.length), 'offices'],
  ['24/7', 'always shipping'],
]

export function About() {
  const [i, setI] = useState(0)
  const N = 3
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
            <div className="abx-halo"><span className="abx-halo-ring" /><span className="abx-monogram">{SITE.founder.monogram}</span></div>
            <span className="scr-kick">About {SITE.brand.name}</span>
            <h2 className="abx-lead">Built by <em>one parent</em>.<br />Run by <em>{AGENTS.length} agents</em>.</h2>
            <p className="abx-quote">"{SITE.founder.quote}"</p>
            <div className="abx-sign"><b>{SITE.founder.name}</b><span>{SITE.founder.role}</span></div>
          </div>
          <div className="abx-strip">
            {ABOUT_STATS.map(([n, l]) => <div key={l} className="abx-stat"><b>{n}</b><span>{l}</span></div>)}
          </div>
        </section>

        <section className={`abx-panel abx-team ${cls(1)}`} aria-hidden={i !== 1}>
          <div className="abx-teamhead">
            <span className="scr-kick">The company · six offices</span>
            <h2 className="abx-teamlead">A company that <em>runs itself.</em></h2>
          </div>
          <JarvisOrb />
          <OrgFlow />
          <div className="abx-legend">{OFFICES.map(o => <span key={o.id}><i style={{ background: o.accent }} />{o.label}</span>)}</div>
        </section>

        <section className={`abx-panel abx-humans ${cls(2)}`} aria-hidden={i !== 2}>
          <div className="abx-teamhead">
            <span className="scr-kick">The humans</span>
            <h2 className="abx-teamlead">{SITE.humans.line}</h2>
          </div>
          <div className="abx-humans-grid">
            {SITE.humans.does.map(d => <div key={d} className="abx-human-card">{d}</div>)}
          </div>
          <div className="abx-stack">{SITE.humans.stack.map(s => <span key={s} className="abx-stack-chip">{s}</span>)}</div>
          <a className="abx-cta" href={`mailto:${SITE.brand.email}?subject=Working%20with%20Arganta`}>{SITE.humans.cta}</a>
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
