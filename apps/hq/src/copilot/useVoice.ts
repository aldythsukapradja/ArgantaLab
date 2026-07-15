import { useCallback, useEffect, useRef, useState } from 'react'
import { runTranscript, type CopilotActions, type IntentSpec } from './intents'
import type { RegistryEntry } from './registry'
import { playListenChime, playCloseChime, playConfirmTick } from './sfx'
import { speakReply, cancelReply, setReplyMuted, isReplyMuted } from './reply'

// ─────────────────────────────────────────────────────────────────────────
// useVoice — SpeechRecognition adapter for the HQ mic button.
//
// Deterministic command mic: the command set comes from the registry
// (DB-backed, seed fallback), matched by intents.ts. No conversation, no
// cloud STT. While armed, two mic consumers run:
//   1. SpeechRecognition   — transcribes → matches intents. Now with interim
//      results, so the HUD can show partial words as they're spoken.
//   2. getUserMedia + AnalyserNode — a live amplitude reading (0..1) for the
//      orb pulse and the HUD waveform.
//
// On a match Jarvis speaks a reply (reply.ts); while that plays we gate
// matching so the spoken reply can't be re-heard as a command.
//
// Chrome/Edge/Safari-partial only; no Firefox. Secure context required.
// Survives: continuous recognition ends ~every 60s (auto-restart),
// no-speech/aborted are routine, everything torn down on disarm/unmount.
// ─────────────────────────────────────────────────────────────────────────

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
}

export type VoiceStatus = 'unsupported' | 'idle' | 'armed' | 'denied'

export function useVoice(actions: CopilotActions, intents: RegistryEntry[]) {
  const [status, setStatus] = useState<VoiceStatus>(() => (getRecognitionCtor() ? 'idle' : 'unsupported'))
  const [amplitude, setAmplitude] = useState(0)
  const [interim, setInterim] = useState('')            // live partial transcript for the HUD
  const [lastIntent, setLastIntent] = useState<IntentSpec | null>(null)
  const [lastFiredAt, setLastFiredAt] = useState(0)     // bumps on each match, drives the flash overlay
  const [muted, setMuted] = useState(() => isReplyMuted())

  const armedRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const gateUntilRef = useRef(0)                        // suppress matching until this time (reply playing)
  const actionsRef = useRef(actions)
  const intentsRef = useRef(intents)
  intentsRef.current = intents

  const stopAmplitudeLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    analyserRef.current = null
    if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => {})
    audioCtxRef.current = null
    setAmplitude(0)
  }, [])

  const startAmplitudeLoop = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!armedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        if (!armedRef.current || !analyserRef.current) return
        analyserRef.current.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
        const rms = Math.sqrt(sum / data.length)
        setAmplitude(Math.min(1, rms * 4))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // Amplitude is cosmetic — recognition still works without it.
    }
  }, [])

  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    rec.onend = null
    rec.onerror = null
    rec.onresult = null
    rec.abort()
    recognitionRef.current = null
    setInterim('')
  }, [])

  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      const transcript = result?.[0]?.transcript ?? ''
      if (!result?.isFinal) { setInterim(transcript); return }   // live partial → HUD
      setInterim('')
      if (performance.now() < gateUntilRef.current) return       // Jarvis is speaking — ignore echoes
      const spec = runTranscript(transcript, actionsRef.current, intentsRef.current)
      if (spec) {
        setLastIntent(spec)
        setLastFiredAt(Date.now())
        playConfirmTick()
        const entry = intentsRef.current.find(e => e.id === spec.id)
        const gapMs = speakReply(spec.reply, entry?.replyAudioPath ?? null)
        if (gapMs > 0) gateUntilRef.current = performance.now() + gapMs
      }
    }
    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        armedRef.current = false
        setStatus('denied')
        stopAmplitudeLoop()
        return
      }
    }
    rec.onend = () => { if (armedRef.current) rec.start() }
    recognitionRef.current = rec
    rec.start()
  }, [stopAmplitudeLoop])

  const disarm = useCallback(() => {
    const wasArmed = armedRef.current
    armedRef.current = false
    stopRecognition()
    stopAmplitudeLoop()
    cancelReply()
    setStatus(prev => (prev === 'unsupported' ? prev : 'idle'))
    if (wasArmed) playCloseChime()
  }, [stopRecognition, stopAmplitudeLoop])

  const arm = useCallback(() => {
    if (!getRecognitionCtor()) return
    armedRef.current = true
    setStatus('armed')
    playListenChime()
    startRecognition()
    void startAmplitudeLoop()
  }, [startRecognition, startAmplitudeLoop])

  const toggle = useCallback(() => {
    if (armedRef.current) disarm()
    else arm()
  }, [arm, disarm])

  const toggleMute = useCallback(() => {
    setMuted(prev => { const next = !prev; setReplyMuted(next); if (next) cancelReply(); return next })
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (armedRef.current) { stopRecognition(); stopAmplitudeLoop() }
      } else if (armedRef.current && !recognitionRef.current) {
        startRecognition()
        void startAmplitudeLoop()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [startRecognition, startAmplitudeLoop, stopRecognition, stopAmplitudeLoop])

  // Inject the real disarm so the "stop listening" command can reach this hook.
  const actionsWithDisarm = useRef(actions)
  actionsWithDisarm.current = { ...actions, disarm }
  actionsRef.current = actionsWithDisarm.current

  useEffect(() => () => { armedRef.current = false; stopRecognition(); stopAmplitudeLoop(); cancelReply() }, [stopRecognition, stopAmplitudeLoop])

  return { status, amplitude, interim, lastIntent, lastFiredAt, muted, armed: status === 'armed', toggle, toggleMute }
}
