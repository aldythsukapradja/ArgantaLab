// ── DeckCharts — the d3-backed chart set for the pitch deck's NUMBERS + MACHINE
// chapters. d3-scale/shape do the math; React renders the SVG (no d3 DOM mutation).
// Draw-in animation via pathLength=1 + CSS stroke-dashoffset keyed to .pslide.active
// (matches the existing PitchChart so everything animates on slide-in).
import { scaleLinear } from 'd3-scale'
import { line as d3line, area as d3area, curveMonotoneX } from 'd3-shape'

// ── Competition 2-axis positioning map (slide 5) ──
// x = learning depth, y = family coordination. Every incumbent on one axis; us in
// the corner. Points carry {name, x, y, us}.
export function ScatterMap({ points, w = 620, h = 380 }: {
  points: { name: string; x: number; y: number; us?: boolean }[]; w?: number; h?: number
}) {
  const pad = 46
  const sx = scaleLinear([0, 1], [pad, w - pad])
  const sy = scaleLinear([0, 1], [h - pad, pad])
  return (
    <svg className="d3c" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Competitive landscape">
      {/* quadrant grid */}
      <line x1={pad} y1={sy(0)} x2={w - pad} y2={sy(0)} className="d3c-axis" />
      <line x1={pad} y1={sy(0)} x2={pad} y2={pad} className="d3c-axis" />
      <line x1={sx(0.5)} y1={pad} x2={sx(0.5)} y2={h - pad} className="d3c-grid" />
      <line x1={pad} y1={sy(0.5)} x2={w - pad} y2={sy(0.5)} className="d3c-grid" />
      {/* axis labels */}
      <text x={w / 2} y={h - 12} className="d3c-axl" textAnchor="middle">Learning depth →</text>
      <text x={16} y={h / 2} className="d3c-axl" textAnchor="middle" transform={`rotate(-90 16 ${h / 2})`}>Family coordination →</text>
      <text x={w - pad} y={pad - 12} className="d3c-corner" textAnchor="end">the open corner</text>
      {points.map(p => (
        <g key={p.name} className={`d3c-pt${p.us ? ' us' : ''}`} style={{ ['--x' as string]: sx(p.x), ['--y' as string]: sy(p.y) }}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={p.us ? 11 : 6} />
          <text x={sx(p.x)} y={sy(p.y) - (p.us ? 18 : 12)} textAnchor="middle">{p.name}</text>
        </g>
      ))}
    </svg>
  )
}

