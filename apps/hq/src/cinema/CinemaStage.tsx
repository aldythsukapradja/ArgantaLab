// CinemaStage — the in-place cinematic overlay for the CEO Orb. It does NOT
// cover the cockpit: the real reactor + instruments stay on screen and
// choreograph. This layer only paints the narration, transport and exit, and
// is otherwise pointer-transparent. Landing owns the Director (useCinema) and
// drives the reactor + instruments from its SceneState; this is presentational.
import { useEffect } from 'react'
import { X, Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react'
import type { CinemaApi } from './director'
import { ACTS } from './scenario'
import { KaraokeLine } from '../lib/karaoke/KaraokeLine'
import { useCinemaStore, mergeScene } from './store'
import './cinema-stage.css'

export function CinemaStage({ cinema: c, onExit }: { cinema: CinemaApi; onExit: () => void }) {
  const { overrides } = useCinemaStore()
  const scene = mergeScene(c.scene, overrides[c.scene.id])
  const act = ACTS[c.scene.act]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches?.('input,textarea,select')) return
      if (e.key === 'Escape') { e.preventDefault(); onExit() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); c.next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); c.prev() }
      else if (e.code === 'Space') { e.preventDefault(); c.toggle() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [c, onExit])

  return (
    <div className="cine-layer" style={{ ['--act-accent' as string]: act.accent }}>
      <div className="cine-top">
        <span className="cine-kicker">ACT {act.roman} · {act.title}</span>
        <button className="cine-exit" onClick={onExit} title="Exit cinematic (Esc)"><X size={16} /> Exit</button>
      </div>

      <div className="cine-narr">
        <div className="cine-idea">{scene.idea}</div>
        <KaraokeLine audio={c.audioEl} text={scene.narration} playing={c.playing} className="cine-kara" />
        <div className="cine-speaker">
          <i className={scene.voice} />{scene.voice === 'KF' ? 'KF · Specialist' : 'JM · Jarvis'}
        </div>
      </div>

      <footer className="cine-transport">
        <div className="cine-prog"><i style={{ width: `${(((c.index + c.progress) / c.total) * 100).toFixed(1)}%` }} /></div>
        <div className="cine-ctrl">
          <button onClick={c.prev} title="Previous (←)"><SkipBack size={15} /></button>
          <button className="cine-play" onClick={c.toggle} title="Play / Pause (Space)">{c.playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <button onClick={c.next} title="Next (→)"><SkipForward size={15} /></button>
          <button onClick={c.replay} title="Replay"><RotateCcw size={13} /></button>
          <span className="cine-count">{String(c.index + 1).padStart(2, '0')}/{c.total}</span>
        </div>
      </footer>
    </div>
  )
}
