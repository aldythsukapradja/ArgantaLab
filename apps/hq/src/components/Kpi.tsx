import type { ReactNode } from 'react'
import { compact } from '../lib/format'

export function Kpi({ label, value, sub, icon, accent }: {
  label: string
  value: number | string | null | undefined
  sub?: ReactNode
  icon?: ReactNode
  accent?: 'ok' | 'warn' | 'bad'
}) {
  const display = typeof value === 'number' ? compact(value) : (value ?? '—')
  const empty = value === null || value === undefined || value === '—'
  const subColor = accent === 'ok' ? 'var(--ok)' : accent === 'warn' ? 'var(--warn)' : accent === 'bad' ? 'var(--bad)' : 'var(--tx3)'
  return (
    <div className="kpi">
      <div className="kpi-l">{icon}{label}</div>
      <div className={'kpi-v' + (empty ? ' empty' : '')}>{display}</div>
      {sub && <div className="kpi-s" style={{ color: subColor }}>{sub}</div>}
    </div>
  )
}
