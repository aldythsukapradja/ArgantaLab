// Dependency-free, theme-aware SVG line/area chart for the pitch deck. Draws in
// (CSS stroke-dashoffset via pathLength=1) whenever its slide gains .active — so it
// animates even while the preview tab is hidden. All series share the x-scale.

export interface Series { color: string; pts: number[]; area?: boolean; dashed?: boolean; endLabel?: string }
export interface ChartProps {
  series: Series[]
  xTicks: { i: number; label: string }[]
  yMax?: number
  refLine?: { v: number; label: string }
  marker?: { i: number; v: number; label: string }
  height?: number
}

const W = 580
const padL = 14, padR = 16, padT = 20, padB = 24

export default function PitchChart({ series, xTicks, yMax, refLine, marker, height = 216 }: ChartProps) {
  const n = Math.max(...series.map(s => s.pts.length))
  const max = yMax ?? Math.max(1, ...series.flatMap(s => s.pts), refLine?.v ?? 0) * 1.08
  const H = height
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1)
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const base = H - padB

  return (
    <svg className="pchart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="pitch chart">
      <defs>
        {series.map((s, si) => (
          <linearGradient key={si} id={`pcg${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const gy = padT + f * (H - padT - padB)
        return <line key={f} className="pchart-grid" x1={padL} x2={W - padR} y1={gy} y2={gy} />
      })}

      {refLine && <>
        <line className="pchart-ref" x1={padL} x2={W - padR} y1={y(refLine.v)} y2={y(refLine.v)} />
        <text className="pchart-reflabel" x={W - padR} y={y(refLine.v) - 6} textAnchor="end">{refLine.label}</text>
      </>}

      {series.map((s, si) => {
        const line = s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
        const area = `${line} L${x(s.pts.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`
        return (
          <g key={si}>
            {s.area && <path className="pchart-area" d={area} fill={`url(#pcg${si})`} />}
            <path className="pchart-line" pathLength={1} d={line} fill="none" stroke={s.color}
              strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={s.dashed ? '6 6' : undefined} style={{ ['--pcd' as string]: si * 0.12 + 's' }} />
            {s.endLabel && <text className="pchart-end" x={x(s.pts.length - 1)} y={y(s.pts[s.pts.length - 1]) - 9} textAnchor="end" fill={s.color}>{s.endLabel}</text>}
          </g>
        )
      })}

      {marker && <g className="pchart-mark">
        <line className="pchart-markline" x1={x(marker.i)} x2={x(marker.i)} y1={y(marker.v)} y2={base} />
        <circle cx={x(marker.i)} cy={y(marker.v)} r={5} className="pchart-dot" />
        <text className="pchart-marklabel" x={x(marker.i)} y={y(marker.v) - 12} textAnchor="middle">{marker.label}</text>
      </g>}

      {xTicks.map(t => (
        <text key={t.i} className="pchart-x" x={x(t.i)} y={H - 7} textAnchor="middle">{t.label}</text>
      ))}
    </svg>
  )
}
