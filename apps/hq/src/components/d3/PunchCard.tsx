import { useMemo } from 'react'
import { useMeasure, useTooltip, TooltipLayer, fmtDur } from './chartkit'
import type { EngagementPunch } from '../../data/types'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Hour-of-week heat grid (client-local time) — sequential single-hue ramp
// (indigo, light→dark = more time), per-cell tooltip. Shows the rhythm of the
// week and the empty slots — the "gap map".
export function PunchCard({ punch }: { punch: EngagementPunch[] }) {
  const [wrapRef, width] = useMeasure<HTMLDivElement>()
  const { wrapRef: tipWrap, tip, show, hide } = useTooltip()

  const { grid, maxV } = useMemo(() => {
    const grid = new Map<string, number>()
    let maxV = 0
    for (const p of punch) {
      const k = p.dow + ':' + p.hour
      const v = (grid.get(k) ?? 0) + p.seconds
      grid.set(k, v)
      if (v > maxV) maxV = v
    }
    return { grid, maxV }
  }, [punch])

  const W = Math.max(320, width)
  const labelW = 30
  const cell = Math.max(8, Math.floor((W - labelW) / 24) - 2)
  const gap = 2
  const H = 14 + 7 * (cell + gap)

  if (width === 0) return <div ref={wrapRef} style={{ minHeight: 120 }} />

  // sequential: indigo ramp via opacity over the slot hue (single hue, more = darker)
  const alpha = (v: number) => (v <= 0 ? 0 : 0.16 + 0.84 * Math.sqrt(v / Math.max(1, maxV)))

  return (
    <div ref={wrapRef}>
      <div ref={tipWrap} style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }} role="img" aria-label="Time-of-week heat map">
          {DOW.map((d, r) => (
            <text key={d} x={labelW - 6} y={14 + r * (cell + gap) + cell / 2 + 3} fontSize={9.5} fill="var(--tx3)" textAnchor="end">{d}</text>
          ))}
          {[0, 6, 12, 18].map((h) => (
            <text key={h} x={labelW + h * (cell + gap) + cell / 2} y={8} fontSize={9} fill="var(--tx3)" textAnchor="middle">
              {h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? h + 'a' : (h - 12) + 'p'}
            </text>
          ))}
          {Array.from({ length: 7 }, (_, r) => Array.from({ length: 24 }, (_, c) => {
            const v = grid.get(r + ':' + c) ?? 0
            return (
              <rect key={r + '-' + c}
                x={labelW + c * (cell + gap)} y={14 + r * (cell + gap)}
                width={cell} height={cell} rx={2.5}
                fill={v > 0 ? 'var(--ch1)' : 'var(--bg3)'} opacity={v > 0 ? alpha(v) : 1}
                onPointerMove={(e) => show(e, (
                  <div>
                    <b style={{ color: 'var(--tx)' }}>{fmtDur(v)}</b>
                    <span style={{ color: 'var(--tx3)' }}> · {DOW[r]} {c}:00–{c + 1}:00</span>
                  </div>
                ))}
                onPointerLeave={hide} />
            )
          }))}
        </svg>
        <TooltipLayer tip={tip} />
      </div>
    </div>
  )
}
