import { useMemo, useState } from 'react'
import { scaleLinear, scaleBand, scalePow } from 'd3-scale'
import { arc as d3arc, area as d3area, line as d3line, curveMonotoneX } from 'd3-shape'
import { DEFAULT_SFX_RECIPES, cueGroups, isDynamicOnly } from '@arganta/audio'

// Overview = a BENTO dashboard (researched layout: asymmetric tiles where size
// encodes importance, ≤~12 widgets, bars-over-bubbles for ranking — Stephen
// Few). Every widget is drawn with d3 (scales + shape generators, SVG) and
// backed by REAL audio_usage data — no mock numbers, honest empty states.
// A hero ranked-bar tile answers "which cue to fine-tune first"; the earlier
// scatter is gone (a linear x-axis with one dominant cue crushed every other
// point into the left edge — a ranked bar reads that same signal correctly).

type UsageRow = { play_count: number; last_played: string | null }
type Usage = Record<string, UsageRow>
type Trend = { day: string; plays: number }[]

const CAT_COLOR: Record<string, string> = {
  Action: '#6366f1', Progression: '#0ea5a3', Combat: '#ef4444',
  'Bloomwall towers': '#f59e0b', Emotes: '#ff3d72',
}
const GROUPS = cueGroups() as Record<string, string[]>
const ALL_CUES = Object.keys(DEFAULT_SFX_RECIPES)
const catOf = (name: string) => Object.entries(GROUPS).find(([, n]) => n.includes(name))?.[0] || 'Action'
const relTime = (iso: string | null) => {
  if (!iso) return 'never'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 90) return 'just now'
  if (s < 3600) return Math.round(s / 60) + 'm ago'
  if (s < 86400) return Math.round(s / 3600) + 'h ago'
  return Math.round(s / 86400) + 'd ago'
}

type Row = { name: string; count: number; dyn: boolean; cat: string; last: string | null }

// ---- KPI tile (optionally with a sparkline drawn from the real trend) ----
function Kpi({ k, v, s, hot, spark }: { k: string; v: string | number; s: string; hot?: boolean; spark?: number[] }) {
  let sparkPath = ''
  if (spark && spark.length > 1) {
    const W = 90, H = 26, max = Math.max(1, ...spark)
    const x = scaleLinear().domain([0, spark.length - 1]).range([0, W])
    const y = scaleLinear().domain([0, max]).range([H, 3])
    sparkPath = (d3line<number>().x((_, i) => x(i)).y(d => y(d)).curve(curveMonotoneX)(spark)) || ''
  }
  return (
    <div className={'mbf-w mbf-kpi2' + (hot ? ' hot' : '')}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
      {sparkPath && <svg className="mbf-kpispark" viewBox="0 0 90 26" preserveAspectRatio="none"><path d={sparkPath} fill="none" stroke="var(--acc)" strokeWidth={1.6} /></svg>}
    </div>
  )
}

