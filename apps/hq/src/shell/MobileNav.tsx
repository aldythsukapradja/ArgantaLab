import { LayoutGrid, TrendingUp, Boxes, Radar } from 'lucide-react'
import { useHQ, surfaceLabel, type SurfaceId } from './store'

// Mobile collapses the rail into reachable groups. Multi-surface groups expose
// their members as a secondary sub-tab bar. Group membership MIRRORS the desktop
// Rail (shell/Rail.tsx) so nothing is unreachable on a phone — keep the two in
// sync when a surface is added. Agent (Arganta Core, the founder's primary
// conversational interface) sits DEAD CENTER as a raised orb — like the landing
// dock — and opens full-screen on mobile.
type Grp = { id: string; label: string; Icon: typeof LayoutGrid; surfaces: SurfaceId[] }
export const MGROUPS: Grp[] = [
  { id: 'products', label: 'Products', Icon: LayoutGrid, surfaces: ['portfolio', 'home', 'cinema'] },
  { id: 'analytics', label: 'Analytics', Icon: TrendingUp, surfaces: ['growth', 'data', 'knowledge', 'architecture', 'rack'] },
  { id: 'command', label: 'Command', Icon: Radar, surfaces: ['command', 'copilot'] },
  // broadcast (Content Builder) FIRST → it's the Build tab's default tap target
  // (go(surfaces[0])) per M1c.
  { id: 'build', label: 'Build', Icon: Boxes, surfaces: ['broadcast', 'pixel', 'game', 'app', 'content', 'agents', 'battle', 'character', 'world', 'music', 'video', 'reactor', 'media'] },
]

export function MobileNav() {
  const { surface, go, closeAgent, agentOpen } = useHQ()
  const activeGroup = MGROUPS.find(g => g.surfaces.includes(surface))?.id
  const left = MGROUPS.slice(0, 2)   // Products, Analytics
  const right = MGROUPS.slice(2)     // Command, Build

  const GroupBtn = (g: Grp) => (
    <button key={g.id} className={'mnav-item' + (!agentOpen && surface !== 'core' && activeGroup === g.id ? ' on' : '')}
      onClick={() => { if (agentOpen) closeAgent(); go(g.surfaces[0]) }}>
      <span className="mn-ic"><g.Icon size={20} /></span><span className="mn-lbl">{g.label}</span>
    </button>
  )

  return (
    <nav className="mnav" aria-label="Primary (mobile)">
      {left.map(GroupBtn)}
      <button className={'mnav-item mnav-agent' + (surface === 'core' ? ' on' : '')}
        onClick={() => { if (agentOpen) closeAgent(); go('core') }} aria-label="Open Arganta Core (Agent)">
        <span className="mnav-orb" aria-hidden>
          <span className="mnav-orb-core" />
          <span className="mnav-orb-ring" />
          <span className="mnav-orb-sats"><i /><i /><i /></span>
        </span>
        <span className="mn-lbl">Agent</span>
      </button>
      {right.map(GroupBtn)}
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
