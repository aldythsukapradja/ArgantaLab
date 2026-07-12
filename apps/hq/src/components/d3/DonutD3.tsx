import { useMemo, useState } from 'react'
import { pie as d3pie, arc as d3arc, type PieArcDatum } from 'd3-shape'
import { useTooltip, TooltipLayer, TipRow } from './chartkit'
import { compact } from '../../lib/format'

export interface DonutSlice { label: string; value: number; color: string }

// D3 arc donut — 2px surface gaps via padAngle, hover lift + tooltip, legend
// with values (identity is never color-alone).
export function DonutD3({ slices, centerLabel, centerValue, size = 168, valueFmt = compact, dense = false }: {
  slices: DonutSlice[]
  centerLabel?: string
  centerValue?: string
  size?: number
  valueFmt?: (v: number) => string
  /** tight legend for narrow rails */
  dense?: boolean
}) {
  const { wrapRef, tip, show, hide } = useTooltip()
  const [hover, setHover] = useState<number | null>(null)
  const R = size / 2
  const total = slices.reduce((s, x) => s + x.value, 0) || 1

  const arcs = useMemo(() => {
    const gen = d3pie<DonutSlice>().value((d) => d.value).sort(null).padAngle(2 / (R - 12))
    return gen(slices)
  }, [slices, R])

  const arcPath = (d: PieArcDatum<DonutSlice>, lift: boolean) =>
    d3arc<PieArcDatum<DonutSlice>>()
      .innerRadius(R - 26)
      .outerRadius(lift ? R - 1 : R - 4)
      .cornerRadius(3)(d) ?? ''

  return (
    <div ref={wrapRef} className="row" style={{ gap: 22, flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ flex: 'none' }} role="img" aria-label={centerLabel || 'Composition'}>
        <g transform={`translate(${R},${R})`}>
          {arcs.map((a, i) => (
            <path key={a.data.label} d={arcPath(a, hover === i)} fill={a.data.color}
              style={{ transition: 'd .15s var(--ease)', cursor: 'default' }}
              onPointerMove={(e) => {
                setHover(i)
                show(e, (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TipRow color={a.data.color} label={a.data.label} value={valueFmt(a.data.value)} />
                    <div style={{ color: 'var(--tx3)' }}>{Math.round((100 * a.data.value) / total)}% of total</div>
                  </div>
                ))
              }}
              onPointerLeave={() => { setHover(null); hide() }} />
          ))}
        </g>
        {centerValue && <text x={R} y={R - 2} fontSize={21} fontWeight={700} fill="var(--tx)" textAnchor="middle">{centerValue}</text>}
        {centerLabel && <text x={R} y={R + 16} fontSize={10} fill="var(--tx3)" textAnchor="middle">{centerLabel}</text>}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: dense ? 3 : 6, minWidth: dense ? 120 : 150, flex: 1 }}>
        {slices.map((s, i) => (
          <div key={s.label} className="row" style={{ gap: dense ? 6 : 8, fontSize: dense ? 10.5 : 12, opacity: hover == null || hover === i ? 1 : 0.55, transition: 'opacity .12s' }}>
            <span style={{ width: dense ? 8 : 10, height: dense ? 8 : 10, borderRadius: 3, background: s.color, flex: 'none' }} />
            <span style={{ color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ fontWeight: 600, marginLeft: 'auto', color: 'var(--tx)' }}>{valueFmt(s.value)}</span>
            <span style={{ color: 'var(--tx3)', width: dense ? 28 : 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round((100 * s.value) / total)}%</span>
          </div>
        ))}
      </div>
      <TooltipLayer tip={tip} />
    </div>
  )
}
