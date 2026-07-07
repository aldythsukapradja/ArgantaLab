import { useEffect, useMemo, useState } from 'react'
import { Mic, LayoutGrid, Sun, Moon } from 'lucide-react'
import { useHQ } from '../shell/store'
import { live, cloudEnabled } from '../data/live'
import type { GrowthOverview, EconomyData, PortfolioVc } from '../data/types'
import type { KinetikStats } from '../data/live'
import { LandingBg } from './LandingBg'
import { AreaTrend, MintBurnBars, MixDonut, Gauges } from './landingCharts'
import { ReactorOrb } from './ReactorOrb'
import { WorldMap } from './WorldMap'
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

// AI/ML brain — a dense node cluster masked to a brain-ish ellipse (viewBox 140x60).
const MINI_BRAIN = (() => {
  const rand = mulberry32(11); const nodes: [number, number][] = []
  const cx = 70, cy = 30, rx = 54, ry = 23; let tries = 0
  while (nodes.length < 46 && tries < 900) {
    tries++
    const x = cx + (rand() * 2 - 1) * rx, y = cy + (rand() * 2 - 1) * ry
    const nx = (x - cx) / rx, ny = (y - cy) / ry
    if (nx * nx + ny * ny <= 1) nodes.push([x, y])
  }
  let d = ''
  for (let i = 0; i < nodes.length; i++) {
    const near = nodes.map((p, j) => ({ j, dd: (p[0] - nodes[i][0]) ** 2 + (p[1] - nodes[i][1]) ** 2 })).filter(o => o.j !== i).sort((a, b) => a.dd - b.dd).slice(0, 3)
    for (const o of near) if (o.j > i) d += `M${nodes[i][0].toFixed(0)} ${nodes[i][1].toFixed(0)}L${nodes[o.j][0].toFixed(0)} ${nodes[o.j][1].toFixed(0)}`
  }
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
  const [lite] = useState(() => typeof window !== 'undefined' && (window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches))
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
  const mb = e?.mintBurn ?? []
  const scen = [
    ['Growth', !!g], ['Retention', vc?.d1Retention != null], ['Economy', !!e],
    ['Content', g?.accuracyPct != null], ['Monetization', !!vc], ['Activity', mix.length > 0],
  ] as [string, boolean][]

  return (
    <div className="ceo" data-hud={hud}>
      <LandingBg />

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
            <WorldMap />
            <div className="ceo-r3"><div><span className="v">{N(k?.circles)}</span><span className="l">Circles</span></div><div><span className="v">{N(k?.members)}</span><span className="l">Members</span></div><div><span className="v">{N(g?.wau)}</span><span className="l">Active·7d</span></div></div>
            <div className="ceo-note">geo = placeholder → usage % by region</div>
          </div>
          <div className="ceo-pnl"><div className="ceo-ph"><b />Performance<span>live product metrics</span></div>
            <AreaTrend data={g?.northStar} />
            <div className="ceo-r3"><div><span className="v">{vc?.lessonsPerKidDay == null ? '—' : vc.lessonsPerKidDay.toFixed(1)}</span><span className="l">Lessons/kid</span></div><div><span className="v">{PCT(vc?.d1Retention)}</span><span className="l">D1 return</span></div><div><span className="v">{N(vc?.screenMinPerKidDay)}m</span><span className="l">Screen/kid</span></div></div>
          </div>
        </div>

        {/* CENTER */}
        <div className="ceo-core">
          <div className="ceo-greet">{greet}, {first}</div>
          <div className="ceo-orbrow">
          <div className="ceo-badge"><div className="bv">27</div><div className="bl">agents</div></div>
          <div className="ceo-orb">
            {lite ? (
            <svg viewBox="0 0 400 400" role="img" aria-label="CEO reactor core">
              <defs>
                <radialGradient id="ceocore" cx="50%" cy="44%" r="56%"><stop offset="0%" stopColor="#ffffff" /><stop offset="48%" stopColor="var(--c-core1)" /><stop offset="100%" stopColor="var(--c-core2)" /></radialGradient>
                <radialGradient id="ceoglow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="var(--c-accent)" stopOpacity=".3" /><stop offset="100%" stopColor="var(--c-accent)" stopOpacity="0" /></radialGradient>
              </defs>
              {/* graduated tick bezel */}
              <g className="ceo-rC" stroke="var(--c-ring)" strokeWidth="1.4">
                {Array.from({ length: 72 }).map((_, i) => {
                  const a = (i / 72) * Math.PI * 2, lg = i % 6 === 0
                  const R0 = 191, R1 = lg ? 178 : 185
                  return <line key={i} x1={(200 + Math.cos(a) * R0).toFixed(1)} y1={(200 + Math.sin(a) * R0).toFixed(1)} x2={(200 + Math.cos(a) * R1).toFixed(1)} y2={(200 + Math.sin(a) * R1).toFixed(1)} strokeOpacity={lg ? 0.7 : 0.32} />
                })}
              </g>
              <g fill="none" strokeLinecap="round">
                <g className="ceo-rA" stroke="var(--c-ring)"><circle cx="200" cy="200" r="168" strokeWidth="1.4" strokeOpacity=".55" strokeDasharray="200 860" /><circle cx="200" cy="200" r="168" strokeWidth="1.4" strokeOpacity=".16" /></g>
                <circle cx="200" cy="200" r="154" stroke="var(--c-ring)" strokeWidth="1" strokeOpacity=".38" strokeDasharray="3 8" />
                <g className="ceo-rB" stroke="var(--c-ring)"><circle cx="200" cy="200" r="138" strokeWidth="2" strokeOpacity=".7" /><path d="M200 56v12M200 332v12M56 200h12M332 200h12" strokeWidth="1.3" strokeOpacity=".55" /></g>
                <g className="ceo-rB2" stroke="var(--c-accent)"><circle cx="200" cy="200" r="120" strokeWidth="1.2" strokeOpacity=".5" strokeDasharray="1.5 7" /></g>
                <circle cx="200" cy="200" r="102" stroke="var(--c-ring)" strokeWidth="1" strokeOpacity=".28" />
                <g className="ceo-rA" stroke="var(--c-accent2)"><circle cx="200" cy="200" r="84" strokeWidth="1.4" strokeOpacity=".55" strokeDasharray="90 438" /></g>
                <g className="ceo-rC" stroke="var(--c-accent)"><circle cx="200" cy="200" r="66" strokeWidth="1.2" strokeOpacity=".6" strokeDasharray="6 5" /></g>
              </g>
              <g className="ceo-sweep"><path d="M200 200 L200 62 A138 138 0 0 1 294 100 Z" fill="var(--c-accent)" opacity=".07" /></g>
              <circle cx="200" cy="200" r="96" fill="url(#ceoglow)" />
              <circle cx="200" cy="200" r="40" fill="url(#ceocore)" style={{ filter: 'drop-shadow(0 0 22px var(--c-accent))' }}>
                <animate attributeName="r" values="40;43;40" dur="3.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="200" cy="197" r="16" fill="#fff" opacity=".95" />
            </svg>
            ) : <ReactorOrb dark={theme === 'dark'} />}
          </div>
          <div className="ceo-badge"><div className="bv">{PCT(e?.coverage)}</div><div className="bl">coverage</div></div>
          </div>
          {/* core output */}
          <div className="ceo-coreout"><span className="ceo-co-l">CORE OUTPUT · mint vs burn</span>
            <MintBurnBars data={mb} />
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
            <AreaTrend data={g?.northStar} color="var(--c-accent2)" />
            <div className="ceo-r3"><div><span className="v">{PCT(vc?.activationRate)}</span><span className="l">Activation</span></div><div><span className="v">{PCT(vc?.returnRate)}</span><span className="l">Return·30d</span></div><div><span className="v">{vc?.kFactor == null ? '—' : vc.kFactor.toFixed(2)}</span><span className="l">k-factor</span></div></div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="ceo-row4">
        <div className="ceo-pnl"><div className="ceo-ph"><b />AARRR vitals<span>the funnel</span></div>
          <Gauges items={[
            { name: 'Activation', value: vc?.activationRate ?? null },
            { name: 'Engage', value: g?.stickiness ?? null },
            { name: 'Retain', value: vc?.d1Retention ?? null },
            { name: 'Referral', value: vc?.invitesSent ? Math.round((100 * vc.invitesAccepted) / vc.invitesSent) : null },
          ]} />
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
            <div style={{ flex: '0 0 96px' }}><MixDonut data={mix} /></div>
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
