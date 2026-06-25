import { LayoutGrid, TrendingUp, Boxes, Sparkles } from 'lucide-react'
import { useHQ, surfaceLabel, type SurfaceId } from './store'

// Mobile collapses the 8-surface rail into 4 reachable groups. Multi-surface
// groups expose their members as a secondary sub-tab bar; "Agent" opens the
// orchestrating orb full-screen (the floating orb is hidden on mobile).
type Grp = { id: string; label: string; Icon: typeof LayoutGrid; surfaces: SurfaceId[] }
export const MGROUPS: Grp[] = [
  { id: 'portfolio', label: 'Portfolio', Icon: LayoutGrid, surfaces: ['portfolio'] },
  { id: 'analytics', label: 'Analytics', Icon: TrendingUp, surfaces: ['data', 'growth'] },
  { id: 'build', label: 'Build', Icon: Boxes, surfaces: ['game', 'app', 'content', 'agents', 'moments'] },
]

export function MobileNav() {
  const { surface, go, openAgent, closeAgent, agentOpen } = useHQ()
  const activeGroup = MGROUPS.find(g => g.surfaces.includes(surface))?.id

  return (
    <nav className="mnav" aria-label="Primary (mobile)">
      {MGROUPS.map(g => (
        <button key={g.id} className={'mnav-item' + (!agentOpen && activeGroup === g.id ? ' on' : '')}
          onClick={() => { if (agentOpen) closeAgent(); go(g.surfaces[0]) }}>
          <g.Icon size={19} /><span>{g.label}</span>
        </button>
      ))}
      <button className={'mnav-item' + (agentOpen ? ' on' : '')} onClick={() => openAgent('full')}>
        <Sparkles size={19} /><span>Agent</span>
      </button>
    </nav>
  )
}

export function MobileSubnav() {
  const { surface, go } = useHQ()
  const grp = MGROUPS.find(g => g.surfaces.includes(surface))
  if (!grp || grp.surfaces.length < 2) return null
  return (
    <div className="msub">
      {grp.surfaces.map(s => (
        <button key={s} className={surface === s ? 'on' : ''} onClick={() => go(s)}>{surfaceLabel(s)}</button>
      ))}
    </div>
  )
}