// ---- HERO: ranked horizontal bars, sqrt scale so a dominant cue doesn't
//      flatten the rest. The genuine "fine-tune priority" widget. ----
function RankedBars({ rows, onSelect }: { rows: Row[]; onSelect: (n: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const top = rows.slice(0, 12)
  const W = 520, rowH = 26, PAD_T = 4, LABEL = 108, VAL = 46
  const H = PAD_T * 2 + top.length * rowH
  const max = Math.max(1, ...top.map(r => r.count))
  const x = scalePow().exponent(0.5).domain([0, max]).range([0, W - LABEL - VAL])
  const y = scaleBand<string>().domain(top.map(r => r.name)).range([PAD_T, H - PAD_T]).padding(0.28)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {top.map(r => {
        const yy = y(r.name)!, bh = y.bandwidth(), w = Math.max(2, x(r.count))
        const on = hover === r.name
        return (
          <g key={r.name} style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover(r.name)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(r.name)}>
            <rect x={0} y={yy - 2} width={W} height={bh + 4} fill={on ? 'var(--bg3)' : 'transparent'} rx={5} />
            <text x={LABEL - 8} y={yy + bh / 2 + 3.5} textAnchor="end" fontSize={11.5} fontWeight={on ? 700 : 600} fill="var(--tx)">{r.name}</text>
            <rect x={LABEL} y={yy} width={W - LABEL - VAL} height={bh} rx={bh / 2} fill="var(--bg3)" />
            <rect x={LABEL} y={yy} width={w} height={bh} rx={bh / 2} fill={CAT_COLOR[r.cat]} opacity={on ? 1 : 0.85} />
            <text x={LABEL + w + 6} y={yy + bh / 2 + 3.5} fontSize={10.5} fontFamily="var(--mono)" fill="var(--tx2)">{r.count.toLocaleString()}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Donut({ rows }: { rows: Row[] }) {
  const cats: Record<string, number> = {}
  rows.forEach(r => { cats[r.cat] = (cats[r.cat] || 0) + r.count })
  const total = Object.values(cats).reduce((a, b) => a + b, 0) || 1
  const R = 74, r0 = 46
  let a0 = -Math.PI / 2
  const arcs = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, v]) => {
    const a1 = a0 + (v / total) * Math.PI * 2
    const d = d3arc<any, any>().innerRadius(r0).outerRadius(R).cornerRadius(2).padAngle(0.02).startAngle(a0).endAngle(a1)({} as any) || ''
    a0 = a1
    return { cat, v, d, pct: Math.round((v / total) * 100) }
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${R * 2} ${R * 2}`} width={168} height={168}>
        <g transform={`translate(${R},${R})`}>
          {arcs.map(a => <path key={a.cat} d={a.d} fill={CAT_COLOR[a.cat]} />)}
          <text textAnchor="middle" y={-1} fontSize={20} fontWeight={800} fill="var(--tx)">{total.toLocaleString()}</text>
          <text textAnchor="middle" y={15} fontSize={8} fontFamily="var(--mono)" fill="var(--tx3)" letterSpacing={1}>TOTAL PLAYS</text>
        </g>
      </svg>
      <div className="mbf-donutleg">
        {arcs.map(a => <span key={a.cat}><i style={{ background: CAT_COLOR[a.cat] }} />{a.cat} {a.pct}%</span>)}
      </div>
    </div>
  )
}

// ---- Coverage gauge (d3 arc semicircle): how many cues have ever fired ----
function CoverageGauge({ played, total }: { played: number; total: number }) {
  const pct = total ? played / total : 0
  const R = 72, r0 = 52, W = R * 2, H = R + 18
  const a = scaleLinear().domain([0, 1]).range([-Math.PI / 2, Math.PI / 2])
  const track = d3arc<any, any>().innerRadius(r0).outerRadius(R).startAngle(-Math.PI / 2).endAngle(Math.PI / 2)({} as any) || ''
  const val = d3arc<any, any>().innerRadius(r0).outerRadius(R).cornerRadius(3).startAngle(-Math.PI / 2).endAngle(a(pct))({} as any) || ''
  const tone = pct > 0.66 ? 'var(--ok)' : pct > 0.33 ? 'var(--warn)' : 'var(--bad)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={188}>
        <g transform={`translate(${R},${R})`}>
          <path d={track} fill="var(--bg3)" />
          <path d={val} fill={tone} />
          <text textAnchor="middle" y={-6} fontSize={26} fontWeight={800} fill="var(--tx)">{Math.round(pct * 100)}%</text>
          <text textAnchor="middle" y={11} fontSize={9} fontFamily="var(--mono)" fill="var(--tx3)">{played}/{total} cues used</text>
        </g>
      </svg>
      <div style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: 2 }}>{total - played} silent — candidates to cut</div>
    </div>
  )
}

// ---- Static vs dynamic PLAYS (not cue count): reinforces why a runtime
//      tracker exists — dynamic cues are invisible to static grep. ----
function SplitBar({ rows }: { rows: Row[] }) {
  const dynPlays = rows.filter(r => r.dyn).reduce((a, r) => a + r.count, 0)
  const staticPlays = rows.filter(r => !r.dyn).reduce((a, r) => a + r.count, 0)
  const total = dynPlays + staticPlays || 1
  const dynPct = (dynPlays / total) * 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
      <div className="mbf-splitbar">
        <div style={{ width: (100 - dynPct) + '%', background: 'var(--acc)' }} />
        <div style={{ width: dynPct + '%', background: 'var(--warn)' }} />
      </div>
      <div className="mbf-splitleg">
        <span><i style={{ background: 'var(--acc)' }} />Static <b>{staticPlays.toLocaleString()}</b></span>
        <span><i style={{ background: 'var(--warn)' }} />Dynamic <b>{dynPlays.toLocaleString()}</b></span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{Math.round(dynPct)}% of plays come from cues grep can't attribute — only this tracker sees them.</div>
    </div>
  )
}

function Recency({ rows, onSelect }: { rows: Row[]; onSelect: (n: string) => void }) {
  const recent = rows.filter(r => r.last).sort((a, b) => new Date(b.last!).getTime() - new Date(a.last!).getTime()).slice(0, 6)
  if (recent.length === 0) return <div style={{ fontSize: 11, color: 'var(--tx3)', padding: 8 }}>No plays recorded yet.</div>
  return (
    <div className="mbf-recency">
      {recent.map(r => (
        <div key={r.name} className="mbf-recrow" onClick={() => onSelect(r.name)}>
          <span className="dot" style={{ background: CAT_COLOR[r.cat] }} />
          <span className="nm">{r.name}</span>
          <span className="t">{relTime(r.last)}</span>
        </div>
      ))}
    </div>
  )
}

function TrendArea({ trend }: { trend: Trend }) {
  const W = 900, H = 130, PAD_L = 4, PAD_R = 4, PAD_T = 10, PAD_B = 20
  const max = Math.max(1, ...trend.map(d => d.plays))
  const x = scaleLinear().domain([0, Math.max(1, trend.length - 1)]).range([PAD_L, W - PAD_R])
  const y = scaleLinear().domain([0, max]).range([H - PAD_B, PAD_T])
  const areaPath = d3area<{ day: string; plays: number }>().x((_, i) => x(i)).y0(H - PAD_B).y1(d => y(d.plays)).curve(curveMonotoneX)(trend) || ''
  const linePath = d3line<{ day: string; plays: number }>().x((_, i) => x(i)).y(d => y(d.plays)).curve(curveMonotoneX)(trend) || ''
  const step = Math.max(1, Math.round(trend.length / 8))
  const lastIdx = trend.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="mbf-trendfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--acc)" stopOpacity={0.32} />
          <stop offset="100%" stopColor="var(--acc)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#mbf-trendfade)" />
      <path d={linePath} fill="none" stroke="var(--acc)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {lastIdx >= 0 && <circle cx={x(lastIdx)} cy={y(trend[lastIdx].plays)} r={3.5} fill="var(--acc)" stroke="var(--bg)" strokeWidth={1.5} />}
      {trend.map((d, i) => (i % step === 0 || i === lastIdx) ? (
        <text key={d.day} x={x(i)} y={H - 6} fontSize={8.5} fontFamily="var(--mono)" fill="var(--tx3)" textAnchor="middle">
          {new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </text>
      ) : null)}
    </svg>
  )
}

export function Analytics({ usage, usageLoaded, cloudEnabled, trend, onSelectCue }: {
  usage: Usage; usageLoaded: boolean; cloudEnabled: boolean; trend: Trend | null; onSelectCue: (name: string) => void
}) {
  const rows: Row[] = useMemo(() => ALL_CUES
    .map(name => ({ name, count: usage[name]?.play_count ?? 0, dyn: isDynamicOnly(name), cat: catOf(name), last: usage[name]?.last_played ?? null }))
    .sort((a, b) => b.count - a.count), [usage])

  if (!cloudEnabled) return <div className="mbf-note">Connect Supabase + run <code>supabase/migration_audio_usage.sql</code> to see real usage. Nothing honest to show here until then — no mock numbers.</div>
  if (!usageLoaded) return <div className="mbf-note">Loading…</div>

  const total = rows.reduce((a, r) => a + r.count, 0)
  const played = rows.filter(r => r.count > 0).length
  const silent = ALL_CUES.length - played
  const dynamicCount = rows.filter(r => r.dyn).length
  const spark = trend ? trend.slice(-14).map(d => d.plays) : undefined

  if (total === 0) return <div className="mbf-note">Migration ran but no plays logged yet — the table is empty. Play the game for ~15s (client flushes every 15s) then reload.</div>

  return (
    <div className="mbf-bento">
      <Kpi k="Total plays" v={total.toLocaleString()} s="live-tracked" spark={spark} />
      <Kpi k="Cues in library" v={ALL_CUES.length} s={`${ALL_CUES.length - dynamicCount} static · ${dynamicCount} dynamic`} />
      <Kpi k="Most played" v={rows[0].name} s={`${rows[0].count.toLocaleString()} plays`} />
      <Kpi k="Coverage" v={`${Math.round((played / ALL_CUES.length) * 100)}%`} s={`${played}/${ALL_CUES.length} cues used`} />
      <Kpi hot={silent > 0} k="Silent cues" v={silent} s="0 plays — review these" />

      <div className="mbf-w w-hero">
        <div className="mbf-wh"><b>Fine-tune priority</b><span>most-played cues — polish these first</span></div>
        <RankedBars rows={rows} onSelect={onSelectCue} />
      </div>

      <div className="mbf-w w-donut">
        <div className="mbf-wh"><b>Plays by category</b></div>
        <Donut rows={rows} />
      </div>

      <div className="mbf-w w-gauge">
        <div className="mbf-wh"><b>Library coverage</b></div>
        <CoverageGauge played={played} total={ALL_CUES.length} />
      </div>

      <div className="mbf-w w-split">
        <div className="mbf-wh"><b>Static vs dynamic</b><span>plays</span></div>
        <SplitBar rows={rows} />
      </div>

      <div className="mbf-w w-recency">
        <div className="mbf-wh"><b>Recently played</b></div>
        <Recency rows={rows} onSelect={onSelectCue} />
      </div>

      <div className="mbf-w w-trend">
        {trend === null ? (
          <>
            <div className="mbf-wh"><b>Plays over time</b><span className="mbf-locktag">needs audio_usage_daily table</span></div>
            <div className="mbf-lockedpanel">Run <code>supabase/migration_audio_usage_daily.sql</code> to enable the trend (build plan §4).</div>
          </>
        ) : (
          <>
            <div className="mbf-wh"><b>Plays over time</b><span>last {trend.length} days · all cues</span></div>
            <TrendArea trend={trend} />
          </>
        )}
      </div>
    </div>
  )
}
