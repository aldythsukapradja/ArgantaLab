// CinemaStage — WS1 · E1 P1+P2. The full cinematic mounted OVER the real CEO Orb
// (Landing). The Director (useCinema) runs the 46-scene narrative on the audio
// clock; the reactor core is the centre, driven per scene through CoreSlot
// (renderer 'ws2' → WS2's real R3F reactor). Narration karaoke + transport ride
// on top. Normal cockpit is untouched — this only mounts while playing.
import { useEffect } from 'react'
import { X, Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react'
import { useCinema } from './director'
import { ACTS } from './scenario'
import { CoreSlot } from './slots/CoreSlot'
import { KaraokeLine } from '../lib/karaoke/KaraokeLine'
import { useCinemaStore, mergeScene } from './store'
import './cinema-stage.css'

export function CinemaStage({ onExit }: { onExit: () => void }) {
  const c = useCinema()
  const { overrides } = useCinemaStore()
  const scene = mergeScene(c.scene, overrides[c.scene.id])
  const act = ACTS[c.scene.act]

  // Entering is a user gesture (the "Play cinematic" click) — start the film.
  useEffect(() => { c.startAuto() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="cine" data-act={c.scene.act} style={{ ['--act-accent' as string]: act.accent }}>
      <div className="cine-top">
        <span className="cine-kicker">ACT {act.roman} · {act.title}</span>
        <button className="cine-exit" onClick={onExit} title="Exit cinematic (Esc)"><X size={16} /> Exit</button>
      </div>

      <div className="cine-reactor">
        <CoreSlot state={c.state.core} product={c.state.product} progress={c.progress} reducedMotion={c.state.mode === 'paused'} />
      </div>

      <div className="cine-narr">
        <div className="cine-idea">{scene.idea}</div>
        <KaraokeLine audio={c.audioEl} text={scene.narration} playing={c.playing} className="cine-kara" />
        <div className="cine-speaker">
          <i className={scene.voice} />{scene.voice === 'KF' ? 'KF · Specialist' : 'JM · Jarvis'}
        </div>
      </div>

      <footer className="cine-transport">
        <div className="cine-ctrl">
          <button onClick={c.prev} title="Previous (←)"><SkipBack size={17} /></button>
          <button className="cine-play" onClick={c.toggle} title="Play / Pause (Space)">{c.playing ? <Pause size={19} /> : <Play size={19} />}</button>
          <button onClick={c.next} title="Next (→)"><SkipForward size={17} /></button>
          <button onClick={c.replay} title="Replay"><RotateCcw size={15} /></button>
        </div>
        <div className="cine-rail">
          {ACT_SEGMENTS.map(seg => (
            <div key={seg.act} className={'cine-seg' + (c.scene.act === seg.act ? ' on' : c.scene.act > seg.act ? ' past' : '')}
              style={{ ['--seg-accent' as string]: ACTS[seg.act as 1].accent }} title={`Act ${ACTS[seg.act as 1].roman}`} />
          ))}
        </div>
        <span className="cine-count">{String(c.index + 1).padStart(2, '0')} / {c.total}</span>
      </footer>
    </div>
  )
}

const ACT_SEGMENTS = [1, 2, 3, 4, 5, 6, 7].map(a => ({ act: a }))