// ── Valuation range/dumbbell plot (slide 24) ──
// Each method a horizontal low→high bar; a recommended band behind them.
export function RangePlot({ methods, band, w = 620, h = 340 }: {
  methods: { label: string; low: number; high: number }[]
  band: { low: number; high: number }
  w?: number; h?: number
}) {
  const padL = 128, padR = 40, padT = 20, padB = 34
  const maxV = Math.max(...methods.map(m => m.high), band.high) * 1.05
  const sx = scaleLinear([0, maxV], [padL, w - padR])
  const rowH = (h - padT - padB) / methods.length
  return (
    <svg className="d3c" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Valuation methods">
      {/* recommended band */}
      <rect x={sx(band.low)} y={padT - 4} width={sx(band.high) - sx(band.low)} height={h - padT - padB + 8} className="d3c-band" />
      <text x={(sx(band.low) + sx(band.high)) / 2} y={h - 10} textAnchor="middle" className="d3c-bandl">recommended ${band.low}–{band.high}M</text>
      {methods.map((m, i) => {
        const y = padT + i * rowH + rowH / 2
        return (
          <g key={m.label} className="d3c-row" style={{ ['--i' as string]: i }}>
            <text x={padL - 12} y={y + 4} textAnchor="end" className="d3c-rowl">{m.label}</text>
            <line x1={sx(m.low)} y1={y} x2={sx(m.high)} y2={y} className="d3c-dumb" />
            <circle cx={sx(m.low)} cy={y} r={4.5} className="d3c-dot" />
            <circle cx={sx(m.high)} cy={y} r={4.5} className="d3c-dot" />
            <text x={sx(m.high) + 8} y={y + 4} className="d3c-val">${m.high}M</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Per-payer LTV:CAC bar trio (slide 19) ──
export function PayerBars({ cases, w = 560, h = 300 }: {
  cases: { label: string; ltv: number; cac: number; ratio: number }[]; w?: number; h?: number
}) {
  const padL = 42, padR = 20, padT = 20, padB = 46
  const maxV = Math.max(...cases.flatMap(c => [c.ltv, c.cac])) * 1.1
  const sy = scaleLinear([0, maxV], [h - padB, padT])
  const groupW = (w - padL - padR) / cases.length
  const bw = Math.min(38, groupW / 3.2)
  return (
    <svg className="d3c" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Per-payer unit economics">
      <line x1={padL} y1={sy(0)} x2={w - padR} y2={sy(0)} className="d3c-axis" />
      {cases.map((c, i) => {
        const cx = padL + i * groupW + groupW / 2
        const under = c.ratio < 1
        return (
          <g key={c.label} className="d3c-bargroup" style={{ ['--i' as string]: i }}>
            <rect x={cx - bw - 3} y={sy(c.ltv)} width={bw} height={sy(0) - sy(c.ltv)} className="d3c-bar ltv" />
            <rect x={cx + 3} y={sy(c.cac)} width={bw} height={sy(0) - sy(c.cac)} className={`d3c-bar cac${under ? ' bad' : ''}`} />
            <text x={cx} y={h - 26} textAnchor="middle" className="d3c-rowl">{c.label}</text>
            <text x={cx} y={h - 10} textAnchor="middle" className={`d3c-ratio${under ? ' bad' : ''}`}>{c.ratio.toFixed(1)}× LTV:CAC</text>
          </g>
        )
      })}
      <g className="d3c-legend2"><rect x={w - padR - 150} y={padT} width={10} height={10} className="d3c-bar ltv" /><text x={w - padR - 136} y={padT + 9} className="d3c-leg">LTV / payer</text><rect x={w - padR - 70} y={padT} width={10} height={10} className="d3c-bar cac" /><text x={w - padR - 56} y={padT + 9} className="d3c-leg">CAC / payer</text></g>
    </svg>
  )
}

// ── Velocity swimlane timeline (slide 23) ──
export function Velocity({ items, w = 620, h = 300 }: {
  items: { label: string; kind: 'product' | 'builder' }[]; w?: number; h?: number
}) {
  const padL = 20, padR = 20, padT = 40, padB = 20
  const products = items.filter(i => i.kind === 'product')
  const builders = items.filter(i => i.kind === 'builder')
  const laneY = (n: number) => padT + n * ((h - padT - padB) / 2)
  const chip = (arr: typeof items, y: number) => {
    const cw = (w - padL - padR) / arr.length
    return arr.map((it, i) => (
      <g key={it.label} className="d3c-vchip" style={{ ['--i' as string]: i }}>
        <rect x={padL + i * cw + 4} y={y} width={cw - 8} height={30} rx={8} className={`d3c-vbox ${it.kind}`} />
        <text x={padL + i * cw + cw / 2} y={y + 20} textAnchor="middle" className="d3c-vlbl">{it.label}</text>
      </g>
    ))
  }
  return (
    <svg className="d3c" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Shipping velocity">
      <text x={padL} y={laneY(0) - 8} className="d3c-vlane">PRODUCTS</text>
      {chip(products, laneY(0))}
      <text x={padL} y={laneY(1) - 8} className="d3c-vlane">BUILDER SURFACES</text>
      {chip(builders, laneY(1))}
    </svg>
  )
}

// ── Line/area (growth, retention, cash, ARR fan, scale) — d3-scaled, multi-series ──
export function LineArea({ series, xTicks, refLine, w = 620, h = 260, yMax }: {
  series: { color: string; pts: number[]; area?: boolean; dashed?: boolean; label?: string }[]
  xTicks?: { i: number; label: string }[]
  refLine?: { v: number; label: string }
  w?: number; h?: number; yMax?: number
}) {
  const padL = 34, padR = 44, padT = 16, padB = 26
  const n = Math.max(...series.map(s => s.pts.length))
  const allV = series.flatMap(s => s.pts)
  const lo = Math.min(0, ...allV), hi = yMax ?? Math.max(...allV) * 1.08
  const sx = scaleLinear([0, n - 1], [padL, w - padR])
  const sy = scaleLinear([lo, hi], [h - padB, padT])
  const mkLine = d3line<number>().x((_, i) => sx(i)).y(v => sy(v)).curve(curveMonotoneX)
  const mkArea = d3area<number>().x((_, i) => sx(i)).y0(sy(Math.max(0, lo))).y1(v => sy(v)).curve(curveMonotoneX)
  return (
    <svg className="d3c" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Trend">
      <line x1={padL} y1={sy(Math.max(0, lo))} x2={w - padR} y2={sy(Math.max(0, lo))} className="d3c-axis" />
      {refLine && <>
        <line x1={padL} y1={sy(refLine.v)} x2={w - padR} y2={sy(refLine.v)} className="d3c-ref" />
        <text x={w - padR} y={sy(refLine.v) - 5} textAnchor="end" className="d3c-refl">{refLine.label}</text>
      </>}
      {series.map((s, si) => (
        <g key={si}>
          {s.area && <path d={mkArea(s.pts) || ''} fill={s.color} opacity={0.12} />}
          <path className="d3c-path" pathLength={1} d={mkLine(s.pts) || ''} fill="none" stroke={s.color} strokeWidth={2.4} style={{ ['--si' as string]: si }} />
          {s.label && <text x={sx(s.pts.length - 1) + 5} y={sy(s.pts[s.pts.length - 1])} className="d3c-endl" fill={s.color}>{s.label}</text>}
        </g>
      ))}
      {xTicks?.map(t => <text key={t.i} x={sx(t.i)} y={h - 8} textAnchor="middle" className="d3c-xt">{t.label}</text>)}
    </svg>
  )
}
