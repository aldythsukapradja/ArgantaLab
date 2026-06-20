import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useAppStore } from '@store/appStore'
import { CINEMATIC_LESSONS } from '@/data/cinematic'
import { createWorld, type CinematicWorld } from './worlds'

const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
const Next = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
const Check = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
const Close = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>

export default function CinematicPlayer({ lessonId }: { lessonId: string }) {
  const { go, completeLesson, addXp, completedLessons } = useAppStore()
  const lesson = CINEMATIC_LESSONS[lessonId]

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cityRef = useRef<CinematicWorld | null>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const [typed, setTyped] = useState('')
  const [fired, setFired] = useState(false)

  // mount the 3D world once + take over the screen (hide chrome)
  useEffect(() => {
    document.body.classList.add('cine-mode')
    if (!canvasRef.current) return () => document.body.classList.remove('cine-mode')
    const city = createWorld(lesson?.world ?? 'city', canvasRef.current)
    cityRef.current = city
    const onResize = () => city.resize()
    window.addEventListener('resize', onResize)
    return () => {
      document.body.classList.remove('cine-mode')
      window.removeEventListener('resize', onResize)
      city.dispose(); cityRef.current = null
    }
  }, [])

  // drive camera + reveal text on each scene change
  useEffect(() => {
    const scene = lesson?.scenes[step]
    if (!scene || !cityRef.current) return
    cityRef.current.goTo(scene.cam)
    cityRef.current.spotlight(scene.spotlight !== undefined)
    cityRef.current.setEffect(scene.effect ?? 'normal')
    setFired(false)
    setTyped('')

    if (textRef.current) {
      const tl = gsap.timeline()
      tl.fromTo('.cs-badge', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' })
        .fromTo('.cs-headline', { clipPath: 'inset(0 100% 0 0)', opacity: 0 }, { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: 0.7, ease: 'power3.out' }, '-=0.1')
        .fromTo('.cs-emoji', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.5')
        .fromTo('.cs-card.a', { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45 }, '-=0.3')
        .fromTo('.cs-card.r', { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45 }, '-=0.3')
        .fromTo('.cs-act', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, '-=0.2')
    }
  }, [step, lesson])

  if (!lesson) return null
  const scene = lesson.scenes[step]
  const isLast = step === lesson.scenes.length - 1
  const done = completedLessons.includes(lessonId)

  const finish = () => {
    if (!done) { completeLesson(lessonId); addXp(lesson.xp) }
    go({ lessonId: null })
  }
  const next = () => { if (isLast) finish(); else setStep(s => s + 1) }
  const prev = () => setStep(s => Math.max(0, s - 1))

  const runInteractive = () => {
    cityRef.current?.pulse()
    setFired(true)
  }

  return (
    <div className="cine">
      <canvas ref={canvasRef} className="cine-canvas" />
      <div className="cine-grad" />

      {/* top bar */}
      <div className="cine-top">
        <button className="cine-x" onClick={() => go({ lessonId: null })}><Close /></button>
        <div className="cine-loc">
          <b>{lesson.title}</b>
          <span>{lesson.location} · Scene {step + 1}/{lesson.scenes.length}</span>
        </div>
        <span className="cine-xp">+{lesson.xp} XP</span>
      </div>

      {/* scene text */}
      <div className="cine-text" ref={textRef} key={step}>
        <div className="cs-emoji">{scene.emoji}</div>
        {scene.badge && <div className="cs-badge">{scene.badge}</div>}
        <h1 className="cs-headline">{scene.headline}</h1>
        <div className="cs-cards">
          <div className="cs-card a">
            <div className="cs-h">🧩 Like this…</div>
            <p>{scene.analogy}</p>
          </div>
          <div className="cs-card r">
            <div className="cs-h">⚙️ In real life</div>
            <p>{scene.real}</p>
          </div>
        </div>

        {scene.interactive && (
          <div className="cs-act">
            {scene.interactive.kind === 'type' ? (
              <div className="cs-type">
                <span className="cs-type-pre">https://</span>
                <input
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder="argantalab.com"
                  onKeyDown={e => { if (e.key === 'Enter' && typed.trim()) runInteractive() }}
                />
                <button className="btn btn-primary" disabled={!typed.trim()} onClick={runInteractive}>Drive →</button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={runInteractive}>{scene.interactive.prompt}</button>
            )}
            {fired && <div className="cs-fired">✨ The city lit up! You made it happen.</div>}
            {!fired && scene.interactive.kind !== 'type' && <p className="cs-hint">{scene.interactive.prompt}</p>}
          </div>
        )}
      </div>

      {/* nav */}
      <div className="cine-nav">
        <button className="btn btn-ghost" onClick={prev} disabled={step === 0}><Back /> Back</button>
        <div className="cine-dots">
          {lesson.scenes.map((_, i) => <i key={i} className={i === step ? 'on' : ''} onClick={() => setStep(i)} />)}
        </div>
        <button className="btn btn-primary" onClick={next}>
          {isLast ? <><Check /> Finish</> : <>Next <Next /></>}
        </button>
      </div>
    </div>
  )
}
