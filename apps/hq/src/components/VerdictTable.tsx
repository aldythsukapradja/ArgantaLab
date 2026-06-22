import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { FeatureAdoption, Verdict } from '../contract/metrics'

export const VERDICT: Record<Verdict, { label: string; fg: string; bg: string; bar: string }> = {
  hero: { label: 'Hero', fg: 'var(--ok)', bg: 'var(--ok-bg)', bar: 'var(--ok)' },
  core: { label: 'Core', fg: 'var(--info)', bg: 'var(--info-bg)', bar: 'var(--info)' },
  niche: { label: 'Niche', fg: 'var(--acc3)', bg: 'color-mix(in srgb,var(--acc3) 16%,transparent)', bar: 'var(--acc3)' },
  watch: { label: 'Watch', fg: 'var(--warn)', bg: 'var(--warn-bg)', bar: 'var(--warn)' },
  dead: { label: 'Dead', fg: 'var(--bad)', bg: 'var(--bad-bg)', bar: 'var(--bad)' },
}

function Trend({ t }: { t: FeatureAdoption['trend'] }) {
  if (t === 'up') return <TrendingUp size={15} style={{ color: 'var(--ok)' }} />
  if (t === 'down') return <TrendingDown size={15} style={{ color: 'var(--bad)' }} />
  return <Minus size={15} style={{ color: 'var(--faint)' }} />
}

export function VerdictTable({ rows }: { rows: FeatureAdoption[] }) {
  return (
    <div>
      {rows.map((r, i) => {
        const v = VERDICT[r.verdict]
        return (
          <div key={r.featureId} className="row" style={{ gap: 10, padding: '8px 0',
            borderBottom: i < rows.length - 1 ? '1px solid var(--brd)' : 'none' }}>
            <div style={{ flex: '0 0 138px', fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
            <div style={{ flex: 1, height: 7, borderRadius: 99, background: 'var(--chip)', overflow: 'hidden' }}>
              <div style={{ width: `${r.adoptionPct}%`, height: '100%', background: v.bar }} />
            </div>
            <span style={{ flex: '0 0 34px', textAlign: 'right', fontSize: 12 }}>{r.adoptionPct}%</span>
            <span style={{ flex: '0 0 16px' }}><Trend t={r.trend} /></span>
            <span style={{ flex: '0 0 50px', textAlign: 'center', fontSize: 10.5, padding: '2px 0', borderRadius: 5, color: v.fg, background: v.bg }}>{v.label}</span>
          </div>
        )
      })}
    </div>
  )
}
