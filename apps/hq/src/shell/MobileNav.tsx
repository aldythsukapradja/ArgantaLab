import { useEffect, useState } from 'react'
import {
  Building2, LineChart, Clapperboard, Hammer, X, LayoutGrid,
  Megaphone, Music2, Wand2, Grid2x2, Gamepad2, Map, Swords, UserRound, Boxes, GraduationCap, Network, Atom, Film,
  Sparkles, Radar, Mic2, TrendingUp, Database, BookOpen, Orbit, Workflow, Cpu, LogOut, BookUser,
} from 'lucide-react'
import { useHQ, surfaceLabel, type SurfaceId } from './store'
import { ReactorOrb } from '../surfaces/core/ReactorOrb'
import { signOut } from '../lib/auth'

// Mobile collapses the rail into reachable groups. Group membership MIRRORS the
// desktop Rail (shell/Rail.tsx) — Company → Insights → Studio → Forge — so
// nothing is unreachable on a phone; keep the two in sync when a surface is
// added. Agent (Arganta Core, the founder's primary conversational interface)
// sits DEAD CENTER as a raised orb — like the landing dock — and opens
// full-screen on mobile. Every tab opens the same launcher sheet (icon + what
// it does) instead of dumping into the first surface — consistent discovery
// across all four groups.
type Grp = { id: string; label: string; Icon: typeof LayoutGrid; surfaces: SurfaceId[] }
export const MGROUPS: Grp[] = [
  { id: 'company', label: 'Company', Icon: Building2, surfaces: ['portfolio', 'home', 'command', 'copilot', 'cinema'] },
  { id: 'insights', label: 'Insights', Icon: LineChart, surfaces: ['growth', 'data', 'vault', 'knowledge', 'architecture', 'rack'] },
  { id: 'studio', label: 'Studio', Icon: Clapperboard, surfaces: ['biography', 'brand', 'influencer', 'broadcast', 'video', 'music', 'media', 'pixel'] },
  { id: 'forge', label: 'Forge', Icon: Hammer, surfaces: ['game', 'world', 'battle', 'character', 'app', 'content', 'agents', 'reactor'] },
]

// Launcher card copy: icon + one line of "what it does". Mobile-launcher-only
// chrome, so it lives here rather than the store.
const CARD: Partial<Record<SurfaceId, { Icon: typeof LayoutGrid; desc: string }>> = {
  portfolio: { Icon: LayoutGrid, desc: 'Five products, one operating view' },
  home: { Icon: Sparkles, desc: 'The founder cockpit' },
  command: { Icon: Radar, desc: 'C-suite offices & verdicts' },
  copilot: { Icon: Mic2, desc: 'Voice & gesture control' },
  cinema: { Icon: Film, desc: 'Founder keynote cinematic' },
  growth: { Icon: TrendingUp, desc: 'North star & engagement trends' },
  data: { Icon: Database, desc: 'Schema, tables & ontology' },
  vault: { Icon: BookOpen, desc: 'Founder notes & knowledge base' },
  knowledge: { Icon: Orbit, desc: 'Vault as a 3D knowledge graph' },
  architecture: { Icon: Workflow, desc: 'System map & data lineage' },
  rack: { Icon: Cpu, desc: 'LLM tiers & routing policy' },
  biography: { Icon: BookUser, desc: 'CV, intro deck & founder journey' },
  brand: { Icon: Sparkles, desc: 'Brand OS — the source of truth' },
  influencer: { Icon: UserRound, desc: 'Five virtual creators' },
  broadcast: { Icon: Megaphone, desc: 'Social posts & carousels' },
  video: { Icon: Film, desc: 'Videos with voice & export' },
  music: { Icon: Music2, desc: 'Tracks & soundscapes' },
  media: { Icon: Wand2, desc: 'AI image, voice & media runs' },
  pixel: { Icon: Grid2x2, desc: 'Pixel-art sprite library' },
  game: { Icon: Gamepad2, desc: '15-genre game engine' },
  world: { Icon: Map, desc: 'Openworld maps & towns' },
  battle: { Icon: Swords, desc: 'Monsters & encounters' },
  character: { Icon: UserRound, desc: 'Heroes, skills & NPCs' },
  app: { Icon: Boxes, desc: 'Circle app templates' },
  content: { Icon: GraduationCap, desc: 'Learning drills & lessons' },
  agents: { Icon: Network, desc: 'Agent workflows' },
  reactor: { Icon: Atom, desc: 'Arc-reactor scene builder' },
}

function LauncherSheet({ grp, authed, onClose }: { grp: Grp; authed: boolean; onClose: () => void }) {
  const { surface, go } = useHQ()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="mlaunch-wrap" role="dialog" aria-modal="true" aria-label={grp.label + ' launcher'}>
      <div className="mlaunch-backdrop" onClick={onClose} />
      <div className="mlaunch">
        <header>
          <span>{grp.label}</span>
          <button onClick={onClose} aria-label="Close launcher"><X size={16} /></button>
        </header>
        <div className="mlaunch-grid">
          {grp.surfaces.map(s => {
            const c = CARD[s]
            const I = c?.Icon ?? LayoutGrid
            return (
              <button key={s} className={'mlaunch-card' + (surface === s ? ' on' : '')}
                onClick={() => { go(s); onClose() }}>
                <span className="mlc-ic"><I size={19} /></span>
                <span className="mlc-name">{surfaceLabel(s)}</span>
                {c?.desc && <span className="mlc-desc">{c.desc}</span>}
              </button>
            )
          })}
          {grp.id === 'company' && authed && (
            <button className="mlaunch-card" onClick={() => { onClose(); signOut() }}>
              <span className="mlc-ic"><LogOut size={19} /></span>
              <span className="mlc-name">Sign out</span>
              <span className="mlc-desc">End this session</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function MobileNav({ authed = false }: { authed?: boolean }) {
  const { surface, go, closeAgent, agentOpen } = useHQ()
  const [launcher, setLauncher] = useState<string | null>(null)
  const activeGroup = MGROUPS.find(g => g.surfaces.includes(surface))?.id
  const left = MGROUPS.slice(0, 2)   // Company, Insights
  const right = MGROUPS.slice(2)     // Studio, Forge
  const openGrp = launcher ? MGROUPS.find(g => g.id === launcher) : null

  const GroupBtn = (g: Grp) => (
    <button key={g.id} className={'mnav-item' + (!agentOpen && surface !== 'core' && activeGroup === g.id ? ' on' : '')}
      onClick={() => {
        if (agentOpen) closeAgent()
        setLauncher(l => (l === g.id ? null : g.id))
      }}>
      <span className="mn-ic"><g.Icon size={20} /></span><span className="mn-lbl">{g.label}</span>
    </button>
  )

  return (
    <>
      {openGrp && <LauncherSheet grp={openGrp} authed={authed} onClose={() => setLauncher(null)} />}
      <nav className="mnav" aria-label="Primary (mobile)">
        {left.map(GroupBtn)}
        <button className={'mnav-item mnav-agent' + (surface === 'core' ? ' on' : '')}
          onClick={() => { setLauncher(null); if (agentOpen) closeAgent(); go('core') }} aria-label="Open Arganta Core (Agent)">
          <ReactorOrb size="dock" active={surface === 'core'} />
          <span className="mn-lbl">Agent</span>
        </button>
        {right.map(GroupBtn)}
      </nav>
    </>
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
