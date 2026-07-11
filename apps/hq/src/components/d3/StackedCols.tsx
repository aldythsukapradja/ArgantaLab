import { useMemo } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { useMeasure, useTooltip, TooltipLayer, TipRow, Legend } from './chartkit'
import { compact } from '../../lib/format'

export interface StackSeries { key: string; label: string; color: string }

// Stacked columns (per day) — ≤24px columns, 2px surface gaps between
// segments, per-column tooltip listing every series.
export function StackedCols({ labels, series, data, height = 190, valueFmt = compact }: {
  labels: string[]
  series: StackSeries[]
  data: Record<string, number>[]   // one object per label, keyed by series.key
  height?: number
  valueFmt?: (v: number) => string
}) {
  const [wrapRef, width] = useMeasure<HTMLDivElement>()
  const { wrapRef: tipWrap, tip, show, hide } = useTooltip()
  const W = Math.max(320, width)
  const H = height
  const padL = 8, padR = 34, padT = 12, padB = 22

  const { xb, y, totals } = useMemo(() => {
    const totals = data.map((d) => series.reduce((s, sr) => s + (d[sr.key] ?? 0), 0))
    const xb = scaleBand<number>().domain(labels.map((_, i) => i)).range([padL, W - padR]).paddingInner(0.35).paddingOuter(0.1)
    const y = scaleLinear().domain([0, Math.max(1, ...totals)]).range([H - padB, padT]).nice()
    return { xb, y, totals }
  }, [labels, series, data, W, H])

  if (labels.length === 0 || width === 0) return <div ref={wrapRef} style={{ minHeight: H }} />

  const bw = Math.min(24, xb.bandwidth())
  const ticks = y.ticks(4)

  return (
    <div ref={wrapRef}>
      <div ref={tipWrap} style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }} role="img" aria-label="Stacked columns">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--bd)" strokeWidth={1} />
              <text x={W - padR + 5} y={y(t) + 3.5} fontSize={9.5} fill="var(--tx3)">{valueFmt(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => {
            const cx = (xb(i) ?? 0) + (xb.bandwidth() - bw) / 2
            let acc = 0
            return (
              <g key={l + i}
                onPointerMove={(e) => show(e, (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontWeight: 700, color: 'var(--tx)' }}>{l} · {valueFmt(totals[i])}</div>
                    {series.map((s) => (data[i]?.[s.key] ?? 0) > 0 && (
                      <TipRow key={s.key} color={s.color} label={s.label} value={valueFmt(data[i][s.key])} />
                    ))}
                  </div>
                ))}
                onPointerLeave={hide}>
                <rect x={xb(i) ?? 0} y={padT - 6} width={xb.bandwidth()} height={H - padT - padB + 6} fill="transparent" />
                {series.map((s) => {
                  const v = data[i]?.[s.key] ?? 0
                  if (v <= 0) return null
                  const y1 = y(acc + v)
                  const y0 = y(acc)
                  acc += v
                  // 2px surface gap between touching segments (shrink 1px per edge)
                  const isBase = y0 >= H - padB - 0.5
                  const gy = y1 + 1
                  const gh = Math.max(1.5, y0 - y1 - (isBase ? 1 : 2))
                  return <rect key={s.key} x={cx} y={gy} width={bw} height={gh} rx={2} fill={s.color} />
                })}
                {(labels.length <= 10 || i % Math.ceil(labels.length / 10) === 0) && (
                  <text x={cx + bw / 2} y={H - 6} fontSize={9.5} fill="var(--tx3)" textAnchor="middle">{l}</text>
                )}
              </g>
            )
          })}
        </svg>
        <TooltipLayer tip={tip} />
      </div>
      <div style={{ marginTop: 6 }}>
        <Legend items={series.map(s => ({ label: s.label, color: s.color }))} />
      </div>
    </div>
  )
}
