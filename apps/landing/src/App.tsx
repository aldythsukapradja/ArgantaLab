import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import SkyScene from './three/SkyScene'
import { Hub, SubHub } from './stage/scenes'
import { FLIGHTS, FLIGHT_BY_ID, HUB_POS, SUBHUB_POS, flightScenePos } from './stage/registry'
import { ActiveCtx } from './stage/active'

// ──────────────────────────────────────────────────────────────
//  FLIGHT THROUGH ARGANTA — Daybreak
//  A camera flies over one stage. Hub → (sub-hub) → flight. Pull up returns.
//  The light sky drifts behind everything and parallaxes with the camera.
// ──────────────────────────────────────────────────────────────

type View = { mode: 'hub' } | { mode: 'subhub' } | { mode: 'flight'; f: string; i: number }

// Scene box is landscape on desktop, portrait on phones — so content fills the
// screen instead of floating tiny in the middle.
function sceneSize() {
  const vw = window.innerWidth, vh = window.innerHeight
  if (vw < 820) return { w: Math.min(vw * 0.96, 560), h: Math.min(vh * 0.94, 980) }
  return { w: 1180, h: 780 }
}
function fitScale(zoomOut = false) {
  const { w, h } = sceneSize()
  const vw = window.innerWidth, vh = window.innerHeight
  const mobile = vw < 820
  const base = Math.max(0.34, Math.min(mobile ? 1.0 : 1.06, (vw * 0.97) / w, (vh * 0.95) / h))
  return zoomOut && !mobile ? base * 0.82 : base
}
function posOf(v: View) {
  if (v.mode === 'hub') return HUB_POS
  if (v.mode === 'subhub') return SUBHUB_POS
  return flightScenePos(v.f, v.i)
}
function viewId(v: View) {
  if (v.mode === 'hub') return 'hub'
  if (v.mode === 'subhub') return 'subhub'
  return `${v.f}-${v.i}`
}
function parentOf(v: View): View {
  if (v.mode !== 'flight') return { mode: 'hub' }
  return FLIGHT_BY_ID[v.f]?.product ? { mode: 'subhub' } : { mode: 'hub' }
}

function ArgantaMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.3" />
      <circle cx="16" cy="8" r="2.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}
const IconSun = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></svg>
const IconMoon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
const IconMap = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l-6 2v12l6-2 6 2 6-2V6l-6 2-6-2zM9 6v12M15 8v12" /></svg>

