import type { GrowthPoint } from '../data/types'
import { AreaTrend } from './d3/AreaTrend'

// Single-series trend — now a thin wrapper over the D3 AreaTrend so every
// time series in HQ shares one mark spec, crosshair tooltip and legend logic.
export function LineChart({ points, label = 'Weekly active' }: { points: GrowthPoint[]; label?: string }) {
  if (points.length === 0) return null
  return (
    <AreaTrend
      labels={points.map(p => p.week)}
      series={[{ key: 'v', label, color: 'var(--ch1)', area: true }]}
      data={points.map(p => ({ v: p.value }))}
      height={190}
    />
  )
}
