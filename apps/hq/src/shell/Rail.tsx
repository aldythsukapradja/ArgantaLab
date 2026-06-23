import {
  LayoutGrid, Database, Activity, Users, Gamepad2, Boxes, CircleDashed,
} from 'lucide-react'
import { useHQ, type SurfaceId } from './store'

type Item = { id: SurfaceId; label: string; Icon: typeof LayoutGrid; badge?: string }
type Group = { name: string; items: Item[] }

// Order locked: Products → Analytics → Build.
const GROUPS: Group[] = [
  { name: 'Products', items: [
    { id: 'portfolio', label: 'Portfolio', Icon: LayoutGrid },
  ] },
  { name: 'Analytics', items: [
    { id: 'data', label: 'Data', Icon: Database, badge: 'Live' },
    { id: 'pulse', label: 'Pulse', Icon: Activity },
    { id: 'audience', label: 'Audience', Icon: Users },
  ] },
  { name: 'Build', items: [
    { id: 'game', label: 'Game Builder', Icon: Gamepad2 },
    { id: 'app', label: 'App Builder', Icon: Boxes },
  ] },
]

export function Rail({ who }: { who: string }) {
  const { surface, go } = useHQ()
  const initials = who.slice(0, 2).toUpperCase()
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
        </div>
      ))}

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
