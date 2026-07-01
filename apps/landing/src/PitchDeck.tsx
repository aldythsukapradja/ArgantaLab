import { useCallback, useEffect, useRef, useState } from 'react'
import { useHqPitch, UNIT_ECON, type PitchData } from './lib/hq'
import { AGENTS } from './data/agents'

// ── inline investor pitch — a slide presentation inside the Pitch tab ──
const fmt = (n?: number | null, suffix = '') => n == null ? null : (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(Math.round(n * 10) / 10)) + suffix
const usd = (n: number) => '$' + (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(n < 10 ? 2 : 0))

function Metric({ label, value, bench, what }: { label: string; value: string | null; bench: string; what: string }) {
  return (
    <div className="mcard">
      <span className="mcard-l">{label}</span>
      <b className={`mcard-v${value == null ? ' soon' : ''}`}>{value ?? 'live soon'}</b>
      <span className="mcard-bench">{bench}</span>
      <span className="mcard-what">{what}</span>
    </div>
  )
}

interface Slide { id: string; el: (d: PitchData | null) => React.ReactNode }
const SLIDES: Slide[] = [
  { id: 'cover', el: () => <>
    <span className="pkick">Investor pitch · Seed · 2026</span>
    <h1 className="pdisplay xl">Turn screen time into<br /><em>intelligence time.</em></h1>
    <p className="psub">Every number here is a live aggregate from our own operator system — benchmarked to YC / edtech quartiles, revenue ratios marked pending, never faked.</p>
  </> },
  { id: 'thesis', el: () => <><h2 className="pdisplay">Kids see play.<br /><em>Parents see growth.</em></h2></> },
  { id: 'problem', el: () => <>
    <span className="pkick">The problem</span>
    <div className="pbignum">2.5<span>hrs / day</span></div>
    <h2 className="pdisplay sm">A childhood of screens, <em>building nothing.</em></h2>
  </> },
  { id: 'whynow', el: () => <>
    <span className="pkick">Why now</span>
    <h2 className="pdisplay sm">Each pillar is <em>already proven.</em></h2>
    <div className="pgrid3">
      <div className="mcard"><b className="mcard-v">124B</b><span className="mcard-what">hours on Roblox, 2025 — kids live in digital worlds</span></div>
      <div className="mcard"><b className="mcard-v">50M+</b><span className="mcard-what">daily Duolingo learners — gamified habit works</span></div>
      <div className="mcard"><b className="mcard-v">98M</b><span className="mcard-what">families on Life360 — households organize in circles</span></div>
    </div>
  </> },
  { id: 'wedge', el: () => <>
    <span className="pkick">The wedge</span>
    <h2 className="pdisplay sm">Don't fight the screen.<br /><em>Redirect it.</em></h2>
    <p className="psub">Route the hours kids already spend into a six-world learning journey, inside a circle parents trust.</p>
  </> },
  { id: 'product', el: () => <>
    <span className="pkick">The product</span>
    <h2 className="pdisplay sm">One OS, <em>three products.</em></h2>
    <div className="pgrid3">
      <div className="mcard"><span className="mcard-l" style={{ color: '#8b5cf6' }}>ArgantaLab</span><span className="mcard-what">Six-world learning · build, pitch & ship</span></div>
      <div className="mcard"><span className="mcard-l" style={{ color: '#06b6d4' }}>KinetikCircle</span><span className="mcard-what">The family OS · rhythm, calendar, moments</span></div>
      <div className="mcard"><span className="mcard-l" style={{ color: '#10b981' }}>Circle Apps</span><span className="mcard-what">Nine task apps · one shared spine</span></div>
    </div>
  </> },
  { id: 'engagement', el: d => <>
    <span className="pkick">It works · engagement</span>
    <h2 className="pdisplay sm">The pre-revenue <em>truth.</em></h2>
    <div className="pgrid2">
      <Metric label="Weekly active learners" value={fmt(d?.wau)} bench="North Star" what="Unique kids who used the app in 7 days — the truest pulse." />
      <Metric label="Stickiness · DAU/MAU" value={fmt(d?.stickiness ?? undefined, '%')} bench="> 20% strong · > 50% elite" what="Share of monthly users active on an average day." />
      <Metric label="WoW growth" value={d?.wowPct == null ? null : (d.wowPct > 0 ? '+' : '') + d.wowPct + '%'} bench="> 7% = YC default-alive" what="Weekly-active growth vs the prior week." />
      <Metric label="Depth · attempts/active" value={fmt(d?.depth)} bench="> 4 healthy · > 8 deep" what="Questions each active learner attempts per week." />
    </div>
  </> },
  { id: 'intelligence', el: d => <>
    <span className="pkick">Intelligence time</span>
    <h2 className="pdisplay sm">The graph <em>parents pay for.</em></h2>
    <div className="pgrid3">
      <Metric label="Lessons / kid / day" value={fmt(d?.lessonsPerKidDay)} bench="the habit" what="Learning volume per active child, per day." />
      <Metric label="Screen-min / kid / day" value={fmt(d?.screenMinPerKidDay, 'm')} bench="time redirected" what="Minutes of screen time turned into learning." />
      <Metric label="Accuracy" value={fmt(d?.accuracyPct ?? undefined, '%')} bench="healthy 55–85%" what="Kept challenged but succeeding = mastery." />
    </div>
  </> },
  { id: 'retention', el: d => <>
    <span className="pkick">Retention · the #1 number</span>
    <h2 className="pdisplay sm">Proof the product <em>keeps them.</em></h2>
    <div className="pgrid3">
      <Metric label="D30 retention" value={fmt(d?.d30 ?? undefined, '%')} bench="> 35% top-quartile edtech" what="Kids still active 30 days after joining." />
      <Metric label="D1 retention" value={fmt(d?.d1 ?? undefined, '%')} bench="next-day comeback" what="Come-back rate the day after a session." />
      <Metric label="Activation · 48h" value={fmt(d?.activationRate ?? undefined, '%')} bench="first-value speed" what="Signups who take a real action within 48h." />
    </div>
  </> },
  { id: 'flywheel', el: d => <>
    <span className="pkick">The flywheel · moat</span>
    <h2 className="pdisplay sm">Circles make it <em>grow itself.</em></h2>
    <div className="pgrid3">
      <Metric label="Active circles" value={fmt(d?.flywheelCount)} bench="network unit" what="Circles containing an active learner." />
      <Metric label="k-factor" value={fmt(d?.kFactor)} bench="> 1 = viral" what="New users each user brings via invites." />
      <Metric label="Families" value={fmt(d?.familiesTotal)} bench="the base" what="Households on the platform." />
    </div>
  </> },
  { id: 'economy', el: d => <>
    <span className="pkick">The Argon economy</span>
    <h2 className="pdisplay sm">Kids already <em>spend.</em> Parents will pay.</h2>
    <div className="pgrid3">
      <Metric label="Spend / active kid · 30d" value={fmt(d?.spentPerActiveKid)} bench="pay-intent proxy" what="Argons kids choose to spend — demand signal." />
      <Metric label="Sink coverage" value={fmt(d?.econCoverage ?? undefined, '%')} bench="healthy economy" what="Spent ÷ recurring mint — a balanced economy." />
      <Metric label="Argons in float" value={fmt(d?.econFloat)} bench="engagement stock" what="Earned-but-unspent — stored motivation." />
    </div>
  </> },
  { id: 'econ', el: () => <>
    <span className="pkick">Unit economics · base case</span>
    <h2 className="pdisplay sm">Built to <em>compound.</em></h2>
    <div className="pgrid3">
      <div className="mcard hero"><b className="mcard-v">{UNIT_ECON.mid.ltvCac.toFixed(1)}×</b><span className="mcard-l">LTV / CAC</span><span className="mcard-what">Low {UNIT_ECON.low.ltvCac.toFixed(1)}× · High {UNIT_ECON.high.ltvCac.toFixed(1)}×</span></div>
      <div className="mcard hero"><b className="mcard-v">{UNIT_ECON.mid.payback.toFixed(1)}mo</b><span className="mcard-l">CAC payback</span><span className="mcard-what">85% gross margin</span></div>
      <div className="mcard hero"><b className="mcard-v">{usd(UNIT_ECON.mid.ltv)}</b><span className="mcard-l">LTV / subscriber</span><span className="mcard-what">$0.96 blended ARPU/family/mo</span></div>
    </div>
    <p className="psub sm">Two streams — family subscription + Argon packs. Model: 5% convert · $7.99 · 5% churn.</p>
  </> },
  { id: 'moat', el: () => <>
    <span className="pkick">The moat</span>
    <h2 className="pdisplay sm">Three moats that <em>compound.</em></h2>
    <div className="pgrid3">
      <div className="mcard"><b className="mcard-v">{AGENTS.length}</b><span className="mcard-l">AI-agent company</span><span className="mcard-what">One founder, a full org of agents — lean, ships fast, scales without headcount.</span></div>
      <div className="mcard"><span className="mcard-l" style={{ color: '#06b6d4' }}>Circles</span><span className="mcard-what">Network effect — every family deepens the trusted circle graph + proprietary learning data.</span></div>
      <div className="mcard"><span className="mcard-l" style={{ color: '#10b981' }}>Content depth</span><span className="mcard-what">Six worlds × six age stages — thousands of authored, adaptive learning items.</span></div>
    </div>
  </> },
  { id: 'traction', el: d => <>
    <span className="pkick">Traction · live catalog</span>
    <h2 className="pdisplay sm">Real scale, <em>today.</em></h2>
    <div className="pgrid4">
      <Metric label="Learners" value={fmt(d?.learners)} bench="signups" what="Kids who joined ArgantaLab." />
      <Metric label="Circles" value={fmt(d?.circles)} bench="households" what="Family/class circles created." />
      <Metric label="Worlds live" value={fmt(d?.worldsLive)} bench="content" what="Learning worlds shipped." />
      <Metric label="Items live" value={fmt(d?.itemsLive)} bench="depth" what="Playable learning items authored." />
    </div>
  </> },
  { id: 'ask', el: () => <>
    <span className="pkick">Team · the ask</span>
    <h2 className="pdisplay sm">Built by a parent.<br /><em>Raising to reach 10,000 families.</em></h2>
    <p className="psub">Aldyth Sukapradja, founder. Raising a seed round to scale the agent workforce. <span className="pnote">(raise amount, use of funds & bio — TBD)</span></p>
    <div className="pcta"><a className="pbtn primary" href="mailto:hello@arganta.app?subject=Investing%20in%20Arganta">Talk to us →</a></div>
  </> },
]

