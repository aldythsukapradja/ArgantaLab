// The one Arganta Core reactor orb — cyan core + ring + three orbiting product
// pods. Used at TWO sizes: the bottom-dock Agent button (`dock`) and the chat
// empty-state hero (`hero`). CSS-only visual lives in theme.css (.reactor-orb*)
// so it's global — the dock renders even when the lazy Core surface (and its
// core.css) hasn't loaded. Deliberately NOT CoreSlot/Core2D: that cockpit scene
// is illegible below ~150px (see CoreOrb.tsx's note); this is the shared,
// token-light identity instead.
export function ReactorOrb({ size = 'hero', active = false, className = '' }: {
  size?: 'dock' | 'hero'
  active?: boolean
  className?: string
}) {
  return (
    <span className={`reactor-orb reactor-orb-${size}${active ? ' on' : ''}${className ? ' ' + className : ''}`} aria-hidden>
      <span className="reactor-orb-core" />
      <span className="reactor-orb-ring" />
      <span className="reactor-orb-sats"><i /><i /><i /></span>
    </span>
  )
}
