import { useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { useMeasure, useTooltip, TooltipLayer, TipRow, roundedRightBar } from './chartkit'
import { compact } from '../../lib/format'

export interface HBar { label: string; value: number; color: string; sub?: string }

// Horizontal bars: ≤18px thick, 4px rounded data-end (square at the baseline),
// value at the tip, per-mark hover tooltip. Labels wear text tokens.
export function HBars({ bars, valueFmt = compact, labelWidth = 150, barH = 16 }: {
  bars: HBar[]
  valueFmt?: (v: number) => string
  labelWidth?: number
  barH?: number
}) {
  const [wrapRef, width] = useMeasure<HTMLDivElement>()
  const { wrapRef: tipWrap, tip, show, hide } = useTooltip()
  const [hover, setHover] = useState<number | null>(null)
  if (!bars.length) return null
  const W = Math.max(280, width)
  const gap = 9
  const padV = 2
  const valueW = 52
  const H = bars.length * (barH + gap) - gap + padV * 2
  const x = scaleLinear().domain([0, Math.max(1, ...bars.map(b => b.value))]).range([0, W - labelWidth - valueW - 14])

  return (
    <div ref={wrapRef}>
      <div ref={tipWrap} style={{ position: 'relative' }}>
        {width > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }} role="img" aria-label="Bar chart">
            {bars.map((b, i) => {
              const y = padV + i * (barH + gap)
              const w = Math.max(3, x(b.value))
              return (
                <g key={b.label + i}
                  onPointerMove={(e) => { setHover(i); show(e, <TipRow color={b.color} label={b.label} value={valueFmt(b.value)} />) }}
                  onPointerLeave={() => { setHover(null); hide() }}>
                  {/* oversized hit target */}
                  <rect x={0} y={y - gap / 2} width={W} height={barH + gap} fill="transparent" />
                  <text x={labelWidth - 8} y={y + barH / 2 + 3.5} fontSize={11.5} fill="var(--tx2)" textAnchor="end">
                    {b.label.length > 22 ? b.label.slice(0, 21) + '…' : b.label}
                  </text>
                  <rect x={labelWidth} y={y} width={W - labelWidth - valueW - 14} height={barH} rx={4} fill="var(--bg3)" />
                  <path d={roundedRightBar(labelWidth, y, w, barH)} fill={b.color}
                    opacity={hover == null || hover === i ? 1 : 0.6} style={{ transition: 'opacity .12s' }} />
                  <text x={labelWidth + w + 7} y={y + barH / 2 + 3.5} fontSize={11} fontWeight={700} fill="var(--tx)">
                    {valueFmt(b.value)}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
        <TooltipLayer tip={tip} />
      </div>
    </div>
  )
}
