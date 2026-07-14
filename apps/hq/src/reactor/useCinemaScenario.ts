import { useEffect, useRef, useState } from 'react'
import { SCENES, NARRATION } from '../cinema/scenario'
import { deriveState } from '../cinema/deriveState'
import { DEFAULT_CHOREOGRAPHY, type SceneState } from './contract'

// ─────────────────────────────────────────────────────────────────────────
// useCinemaScenario — READ-ONLY driver over the real 46-scene narrative.
//
// It reuses WS1's canonical SCENES + deriveState (never mutating them) so the
// Reactor Builder plays the exact same story the cinema does, start to finish,
// all 46 clips in order. It only reads; it never authors or advances WS1.
//
// Two ways to run:
//   • silent  — scenes advance on a narration-paced timer (no audio needed)
//   • audio   — plays the recorded MP3 per scene, advancing on `ended`
// Either way it emits the reactor's SceneState; the orb breathes whenever a
// voice is narrating (speaker != null).
// ─────────────────────────────────────────────────────────────────────────

export interface CinemaFrame {
  scene: SceneState
  index: number
  total: number
  title: string
  idea: string
  narration: string
  act: number
}

/** Narration-paced duration (s) for silent mode — ~2.6 words/sec, clamped. */
function silentDuration(sceneId: string): number {
  const words = (NARRATION[sceneId] ?? '').trim().split(/\s+/).filter(Boolean).length
  if (!words) return 4.5
  return Math.min(11, Math.max(3.8, words / 2.6))
}

function frameFor(index: number, progress: number, playing: boolean): CinemaFrame {
  const s = SCENES[index]
  const cine = deriveState(s, 'auto', progress)
  // Jarvis (JM) vs the female specialist voice (KF); speaking only while playing.
  const speaker = playing ? (s.voice === 'KF' ? 'specialist' : 'jarvis') : null
  const scene: SceneState = {
    state: cine.core,
    intensity: 0.7,
    speaker,
    focusProduct: s.product ?? null,
    choreography: DEFAULT_CHOREOGRAPHY[cine.core],
    signal: 'live',
    reducedMotion: false,
    sceneTime: progress,
    sceneDuration: silentDuration(s.id),
    sceneId: s.id,
  }
  return { scene, index, total: SCENES.length, title: s.title, idea: s.idea, narration: NARRATION[s.id] ?? s.idea, act: s.act }
}

export function useCinemaScenario(options: {
  playing?: boolean
  speed?: number
  withAudio?: boolean
} = {}): CinemaFrame & { goto: (i: number) => void } {
  const { playing = true, speed = 1, withAudio = false } = options
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const startRef = useRef<number>(performance.now())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Silent (timer) advancement.
  useEffect(() => {
    if (withAudio) return
    let raf = 0
    startRef.current = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (!playing) { startRef.current = now - progress * silentDuration(SCENES[index].id) * 1000; return }
      const dur = silentDuration(SCENES[index].id) * 1000 / speed
      const p = Math.min(1, (now - startRef.current) / dur)
      setProgress(p)
      if (p >= 1) { setIndex(i => (i + 1) % SCENES.length); startRef.current = now; setProgress(0) }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing, speed, withAudio])

  // Audio-driven advancement.
  useEffect(() => {
    if (!withAudio) { audioRef.current?.pause(); audioRef.current = null; return }
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio
    audio.src = `/audio/${SCENES[index].file}`
    audio.playbackRate = speed
    const onEnd = () => { setIndex(i => (i + 1) % SCENES.length); setProgress(0) }
    const onTime = () => { if (audio.duration) setProgress(Math.min(1, audio.currentTime / audio.duration)) }
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('timeupdate', onTime)
    if (playing) audio.play().catch(() => { /* needs a user gesture; the Play button is one */ })
    else audio.pause()
    return () => { audio.removeEventListener('ended', onEnd); audio.removeEventListener('timeupdate', onTime) }
  }, [index, playing, speed, withAudio])

  useEffect(() => () => { audioRef.current?.pause() }, [])

  return { ...frameFor(index, progress, playing), goto: (i: number) => { setIndex(((i % SCENES.length) + SCENES.length) % SCENES.length); setProgress(0); startRef.current = performance.now() } }
}
