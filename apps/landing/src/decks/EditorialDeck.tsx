import { useCallback, useEffect, useRef, useState } from 'react'
import Buddy from '../components/Buddy'
import Ring from '../components/Ring'
import KinSprite from '../components/KinSprite'
import AvatarSprite from '../components/AvatarSprite'
import { WORLDS, RING_LABELS } from '../data/worlds'
import { AGENTS } from '../data/agents'
import OrgChart from '../components/OrgChart'
import { ThemeToggle } from '../theme'

// ──────────────────────────────────────────────────────────────
//  EDITORIAL — a cinematic slide PRESENTATION (no scroll). Full-screen slides
//  advance one at a time with a fancy scale/blur/fade transition + staggered
//  reveals. "Present" auto-plays; otherwise step with keys / arrows / dots.
// ──────────────────────────────────────────────────────────────

const EN = { care: '#F2738C', mind: '#48A7EA', growth: '#27B79A', memory: '#8E7BEA', play: '#ECA13A', calm: '#7C89C4' }
const ORBIT_PCT: Record<string, number> = { NUM: 80, WRD: 55, WON: 100, LOG: 35, WLD: 70, LIF: 45 }
const FLOW = [
  { tm: '3am', t: 'Ngaji', e: 'growth', done: true }, { tm: '9am', t: 'Math Miss Rani', e: 'growth', done: true, clash: true },
  { tm: '9am', t: 'ArgantaLAB', e: 'calm', done: true }, { tm: '2:30pm', t: 'Gitar', e: 'growth', done: true },
]

function Orbit() {
  return (
    <div className="orbit">
      <svg className="orbit-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {WORLDS.map((w, i) => { const a = (-90 + i * 60) * Math.PI / 180; return <line key={w.key} x1="50" y1="50" x2={50 + 38 * Math.cos(a)} y2={50 + 38 * Math.sin(a)} stroke={w.color} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.4" /> })}
      </svg>
      <div className="orbit-buddy"><Buddy mood="happy" size={104} /></div>
      {WORLDS.map((w, i) => { const a = (-90 + i * 60) * Math.PI / 180; const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a)
        return <div key={w.key} className="orbit-node" style={{ left: `${x}%`, top: `${y}%` }}>
          <span className="orbit-ring"><Ring pct={ORBIT_PCT[w.key]} color={w.color} size={58} /><span className="orbit-glyph" style={{ color: w.color }}>{w.icon}</span></span>
          <span className="orbit-label">{RING_LABELS[w.key]}</span>
        </div> })}
    </div>
  )
}

