import type { Health } from '../../data/graph/types'

const COLOR: Record<Health, string> = {
  green: 'var(--ok)', amber: 'var(--warn)', red: 'var(--bad)', blind: 'var(--tx3)',
}
const LABEL: Record<Health, string> = {
  green: 'healthy', amber: 'watch', red: 'red', blind: 'blind — no telemetry',
}

export function HealthDot({ health, size = 9, weakest }: { health: Health; size?: number; weakest?: string }) {
  const c = COLOR[health]
  return (
    <span className="row" style={{ gap: 6 }} title={weakest ? `${LABEL[health]} · weakest: ${weakest}` : LABEL[health]}>
      <span style={{
        width: size, height: size, borderRadius: '50%', flex: 'none',
        background: health === 'blind' ? 'transparent' : c,
        border: health === 'blind' ? `1.5px dashed ${c}` : 'none',
        boxShadow: health === 'red' || health === 'green' ? `0 0 7px ${c}` : 'none',
      }} />
    </span>
  )
}
