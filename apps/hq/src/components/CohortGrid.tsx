import type { CohortRow } from '../contract/metrics'

// Greener = higher retention. Heat from the teal ramp; null = empty cell.
function heat(v: number | null): { bg: string; fg: string } {
  if (v == null) return { bg: 'var(--chip)', fg: 'var(--faint)' }
  if (v >= 70) return { bg: '#1D9E75', fg: '#fff' }
  if (v >= 50) return { bg: '#5DCAA5', fg: '#04342C' }
  if (v >= 38) return { bg: '#9FE1CB', fg: '#04342C' }
  if (v >= 32) return { bg: 'var(--ok-bg)', fg: 'var(--ok)' }
  return { bg: 'var(--warn-bg)', fg: 'var(--warn)' }
}

const COLS: { key: keyof CohortRow; label: string }[] = [
  { key: 'd1', label: 'D1' }, { key: 'd7', label: 'D7' }, { key: 'd14', label: 'D14' }, { key: 'd30', label: 'D30' },
]

export function CohortGrid({ rows }: { rows: CohortRow[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(4,1fr)', gap: 4, fontSize: 11.5 }}>
      <span />
      {COLS.map((c) => <span key={c.label} className="faint" style={{ textAlign: 'center' }}>{c.label}</span>)}
      {rows.map((r) => (
        <Row key={r.label} r={r} />
      ))}
    </div>
  )
}

function Row({ r }: { r: CohortRow }) {
  return (
    <>
      <span className="dim" style={{ display: 'flex', alignItems: 'center' }}>{r.label}</span>
      {COLS.map((c) => {
        const v = r[c.key] as number | null
        const h = heat(v)
        return (
          <div key={c.label} style={{ padding: '7px 0', textAlign: 'center', borderRadius: 5, background: h.bg, color: h.fg }}>
            {v == null ? '—' : v}
          </div>
        )
      })}
    </>
  )
}
