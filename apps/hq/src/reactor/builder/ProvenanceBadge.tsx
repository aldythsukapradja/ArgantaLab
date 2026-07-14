import type { Provenance } from '../model/layers'

// ─────────────────────────────────────────────────────────────────────────
// ProvenanceBadge — the small pill every node in the inspector carries.
//
// Never lets a placeholder/simulated node read as measured. Colors are fixed
// per state (not layer color) so the meaning stays legible across the whole
// Builder regardless of which layer you're looking at.
// ─────────────────────────────────────────────────────────────────────────

const TONE: Record<Provenance, { bg: string; fg: string; label: string }> = {
  live: { bg: 'rgba(75,229,189,.16)', fg: '#2fae8c', label: 'Live' },
  partial: { bg: 'rgba(21,151,255,.14)', fg: '#1878c9', label: 'Partial' },
  simulated: { bg: 'rgba(154,114,255,.16)', fg: '#7c5ce0', label: 'Simulated' },
  placeholder: { bg: 'rgba(140,150,160,.16)', fg: '#6b7684', label: 'Placeholder' },
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const tone = TONE[provenance]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', flexShrink: 0,
      padding: '2px 6px', borderRadius: 6, background: tone.bg, color: tone.fg,
      font: '600 9px Inter, system-ui, sans-serif', letterSpacing: '.03em', textTransform: 'uppercase',
    }}>{tone.label}</span>
  )
}
