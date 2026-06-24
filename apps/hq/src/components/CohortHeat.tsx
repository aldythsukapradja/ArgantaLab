import { type ReactNode } from 'react'
import type { RetentionData } from '../data/types'

// Retention triangle — weekly cohorts (rows) × weeks-since-signup (cols),
// cells heat-colored by % still active. Null = week not yet elapsed.
const heat = (v: number | null): { bg: string; fg: string } => {
  if (v === null) return { bg: 'var(--bg3)', fg: 'var(--tx3)' }
  if (v >= 55) return { bg: 'var(--ok-bg)', fg: 'var(--ok)' }
  if (v >= 30) return { bg: 'var(--acc-soft)', fg: 'var(--acc-text)' }
  return { bg: 'var(--warn-bg)', fg: 'var(--warn)' }
}

export function CohortHeat({ data }: { data: RetentionData }) {
  const cols = data.horizons.length
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${cols}, 1fr)`, gap: 5 }}>
      <div style={{ fontSize: 10.5, color: 'var(--tx3)', alignSelf: 'end', paddingBottom: 4 }}>cohort ↓ / week →</div>
      {data.horizons.map(h => (
        <div key={h} style={{ textAlign: 'center', fontSize: 11, color: 'var(--tx3)', paddingBottom: 4 }}>{h}</div>
      ))}
      {data.cohorts.map(c => (
        <Row key={c.label}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{c.size} joined</div>
          </div>
          {data.horizons.map((_, i) => {
            const v = c.ret[i] ?? null
            const s = heat(v)
            return (
              <div key={i} title={`${c.label} · week ${i}: ${v === null ? 'n/a' : v + '%'}`}
                style={{ background: s.bg, color: s.fg, borderRadius: 7, padding: '13px 0', textAlign: 'center', fontWeight: 600, fontSize: 13 }}>
                {v === null ? '·' : v + '%'}
              </div>
            )
          })}
        </Row>
      ))}
    </div>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'contents' }}>{children}</div>
}
