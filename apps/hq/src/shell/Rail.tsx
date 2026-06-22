import {
  Activity, LayoutGrid, ToggleRight, Users, Diamond, Bot, Flame, Lightbulb, SlidersHorizontal, CircleDashed,
} from 'lucide-react'
import { useHQ, type SurfaceId } from './store'

const NAV: { id: SurfaceId; label: string; Icon: typeof Activity }[] = [
  { id: 'pulse', label: 'Pulse', Icon: Activity },
  { id: 'portfolio', label: 'Portfolio', Icon: LayoutGrid },
  { id: 'features', label: 'Features', Icon: ToggleRight },
  { id: 'audience', label: 'Audience', Icon: Users },
  { id: 'economy', label: 'Economy', Icon: Diamond },
  { id: 'agents', label: 'Agents', Icon: Bot },
  { id: 'forge', label: 'Forge', Icon: Flame },
  { id: 'studio', label: 'Studio', Icon: Lightbulb },
  { id: 'registry', label: 'Registry', Icon: SlidersHorizontal },
]

export function Rail() {
  const { surface, go } = useHQ()
  return (
    <nav className="hq-rail glass" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '14px 8px' }}>
      <div className="row" style={{ gap: 8, padding: '4px 8px 14px' }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center',
          background: 'linear-gradient(135deg,var(--acc),var(--acc3))', color: '#fff' }}>
          <CircleDashed size={15} />
        </div>
        <span className="hq-rail-label" style={{ fontSize: 13, fontWeight: 600 }}>Circle HQ</span>
      </div>
      {NAV.map(({ id, label, Icon }) => {
        const on = surface === id
        return (
          <button key={id} onClick={() => go(id)} title={label}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10,
              fontSize: 13, color: on ? 'var(--text)' : 'var(--dim)',
              background: on ? 'color-mix(in srgb,var(--acc2) 16%,transparent)' : 'transparent' }}>
            <Icon size={17} style={{ flex: '0 0 auto' }} />
            <span className="hq-rail-label">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
