import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import * as repo from '@repo/kinetikRepo'
import type { KApp } from '@repo/kinetikRepo'
import { APP_ICON, IconChevronL } from '@components/Icons'
import { NATIVE_APPS, type NativeApp } from '../apps/registry'
import * as appsRepo from '@repo/appsRepo'

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
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]

  const [apps, setApps] = useState<KApp[] | null>(null)
  const [open, setOpen] = useState<KApp | null>(null)
  const [native, setNative] = useState<NativeApp | null>(null)
  const [snips, setSnips] = useState<Record<string, string>>({})
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    if (!circle) return
    let alive = true
    setApps(null); setSnips({})
    repo.fetchApps(circle.id)
      .then(a => { if (alive) setApps(a) })
      .catch(() => { if (alive) setApps([]) })
    appsRepo.appSnippets(circle.id).then(s => { if (alive) setSnips(s) }).catch(() => {})
    return () => { alive = false }
  }, [circle?.id])

  const tap = (a: KApp) => {
    const el = refs.current[a.id]
    if (el) gsap.fromTo(el, { scale: 0.86 }, { scale: 1, duration: 0.5, ease: 'back.out(3.5)' })
    setOpen(a)
  }

  const count = apps?.length ?? 0

  return (
    <div className="fade-in apps2">
      <div className="apps2-head rise">
        <h1>Apps</h1>
        <p>Native to {circle?.name ?? 'your circle'} — data stays in your family.</p>
      </div>

      {/* Native circle apps — live cards */}
      <div className="apps2-grid">
        {NATIVE_APPS.map(a => (
          <button
            key={a.id}
            className="apps2-card rise"
            ref={el => (refs.current[a.id] = el)}
            style={{ ['--ca0' as any]: a.accent[0], ['--ca1' as any]: a.accent[1] }}
            onClick={() => { const el = refs.current[a.id]; if (el) gsap.fromTo(el, { scale: 0.94 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }); setNative(a) }}
          >
            <span className="apps2-ic">{a.emoji}</span>
            <span className="apps2-name">{a.name}</span>
            <span className="apps2-snip">{snips[a.id] ?? a.tagline}</span>
            <span className="apps2-go" aria-hidden>↗</span>
          </button>
        ))}
      </div>

      {/* Published CircleHQ apps — secondary shelf */}
      {apps && apps.length > 0 && (
        <>
          <div className="apps2-sec rise"><span>From CircleHQ</span><small>{count} {count === 1 ? 'app' : 'apps'}</small></div>
          <div className="apps2-mini rise">
            {apps.map(a => {
              const [g0, g1] = gradFor(a.id + a.name)
              const Icon = APP_ICON[iconFor(a.category, a.name)]
              return (
                <button key={a.id} className="apps2-mini-tile" ref={el => (refs.current[a.id] = el)} onClick={() => tap(a)}>
                  <span className="app-ic2" style={a.thumbnail ? { padding: 0, overflow: 'hidden' } : { background: `linear-gradient(140deg,${g0},${g1})` }}>
                    {a.thumbnail ? <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon width={24} height={24} />}
                  </span>
                  <small>{a.name}</small>
                </button>
              )
            })}
          </div>
        </>
      )}

      {open && createPortal(<AppRunner app={open} onClose={() => setOpen(null)} />, document.body)}
      {native && createPortal(<native.Component onClose={() => setNative(null)} />, document.body)}
    </div>
  )
}

// CircleHQ apps gate their standalone boot behind an "embedded" check
// (`window.self !== window.top`, which is always true inside an iframe), so
// embedded they skip rendering their content and wait for a host to drive them.
// Our runner IS the standalone surface, so neutralise that check → the app boots
// and renders fully, exactly like opening it on its own.
function runnableHtml(html: string): string {
  return html.replace(/window\.(?:self|top|parent)\s*!==?\s*window\.(?:self|top|parent)/g, 'false')
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
        ? <iframe
            className="ar-frame"
            srcDoc={runnableHtml(app.html)}
            // First-party apps published from CircleHQ — they need same-origin so
            // localStorage / Supabase / fetch work; without it their JS throws on
            // first storage access and the app renders blank.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox"
            allow="clipboard-write; clipboard-read"
            title={app.name}
          />
        : <div className="ar-empty"><b>{app.name}</b><p>{app.description || 'This app has no runnable build yet.'}</p></div>}
    </div>
  )
}