function parseHash(): View {
  const h = window.location.hash.replace(/^#/, '')
  if (h === 'company') return { mode: 'flight', f: 'company', i: 0 }
  if (h === 'vision') return { mode: 'flight', f: 'vision', i: 0 }
  if (h === 'products') return { mode: 'subhub' }
  const m = h.match(/^products\/(\w+)$/)
  if (m && FLIGHT_BY_ID[m[1]]) return { mode: 'flight', f: m[1], i: 0 }
  return { mode: 'hub' }
}

export default function App() {
  const [dark, setDark] = useState(false)
  const [view, setView] = useState<View>(() => parseHash())
  const [size, setSize] = useState(() => sceneSize())
  const stageRef = useRef<HTMLDivElement>(null)
  const cam = useRef({ x: HUB_POS.x, y: HUB_POS.y, s: fitScale(true) })
  const focusRef = useRef({ x: HUB_POS.x, y: HUB_POS.y })
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const didInit = useRef(false)
  const wheelAcc = useRef(0)
  const lastHop = useRef(0)

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])

  const applyCam = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    const { x, y, s } = cam.current
    el.style.transform = `translate3d(${window.innerWidth / 2 - x * s}px, ${window.innerHeight / 2 - y * s}px, 0) scale(${s})`
    focusRef.current.x = x; focusRef.current.y = y
  }, [])

  const revealScene = useCallback((id: string) => {
    const el = stageRef.current?.querySelector(`#scene-${id}`)
    if (!el) return
    const bits = el.querySelectorAll('.reveal')
    gsap.killTweensOf(bits)
    gsap.fromTo(bits, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.07, ease: 'power3.out', delay: 0.35, overwrite: true })
  }, [])

  const flyTo = useCallback((v: View, instant = false) => {
    tlRef.current?.kill()
    const p = posOf(v)
    const s = fitScale(v.mode !== 'flight')
    const id = viewId(v)
    if (instant) { cam.current = { x: p.x, y: p.y, s }; applyCam(); revealScene(id); return }
    const travelS = s * 0.56
    const tl = gsap.timeline({ onUpdate: applyCam })
    tl.to(cam.current, { x: p.x, y: p.y, duration: 1.25, ease: 'power2.inOut' }, 0)
    tl.to(cam.current, { s: travelS, duration: 0.55, ease: 'power2.in' }, 0)
    tl.to(cam.current, { s, duration: 0.72, ease: 'power3.out' }, 0.55)
    tlRef.current = tl
    revealScene(id)
  }, [applyCam, revealScene])

  // fly on view change + keep hash in sync
  useEffect(() => {
    if (!didInit.current) { didInit.current = true; flyTo(view, true) }
    else flyTo(view)
    const h = view.mode === 'hub' ? '' : view.mode === 'subhub' ? 'products' : FLIGHT_BY_ID[view.f]?.product ? `products/${view.f}` : view.f
    const want = h ? `#${h}` : ' '
    if (window.location.hash !== (h ? `#${h}` : '')) history.replaceState(null, '', h ? `#${h}` : window.location.pathname)
    void want
  }, [view, flyTo])

  useEffect(() => {
    const onResize = () => { setSize(sceneSize()); cam.current.s = fitScale(view.mode !== 'flight'); applyCam() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [applyCam, view])

  // browser back/forward + manual hash edits
  useEffect(() => {
    const onPop = () => setView(parseHash())
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onPop)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop) }
  }, [])

  // navigation helpers
  const goFlight = useCallback((f: string, i = 0) => setView({ mode: 'flight', f, i }), [])
  const toMap = useCallback(() => setView(v => parentOf(v)), [])
  const step = useCallback((dir: number) => {
    setView(v => {
      if (v.mode !== 'flight') return v
      const f = FLIGHT_BY_ID[v.f]
      const ni = v.i + dir
      if (ni < 0 || ni >= f.scenes.length) return parentOf(v)
      return { mode: 'flight', f: v.f, i: ni }
    })
  }, [])

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); step(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); step(-1) }
      else if (e.key === 'Escape') toMap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, toMap])

  // wheel (cooldown)
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = performance.now()
      if (now - lastHop.current < 680) return
      wheelAcc.current += e.deltaY
      if (Math.abs(wheelAcc.current) > 90) { const d = wheelAcc.current > 0 ? 1 : -1; wheelAcc.current = 0; lastHop.current = now; step(d) }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [step])

  // touch
  useEffect(() => {
    let y0 = 0, x0 = 0
    const ts = (e: TouchEvent) => { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX }
    const te = (e: TouchEvent) => {
      const d = Math.abs(e.changedTouches[0].clientX - x0) > Math.abs(e.changedTouches[0].clientY - y0) ? -(e.changedTouches[0].clientX - x0) : -(e.changedTouches[0].clientY - y0)
      if (d > 50) step(1); else if (d < -50) step(-1)
    }
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchend', te, { passive: true })
    return () => { window.removeEventListener('touchstart', ts); window.removeEventListener('touchend', te) }
  }, [step])

  const activeId = viewId(view)
  const flight = view.mode === 'flight' ? FLIGHT_BY_ID[view.f] : null
  const dots = flight?.scenes ?? []
  const footLabel = view.mode === 'hub' ? 'The Arganta cosmos' : view.mode === 'subhub' ? 'Products' : `${flight?.title} · ${flight?.scenes[view.i].title}`
  const progress = useMemo(() => view.mode === 'flight' && flight ? (view.i / Math.max(1, flight.scenes.length - 1)) * 100 : 0, [view, flight])

  return (
    <div className="cosmos-app">
      <SkyScene focusRef={focusRef} dark={dark} />

      <ActiveCtx.Provider value={activeId}>
        <div className="cosmos-stage" ref={stageRef}>
          <section id="scene-hub" className={`cine-scene${view.mode === 'hub' ? ' is-active' : ''}`} style={{ left: HUB_POS.x - size.w / 2, top: HUB_POS.y - size.h / 2, width: size.w, height: size.h }}>
            <Hub onPick={id => id === 'products' ? setView({ mode: 'subhub' }) : goFlight(id)} />
          </section>
          <section id="scene-subhub" className={`cine-scene${view.mode === 'subhub' ? ' is-active' : ''}`} style={{ left: SUBHUB_POS.x - size.w / 2, top: SUBHUB_POS.y - size.h / 2, width: size.w, height: size.h }}>
            <SubHub onPick={id => goFlight(id)} />
          </section>
          {FLIGHTS.map(f => f.scenes.map((sc, i) => {
            const p = flightScenePos(f.id, i)
            const id = `${f.id}-${i}`
            return (
              <section key={id} id={`scene-${id}`} className={`cine-scene${activeId === id ? ' is-active' : ''}`} style={{ left: p.x - size.w / 2, top: p.y - size.h / 2, width: size.w, height: size.h }}>
                {sc.el}
              </section>
            )
          }))}
        </div>
      </ActiveCtx.Provider>

      <nav className="cosmos-nav">
        <button className="cnav-brand" onClick={() => setView({ mode: 'hub' })} aria-label="Arganta — home"><ArgantaMark /><span>Arganta</span></button>
        <div className="cnav-right">
          {view.mode !== 'hub' && <button className="cnav-map" onClick={toMap}><IconMap /> map</button>}
          <a className="cnav-inv" href="#company" onClick={e => { e.preventDefault(); goFlight('company') }}>for investors →</a>
          <button className="cnav-theme" onClick={() => setDark(d => !d)} aria-label="Toggle theme">{dark ? <IconSun /> : <IconMoon />}</button>
        </div>
      </nav>

      {view.mode === 'flight' && (
        <div className="cosmos-controls">
          <button className="cctl-arrow" onClick={() => step(-1)} aria-label="Previous"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
          <div className="cctl-dots">{dots.map((sc, i) => <button key={sc.id} className={`cctl-dot${view.mode === 'flight' && view.i === i ? ' on' : ''}`} onClick={() => goFlight(flight!.id, i)} aria-label={sc.title} title={sc.title} />)}</div>
          <button className="cctl-arrow next" onClick={() => step(1)} aria-label="Next"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
        </div>
      )}

      <div className="cosmos-foot">
        <span className="cfoot-label">{footLabel}</span>
        {view.mode === 'flight' && <div className="cfoot-bar"><i style={{ width: `${progress}%` }} /></div>}
      </div>
    </div>
  )
}
