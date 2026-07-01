import type { Source } from '../../data/graph/types'

// Non-optional provenance badge — renders next to EVERY metric. A number with no
// badge is a bug. Grey/placeholder is correct and intended.
const META: Record<Source, { glyph: string; label: string; color: string; bg: string }> = {
  live: { glyph: '⬤', label: 'live', color: 'var(--ok)', bg: 'var(--ok-bg)' },
  partial: { glyph: '◐', label: 'partial', color: 'var(--warn)', bg: 'var(--warn-bg)' },
  simulated: { glyph: '◑', label: 'simulated', color: 'var(--acc-text)', bg: 'var(--acc-soft)' },
  placeholder: { glyph: '○', label: 'blind', color: 'var(--tx3)', bg: 'var(--bg3)' },
}

export function SourceBadge({ source, small }: { source: Source; small?: boolean }) {
  const m = META[source]
  return (
    <span className="pill" title={`source: ${source}`} style={{
      background: m.bg, color: m.color, fontSize: small ? 9.5 : 10.5, fontWeight: 600,
      gap: 4, padding: small ? '1px 6px' : '2px 8px', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: small ? 8 : 9 }}>{m.glyph}</span>{m.label}
    </span>
  )
}
