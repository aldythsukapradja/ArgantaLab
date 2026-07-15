// The Director runtime — audio is the master clock. No timers advance scenes;
// they advance on the real <audio> `ended` event. Single index = the whole state.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Mode, SceneState } from './contract'
import { SCENES } from './scenario'
import { deriveState } from './deriveState'
import { resolveAudioSrc } from './store'

export interface CinemaApi {
  index: number
  mode: Mode
  progress: number
  playing: boolean
  audioEl: HTMLAudioElement | null // exposed for real-time karaoke sampling
  duration: number                 // seconds, 0 until metadata loads
  scene: typeof SCENES[number]
  state: SceneState
  total: number
  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  jump: (i: number) => void
  startAuto: () => void
  startGuided: () => void
  replay: () => void
  reload: (autoplay?: boolean) => void
}

export function useCinema(): CinemaApi {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('guided')
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const modeRef = useRef(mode)
  modeRef.current = mode

  // one reusable audio element
  useEffect(() => {
    const a = new Audio()
    a.preload = 'metadata'
    audioRef.current = a
    const onTime = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setProgress(a.currentTime / a.duration)
    }
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      if (modeRef.current === 'auto') setIndex(i => (i < SCENES.length - 1 ? i + 1 : i))
    }
    const onError = () => setPlaying(false)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('durationchange', onMeta)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', onEnded)
    a.addEventListener('error', onError)
    return () => {
      a.pause()
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('durationchange', onMeta)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('error', onError)
    }
  }, [])

  // load + (optionally) play whenever the scene changes
  const load = useCallback((i: number, autoplay: boolean) => {
    const a = audioRef.current
    if (!a) return
    setProgress(0)
    a.src = resolveAudioSrc(SCENES[i].id) // honours an audio replacement
    a.load()
    if (autoplay) a.play().catch(() => {/* NotAllowedError: needs a gesture */})
  }, [])
  const reload = useCallback((autoplay = false) => { load(index, autoplay) }, [index, load])

  useEffect(() => { load(index, playing || modeRef.current === 'auto') }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(() => { audioRef.current?.play().catch(() => {}) }, [])
  const pause = useCallback(() => { audioRef.current?.pause(); setMode(m => (m === 'auto' ? 'paused' : m)) }, [])
  // Pressing play = continuous playback: it starts Auto so the story advances
  // across all scenes on the audio clock (this is what "auto play" means).
  const startAuto = useCallback(() => {
    setMode('auto')
    // if we finished on the last scene, restart from the top
    const at = (audioRef.current?.ended && index === SCENES.length - 1) ? 0 : index
    if (at !== index) setIndex(at); else load(index, true)
  }, [index, load])
  const toggle = useCallback(() => {
    const a = audioRef.current; if (!a) return
    if (a.paused) startAuto(); else pause()
  }, [startAuto, pause])
  // Jumping/skipping keeps the current mode — Auto keeps rolling through to the
  // end until the founder explicitly pauses; the load effect autoplays the new
  // scene whenever we're playing or in Auto.
  const jump = useCallback((i: number) => { setIndex(Math.max(0, Math.min(SCENES.length - 1, i))) }, [])
  const next = useCallback(() => jump(index + 1), [index, jump])
  const prev = useCallback(() => jump(index - 1), [index, jump])
  const startGuided = useCallback(() => { setMode('guided'); load(index, true) }, [index, load])
  const replay = useCallback(() => { const a = audioRef.current; if (a) { a.currentTime = 0; a.play().catch(() => {}) } }, [])

  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __cinema?: unknown }).__cinema = { mode: () => modeRef.current, audio: () => audioRef.current, jump: (i: number) => setIndex(Math.max(0, Math.min(SCENES.length - 1, i))) } }, [])

  const scene = SCENES[index]
  const state = useMemo(() => deriveState(scene, mode, progress), [scene, mode, progress])

  return { index, mode, progress, playing, audioEl: audioRef.current, duration, scene, state, total: SCENES.length,
    play, pause, toggle, next, prev, jump, startAuto, startGuided, replay, reload }
}