export default function PitchDeck() {
  const { data } = useHqPitch()
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const n = SLIDES.length
  const wheelAcc = useRef(0)
  const lastHop = useRef(0)

  const go = useCallback((d: number) => setIdx(i => Math.max(0, Math.min(n - 1, i + d))), [n])
  const manual = useCallback((d: number) => { setPlaying(false); go(d) }, [go])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setIdx(i => (i + 1) % n), 5200)
    return () => clearInterval(id)
  }, [playing, n])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); manual(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); manual(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [manual])

  const onWheel = (e: React.WheelEvent) => {
    const now = performance.now()
    if (now - lastHop.current < 650) return
    wheelAcc.current += e.deltaY
    if (Math.abs(wheelAcc.current) > 60) { const d = wheelAcc.current > 0 ? 1 : -1; wheelAcc.current = 0; lastHop.current = now; manual(d) }
  }

  return (
    <div className="pdeck" onWheel={onWheel}>
      <div className="pdeck-slides">
        {SLIDES.map((s, i) => (
          <section key={s.id} className={`pslide ${i === idx ? 'active' : i < idx ? 'prev' : 'next'}`} aria-hidden={i !== idx}>
            <div className="pslide-in">{s.el(data)}</div>
          </section>
        ))}
      </div>
      <div className="pdeck-ctrl">
        <button className="pdeck-arrow" onClick={() => manual(-1)} disabled={idx === 0} aria-label="Previous">‹</button>
        <button className="pdeck-play" onClick={() => setPlaying(p => !p)}>{playing ? 'Pause' : 'Present'}</button>
        <div className="pdeck-dots">{SLIDES.map((s, i) => <button key={s.id} className={`pdeck-dot${i === idx ? ' on' : ''}`} onClick={() => { setPlaying(false); setIdx(i) }} aria-label={s.id} />)}</div>
        <span className="pdeck-count">{String(idx + 1).padStart(2, '0')}/{n}</span>
        <button className="pdeck-arrow" onClick={() => manual(1)} disabled={idx === n - 1} aria-label="Next">›</button>
      </div>
    </div>
  )
}
