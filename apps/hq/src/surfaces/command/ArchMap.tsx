import { useState } from 'react'
import { Boxes, X, TrendingDown } from 'lucide-react'
import {
  LAYERS, costAt, costCurve, fmtFamilies, TREASURY_PER_ACTIVE,
  type Layer, type LayerKey,
} from '../../data/graph/scaleModel'
import { StackedAreaChart, money, type StackSeries } from '../../components/rcharts'
import { SourceBadge } from './SourceBadge'

const perActive$ = (n: number) => '$' + n.toFixed(3)
function tierLabel(f: number) { return f < 50_000 ? 'Supabase Pro' : f < 300_000 ? 'Pro + compute' : 'Dedicated / replicas' }

// bottom→top stacking order (biggest at the base)
const STACK: LayerKey[] = ['data', 'infra', 'aiml', 'agent', 'ui']

export function ArchMap() {
  const [logF, setLogF] = useState(4)                 // 10^4 = 10k families
  const [sel, setSel] = useState<Layer | null>(null)
  const families = Math.round(Math.pow(10, logF))
  const cost = costAt(families)
  const curve = costCurve()
  const byLayer = (k: LayerKey) => cost[k]
  const dominant = LAYERS.reduce((a, b) => (byLayer(b.key) > byLayer(a.key) ? b : a))
  const series: StackSeries[] = STACK.map(k => {
    const L = LAYERS.find(l => l.key === k)!
    return { key: k, label: L.label, color: L.color }
  })
  const belowTreasury = cost.perActive <= TREASURY_PER_ACTIVE

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><Boxes size={14} /> Architecture &amp; Technology Map <SourceBadge source="simulated" small /></div>
        <div style={{ fontSize: 12, color: 'var(--tx2)' }}>at <b style={{ color: 'var(--acc-text)', fontFamily: 'var(--mono)' }}>{fmtFamilies(families)}</b> families</div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
        <Kpi label="Infra cost / mo" value={money(cost.total)} />
        <Kpi label="$ / active" value={perActive$(cost.perActive)} tone={belowTreasury ? 'ok' : 'bad'} sub={`Treasury load $${TREASURY_PER_ACTIVE.toFixed(2)}`} />
        <Kpi label="Dominant layer" value={dominant.label} sub={money(byLayer(dominant.key)) + '/mo'} />
        <Kpi label="Data tier" value={tierLabel(families)} />
      </div>

      {/* scale slider */}
      <div>
        <label className="row" style={{ justifyContent: 'space-between', fontSize: 11.5, color: 'var(--tx2)', marginBottom: 4 }}>
          <span>Families (scale)</span><b style={{ fontFamily: 'var(--mono)', color: 'var(--acc-text)' }}>{fmtFamilies(families)}</b>
        </label>
        <input type="range" min={3} max={6} step={0.03} value={logF} onChange={e => setLogF(+e.target.value)} style={{ width: '100%' }} />
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 9.5, color: 'var(--tx3)', marginTop: 2 }}>
          <span>1k</span><span>10k</span><span>100k</span><span>1M</span>
        </div>
      </div>

      {/* the layer stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {LAYERS.map(L => {
          const c = byLayer(L.key)
          const share = cost.total > 0 ? (c / cost.total) * 100 : 0
          return (
            <button key={L.key} onClick={() => setSel(L)} style={{
              textAlign: 'left', cursor: 'pointer', border: '1px solid var(--bd2)', borderLeft: `3px solid ${L.color}`,
              borderRadius: 'var(--r-lg)', padding: '10px 12px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <div className="spread" style={{ flexWrap: 'wrap', gap: 6 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ color: L.color, fontWeight: 800 }}>{L.n}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{L.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{L.sub}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{money(c)}/mo</span>
                  <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{Math.round(share)}%</span>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden' }}>
                <div style={{ width: `${share}%`, height: '100%', background: L.color }} />
              </div>
              <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                {L.components.map(comp => <span key={comp} className="pill pill-mut" style={{ fontSize: 9.5 }}>{comp}</span>)}
              </div>
            </button>
          )
        })}
      </div>

      {/* cost-vs-scale */}
      <div>
        <div className="spread" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>Cost vs scale · $/mo by layer (log)</span>
          <span className="row" style={{ gap: 6, fontSize: 10.5, color: belowTreasury ? 'var(--ok)' : 'var(--warn)' }}><TrendingDown size={12} /> $/active {perActive$(cost.perActive)}</span>
        </div>
        <StackedAreaChart data={curve} xKey="f" series={series} xFmt={fmtFamilies} yFmt={money} marker={families} height={220} />
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--tx3)', lineHeight: 1.5 }}>
        Why it matters: deterministic-first agents hold the LLM layer near flat; media storage is the one line that climbs with scale. The <b>$/active</b> here is the same number Treasury loads at $0.08 — cut a layer, and the break-even moves.
      </div>

      {sel && <LayerDrawer L={sel} cost={byLayer(sel.key)} families={families} onClose={() => setSel(null)} />}
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'ok' ? 'var(--ok)' : tone === 'bad' ? 'var(--bad)' : 'var(--tx)'
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', padding: '9px 11px' }}>
      <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function LayerDrawer({ L, cost, families, onClose }: { L: Layer; cost: number; families: number; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Scales with', L.scalesWith],
    ['Cost driver', L.costDriver],
    ['Cost @ ' + fmtFamilies(families), money(cost) + '/mo'],
  ]
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(440px,100vw)', background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', display: 'flex', flexDirection: 'column' }}>
        <div className="spread" style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
          <div className="row" style={{ gap: 8 }}><span style={{ color: L.color, fontWeight: 800 }}>{L.n}</span><span style={{ fontSize: 14, fontWeight: 700 }}>{L.label}</span><span style={{ fontSize: 11, color: 'var(--tx3)' }}>{L.sub}</span></div>
          <button onClick={onClose} aria-label="Close" style={{ cursor: 'pointer', color: 'var(--tx2)' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Components</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{L.components.map(c => <span key={c} className="pill pill-mut" style={{ fontSize: 10.5 }}>{c}</span>)}</div>
          </div>
          <div>
            {rows.map(([k, v]) => (
              <div key={k} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--bd)' }}>
                <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: k.startsWith('Cost') ? 'var(--mono)' : 'inherit' }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="insight ok" style={{ alignItems: 'flex-start' }}>
            <div><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--tx3)' }}>Why we need it</div><div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>{L.why}</div></div>
          </div>
          <div className="insight warn" style={{ alignItems: 'flex-start' }}>
            <div><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--tx3)' }}>Risk if absent</div><div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>{L.risk}</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
