import { useEffect, useRef } from 'react'
import { useAppStore } from '@store/appStore'
import { cinematicForTab, WORLDS, type CLesson } from '@/data/cinematic'
import { CinematicCity } from './CinematicCity'

export default function CinematicWorldMap({ tab }: { tab: string }) {
  const { go, completedLessons, requireAuth } = useAppStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const lessons = cinematicForTab(tab).sort((a, b) => a.num.localeCompare(b.num))
  const world = lessons.length ? WORLDS[lessons[0].world] : null
  const doneCount = lessons.filter(l => completedLessons.includes(l.id)).length

  useEffect(() => {
    if (!canvasRef.current) return
    const city = new CinematicCity(canvasRef.current)
    city.goTo('orbit', 0.1)
    city.spotlight(true)
    const onResize = () => city.resize()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); city.dispose() }
  }, [])

  const unlocked = (l: CLesson) => !l.lock || l.lock.every(p => completedLessons.includes(p))

  const start = (l: CLesson) => {
    if (!unlocked(l)) return
    if (!requireAuth('to start learning')) return
    go({ lessonId: l.id })
  }

  if (!world) return null

  return (
    <div className="wm">
      <canvas ref={canvasRef} className="wm-canvas" />
      <div className="wm-grad" />

      <div className="wm-inner">
        <div className="wm-head">
          <div className="kicker"><span className="live" />&nbsp;{world.name}</div>
          <h1 className="h-title">{world.name}</h1>
          <p className="lead">{world.tagline}</p>
          <div className="wm-prog">
            <span>{doneCount}/{lessons.length} districts lit</span>
            <div className="xpbar"><i style={{ width: `${(doneCount / lessons.length) * 100}%` }} /></div>
          </div>
        </div>

        <div className="wm-track">
          {lessons.map((l, i) => {
            const done = completedLessons.includes(l.id)
            const locked = !unlocked(l)
            const next = !done && !locked && lessons.slice(0, i).every(p => completedLessons.includes(p.id))
            return (
              <button
                key={l.id}
                className={`wm-node${done ? ' done' : ''}${locked ? ' locked' : ''}${next ? ' next' : ''}`}
                style={{ marginTop: i % 2 ? 46 : 0 }}
                onClick={() => start(l)}
                disabled={locked}
              >
                <div className="wm-num">{l.num}</div>
                <div className="wm-ic">{locked ? '🔒' : l.scenes[0].emoji}</div>
                <h3>{l.title}</h3>
                <span className="wm-loc">{l.location}</span>
                <div className="wm-status">
                  {done ? '✓ Lit' : locked ? 'Locked' : `Start · +${l.xp} XP`}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
