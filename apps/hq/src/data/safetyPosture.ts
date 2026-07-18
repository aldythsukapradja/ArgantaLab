// Canonical child-safety + trust posture. One source of truth so the GC office
// (officeSense.gcSense) and the Architecture "Governance & Trust" node read the
// SAME list — provenance-badged honestly, never a placeholder painted as done.
// Because Arganta serves children, consent + data-handling are first-class here.

export type SafetyProv = 'live' | 'partial' | 'placeholder'
export interface SafetyItem { label: string; prov: SafetyProv; note?: string }

export const SAFETY_POSTURE: SafetyItem[] = [
  { label: 'Guardian-run circles (structural consent)', prov: 'partial', note: 'a guardian owns the circle; kids act inside it' },
  { label: 'Age gating', prov: 'placeholder', note: 'no age assurance at signup yet' },
  { label: 'Verifiable parental consent (COPPA)', prov: 'placeholder', note: 'launch blocker for a US consumer launch' },
  { label: 'Minor data retention & deletion', prov: 'placeholder', note: 'no deletion/export path yet' },
  { label: 'UGC moderation queue', prov: 'placeholder', note: 'shared creations are unmoderated today' },
]

// The autonomy gates enforced by the Bridge (tools/arganta-bridge/permissions.ts).
// Kept as data on the HQ side so the GC can name what actually pauses for a human
// without importing the Node-only bridge module. Keep in sync with permissions.ts.
export const GATED_ACTIONS: string[] = [
  'deploy (vercel / wrangler / modal)',
  'push to main / hard reset',
  'database migration / destructive SQL',
  'premium media spend (Higgsfield)',
  'destructive filesystem (rm -rf)',
  'external send / publish (Buffer)',
]
