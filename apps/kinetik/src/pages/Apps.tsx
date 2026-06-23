import { useRef } from 'react'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { APP_ICON } from '@components/Icons'

interface AppDef { id: string; name: string; icon: keyof typeof APP_ICON; grad: [string, string]; diamonds?: number }

const APPS: AppDef[] = [
  { id: 'padel', name: 'Padel', icon: 'padel', grad: ['#22D3EE', '#0EA5E9'], diamonds: 3 },
  { id: 'vault', name: 'FamilyVault', icon: 'vault', grad: ['#64748B', '#334155'] },
  { id: 'travel', name: 'Travel', icon: 'travel', grad: ['#34D399', '#10B981'] },
  { id: 'arganta', name: 'ArgantaLab', icon: 'game', grad: ['#8B5CF6', '#D946EF'], diamonds: 0 },
  { id: 'grocery', name: 'Grocery', icon: 'grocery', grad: ['#FB7185', '#F43F5E'] },
  { id: 'cinema', name: 'Cinema', icon: 'cinema', grad: ['#FBBF24', '#F59E0B'] },
  { id: 'store', name: 'Store', icon: 'store', grad: ['#EFEFF3', '#E2E2EA'] },
]

export default function Apps() {
  const circles = useDataStore(s => s.circles)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const tap = (id: string) => {
    const el = refs.current[id]
    if (el) gsap.fromTo(el, { scale: 0.86 }, { scale: 1, duration: 0.5, ease: 'back.out(3.5)' })
  }
  return (
    <div className="fade-in">
      <p className="mom-private">{circle?.name ?? 'Your circle'} · your household</p>
      <div className="apps-grid">
        {APPS.map(a => {
          const Icon = APP_ICON[a.icon]
          const isStore = a.id === 'store'
          return (
            <button key={a.id} className="app-tile" ref={el => (refs.current[a.id] = el)} onClick={() => tap(a.id)}>
              <span className="app-ic" style={isStore
                ? { background: 'var(--card)', border: '0.5px dashed var(--border-2)', color: 'var(--accent)' }
                : { background: `linear-gradient(135deg,${a.grad[0]},${a.grad[1]})`, color: '#fff' }}>
                <Icon width={26} height={26} />
                {a.diamonds !== undefined && <span className="app-badge">{a.diamonds || ''}</span>}
              </span>
              <small style={isStore ? { color: 'var(--muted)' } : undefined}>{a.name}</small>
            </button>
          )
        })}
      </div>
      <p className="apps-note">Tap to open — each app shares your circle and its energy. More in the Store.</p>
    </div>
  )
}