interface Slide { id: string; layout: 'center' | 'split' | 'split reverse'; el: React.ReactNode }
const SLIDES: Slide[] = [
  { id: 'hero', layout: 'center', el: <>
    <div className="ed-core" aria-hidden><span /></div>
    <span className="ed-kick">The Arganta presentation</span>
    <h1 className="ed-display xl">Screen time,<br /><em>rewritten.</em></h1>
  </> },
  { id: 'thesis', layout: 'center', el: <>
    <h2 className="ed-display">Kids see play.<br /><em>Parents see growth.</em></h2>
    <p className="ed-sub">The same hour on a screen, pointed at something that lasts.</p>
  </> },
  { id: 'problem', layout: 'center', el: <>
    <span className="ed-kick">The problem</span>
    <div className="ed-bignum">2.5<span>hrs / day</span></div>
    <h2 className="ed-display sm">A childhood of screens, <em>building nothing.</em></h2>
  </> },
  { id: 'product', layout: 'split', el: <>
    <div className="ed-copy">
      <span className="ed-kick">The product · ArgantaLab</span>
      <h2 className="ed-display sm">One playful world.<br />Six kinds of intelligence.</h2>
      <p className="ed-body">A companion to grow, six worlds to master, a daily ring to close. Everything a kid loves about a game, aimed at everything a parent wants them to become.</p>
    </div>
    <div className="ed-device orbit-device"><Orbit /></div>
  </> },
  { id: 'make', layout: 'center', el: <>
    <span className="ed-kick">Create</span>
    <h2 className="ed-display sm">They don't just play games.<br /><em>They build, pitch, and ship them.</em></h2>
    <div className="ed-steps">{['Build a game', 'Learn to code', 'Prompt an AI', 'Pitch it', 'Ship it'].map(s => <span key={s} className="ed-step">{s}</span>)}</div>
    <div className="ed-kinrow">{[['countfox', '#f59e0b'], ['letterowl', '#3b82f6'], ['datadragon', '#8b5cf6'], ['mapturtle', '#ef4444'], ['galaxyfawn', '#10b981']].map(([r, c]) => <KinSprite key={r} render={r} color={c} size={60} bob />)}</div>
  </> },
  { id: 'family', layout: 'split reverse', el: <>
    <div className="ed-copy">
      <span className="ed-kick">The family layer · KinetikCircle</span>
      <h2 className="ed-display sm">Learning lives inside<br />real family life.</h2>
      <p className="ed-body">One calm view of the whole circle's day — routines, plans and energy, colour-coded by what kind of time it is. Learning sits in the rhythm, not beside it.</p>
    </div>
    <div className="ed-device">
      <div className="kt-screen">
        <div className="kt-hero">
          <div className="kt-hero-txt"><span className="kt-eyebrow">TUESDAY, JUNE 30</span><b className="kt-greet">Good evening, Aldyth</b><span className="kt-sub">All 7 done — beautiful work.</span></div>
          <div className="kt-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" className="kt-ring-t" /><circle cx="40" cy="40" r="34" className="kt-ring-b" transform="rotate(-90 40 40)" /></svg><span className="kt-ring-c"><b>7</b><i>of 7</i></span></div>
        </div>
        <div className="kt-flowlbl">TODAY'S FLOW</div>
        <div className="kt-flow">{FLOW.map((a, i) => <div key={i} className="kt-ev"><span className="kt-t">{a.tm}</span><span className="kt-node" style={{ background: EN[a.e as keyof typeof EN] }}>{a.done && '✓'}</span><span className="kt-ev-b"><b>{a.t}</b></span>{a.clash && <span className="kt-clash">CLASH</span>}</div>)}</div>
      </div>
    </div>
  </> },
  { id: 'proof', layout: 'split', el: <>
    <div className="ed-copy">
      <span className="ed-kick">Parent view</span>
      <h2 className="ed-display sm">They see play.<br /><em>You see progress.</em></h2>
      <p className="ed-body">Behind the fun: skills mastered, depth of thinking, gaps to close. The one screen that tells you your child is actually growing.</p>
    </div>
    <div className="ed-device">
      <div className="dash">
        <div className="dash-kpis">{[['7', 'day streak'], ['41m', 'today'], ['6/6', 'rings']].map(([v, l]) => <div key={l} className="dash-kpi"><b>{v}</b><span>{l}</span></div>)}</div>
        {[['Number sense', 82, '#f59e0b'], ['Reading', 64, '#3b82f6'], ['Science', 91, '#10b981'], ['Logic & code', 47, '#8b5cf6']].map(([l, p, c]) => (
          <div key={l as string} className="dash-row"><div className="dash-row-top"><span>{l}</span><b style={{ color: c as string }}>{p}%</b></div><div className="lbar"><i style={{ width: `${p}%`, background: c as string }} /></div></div>
        ))}
      </div>
    </div>
  </> },
  { id: 'agents', layout: 'center', el: <>
    <div className="ed-orghead">
      <span className="ed-kick">The company · run by agents</span>
      <h2 className="ed-display sm">One founder. <em>A whole company of {AGENTS.length} agents.</em></h2>
    </div>
    <OrgChart />
  </> },
  { id: 'founder', layout: 'center', el: <>
    <div className="ed-founder">
      <span className="ed-face"><AvatarSprite size={92} mood="happy" /></span>
      <div>
        <span className="ed-kick">The founder</span>
        <h2 className="ed-display xs">Built by a parent, for parents.</h2>
        <p className="ed-body">Aldyth Sukapradja — building the calm, ambitious version of childhood screen time I want for my own family. <span className="ed-note">(add your photo + story here)</span></p>
      </div>
    </div>
  </> },
  { id: 'cta', layout: 'center', el: <>
    <h2 className="ed-display">Make screen time <em>count.</em></h2>
    <div className="ed-cta-actions">
      <a className="ed-btn primary" href="https://lab.arganta.app" target="_blank" rel="noopener noreferrer">Explore ArgantaLab →</a>
      <a className="ed-btn" href="mailto:hello@arganta.app">Join the waitlist</a>
    </div>
    <p className="ed-foot">Arganta — one trusted OS for the modern family.</p>
  </> },
]

