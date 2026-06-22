import { ArrowRight } from 'lucide-react'
import type { EconomyFlow } from '../contract/metrics'

const k = (n: number) => `${Math.round(n / 1000)}k`

export function EconomyFlowView({ flow }: { flow: EconomyFlow }) {
  const Leg = ({ label, amount, sign, tone }:
    { label: string; amount: number; sign: string; tone: 'ok' | 'info' }) => (
    <div className="spread" style={{ fontSize: 12, padding: '5px 9px', borderRadius: 7, marginBottom: 4,
      background: tone === 'ok' ? 'var(--ok-bg)' : 'var(--info-bg)', color: tone === 'ok' ? 'var(--ok)' : 'var(--info)' }}>
      <span>{label}</span><span>{sign}{k(amount)}</span>
    </div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr', gap: 12, alignItems: 'start' }}>
      <div>
        <div className="lbl" style={{ marginBottom: 6 }}>Sources (earned)</div>
        {flow.sources.map((s) => <Leg key={s.label} label={s.label} amount={s.amount} sign="+" tone="ok" />)}
      </div>
      <div style={{ textAlign: 'center', paddingTop: 16 }}>
        <div className="faint" style={{ fontSize: 11 }}>Circulating float</div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{k(flow.float)}</div>
        <ArrowRight size={18} style={{ color: 'var(--faint)' }} />
        <div className="faint" style={{ fontSize: 11 }}>sink coverage</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: flow.sinkCoverage < 0.8 ? 'var(--warn)' : 'var(--ok)' }}>{flow.sinkCoverage.toFixed(2)}×</div>
      </div>
      <div>
        <div className="lbl" style={{ marginBottom: 6 }}>Sinks (spent)</div>
        {flow.sinks.map((s) => <Leg key={s.label} label={s.label} amount={s.amount} sign="-" tone="info" />)}
      </div>
    </div>
  )
}
