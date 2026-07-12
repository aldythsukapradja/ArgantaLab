import { useMemo } from 'react'
import { scaleLinear, scalePoint } from 'd3-scale'
import { line as d3line, area as d3area, curveMonotoneX } from 'd3-shape'
import { max } from 'd3-array'
import { useMeasure, useTooltip, TooltipLayer, TipRow, Legend } from './chartkit'
import { compact } from '../../lib/format'

export interface TrendSeries {
  key: string
  label: string
  color: string
  /** draw the ~10% opacity wash under this series */
  area?: boolean
  dash?: boolean
}

// Responsive multi-series trend (D3 line/area) with a crosshair tooltip that
// snaps to the nearest x and reads every series at once.
export function AreaTrend({ labels, series, data, height = 200, valueFmt = compact, endLabels = true }: {
  labels: string[]
  series: TrendSeries[]
  data: Record<string, number>[]
  height?: number
  valueFmt?: (v: number) => string
  endLabels?: boolean
}) {
  const [wrapRef, width] = useMeasure<HTMLDivElement>()
  const { wrapRef: tipWrap, tip, show, hide } = useTooltip()
  const W = Math.max(320, width)
  const H = height
  const padL = 8, padR = 34, padT = 16, padB = 22
  const n = labels.length

  const { x, y, paths } = useMemo(() => {
    const x = scalePoint<number>().domain(labels.map((_, i) => i)).range([padL, W - padR])
    const maxV = Math.max(1, max(data, (d) => Math.max(...series.map(s => d[s.key] ?? 0))) ?? 1)
    const y = scaleLinear().domain([0, maxV]).range([H - padB, padT]).nice()
    const paths = series.map((s) => {
      const ln = d3line<Record<string, number>>()
        .x((_, i) => x(i) ?? 0).y((d) => y(d[s.key] ?? 0)).curve(curveMonotoneX)
      const ar = d3area<Record<string, number>>()
        .x((_, i) => x(i) ?? 0).y0(H - padB).y1((d) => y(d[s.key] ?? 0)).curve(curveMonotoneX)
      return { s, line: ln(data) ?? '', area: s.area ? (ar(data) ?? '') : null }
    })
    return { x, y, paths }
  }, [labels, series, data, W, H])

  if (n === 0 || width === 0) return <div ref={wrapRef} style={{ minHeight: H }} />

  const step = n > 1 ? (W - padL - padR) / (n - 1) : W
  const nearest = (px: number) => Math.max(0, Math.min(n - 1, Math.round((px - padL) / step)))

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const i = nearest(((e.clientX - box.left) / box.width) * W)
    show(e, (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontWeight: 700, color: 'var(--tx)' }}>{labels[i]}</div>
        {series.map((s) => (
          <TipRow key={s.key} color={s.color} label={s.label} value={valueFmt(data[i]?.[s.key] ?? 0)} />
        ))}
      </div>
    ))
  }

  // hover index is derived from the tooltip's x (container px → viewBox px)
  const hoverI: number | null = tip ? nearest((tip.x / Math.max(1, width)) * W) : null

  // Tick budget scales with plot height so short charts (strip trends, rail
  // curves) never pile labels on top of each other; d3 can overshoot the ask,
  // so thin the list back to budget by stride.
  const plotH = H - padT - padB
  const tickBudget = Math.max(2, Math.min(4, Math.floor(plotH / 34)))
  let ticks = y.ticks(tickBudget)
  if (ticks.length > tickBudget + 1) {
    const stride = Math.ceil(ticks.length / (tickBudget + 1))
    ticks = ticks.filter((_, i) => i % stride === 0)
  }

  return (
    <div ref={wrapRef}>
      <div ref={tipWrap} style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }}
          role="img" aria-label="Trend chart" onPointerMove={onMove} onPointerLeave={hide}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--bd)" strokeWidth={1} />
              {/* baseline tick keeps its gridline but drops the label — it would
                  collide with the x-axis labels sharing that row */}
              {y(t) < H - padB - 11 && (
                <text x={W - padR + 5} y={y(t) + 3.5} fontSize={9.5} fill="var(--tx3)">{valueFmt(t)}</text>
              )}
            </g>
          ))}
          {tip && hoverI != null && (
            <line x1={x(hoverI)} x2={x(hoverI)} y1={padT - 4} y2={H - padB} stroke="var(--bd3)" strokeWidth={1} />
          )}
          {paths.map(({ s, area }) => area && (
            <path key={s.key + '-a'} d={area} fill={s.color} opacity={0.1} />
          ))}
          {paths.map(({ s, line }) => (
            <path key={s.key} d={line} fill="none" stroke={s.color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash ? '5 4' : undefined} />
          ))}
          {/* end markers, ringed in the surface color */}
          {series.map((s) => (
            <circle key={s.key + '-m'} cx={x(n - 1)} cy={y(data[n - 1]?.[s.key] ?? 0)} r={4}
              fill={s.color} stroke="var(--bg)" strokeWidth={2} />
          ))}
          {/* crosshair markers at hover */}
          {tip && hoverI != null && series.map((s) => (
            <circle key={s.key + '-h'} cx={x(hoverI)} cy={y(data[hoverI]?.[s.key] ?? 0)} r={4}
              fill={s.color} stroke="var(--bg)" strokeWidth={2} />
          ))}
          {/* selective direct labels: the endpoint only */}
          {endLabels && series.length <= 3 && series.map((s) => (
            <text key={s.key + '-l'} x={x(n - 1)! - 6} y={y(data[n - 1]?.[s.key] ?? 0) - 9}
              fontSize={10.5} fontWeight={700} fill="var(--tx2)" textAnchor="end">
              {valueFmt(data[n - 1]?.[s.key] ?? 0)}
            </text>
          ))}
          {labels.map((l, i) => (
            (n <= 10 || i % Math.ceil(n / 10) === 0) && (
              <text key={i} x={x(i)} y={H - 6} fontSize={9.5} fill="var(--tx3)" textAnchor="middle">{l}</text>
            )
          ))}
        </svg>
        <TooltipLayer tip={tip} />
      </div>
      <div style={{ marginTop: 6 }}>
        <Legend items={series.map(s => ({ label: s.label, color: s.color }))} mark="line" />
      </div>
    </div>
  )
}
