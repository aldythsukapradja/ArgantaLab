// Shared "fancy dot" — a glossy gradient orb framed by a soft halo ring.
// Used by the top bar (mobile) and the sidebar (tablet/desktop).
export type Accent = [string, string]

export const accentOf = (c?: { accent: Accent }): Accent => c?.accent ?? ['#F43F5E', '#FB7185']

export function CircleEmblem({ accent, size = 22, active = false }: { accent: Accent; size?: number; active?: boolean }) {
  const [c0, c1] = accent
  return (
    <span
      className={`circle-emblem${active ? ' is-active' : ''}`}
      style={{ width: size, height: size, ['--c0' as any]: c0, ['--c1' as any]: c1 }}
    >
      <span className="ce-core" />
    </span>
  )
}
