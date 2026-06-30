import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import GemsBackground from './three/GemsBackground'
import { SCENES, SCENE_W, SCENE_H } from './stage/scenes'
import { ActiveCtx } from './stage/active'

// ──────────────────────────────────────────────────────────────
//  FLIGHT THROUGH ARGANTALAB
//  No scrollbar. Every scene lives on one giant virtual stage; a camera flies
//  between them — zoom out, travel across the cosmos, zoom in, settle. The real
//  ArgantaLab gem field drifts behind everything and parallaxes as we move.
// ──────────────────────────────────────────────────────────────

function fitScale() {
  const vw = window.innerWidth, vh = window.innerHeight
  return Math.max(0.32, Math.min(1.06, (vw * 0.94) / SCENE_W, (vh * 0.9) / SCENE_H))
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
function IconSun() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></svg>
}
function IconMoon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
}

export default function App() {
  const [dark, setDark] = useState(true)
  const [idx, setIdx] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const cam = useRef({ x: SCENES[0].x, y: SCENES[0].y, s: fitScale() })
  const focusRef = useRef({ x: SCENES[0].x, y: SCENES[0].y })
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const didInit = useRef(false)
  const wheelAcc = useRef(0)
  const lastHop = useRef(0)

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])

  const applyCam = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    const { x, y, s } = cam.current
    const tx = window.innerWidth / 2 - x * s
    const ty = window.innerHeight / 2 - y * s
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`
    focusRef.current.x = x
    focusRef.current.y = y
  }, [])

  // Reveal the landed scene's animated parts.
  const revealScene = useCallback((i: number) => {
    const el = stageRef.current?.querySelector(`#scene-${SCENES[i].id}`)
    if (!el) return
    const bits = el.querySelectorAll('.reveal')
    gsap.killTweensOf(bits)
    gsap.fromTo(bits,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.07, ease: 'power3.out', delay: 0.35, overwrite: true })
    el.dispatchEvent(new CustomEvent('scene-active', { bubbles: false }))
  }, [])

  // Fly the camera to a scene. Interrupt-safe: any in-flight hop is killed and
  // re-targeted, so the controls never lock up.
  const flyTo = useCallback((i: number, instant = false) => {
    tlRef.current?.kill()
    const target = SCENES[i]
    const s = fitScale()
    if (instant) {
      cam.current = { x: target.x, y: target.y, s }
      applyCam()
      revealScene(i)
      return
    }
    const travelS = s * 0.58
    const tl = gsap.timeline({ onUpdate: applyCam })
    tl.to(cam.current, { x: target.x, y: target.y, duration: 1.2, ease: 'power2.inOut' }, 0)
    tl.to(cam.current, { s: travelS, duration: 0.55, ease: 'power2.in' }, 0)
    tl.to(cam.current, { s, duration: 0.7, ease: 'power3.out' }, 0.52)
    tlRef.current = tl
    revealScene(i)
  }, [applyCam, revealScene])

  const go = useCallback((next: number) => {
    setIdx(() => Math.max(0, Math.min(SCENES.length - 1, next)))
  }, [])

  // react to index changes — first run places instantly, the rest fly.
  useEffect(() => {
    if (!didInit.current) { didInit.current = true; flyTo(idx, true) }
    else flyTo(idx)
  }, [idx, flyTo])

  // keep framing correct on resize
  useEffect(() => {
    const onResize = () => { cam.current.s = fitScale(); applyCam() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [applyCam])

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(idx + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1) }
      else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(SCENES.length - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, go])

  // wheel = one hop per gesture (cooldown so a single scroll doesn't skip scenes)
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = performance.now()
      if (now - lastHop.current < 650) return
      wheelAcc.current += e.deltaY
      if (wheelAcc.current > 90) { wheelAcc.current = 0; lastHop.current = now; go(idx + 1) }
      else if (wheelAcc.current < -90) { wheelAcc.current = 0; lastHop.current = now; go(idx - 1) }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [idx, go])

  // touch swipe
  useEffect(() => {
    let y0 = 0, x0 = 0
    const ts = (e: TouchEvent) => { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX }
    const te = (e: TouchEvent) => {
      const dy = e.changedTouches[0].clientY - y0
      const dx = e.changedTouches[0].clientX - x0
      const d = Math.abs(dx) > Math.abs(dy) ? -dx : -dy
      if (d > 50) go(idx + 1); else if (d < -50) go(idx - 1)
    }
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchend', te, { passive: true })
    return () => { window.removeEventListener('touchstart', ts); window.removeEventListener('touchend', te) }
  }, [idx, go])

  const progress = useMemo(() => (idx / (SCENES.length - 1)) * 100, [idx])

  return (
    <div className="cosmos-app">
      <GemsBackground focusRef={focusRef} />

      {/* the giant virtual stage the camera flies over */}
      <ActiveCtx.Provider value={SCENES[idx].id}>
        <div className="cosmos-stage" ref={stageRef}>
          {SCENES.map((sc, i) => (
            <section
              key={sc.id}
              id={`scene-${sc.id}`}
              className={`cine-scene${i === idx ? ' is-active' : ''}`}
              style={{ left: sc.x - SCENE_W / 2, top: sc.y - SCENE_H / 2, width: SCENE_W, height: SCENE_H }}
            >
              {sc.node}
            </section>
          ))}
        </div>
      </ActiveCtx.Provider>

      {/* top bar */}
      <nav className="cosmos-nav">
        <button className="cnav-brand" onClick={() => go(0)} aria-label="ArgantaLab — restart">
          <ArgantaMark /><span>ArgantaLab</span>
        </button>
        <div className="cnav-right">
          <span className="cnav-count">{String(idx + 1).padStart(2, '0')} <i>/ {String(SCENES.length).padStart(2, '0')}</i></span>
          <button className="cnav-theme" onClick={() => setDark(d => !d)} aria-label="Toggle theme">{dark ? <IconSun /> : <IconMoon />}</button>
        </div>
      </nav>

      {/* flight controls */}
      <div className="cosmos-controls">
        <button className="cctl-arrow" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="cctl-dots">
          {SCENES.map((sc, i) => (
            <button key={sc.id} className={`cctl-dot${i === idx ? ' on' : ''}`} onClick={() => go(i)} aria-label={sc.title} title={sc.title} />
          ))}
        </div>
        <button className="cctl-arrow next" onClick={() => go(idx + 1)} disabled={idx === SCENES.length - 1} aria-label="Next">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* scene label + progress */}
      <div className="cosmos-foot">
        <span className="cfoot-label">{SCENES[idx].title}</span>
        <div className="cfoot-bar"><i style={{ width: `${progress}%` }} /></div>
      </div>
    </div>
  )
}
