import type { ScorecardTile } from '../contract/metrics'
import { tileStatus, tileInsight } from '../insight/engine'
import { InsightStrip } from './InsightStrip'

const DOT: Record<string, string> = { success: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--bad)' }
const fmt = (v: number, u?: string) => `${v % 1 === 0 ? v : v.toFixed(2)}${u ?? ''}`

/** The Unicorn Scorecard — benchmarked VC metrics with RAG dots + one insight. */
export function Scorecard({ tiles }: { tiles: ScorecardTile[] }) {
  // The insight surfaces the weakest tile (worst status, then furthest from green).
  const rank = { danger: 0, warn: 1, success: 2 } as const
  const weakest = [...tiles].sort((a, b) => rank[tileStatus(a)] - rank[tileStatus(b)])[0]

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="spread" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Unicorn scorecard</div>
        <span className="faint" style={{ fontSize: 11 }}>vs benchmark</span>
      </div>
      {tiles.map((t, i) => (
        <div key={t.key} className="spread" style={{ padding: '7px 0',
          borderBottom: i < tiles.length - 1 ? '1px solid var(--brd)' : 'none' }}>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{t.label}</span>
          <span style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            {fmt(t.value, t.unit)}
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[tileStatus(t)] }} />
          </span>
        </div>
      ))}
      <div style={{ marginTop: 10 }}>
        <InsightStrip insight={tileInsight(weakest)} />
      </div>
    </div>
  )
}
