import { useCallback, useEffect, useRef, useState } from 'react'
import { useHqPitch, growthCurve, retentionCurve, type PitchData } from './lib/hq'
import { CASES, runModel, costCurve, ECON, PAYER } from './lib/econ'
import { AGENTS, OFFICES } from './data/agents'
import { SITE } from './lib/site'
import PitchChart from './components/PitchChart'
import { ScatterMap, RangePlot, PayerBars, Velocity } from './components/DeckCharts'
import { Fact, ProvLegend } from './components/Fact'
import { AppEmbed } from './embed/AppEmbed'

// ── inline investor pitch — a cinematic slide presentation inside the Pitch tab.
// Every static fact comes from SITE; every modelled number from ECON (mirrors HQ);
// every live number from useHqPitch(). One source of truth, consistent everywhere.
const fmt = (n?: number | null, suffix = '') => n == null ? null : (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(Math.round(n * 10) / 10)) + suffix
const money = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : n.toFixed(2))

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

// ── deterministic chart series ──
const GROWTH = growthCurve(100, 12)
const RET = retentionCurve()
const MID = runModel(CASES.mid, 24)
const LOW = runModel(CASES.low, 24)
const HIGH = runModel(CASES.high, 24)
const CASH = MID.rows.map(r => r.cum)
const ARR_MID = MID.rows.map(r => r.revenue * 12)
const ARR_LOW = LOW.rows.map(r => r.revenue * 12)
const ARR_HIGH = HIGH.rows.map(r => r.revenue * 12)
const SCALE = costCurve(24)
const SCALE_PA = SCALE.map(p => p.perActive)
const cumBreak = CASH.findIndex(v => v >= 0)
const CASH_MARK = cumBreak >= 0 ? cumBreak : (MID.firstPositiveMonth ? MID.firstPositiveMonth - 1 : CASH.length - 1)
const BREAK_FAM = ECON.breakEvenFamilies ? Math.round(ECON.breakEvenFamilies) : null
const HH_D30 = Math.round(ECON.householdD30 * 100)
const MONTH_TICKS = [0, 5, 11, 17, 23].map((i, k) => ({ i, label: ['mo 1', '6', '12', '18', '24'][k] }))

