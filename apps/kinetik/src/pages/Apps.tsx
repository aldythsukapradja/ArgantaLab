import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import * as repo from '@repo/kinetikRepo'
import type { KApp } from '@repo/kinetikRepo'
import { APP_ICON, IconDiamond, IconChevronL } from '@components/Icons'

// Deterministic gradient + glyph for an app that ships no thumbnail, so the
// shelf still looks designed. Derived from the app's own name/category.
const GRADS: [string, string][] = [
  ['#34D399', '#10B981'], ['#22D3EE', '#0EA5E9'], ['#FB7185', '#F43F5E'],
  ['#A78BFA', '#8B5CF6'], ['#FBBF24', '#F59E0B'], ['#F472B6', '#EC4899'],
  ['#2DD4BF', '#14B8A6'], ['#60A5FA', '#3B82F6'],
]
function gradFor(s: string): [string, string] {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return GRADS[h % GRADS.length]
}
function iconFor(cat: string | null, name: string): keyof typeof APP_ICON {
  const t = `${cat ?? ''} ${name}`.toLowerCase()
  if (/budget|money|vault|fault|finance|wallet|saving|bank/.test(t)) return 'vault'
  if (/travel|trip|holiday|flight/.test(t)) return 'travel'
  if (/grocery|shop|food|market/.test(t)) return 'grocery'
  if (/cinema|movie|watch|film/.test(t)) return 'cinema'
  if (/padel|sport|play|fitness/.test(t)) return 'padel'
  return 'game'
}

export default function Apps() {
  const circles = useDataStore(s => s.circles)
  const me = useDataStore(s => s.me)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const diamonds = me?.diamonds ?? 0

  const [apps, setApps] = useState<KApp[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<KApp | null>(null)
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    if (!circle) return
    let alive = true
    setApps(null); setErr(null)
    repo.fetchApps(circle.id)
      .then(a => { if (alive) setApps(a) })
      .catch(e => { if (alive) { setApps([]); setErr(e instanceof Error ? e.message : 'Could not load apps') } })
    return () => { alive = false }
  }, [circle?.id])

  const tap = (a: KApp) => {
    const el = refs.current[a.id]
    if (el) gsap.fromTo(el, { scale: 0.86 }, { scale: 1, duration: 0.5, ease: 'back.out(3.5)' })
    setOpen(a)
  }

  const count = apps?.length ?? 0

  return (
    <div className="fade-in apps-page">
      <div className="apps-head">
        <h1>Apps</h1>
        <div className="me3-wallet" style={{ boxShadow: '0 2px 8px rgba(20,16,40,.08)' }}><IconDiamond width={14} height={14} style={{ color: 'var(--memory)' }} /> {diamonds.toLocaleString()}</div>
      </div>

      {/* Store hero */}
      <div className="store-hero" role="presentation">
        <span className="sh-orb sh-orb-1" />
        <span className="sh-orb sh-orb-2" />
        <div className="sh-top">
          <span className="sh-kicker">CircleHQ</span>
          <span className="sh-dia"><IconDiamond width={14} height={14} /> {diamonds.toLocaleString()}</span>
        </div>
        <div className="sh-title">Apps for<br />{circle?.name ?? 'your circle'}</div>
        <div className="sh-foot">
          <span className="sh-sub">{count > 0 ? `${count} app${count === 1 ? '' : 's'} published to this circle` : 'Apps you build in CircleHQ land here'}</span>
        </div>
      </div>

      {/* Your apps */}
      <div className="apps-sec-head">
        <span className="apps-sec-title">Your apps</span>
        {apps && <span className="apps-sec-count">{count} {count === 1 ? 'app' : 'apps'}</span>}
      </div>

      {apps === null && (
        <div className="apps-grid2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="app-tile2" key={i}><span className="app-ic2 app-skel" /><small className="app-skel-line" /></div>
          ))}
        </div>
      )}

      {apps && apps.length === 0 && (
        <div className="apps-empty">
          <span className="apps-empty-ic"><APP_ICON.game width={28} height={28} /></span>
          <b>No apps yet</b>
          <p>{err ? err : 'Build an app in CircleHQ and publish it to this circle — it’ll appear here.'}</p>
        </div>
      )}

      {apps && apps.length > 0 && (
        <div className="apps-grid2">
          {apps.map(a => {
            const [g0, g1] = gradFor(a.id + a.name)
            const Icon = APP_ICON[iconFor(a.category, a.name)]
            return (
              <button key={a.id} className="app-tile2" ref={el => (refs.current[a.id] = el)} onClick={() => tap(a)}>
                <span className="app-ic2" style={a.thumbnail ? { padding: 0, overflow: 'hidden' } : { background: `linear-gradient(140deg,${g0},${g1})` }}>
                  {a.thumbnail
                    ? <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon width={26} height={26} />}
                  {a.featured && <span className="app-badge2">★</span>}
                </span>
                <small>{a.name}</small>
              </button>
            )
          })}
        </div>
      )}

      <p className="apps-note">Apps are built &amp; published from CircleHQ. Each one shares your circle “{circle?.name ?? ''}”.</p>

      {open && createPortal(<AppRunner app={open} onClose={() => setOpen(null)} />, document.body)}
    </div>
  )
}

function AppRunner({ app, onClose }: { app: KApp; onClose: () => void }) {
  return (
    <div className="app-runner">
      <div className="ar-bar">
        <button className="ar-back" onClick={onClose} aria-label="Close"><IconChevronL width={20} height={20} /></button>
        <span className="ar-title">{app.name}</span>
        <span className="ar-spacer" />
      </div>
      {app.html
        ? <iframe className="ar-frame" srcDoc={app.html} sandbox="allow-scripts allow-forms allow-popups allow-modals" title={app.name} />
        : <div className="ar-empty"><b>{app.name}</b><p>{app.description || 'This app has no runnable build yet.'}</p></div>}
    </div>
  )
}
