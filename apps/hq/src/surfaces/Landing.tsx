import { useEffect, useMemo, useState } from 'react'
import { Mic, LayoutGrid, Sun, Moon } from 'lucide-react'
import { useHQ } from '../shell/store'
import { live, cloudEnabled } from '../data/live'
import type { GrowthOverview, EconomyData, PortfolioVc } from '../data/types'
import type { KinetikStats } from '../data/live'
import './landing.css'

// ── CEO Orb — AI-Core Command Center ─────────────────────────────────────────
// Giant radar orb (dense knowledge-graph core = the Vault) + real-data panels.
// Theme-aware: light default, dark on toggle (contrast-correct, follows HQ). Lite
// SVG/CSS — 60fps, no WebGL. Every number live from an hq_* RPC or an honest —.
// (Premium renderer swap to ECharts/D3/react-force-graph is the next increment.)

const N = (v: number | null | undefined, s = '') => (v == null ? '—' : Intl.NumberFormat('en', { notation: 'compact' }).format(v) + s)
const PCT = (v: number | null | undefined) => (v == null ? '—' : Math.round(v) + '%')

// deterministic PRNG so the node cloud is stable across renders
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

function useOrbGraph() {
  return useMemo(() => {
    const rand = mulberry32(7)
    const N = 112, cx = 200, cy = 200, R = 104
    const nodes: { x: number; y: number; b: boolean }[] = []
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2
      const r = Math.pow(rand(), 0.6) * R
      nodes.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, b: rand() < 0.14 })
    }
    let d = ''
    for (let i = 0; i < N; i++) {
      const near = nodes.map((n, j) => ({ j, dd: (n.x - nodes[i].x) ** 2 + (n.y - nodes[i].y) ** 2 }))
        .filter(o => o.j !== i).sort((p, q) => p.dd - q.dd).slice(0, 2)
      for (const o of near) d += `M${nodes[i].x.toFixed(1)} ${nodes[i].y.toFixed(1)}L${nodes[o.j].x.toFixed(1)} ${nodes[o.j].y.toFixed(1)}`
    }
    return { nodes, edges: d }
  }, [])
}

function Spark({ pts, stroke }: { pts?: { value: number }[]; stroke: string }) {
  const d = useMemo(() => {
    if (!pts || pts.length < 2) return '2,11 146,11'
    const v = pts.map(p => p.value), max = Math.max(...v), min = Math.min(...v), span = max - min || 1, n = v.length
    return v.map((x, i) => `${((i / (n - 1)) * 146 + 2).toFixed(0)},${(20 - ((x - min) / span) * 17).toFixed(0)}`).join(' ')
  }, [pts])
  return <svg viewBox="0 0 148 22" className="ceo-spark"><polyline points={d} fill="none" stroke={stroke} strokeWidth="1.6" /></svg>
}

function Gauge({ v, max = 100, label, tone }: { v: number | null; max?: number; label: string; tone?: string }) {
  const frac = v == null ? 0 : Math.max(0, Math.min(1, v / max))
  return (
    <div className="ceo-g">
      <svg viewBox="0 0 60 42"><path d="M8 38a22 22 0 0 1 44 0" fill="none" stroke="var(--c-track)" strokeWidth="5" strokeLinecap="round" />
        {v != null && <path d="M8 38a22 22 0 0 1 44 0" fill="none" stroke={tone || 'var(--c-accent)'} strokeWidth="5" strokeLinecap="round" pathLength={100} strokeDasharray={`${frac * 100} 100`} />}</svg>
      <div className="ceo-gv" style={{ color: tone || 'var(--c-text)' }}>{v == null ? '—' : (max === 100 ? Math.round(v) + '%' : v.toFixed(max <= 3 ? 1 : 0))}</div>
      <div className="ceo-gl">{label}</div>
    </div>
  )
}

const MINI_BRAIN = (() => {
  const rand = mulberry32(3); const nodes: [number, number][] = []
  for (let i = 0; i < 22; i++) nodes.push([18 + rand() * 104, 8 + rand() * 44])
  let d = ''
  for (let i = 0; i < nodes.length; i++) { const n = nodes.map((p, j) => ({ j, dd: (p[0] - nodes[i][0]) ** 2 + (p[1] - nodes[i][1]) ** 2 })).filter(o => o.j !== i).sort((a, b) => a.dd - b.dd).slice(0, 2); for (const o of n) d += `M${nodes[i][0].toFixed(0)} ${nodes[i][1].toFixed(0)}L${nodes[o.j][0].toFixed(0)} ${nodes[o.j][1].toFixed(0)}` }
  return { nodes, edges: d }
})()