interface Slide { id: string; chapter: string; el: (d: PitchData | null) => React.ReactNode }
const SLIDES: Slide[] = [
  { id: 'cover', chapter: SITE.brand.name, el: () => <>
    <span className="pkick">Investor pitch · Seed · 2026</span>
    <h1 className="pdisplay xl">Turn screen time into<br /><em>intelligence time.</em></h1>
    <p className="psub">{SITE.brand.tagline}. Numbers here are <b>live where measured, modeled where marked</b> — every figure wears its provenance, never faked.</p>
    <ProvLegend />
  </> },
  { id: 'thesis', chapter: 'The thesis', el: () => <>
    <h2 className="pdisplay">{SITE.thesis.a}<br /><em>{SITE.thesis.b}</em></h2>
    <p className="psub">{SITE.northStar.line}</p>
  </> },
  { id: 'northstar', chapter: 'The North Star', el: () => <>
    <span className="pkick">Our North Star</span>
    <h2 className="pdisplay sm">Weekly <em>Two-Hook</em> Families.</h2>
    <p className="psub">{SITE.northStar.def} The retained household — not a download — is the company.</p>
    <div className="pgrid2">
      {SITE.northStar.hooks.map(h => <div key={h.k} className="mcard"><span className="mcard-l">{h.k}</span><span className="mcard-what">{h.v}</span></div>)}
    </div>
    <p className="psub sm">Two hooks compound: household D30 = 1 − (1 − kid)(1 − parent) ≈ <b>{HH_D30}%</b>. One hook can’t hold a family; two can.</p>
  </> },
  { id: 'problem', chapter: 'The problem', el: () => <>
    <span className="pkick">The problem</span>
    <div className="pbignum">{SITE.problem.stat}<span>{SITE.problem.unit}</span></div>
    <h2 className="pdisplay sm">A childhood of screens, <em>building nothing.</em></h2>
    <p className="psub">{SITE.problem.detail}</p>
  </> },
  { id: 'market', chapter: 'The market', el: () => <>
    <span className="pkick">The market</span>
    <h2 className="pdisplay sm">Nobody owns <em>both halves.</em></h2>
    <div className="pchartwrap wide"><ScatterMap points={SITE.competitors.map(c => ({ name: c.name, x: c.x, y: c.y, us: 'us' in c ? c.us : false }))} /></div>
    <p className="psub sm">Roblox has the hours, Duolingo the habit, Life360 the family — each owns one axis. <b>Learning × the family graph is the open corner.</b> <span className="pnote">{SITE.market.note}</span></p>
  </> },
  { id: 'whynow', chapter: 'Why now', el: () => <>
    <span className="pkick">Why now</span>
    <h2 className="pdisplay sm">Every pillar is <em>already proven.</em></h2>
    <div className="pgrid3">{SITE.whyNow.map(r => <div key={r.l} className="mcard"><b className="mcard-v">{r.n}</b><span className="mcard-what">{r.l}</span></div>)}</div>
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
    <div className="pgrid3">{SITE.products.map(p => <div key={p.id} className="mcard" style={{ ['--ac' as string]: p.color }}><span className="mcard-l" style={{ color: p.color }}>{p.name}</span><span className="mcard-what">{p.line}</span></div>)}</div>
    <p className="psub sm">Land with learning. Expand into the family's whole operating system. One account, one wallet, one trusted graph.</p>
  </> },
  { id: 'bloom', chapter: 'The product · live', el: () => <>
    <span className="pkick">LashiraBloom · playable now</span>
    <h2 className="pdisplay sm">Adults play. Kids learn. <em>Same world.</em></h2>
    <div className="pembed"><AppEmbed app="lashira" scene="farm" defaultFrame="phone" /></div>
    <p className="psub sm">{SITE.products[1].wedge}</p>
  </> },
  { id: 'engagement', chapter: 'Traction · engagement', el: d => <>
    <span className="pkick">It works · engagement</span>
    <h2 className="pdisplay sm">The pre-revenue <em>truth.</em></h2>
    <div className="pgrid2">
      <Metric label="Weekly two-hook families" value={fmt(d?.flywheelCount)} bench="the North Star" what="Households where a kid learned AND a parent coordinated, same week." />
      <Metric label="Weekly active learners" value={fmt(d?.wau)} bench="the pulse" what="Unique kids who used the app in the last 7 days." />
      <Metric label="Stickiness · DAU/MAU" value={fmt(d?.stickiness ?? undefined, '%')} bench="> 20% strong · > 50% elite" what="Share of monthly users active on an average day." />
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
    <p className="psub sm">At the YC "default-alive" bar of 7% week-over-week, an index of 100 becomes <b>~225 in a quarter</b>; at 10%, ~314. The North Star is a straight line on a log of ambition.</p>
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
    <h2 className="pdisplay sm">Two hooks <em>keep them.</em></h2>
    <div className="pchartwrap">
      <PitchChart
        height={188}
        series={[
          { color: '#8b5cf6', pts: RET.target, area: true, endLabel: 'top-quartile' },
          { color: '#94a3b8', pts: RET.typical, dashed: true, endLabel: 'typical' },
        ]}
        xTicks={[{ i: 0, label: 'D0' }, { i: 1, label: 'D1' }, { i: 2, label: 'D7' }, { i: 3, label: 'D14' }, { i: 4, label: 'D30' }]}
        refLine={{ v: 35, label: '35% · top-quartile D30' }}
      />
    </div>
    <div className="pstats">
      <Stat v={`${HH_D30}%`} l="household D30 (modelled)" />
      <Stat v={fmt(d?.d30 ?? undefined, '%')} l="D30 retention" live />
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
    <h2 className="pdisplay sm">Positive economics — <em>break-even ≈ {BREAK_FAM} families.</em></h2>
    <div className="pchartwrap">
      <PitchChart
        height={196}
        series={[{ color: '#10b981', pts: CASH, area: true }]}
        xTicks={MONTH_TICKS}
        refLine={{ v: 0, label: 'break-even' }}
        marker={{ i: CASH_MARK, v: CASH[CASH_MARK], label: MID.firstPositiveMonth ? `cash-positive · mo ${MID.firstPositiveMonth}` : 'trajectory' }}
      />
    </div>
    <div className="pstats">
      <Stat v={BREAK_FAM ? `${BREAK_FAM}` : '—'} l="break-even families" />
      <Stat v={money(ECON.cac)} l="CAC (invite-led)" />
      <Stat v={`${money(ECON.contributionPerActive)}`} l="contribution / active" />
    </div>
  </> },
  { id: 'payer', chapter: 'Unit economics · per payer', el: () => <>
    <span className="pkick">The per-payer truth</span>
    <h2 className="pdisplay sm">Conversion is <em>the one lever.</em></h2>
    <div className="pchartwrap"><PayerBars cases={[
      { label: 'Low · 2%', ltv: PAYER.low.ltv, cac: PAYER.low.cacPerPayer, ratio: PAYER.low.ratio },
      { label: 'Mid · 4%', ltv: PAYER.mid.ltv, cac: PAYER.mid.cacPerPayer, ratio: PAYER.mid.ratio },
      { label: 'High · 8%', ltv: PAYER.high.ltv, cac: PAYER.high.cacPerPayer, ratio: PAYER.high.ratio },
    ]} /></div>
    <p className="psub sm">At 2% conversion a payer costs more than they return (0.7×). At 4% it's 2.9×, at 8% it's 14×. <b>Invite-led CAC ($1.50) buys time to move conversion</b> — the honest risk, and the plan to retire it.</p>
  </> },
  { id: 'model', chapter: 'The model', el: () => <>
    <span className="pkick">The model · a fan of outcomes</span>
    <h2 className="pdisplay sm">A defensible <em>fan of outcomes.</em></h2>
    <div className="pchartwrap">
      <PitchChart
        height={196}
        series={[
          { color: '#8b5cf6', pts: ARR_HIGH, area: true, endLabel: 'High' },
          { color: '#06b6d4', pts: ARR_MID, endLabel: 'Mid' },
          { color: '#94a3b8', pts: ARR_LOW, dashed: true, endLabel: 'Low' },
        ]}
        xTicks={MONTH_TICKS}
      />
    </div>
    <p className="psub sm">Subscription (${CASES.mid.listPrice}/mo list · ~{money(ECON.effArpu)} effective ARPU) through one driver model, Low→High. The base case reaches a <b>{money(ECON.arrRunRate)} ARR run-rate</b> in 24 months — not a single hopeful number, a range.</p>
  </> },
  { id: 'scale', chapter: 'The architecture', el: () => <>
    <span className="pkick">Built to scale · cheaply</span>
    <h2 className="pdisplay sm">A whole company for <em>~{money(ECON.agentOsCostMo)}/mo.</em></h2>
    <div className="pchartwrap">
      <PitchChart
        height={190}
        series={[{ color: '#8b5cf6', pts: SCALE_PA, area: true }]}
        xTicks={[{ i: 0, label: '1k' }, { i: 8, label: '10k' }, { i: 15, label: '100k' }, { i: 23, label: '1M families' }]}
        refLine={{ v: ECON.infraPerActive, label: `$${ECON.infraPerActive.toFixed(2)} infra / active` }}
      />
    </div>
    <div className="pstats">
      <Stat v={money(ECON.agentOsCostMo)} l={`${AGENTS.length}-agent OS / mo`} />
      <Stat v={`$${ECON.infraPerActive.toFixed(2)}`} l="infra / active" />
      <Stat v="deterministic" l="SQL + math, LLM only phrases" />
    </div>
  </> },
  { id: 'moat', chapter: 'The moat', el: () => <>
    <span className="pkick">The moat</span>
    <h2 className="pdisplay sm">Three moats that <em>compound.</em></h2>
    <div className="pgrid3">
      <div className="mcard" style={{ ['--ac' as string]: '#8b5cf6' }}><b className="mcard-v">{AGENTS.length}</b><span className="mcard-l">AI-agent company · {OFFICES.length} offices</span><span className="mcard-what">One founder, a full org of agents — deterministic-first, ships daily, scales without headcount.</span></div>
      <div className="mcard" style={{ ['--ac' as string]: '#06b6d4' }}><span className="mcard-l" style={{ color: '#06b6d4' }}>Two-hook circles</span><span className="mcard-what">Every family deepens a trusted graph — kid pull × parent stick, a retention no single-hook app can copy.</span></div>
      <div className="mcard" style={{ ['--ac' as string]: '#10b981' }}><span className="mcard-l" style={{ color: '#10b981' }}>One substrate</span><span className="mcard-what">{SITE.substrate.frontEnds} front-ends on one spine ({SITE.substrate.tables} tables · {SITE.substrate.rpcs} RPCs). Competitors rebuild the spine, not clone an app.</span></div>
    </div>
  </> },
  { id: 'velocity', chapter: 'The proof', el: () => <>
    <span className="pkick">Velocity</span>
    <h2 className="pdisplay sm">One founder. <em>An agent OS.</em></h2>
    <div className="pchartwrap wide"><Velocity items={[
      ...SITE.velocity.products.map(p => ({ label: p, kind: 'product' as const })),
      ...SITE.velocity.builders.map(b => ({ label: b, kind: 'builder' as const })),
    ]} /></div>
    <p className="psub sm">{SITE.velocity.stat.loc} lines · {SITE.velocity.stat.commits} commits · {SITE.velocity.stat.apps} apps in 12 months — {SITE.velocity.line}</p>
  </> },
  { id: 'valuation', chapter: 'Valuation', el: () => <>
    <span className="pkick">Computed, not negotiated</span>
    <h2 className="pdisplay sm">Valuation is <em>an output.</em></h2>
    <div className="pchartwrap wide"><RangePlot methods={SITE.valuation.methods.map(m => ({ label: m.label, low: m.low, high: m.high }))} band={{ low: SITE.valuation.now.low, high: SITE.valuation.now.high }} /></div>
    <div className="pladder">{SITE.valuation.ladder.map((s, i) => <div key={s.step} className={`pladder-step${i === 0 ? ' now' : ''}`}><b>${s.range[0]}–{s.range[1]}M</b><span>{s.step}</span></div>)}</div>
    <p className="psub sm"><span className="fact-chip fact-modeled"><i>◐</i>modeled</span> Six methods off the same graph that runs the company. {SITE.valuation.lever}</p>
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
    <h2 className="pdisplay sm">Built by a parent.<br /><em>{SITE.ask.headline}</em></h2>
    <div className="pgrid3">{SITE.ask.uses.map(u => <div key={u.l} className="mcard"><span className="mcard-l">{u.l}</span><span className="mcard-what">{u.d}</span></div>)}</div>
    <p className="psub sm">{SITE.founder.name}, {SITE.founder.role}. Ask: {SITE.ask.intros}.</p>
    <div className="pcta"><a className="pbtn primary" href={`mailto:${SITE.brand.email}?subject=Investing%20in%20${SITE.brand.name}`}>Talk to us →</a></div>
  </> },
]

export default function PitchDeck() {
  const { data } = useHqPitch()
  const [idx, setIdx] = useState(0)
  const n = SLIDES.length
  const wheelAcc = useRef(0)
  const lastHop = useRef(0)

  const go = useCallback((d: number) => setIdx(i => Math.max(0, Math.min(n - 1, i + d))), [n])
  const manual = useCallback((d: number) => go(d), [go])

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
        <div className="pdeck-dots">{SLIDES.map((s, i) => <button key={s.id} className={`pdeck-dot${i === idx ? ' on' : ''}`} onClick={() => setIdx(i)} aria-label={s.id} />)}</div>
        <button className="pdeck-arrow" onClick={() => manual(1)} disabled={idx === n - 1} aria-label="Next">›</button>
      </div>
    </div>
  )
}
