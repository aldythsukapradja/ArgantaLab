import { useEffect, useState } from 'react'
import { data } from '../data'
import { insight } from '../insight/engine'
import type { Rollup, TreeNode } from '../contract/metrics'
import type { Signal } from '../contract/signals'
import { MetricTree } from '../components/MetricTree'
import { Scorecard } from '../components/Scorecard'
import { InsightStrip } from '../components/InsightStrip'
import { useHQ, type ProductLens } from '../shell/store'

const LENSES: { id: ProductLens; label: string }[] = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'arganta', label: 'ArgantaLab' },
  { id: 'kinetik', label: 'KinetikCircle' },
]
const SEV: Record<string, string> = { success: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--bad)', info: 'var(--info)' }

// Build a 2-point series from a node's value + delta so TrendShift can speak,
// attributing to the strongest child.
function treeInsight(root: TreeNode) {
  const d = root.deltaPct ?? 0
  const prev = root.value / (1 + d / 100)
  const topChild = root.children?.slice().sort((a, b) => (b.deltaPct ?? b.adoptionPct ?? 0) - (a.deltaPct ?? a.adoptionPct ?? 0))[0]
  return insight(
    { key: root.key, label: root.label, points: [{ t: '0', v: prev }, { t: '1', v: root.value }] },
    { label: root.label, driverHint: topChild?.label },
  )
}

export function Pulse() {
  const { product, setProduct } = useHQ()
  const [rollup, setRollup] = useState<Rollup | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])

  useEffect(() => { data.portfolioRollup(product).then(setRollup) }, [product])
  useEffect(() => { data.signals().then(setSignals) }, [])

  if (!rollup) return <div className="dim" style={{ padding: 20 }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {LENSES.map((l) => (
          <button key={l.id} onClick={() => setProduct(l.id)}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 99,
              color: product === l.id ? '#fff' : 'var(--dim)',
              background: product === l.id ? 'linear-gradient(135deg,var(--acc),var(--acc3))' : 'var(--chip)',
              border: '1px solid var(--brd2)' }}>{l.label}</button>
        ))}
      </div>

      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Pulse</h2>
        <div className="faint" style={{ fontSize: 12 }}>North-star tree · {product} lens</div>
      </div>

      <div className="hq-2col" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Metric tree</div>
          <MetricTree root={rollup.northStar} />
          <div style={{ marginTop: 12 }}><InsightStrip insight={treeInsight(rollup.northStar)} /></div>
        </div>
        <Scorecard tiles={rollup.scorecard} />
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Signal feed</div>
        {signals.map((s) => (
          <div key={s.id} className="row" style={{ gap: 9, padding: '7px 0', alignItems: 'flex-start' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, background: SEV[s.severity], flex: '0 0 auto' }} />
            <div style={{ fontSize: 12.5 }}>{s.headline}
              {s.driver && <span className="faint"> · {s.driver}</span>}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