export default function EditorialDeck({ present = false, onExit }: { present?: boolean; onExit?: () => void }) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(present)
  const n = SLIDES.length
  const lastHop = useRef(0)
  const wheelAcc = useRef(0)

  const goTo = useCallback((i: number) => setIdx(Math.max(0, Math.min(n - 1, i))), [n])
  const step = useCallback((d: number) => setIdx(i => Math.max(0, Math.min(n - 1, i + d))), [n])
  const manual = useCallback((d: number) => { setPlaying(false); step(d) }, [step])

  // auto-present
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setIdx(i => (i + 1) % n), 4200)
    return () => clearInterval(id)
  }, [playing, n])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'ArrowDown') { e.preventDefault(); manual(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') { e.preventDefault(); manual(-1) }
      else if (e.key === 'Escape') onExit?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [manual, onExit])

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const now = performance.now()
      if (now - lastHop.current < 700) return
      wheelAcc.current += e.deltaY
      if (Math.abs(wheelAcc.current) > 80) { const d = wheelAcc.current > 0 ? 1 : -1; wheelAcc.current = 0; lastHop.current = now; manual(d) }
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [manual])

  useEffect(() => {
    let x0 = 0, y0 = 0
    const ts = (e: TouchEvent) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY }
    const te = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0
      const d = Math.abs(dx) > Math.abs(dy) ? -dx : -dy
      if (d > 45) manual(1); else if (d < -45) manual(-1)
    }
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchend', te, { passive: true })
    return () => { window.removeEventListener('touchstart', ts); window.removeEventListener('touchend', te) }
  }, [manual])

  return (
    <div className="edp">
      <header className="ed-nav">
        <button className="ed-back" onClick={onExit}>← Back</button>
        <span className="ed-brand">Arganta</span>
        <div className="ed-nav-r">
          <button className="ed-present" onClick={() => setPlaying(p => !p)}>{playing ? 'Pause' : 'Present'}</button>
          <ThemeToggle className="ed-theme" />
        </div>
      </header>

      <div className="slides">
        {SLIDES.map((s, i) => (
          <section key={s.id} className={`slide ${i === idx ? 'active' : i < idx ? 'prev' : 'next'}`} aria-hidden={i !== idx}>
            <div className={`slide-in ${s.layout}`}>{s.el}</div>
          </section>
        ))}
      </div>

      <div className="edp-controls">
        <button className="edp-arrow" onClick={() => manual(-1)} disabled={idx === 0} aria-label="Previous">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="edp-dots">{SLIDES.map((s, i) => <button key={s.id} className={`edp-dot${i === idx ? ' on' : ''}`} onClick={() => { setPlaying(false); goTo(i) }} aria-label={s.id} />)}</div>
        <button className="edp-arrow" onClick={() => manual(1)} disabled={idx === n - 1} aria-label="Next">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      <div className="edp-count">{String(idx + 1).padStart(2, '0')} <i>/ {String(n).padStart(2, '0')}</i></div>
      <div className="edp-progress"><i style={{ width: `${(idx / (n - 1)) * 100}%` }} /></div>
    </div>
  )
}