export function Landing({ who = 'Operator' }: { who?: string }) {
  const { openPalette, toggleAgent, go, theme, toggleTheme } = useHQ()
  const orb = useOrbGraph()
  const [g, setG] = useState<GrowthOverview | null>(null)
  const [e, setE] = useState<EconomyData | null>(null)
  const [k, setK] = useState<KinetikStats | null>(null)
  const [vc, setVc] = useState<PortfolioVc | null>(null)
  const [hud, setHud] = useState(true)
  const first = who.split(/[\s@]/)[0]

  useEffect(() => {
    let on = true
    live.growthOverview().then(r => on && setG(r))
    live.economy().then(r => on && setE(r))
    live.kinetikStats().then(r => on && setK(r))
    live.portfolioVc().then(r => on && setVc(r))
    return () => { on = false }
  }, [])

  const h = new Date().getHours()
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const w2f = vc?.flywheelCount ?? null
  const total = vc?.familiesTotal ?? null
  const align = w2f != null && total ? Math.round((100 * w2f) / total) : null
  const mix = g?.activityMix ?? []
  const mixTotal = mix.reduce((s, x) => s + x.events, 0) || 1
  const mb = e?.mintBurn ?? []
  const mbMax = Math.max(1, ...mb.flatMap(p => [p.mint, p.burn]))
  const scen = [
    ['Growth', !!g], ['Retention', vc?.d1Retention != null], ['Economy', !!e],
    ['Content', g?.accuracyPct != null], ['Monetization', !!vc], ['Activity', mix.length > 0],
  ] as [string, boolean][]

  return (
    <div className="ceo" data-hud={hud}>
      <span className="ceo-brk tl" /><span className="ceo-brk tr" /><span className="ceo-brk bl" /><span className="ceo-brk br" />

      <div className="ceo-top">
        <span className="ceo-brand">◆ CIRCLE HQ · COMMAND</span>
        <span className="ceo-core-st"><b>CEO CORE</b> · {cloudEnabled ? 'ONLINE ●' : 'OFFLINE ○'}</span>
        <span className="ceo-top-r">
          <button className="ceo-ib" onClick={() => setHud(v => !v)} title="Toggle HUD">HUD</button>
          <button className="ceo-menu" onClick={openPalette} title="Menu (⌘K)"><LayoutGrid size={12} /> MENU</button>
          <button className="ceo-ib" onClick={toggleTheme} title="Theme">{theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}</button>
        </span>
      </div>

      <div className="ceo-body">
        {/* LEFT */}
        <div className="ceo-col left">
          <div className="ceo-pnl"><div className="ceo-ph"><b />Reach<span>circles · people</span></div>
            <svg viewBox="0 0 150 52" className="ceo-map"><g className="ceo-dots">{Array.from({ length: 60 }).map((_, i) => { const r = mulberry32(i + 1); return <circle key={i} cx={8 + r() * 134} cy={6 + mulberry32(i + 99)() * 40} r=".8" /> })}</g><path d="M20 40q50 -34 108 -12" fill="none" stroke="var(--c-accent2)" strokeWidth="1" strokeOpacity=".7" /><circle cx="20" cy="40" r="2" fill="var(--c-accent2)" /><circle cx="128" cy="28" r="2.2" fill="var(--c-accent2)" /></svg>
            <div className="ceo-r3"><div><span className="v">{N(k?.circles)}</span><span className="l">Circles</span></div><div><span className="v">{N(k?.members)}</span><span className="l">Members</span></div><div><span className="v">{N(g?.wau)}</span><span className="l">Active·7d</span></div></div>
            <div className="ceo-note">geo = placeholder → usage % by region</div>
          </div>
          <div className="ceo-pnl"><div className="ceo-ph"><b />Performance<span>live product metrics</span></div>
            <Spark pts={g?.northStar} stroke="var(--c-accent)" />
            <div className="ceo-r3"><div><span className="v">{vc?.lessonsPerKidDay == null ? '—' : vc.lessonsPerKidDay.toFixed(1)}</span><span className="l">Lessons/kid</span></div><div><span className="v">{PCT(vc?.d1Retention)}</span><span className="l">D1 return</span></div><div><span className="v">{N(vc?.screenMinPerKidDay)}m</span><span className="l">Screen/kid</span></div></div>
          </div>
        </div>

        {/* CENTER */}
        <div className="ceo-core">
          <div className="ceo-badge bL"><div className="bv">27</div><div className="bl">agents</div></div>
          <div className="ceo-greet">{greet}, {first}</div>
          <div className="ceo-orb">
            <svg viewBox="0 0 400 400" role="img" aria-label="CEO knowledge-graph core">
              <defs><radialGradient id="ceocore" cx="50%" cy="42%" r="58%"><stop offset="0%" stopColor="var(--c-core0)" /><stop offset="55%" stopColor="var(--c-core1)" /><stop offset="100%" stopColor="var(--c-core2)" /></radialGradient>
                <radialGradient id="ceoglow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="var(--c-accent)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--c-accent)" stopOpacity="0" /></radialGradient></defs>
              <g fill="none" strokeLinecap="round">
                <circle cx="200" cy="200" r="190" stroke="var(--c-ring)" strokeOpacity=".14" strokeDasharray="2 10" />
                <g className="ceo-rA"><circle cx="200" cy="200" r="170" stroke="var(--c-ring)" strokeWidth="1.2" strokeOpacity=".4" strokeDasharray="120 340" /></g>
                <g className="ceo-rC"><circle cx="200" cy="200" r="150" stroke="var(--c-ring)" strokeWidth="1" strokeOpacity=".5" strokeDasharray="3 9" /></g>
                <g className="ceo-rB" stroke="var(--c-ring)" strokeOpacity=".5"><circle cx="200" cy="200" r="132" strokeWidth="1.2" /><path d="M200 78v12M200 310v12M78 200h12M310 200h12M114 114l9 9M286 286l-9-9M286 114l-9 9M114 286l9-9" strokeWidth="1.1" /></g>
                <g className="ceo-rB2"><circle cx="200" cy="200" r="116" stroke="var(--c-accent)" strokeWidth="1.2" strokeOpacity=".45" strokeDasharray="1.5 7" /></g>
              </g>
              <g className="ceo-sweep"><path d="M200 200 L200 90 A110 110 0 0 1 275 122 Z" fill="var(--c-accent)" opacity=".06" /></g>
              <circle cx="200" cy="200" r="108" fill="url(#ceoglow)" />
              <g className="ceo-brain">
                <path d={orb.edges} stroke="var(--c-line)" strokeWidth="0.6" fill="none" />
                {orb.nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={n.b ? 1.7 : 1} fill={n.b ? 'var(--c-node-b)' : 'var(--c-node)'} opacity={n.b ? 1 : .8} />)}
                <circle className="ceo-hub" cx="200" cy="200" r="4.5" fill="var(--c-core0)" />
              </g>
            </svg>
          </div>
          <div className="ceo-badge bR"><div className="bv">{PCT(e?.coverage)}</div><div className="bl">coverage</div></div>
          {/* core output */}
          <div className="ceo-coreout"><span className="ceo-co-l">CORE OUTPUT · mint vs burn</span>
            <svg viewBox="0 0 260 34" className="ceo-cobar">{mb.slice(-16).map((p, i) => (<g key={i}><rect x={i * 16 + 4} y={34 - (p.mint / mbMax) * 30} width="6" height={(p.mint / mbMax) * 30} fill="var(--c-accent)" /><rect x={i * 16 + 10} y={34 - (p.burn / mbMax) * 30} width="6" height={(p.burn / mbMax) * 30} fill="var(--c-mag)" /></g>))}</svg>
          </div>
        </div>

        {/* RIGHT */}
        <div className="ceo-col right">
          <div className="ceo-pnl"><div className="ceo-ph"><b />North Star<span>weekly two-hook families</span></div>
            <div className="ceo-ns"><span className="ceo-ns-v">{N(w2f)}</span>{g?.wowPct != null && <span className={'ceo-ns-d ' + (g.wowPct < 0 ? 'dn' : '')}>{g.wowPct < 0 ? '▼' : '▲'}{Math.abs(g.wowPct)}%</span>}</div>
            <div className="ceo-align"><i style={{ width: (align ?? 0) + '%' }} /></div>
            <div className="ceo-note">alignment {align == null ? '—' : align + '%'} · vs target</div>
          </div>
          <div className="ceo-pnl"><div className="ceo-ph"><b />Insights<span>growth · monetization</span></div>
            <Spark pts={g?.northStar} stroke="var(--c-accent2)" />
            <div className="ceo-r3"><div><span className="v">{PCT(vc?.activationRate)}</span><span className="l">Activation</span></div><div><span className="v">{PCT(vc?.returnRate)}</span><span className="l">Return·30d</span></div><div><span className="v">{vc?.kFactor == null ? '—' : vc.kFactor.toFixed(2)}</span><span className="l">k-factor</span></div></div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="ceo-row4">
        <div className="ceo-pnl"><div className="ceo-ph"><b />AARRR vitals<span>the funnel</span></div>
          <div className="ceo-gauges">
            <Gauge v={vc?.activationRate ?? null} label="Activ" />
            <Gauge v={g?.stickiness ?? null} label="Engage" />
            <Gauge v={vc?.d1Retention ?? null} label="Retain" tone={(vc?.d1Retention ?? 0) >= 40 ? 'var(--c-ok)' : 'var(--c-warn)'} />
            <Gauge v={vc?.kFactor ?? null} max={1.5} label="Referral" />
          </div>
        </div>
        <div className="ceo-pnl"><div className="ceo-ph"><b />Agent OS<span>automations</span></div>
          <div className="ceo-tasks">{scen.map(([name, on]) => (<div key={name} className="ceo-task"><span className={'d ' + (on ? 'on' : '')} />{name}<span className="st">{on ? 'live' : 'idle'}</span></div>))}</div>
        </div>
        <div className="ceo-pnl"><div className="ceo-ph"><b />AI / ML<span>MCP → Claude · OpenAI</span></div>
          <div className="ceo-aiml"><svg viewBox="0 0 140 60" className="ceo-brainmini"><path d={MINI_BRAIN.edges} stroke="var(--c-line)" strokeWidth=".6" fill="none" />{MINI_BRAIN.nodes.map((n, i) => <circle key={i} cx={n[0]} cy={n[1]} r={i % 4 === 0 ? 1.8 : 1.1} fill={i % 4 === 0 ? 'var(--c-node-b)' : 'var(--c-node)'} />)}</svg>
            <div><div className="ceo-big">{PCT(g?.accuracyPct)}</div><div className="l">mastery accuracy</div><div className="l">4 builders · deterministic</div></div></div>
        </div>
        <div className="ceo-pnl"><div className="ceo-ph"><b />Activity mix<span>what kids do · 30d</span></div>
          <div className="ceo-donut">
            <svg viewBox="0 0 84 84">{(() => { let off = 0; const R = 32, C = 2 * Math.PI * R; return mix.length ? mix.slice(0, 6).map((s, i) => { const len = (s.events / mixTotal) * C; const el = <circle key={i} cx="42" cy="42" r={R} fill="none" stroke={`var(--c-slice${i % 5})`} strokeWidth="10" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 42 42)" />; off += len; return el }) : <circle cx="42" cy="42" r={R} fill="none" stroke="var(--c-track)" strokeWidth="10" /> })()}</svg>
            <div className="ceo-legend">{mix.slice(0, 5).map((s, i) => <div key={s.kind}><span style={{ background: `var(--c-slice${i % 5})` }} />{s.kind}</div>)}{!mix.length && <div className="l">no signal yet</div>}</div>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="ceo-bar">
        <button className="ceo-nav" onClick={() => toggleAgent()}><Mic size={14} /> VOICE · CEO agent</button>
        <button className="ceo-nav" onClick={() => setHud(v => !v)}>HUD · panels</button>
        <button className="ceo-corebtn" onClick={() => toggleAgent()} aria-label="Talk to the CEO agent"><span className="ceo-ring" /><span className="ceo-ring r2" /><Mic size={20} color="#fff" /></button>
        <button className="ceo-nav" onClick={() => go('growth')}>DATA · Growth</button>
        <button className="ceo-nav" onClick={() => go('command')}>DIAGNOSTICS · Command</button>
      </div>
      {!cloudEnabled && <div className="ceo-foot">OFFLINE PREVIEW · SIGN IN FOR LIVE DATA · values show honest —</div>}
    </div>
  )
}
