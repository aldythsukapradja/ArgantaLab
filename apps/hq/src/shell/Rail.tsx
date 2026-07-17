import {
  LayoutGrid, Database, TrendingUp, GraduationCap, Gamepad2, Boxes, CircleDashed,
  Network, Megaphone, Radar, Grid2x2, Sparkles, Workflow, Swords, UserRound, Map, Music2, Film, Wand2,
  Orbit, Atom, Cpu, Mic2, MessageCircle, BookOpen, LogOut, Palette, BookUser,
} from 'lucide-react'
import { useHQ, type SurfaceId } from './store'
import { useCopilotStore } from '../copilot/store'
import { CopilotDock } from '../copilot/CopilotDock'
import { signOut } from '../lib/auth'

type Item = { id: SurfaceId; label: string; Icon: typeof LayoutGrid; badge?: string }
type Group = { name: string; items: Item[] }

// Order locked: Company → Insights → Studio → Forge — the founder loop
// (run it → know it → market it → build it). Mirrored by MobileNav.MGROUPS;
// keep the two in sync when a surface is added.
const GROUPS: Group[] = [
  { name: 'Company', items: [
    { id: 'home', label: 'Home', Icon: Sparkles },
    { id: 'portfolio', label: 'Portfolio', Icon: LayoutGrid },
    { id: 'command', label: 'Command', Icon: Radar },
    { id: 'core', label: 'Arganta Core', Icon: MessageCircle },
    { id: 'copilot', label: 'Copilot', Icon: Mic2 },
    { id: 'cinema', label: 'Cinema', Icon: Film },
  ] },
  { name: 'Insights', items: [
    { id: 'growth', label: 'Growth', Icon: TrendingUp },
    { id: 'data', label: 'Data', Icon: Database },
    { id: 'vault', label: 'HQ Vault', Icon: BookOpen },
    { id: 'knowledge', label: 'Knowledge', Icon: Orbit },
    { id: 'architecture', label: 'Architecture', Icon: Workflow },
    { id: 'rack', label: 'Model Rack', Icon: Cpu },
  ] },
  // Founder rule: everything inside Studio ends in "Studio" — no Builder, no
  // Vault, no Center. Surface ids are unchanged; only the labels carry the rule.
  { name: 'Studio', items: [
    { id: 'biography', label: 'Biography Studio', Icon: BookUser },
    { id: 'brand', label: 'Brand Studio', Icon: Palette },
    { id: 'influencer', label: 'Influencer Studio', Icon: UserRound },
    { id: 'broadcast', label: 'Post Studio', Icon: Megaphone },
    { id: 'video', label: 'Video Studio', Icon: Film },
    { id: 'music', label: 'Music Studio', Icon: Music2 },
    { id: 'media', label: 'Media Studio', Icon: Wand2 },
    { id: 'pixel', label: 'Pixel Studio', Icon: Grid2x2 },
  ] },
  { name: 'Forge', items: [
    { id: 'game', label: 'Game Builder', Icon: Gamepad2 },
    { id: 'world', label: 'Openworld Builder', Icon: Map },
    { id: 'battle', label: 'Battle Builder', Icon: Swords },
    { id: 'character', label: 'Character Forge', Icon: UserRound },
    { id: 'app', label: 'App Builder', Icon: Boxes },
    { id: 'content', label: 'Learn Builder', Icon: GraduationCap },
    { id: 'agents', label: 'Agent Builder', Icon: Network },
    { id: 'reactor', label: 'Reactor Builder', Icon: Atom },
  ] },
]

export function Rail({ who, authed = false }: { who: string; authed?: boolean }) {
  const { surface, go } = useHQ()
  const initials = who.slice(0, 2).toUpperCase()

  const armed = useCopilotStore(s => s.armed)
  const voiceStatus = useCopilotStore(s => s.voiceStatus)
  const gestureActive = useCopilotStore(s => s.gestureActive)
  const gestureLoading = useCopilotStore(s => s.gestureLoading)
  const gestureStatus = useCopilotStore(s => s.gestureStatus)
  const toggleVoice = useCopilotStore(s => s.toggleVoice)
  const toggleGesture = useCopilotStore(s => s.toggleGesture)
  const openHelp = useCopilotStore(s => s.openHelp)

  return (
    <nav className="rail" aria-label="Primary">
      <div className="rail-logo">
        <div className="rail-mark"><CircleDashed size={15} color="#fff" /></div>
        <span className="rail-name">Circle HQ</span>
      </div>

      {GROUPS.map((g) => (
        <div key={g.name} className="rail-grp-wrap">
          <div className="rail-grp">{g.name}</div>
          {g.items.map(({ id, label, Icon, badge }) => (
            <button key={id} className={'nav' + (surface === id ? ' on' : '')}
              onClick={() => go(id)} title={label}>
              <Icon size={17} />
              <span>{label}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </button>
          ))}
          {g.name === 'Company' && authed && (
            <button className="nav" onClick={signOut} title="Sign out">
              <LogOut size={17} />
              <span>Sign out</span>
            </button>
          )}
        </div>
      ))}

      <CopilotDock
        armed={armed} voiceStatus={voiceStatus}
        gestureActive={gestureActive} gestureLoading={gestureLoading} gestureStatus={gestureStatus}
        onToggleVoice={toggleVoice} onToggleGesture={toggleGesture} onOpenHelp={openHelp}
        inline />

      <div className="rail-foot">
        <div className="avatar">{initials}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>{who}</div>
          <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Operator</div>
        </div>
      </div>
    </nav>
  )
}
