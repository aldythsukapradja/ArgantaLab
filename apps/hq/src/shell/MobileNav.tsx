import { LayoutGrid, TrendingUp, Boxes, Radar, MessageCircle } from 'lucide-react'
import { useHQ, surfaceLabel, type SurfaceId } from './store'

// Mobile collapses the rail into reachable groups. Multi-surface groups expose
// their members as a secondary sub-tab bar. Group membership MIRRORS the desktop
// Rail (shell/Rail.tsx) so nothing is unreachable on a phone — keep the two in
// sync when a surface is added. The rightmost entry is the Arganta Core chat
// (the founder's primary conversational interface), full-screen on mobile.
type Grp = { id: string; label: string; Icon: typeof LayoutGrid; surfaces: SurfaceId[] }
export const MGROUPS: Grp[] = [
  { id: 'products', label: 'Products', Icon: LayoutGrid, surfaces: ['portfolio', 'home', 'cinema'] },
  { id: 'analytics', label: 'Analytics', Icon: TrendingUp, surfaces: ['growth', 'data', 'knowledge', 'architecture', 'rack'] },
  { id: 'command', label: 'Command', Icon: Radar, surfaces: ['command', 'copilot'] },
  { id: 'build', label: 'Build', Icon: Boxes, surfaces: ['pixel', 'game', 'app', 'content', 'agents', 'broadcast', 'battle', 'character', 'world', 'music', 'video', 'reactor', 'media'] },
]

export function MobileNav() {
  const { surface, go, closeAgent, agentOpen } = useHQ()
  const activeGroup = MGROUPS.find(g => g.surfaces.includes(surface))?.id

  return (
    <nav className="mnav" aria-label="Primary (mobile)">
      {MGROUPS.map(g => (
        <button key={g.id} className={'mnav-item' + (!agentOpen && activeGroup === g.id ? ' on' : '')}
          onClick={() => { if (agentOpen) closeAgent(); go(g.surfaces[0]) }}>
          <span className="mn-ic"><g.Icon size={20} /></span><span className="mn-lbl">{g.label}</span>
        </button>
      ))}
      <button className={'mnav-item' + (surface === 'core' ? ' on' : '')}
        onClick={() => { if (agentOpen) closeAgent(); go('core') }}>
        <span className="mn-ic"><MessageCircle size={20} /></span><span className="mn-lbl">Core</span>
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
