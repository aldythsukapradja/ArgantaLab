import { useCallback, useEffect, useRef, useState } from 'react'
import { useHqPitch, UNIT_ECON, paybackCurve, growthCurve, retentionCurve, arrFan, type PitchData } from './lib/hq'
import { AGENTS } from './data/agents'
import PitchChart from './components/PitchChart'

// ── inline investor pitch — a cinematic slide presentation inside the Pitch tab ──
const fmt = (n?: number | null, suffix = '') => n == null ? null : (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(Math.round(n * 10) / 10)) + suffix
const usd = (n: number) => '$' + (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(n < 10 ? 2 : 0))
const arrFmt = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1e3) + 'k')

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
function Stat({ v, l, live }: { v: string | null; l: string; live?: boolean }) {
  return <div className="pstat"><b className={v == null ? 'soon' : ''}>{v ?? 'live soon'}</b><span>{l}{live && v != null ? ' · live' : ''}</span></div>
}

// deterministic chart series — recalculated from the HQ model (see lib/hq.ts)
const GROWTH = growthCurve(100, 12)
const RET = retentionCurve()
const PAY = paybackCurve('mid', 18)
const FAN = arrFan(100_000, 8)

interface Slide { id: string; chapter: string; el: (d: PitchData | null) => React.ReactNode }
const SLIDES: Slide[] = [
  { id: 'cover', chapter: 'Arganta', el: () => <>
    <span className="pkick">Investor pitch · Seed · 2026</span>
    <h1 className="pdisplay xl">Turn screen time into<br /><em>intelligence time.</em></h1>
    <p className="psub">The trusted operating system for the modern family. Every metric here is a <b>live aggregate</b> from our own operator system — benchmarked to YC / edtech quartiles, revenue ratios marked pending, never faked.</p>
  </> },
  { id: 'thesis', chapter: 'The thesis', el: () => <><h2 className="pdisplay">Kids see play.<br /><em>Parents see growth.</em></h2><p className="psub">One product, two customers who never conflict — the child wants the game, the parent wants the outcome, and both get exactly that.</p></> },
  { id: 'problem', chapter: 'The problem', el: () => <>
    <span className="pkick">The problem</span>
    <div className="pbignum">2.5<span>hrs / day</span></div>
    <h2 className="pdisplay sm">A childhood of screens, <em>building nothing.</em></h2>
    <p className="psub">That's ~900 hours a year of a child's attention — the most valuable resource on earth — spent on infinite scroll instead of skills. Parents feel it. No one has fixed it.</p>
  </> },
  { id: 'market', chapter: 'The market', el: () => <>
    <span className="pkick">The market</span>
    <h2 className="pdisplay sm">A <em>generational</em> market.</h2>
    <div className="pgrid3">
      <div className="mcard"><b className="mcard-v">1.9B</b><span className="mcard-what">children under 15 worldwide — the largest connected generation ever.</span></div>
      <div className="mcard"><b className="mcard-v">$340B</b><span className="mcard-what">consumer & digital learning spend by 2030.</span></div>
      <div className="mcard"><b className="mcard-v">$0</b><span className="mcard-what">trusted OS that owns the whole family relationship — the seat is empty.</span></div>
    </div>
    <p className="psub sm"><span className="pnote">Directional global references — the wedge is the family, not a single category.</span></p>
  </> },
  { id: 'whynow', chapter: 'Why now', el: () => <>
    <span className="pkick">Why now</span>
    <h2 className="pdisplay sm">Every pillar is <em>already proven.</em></h2>
    <div className="pgrid3">
      <div className="mcard"><b className="mcard-v">124B</b><span className="mcard-what">hours on Roblox, 2025 — kids already live in digital worlds.</span></div>
      <div className="mcard"><b className="mcard-v">50M+</b><span className="mcard-what">daily Duolingo learners — gamified habit works at scale.</span></div>
      <div className="mcard"><b className="mcard-v">98M</b><span className="mcard-what">families on Life360 — households organize in circles.</span></div>
    </div>
    <p className="psub sm">Three multi-billion behaviors exist in isolation. <b>We fuse them into one product</b> — and AI finally makes adaptive, per-child content cheap enough to do it.</p>
  </> },
  { id: 'wedge', chapter: 'The wedge', el: () => <>
    <span className="pkick">The wedge</span>
    <h2 className="pdisplay sm">Don't fight the screen.<br /><em>Redirect it.</em></h2>
    <p className="psub">Route the hours kids already spend into a six-world learning journey — build games, ship projects, close the loop — inside a circle parents trust. We start where the attention already is.</p>
  </> },
  { id: 'product', chapter: 'The product', el: () => <>
    <span className="pkick">The product</span>
    <h2 className="pdisplay sm">One OS, <em>three products.</em></h2>
    <div className="pgrid3">
      <div className="mcard" style={{ ['--ac' as string]: '#8b5cf6' }}><span className="mcard-l" style={{ color: '#8b5cf6' }}>ArgantaLab</span><span className="mcard-what">Six-world learning · build, pitch & ship.</span></div>
      <div className="mcard" style={{ ['--ac' as string]: '#06b6d4' }}><span className="mcard-l" style={{ color: '#06b6d4' }}>KinetikCircle</span><span className="mcard-what">The family OS · rhythm, calendar, moments.</span></div>
      <div className="mcard" style={{ ['--ac' as string]: '#10b981' }}><span className="mcard-l" style={{ color: '#10b981' }}>Circle Apps</span><span className="mcard-what">Nine task apps · one shared spine.</span></div>
    </div>
    <p className="psub sm">Land with learning. Expand into the family's whole operating system. One account, one wallet, one trusted graph.</p>
  </> },
  { id: 'engagement', chapter: 'Traction · engagement', el: d => <>
    <span className="pkick">It works · engagement</span>
    <h2 className="pdisplay sm">The pre-revenue <em>truth.</em></h2>
    <div className="pgrid2">
      <Metric label="Weekly active learners" value={fmt(d?.wau)} bench="North Star" what="Unique kids who used the app in 7 days — the truest pulse." />
      <Metric label="Stickiness · DAU/MAU" value={fmt(d?.stickiness ?? undefined, '%')} bench="> 20% strong · > 50% elite" what="Share of monthly users active on an average day." />
      <Metric label="WoW growth" value={d?.wowPct == null ? null : (d.wowPct > 0 ? '+' : '') + d.wowPct + '%'} bench="> 7% = YC default-alive" what="Weekly-active growth vs the prior week." />
      <Metric label="Depth · attempts/active" value={fmt(d?.depth)} bench="> 4 healthy · > 8 deep" what="Questions each active learner attempts per week." />
    </div>
  </> },
  { id: 'growth', chapter: 'Traction · compounding', el: () => <>
    <span className="pkick">Compounding</span>
    <h2 className="pdisplay sm">Weekly growth is <em>the whole game.</em></h2>
    <div className="pchartwrap">
      <PitchChart
        series={[
          { color: '#8b5cf6', pts: GROWTH.fast, area: true, endLabel: '10% · elite' },
          { color: '#94a3b8', pts: GROWTH.slow, dashed: true, endLabel: '7% · alive' },
        ]}
        xTicks={[{ i: 0, label: 'wk 0' }, { i: 4, label: '4' }, { i: 8, label: '8' }, { i: 12, label: '12' }]}
      />
    </div>
    <p className="psub sm">At the YC "default-alive" bar of 7% week-over-week, an index of 100 weekly-active learners becomes <b>~225 in a quarter</b>. At 10%, ~314. The North Star is a straight line on a log of ambition.</p>
  </> },
  { id: 'intelligence', chapter: 'Traction · the graph', el: d => <>
    <span className="pkick">Intelligence time</span>
    <h2 className="pdisplay sm">The graph <em>parents pay for.</em></h2>
    <div className="pgrid3">
      <Metric label="Lessons / kid / day" value={fmt(d?.lessonsPerKidDay)} bench="the habit" what="Learning volume per active child, per day." />
      <Metric label="Screen-min / kid / day" value={fmt(d?.screenMinPerKidDay, 'm')} bench="time redirected" what="Minutes of screen time turned into learning." />
      <Metric label="Accuracy" value={fmt(d?.accuracyPct ?? undefined, '%')} bench="healthy 55–85%" what="Kept challenged but succeeding = mastery." />
    </div>
  </> },
  { id: 'retention', chapter: 'Traction · retention', el: d => <>
    <span className="pkick">Retention · the #1 number</span>
    <h2 className="pdisplay sm">Proof the product <em>keeps them.</em></h2>
    <div className="pchartwrap">
      <PitchChart
        height={190}
        series={[
          { color: '#8b5cf6', pts: RET.target, area: true, endLabel: 'top-quartile' },
          { color: '#94a3b8', pts: RET.typical, dashed: true, endLabel: 'typical' },
        ]}
        xTicks={[{ i: 0, label: 'D0' }, { i: 1, label: 'D1' }, { i: 2, label: 'D7' }, { i: 3, label: 'D14' }, { i: 4, label: 'D30' }]}
        refLine={{ v: 35, label: '35% · top-quartile D30' }}
      />
    </div>
    <div className="pstats">
      <Stat v={fmt(d?.d30 ?? undefined, '%')} l="D30 retention" live />
      <Stat v={fmt(d?.d1 ?? undefined, '%')} l="D1 comeback" live />
      <Stat v={fmt(d?.activationRate ?? undefined, '%')} l="48h activation" live />
    </div>
  </> },
  { id: 'flywheel', chapter: 'The moat', el: d => <>
    <span className="pkick">The flywheel · moat</span>
    <h2 className="pdisplay sm">Circles make it <em>grow itself.</em></h2>
    <div className="pgrid3">
      <Metric label="Active circles" value={fmt(d?.flywheelCount)} bench="network unit" what="Circles containing an active learner." />
      <Metric label="k-factor" value={fmt(d?.kFactor)} bench="> 1 = viral" what="New users each user brings via invites." />
      <Metric label="Families" value={fmt(d?.familiesTotal)} bench="the base" what="Households on the platform." />
    </div>
  </> },
  { id: 'economy', chapter: 'The economy', el: d => <>
    <span className="pkick">The Argon economy</span>
    <h2 className="pdisplay sm">Kids already <em>spend.</em> Parents will pay.</h2>
    <div className="pgrid3">
      <Metric label="Spend / active kid · 30d" value={fmt(d?.spentPerActiveKid)} bench="pay-intent proxy" what="Argons kids choose to spend — demand signal." />
      <Metric label="Sink coverage" value={fmt(d?.econCoverage ?? undefined, '%')} bench="healthy economy" what="Spent ÷ recurring mint — a balanced economy." />
      <Metric label="Argons in float" value={fmt(d?.econFloat)} bench="engagement stock" what="Earned-but-unspent — stored motivation." />
    </div>
  </> },
  { id: 'econ', chapter: 'Unit economics', el: () => <>
    <span className="pkick">Unit economics · base case</span>
    <h2 className="pdisplay sm">One subscriber <em>pays back in {PAY.paybackMo.toFixed(1)} months.</em></h2>
    <div className="pchartwrap">
      <PitchChart
        height={196}
        series={[{ color: '#10b981', pts: PAY.cum, area: true }]}
        xTicks={[0, 3, 6, 9, 12, 15, 18].map(m => ({ i: m, label: m + 'mo' }))}
        refLine={{ v: PAY.cac, label: `CAC $${PAY.cac}` }}
        marker={{ i: Math.round(PAY.paybackMo), v: PAY.cac, label: `payback ${PAY.paybackMo.toFixed(1)}mo` }}
      />
    </div>
    <div className="pstats">
      <Stat v={`${UNIT_ECON.mid.ltvCac.toFixed(1)}×`} l="LTV / CAC" />
      <Stat v={`${UNIT_ECON.mid.payback.toFixed(1)}mo`} l="payback" />
      <Stat v={usd(UNIT_ECON.mid.ltv)} l="LTV / sub" />
    </div>
  </> },
  { id: 'model', chapter: 'The model', el: () => <>
    <span className="pkick">The model · a fan of outcomes</span>
    <h2 className="pdisplay sm">A defensible <em>fan of outcomes.</em></h2>
    <div className="pchartwrap">
      <PitchChart
        height={196}
        series={[
          { color: '#8b5cf6', pts: FAN.high, area: true, endLabel: 'High' },
          { color: '#06b6d4', pts: FAN.mid, endLabel: 'Mid' },
          { color: '#94a3b8', pts: FAN.low, dashed: true, endLabel: 'Low' },
        ]}
        xTicks={[{ i: 0, label: '0' }, { i: 4, label: '50k families' }, { i: 8, label: '100k' }]}
      />
    </div>
    <p className="psub sm">Two revenue streams — subscription + Argon packs — through one driver model. At 100k families the base case throws off <b>{arrFmt(FAN.mid[FAN.mid.length - 1])} ARR</b>; the breakout case <b>{arrFmt(FAN.high[FAN.high.length - 1])}</b>. Not a single hopeful number — a range.</p>
  </> },
  { id: 'moat', chapter: 'The moat', el: () => <>
    <span className="pkick">The moat</span>
    <h2 className="pdisplay sm">Three moats that <em>compound.</em></h2>
    <div className="pgrid3">
      <div className="mcard" style={{ ['--ac' as string]: '#8b5cf6' }}><b className="mcard-v">{AGENTS.length}</b><span className="mcard-l">AI-agent company</span><span className="mcard-what">One founder, a full org of agents — lean, ships daily, scales without headcount.</span></div>
      <div className="mcard" style={{ ['--ac' as string]: '#06b6d4' }}><span className="mcard-l" style={{ color: '#06b6d4' }}>Circles</span><span className="mcard-what">Network effect — every family deepens a trusted graph + proprietary learning data.</span></div>
      <div className="mcard" style={{ ['--ac' as string]: '#10b981' }}><span className="mcard-l" style={{ color: '#10b981' }}>Content depth</span><span className="mcard-what">Six worlds × six age stages — thousands of authored, adaptive learning items.</span></div>
    </div>
  </> },
  { id: 'traction', chapter: 'Traction · today', el: d => <>
    <span className="pkick">Traction · live catalog</span>
    <h2 className="pdisplay sm">Real scale, <em>today.</em></h2>
    <div className="pgrid4">
      <Metric label="Learners" value={fmt(d?.learners)} bench="signups" what="Kids who joined ArgantaLab." />
      <Metric label="Circles" value={fmt(d?.circles)} bench="households" what="Family/class circles created." />
      <Metric label="Worlds live" value={fmt(d?.worldsLive)} bench="content" what="Learning worlds shipped." />
      <Metric label="Items live" value={fmt(d?.itemsLive)} bench="depth" what="Playable learning items authored." />
    </div>
  </> },
  { id: 'vision', chapter: 'The vision', el: () => <>
    <span className="pkick">Where this goes</span>
    <h2 className="pdisplay">One OS for <em>every family.</em></h2>
    <p className="psub">Own the family relationship through the years that matter most — from a six-year-old's first game to the whole household's daily rhythm. Learning is the wedge; the family operating system is the company.</p>
  </> },
  { id: 'ask', chapter: 'The ask', el: () => <>
    <span className="pkick">Team · the ask</span>
    <h2 className="pdisplay sm">Built by a parent.<br /><em>Raising to reach 10,000 families.</em></h2>
    <div className="pgrid3">
      <div className="mcard"><span className="mcard-l">Scale the agent workforce</span><span className="mcard-what">Deepen content across all six worlds and every age stage.</span></div>
      <div className="mcard"><span className="mcard-l">Prove the paywall</span><span className="mcard-what">Turn demonstrated pay-intent into subscription revenue.</span></div>
      <div className="mcard"><span className="mcard-l">Ignite the circle flywheel</span><span className="mcard-what">Family & classroom invite loops toward k &gt; 1.</span></div>
    </div>
    <p className="psub sm">Aldyth Sukapradja, founder & human CEO. <span className="pnote">Raise amount & use-of-funds detailed on request.</span></p>
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

  const pct = n > 1 ? (idx / (n - 1)) * 100 : 0
  const cur = SLIDES[idx]

  return (
    <div className="pdeck" onWheel={onWheel}>
      <div className="pdeck-prog"><i style={{ width: `${pct}%` }} /></div>
      <div className="pdeck-rail">
        <span className="pdeck-chapter">{cur.chapter}</span>
        <span className="pdeck-count">{String(idx + 1).padStart(2, '0')} <em>/ {String(n).padStart(2, '0')}</em></span>
      </div>
      <div className="pdeck-slides">
        {SLIDES.map((s, i) => (
          <section key={s.id} className={`pslide ${i === idx ? 'active' : i < idx ? 'prev' : 'next'}`} aria-hidden={i !== idx}>
            <div className="pglow" aria-hidden />
            <div className="pslide-in">{s.el(data)}</div>
          </section>
        ))}
      </div>
      <div className="pdeck-ctrl">
        <button className="pdeck-arrow" onClick={() => manual(-1)} disabled={idx === 0} aria-label="Previous">‹</button>
        <button className="pdeck-play" onClick={() => setPlaying(p => !p)}>{playing ? '❙❙ Pause' : '▸ Present'}</button>
        <div className="pdeck-dots">{SLIDES.map((s, i) => <button key={s.id} className={`pdeck-dot${i === idx ? ' on' : ''}`} onClick={() => { setPlaying(false); setIdx(i) }} aria-label={s.id} />)}</div>
        <button className="pdeck-arrow" onClick={() => manual(1)} disabled={idx === n - 1} aria-label="Next">›</button>
      </div>
    </div>
  )
}
