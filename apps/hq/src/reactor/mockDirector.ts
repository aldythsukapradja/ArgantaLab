import { useEffect, useRef, useState } from 'react'
import type {
  ChoreographyId, CoreState, ProductId, SceneState, SignalState, Speaker,
} from './contract'
import { DEFAULT_CHOREOGRAPHY } from './contract'

// ─────────────────────────────────────────────────────────────────────────
// Mock Cinema Director.
//
// Stands in for WS1 until the real Director exists. Walks a compressed but
// faithful Act I→VII tour of the 46-scene manifest so the 3D core can be
// built and demoed against every semantic state before any audio is wired.
// The real Director will emit the identical SceneState shape — swapping it in
// requires no change to any core.
// ─────────────────────────────────────────────────────────────────────────

interface Beat {
  state: CoreState
  /** Mock duration in seconds (the real clock = clip length). */
  dur: number
  choreography?: ChoreographyId
  focusProduct?: ProductId
  speaker?: Speaker
  signal?: SignalState
  /** Scene key echoing the manifest, for timeline/media alignment. */
  sceneId?: string
}

const PRODUCTS: ProductId[] = ['arganta', 'kinetik', 'lashira', 'hq', 'landing']

// One representative beat per manifest movement. Product-focus repeats per
// product (Act III's 25 clips collapse to 5 focus beats for the demo).
const SCRIPT: Beat[] = [
  { state: 'offline', dur: 1.6, signal: 'offline', sceneId: '0.0' },
  { state: 'booting', dur: 3.0, signal: 'partial', sceneId: '1.1' },
  { state: 'idle', dur: 2.4, signal: 'live', sceneId: '1.3' },
  { state: 'jarvis-speaking', dur: 3.6, signal: 'live', sceneId: '2.1' },
  ...PRODUCTS.map((p, i): Beat => ({
    state: 'product-focus',
    dur: 3.0,
    focusProduct: p,
    speaker: 'jarvis',
    signal: 'live',
    sceneId: `3.${i * 5 + 1}`,
  })),
  { state: 'think', dur: 2.8, choreography: 'triad', speaker: 'jarvis', signal: 'live', sceneId: '4.2' },
  { state: 'know', dur: 2.8, choreography: 'triad', speaker: 'jarvis', signal: 'live', sceneId: '4.3' },
  { state: 'do', dur: 2.8, choreography: 'triad', speaker: 'jarvis', signal: 'live', sceneId: '4.4' },
  { state: 'architecture-unfold', dur: 5.2, choreography: 'axial', speaker: 'jarvis', signal: 'live', sceneId: '5.3' },
  { state: 'vault-entry', dur: 3.0, choreography: 'helix', speaker: 'jarvis', signal: 'live', sceneId: '6.3' },
  { state: 'do', dur: 3.0, choreography: 'triad', speaker: 'jarvis', signal: 'partial', sceneId: '6.5' },
  { state: 'return', dur: 3.4, speaker: 'jarvis', signal: 'live', sceneId: '7.1' },
]

const TOTAL = SCRIPT.reduce((sum, beat) => sum + beat.dur, 0)

/** A voice-like 0..1 energy envelope — layered sines, no true randomness. */
function voiceEnvelope(t: number): number {
  const a = 0.5 + 0.5 * Math.sin(t * 7.1)
  const b = 0.5 + 0.5 * Math.sin(t * 13.7 + 1.3)
  const c = 0.5 + 0.5 * Math.sin(t * 2.9 + 0.6)
  return 0.35 + 0.6 * (a * 0.5 + b * 0.3 + c * 0.2)
}

function intensityFor(beat: Beat, localTime: number): number {
  switch (beat.state) {
    case 'offline':
      return 0.06
    case 'booting':
      return Math.min(0.85, (localTime / beat.dur) * 0.9)
    case 'idle':
      return 0.3 + 0.05 * Math.sin(localTime * 1.6)
    case 'listening':
      return 0.42 + 0.08 * Math.sin(localTime * 2.2)
    case 'jarvis-speaking':
    case 'specialist-speaking':
    case 'product-focus':
      return voiceEnvelope(localTime)
    case 'think':
    case 'know':
    case 'do':
      return 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(localTime * 4))
    case 'architecture-unfold':
      return 0.85
    case 'vault-entry':
      return 0.7 + 0.1 * Math.sin(localTime * 3)
    case 'return':
      return Math.max(0.32, 0.85 - (localTime / beat.dur) * 0.5)
    default:
      return 0.4
  }
}

/** Pure sampler — the SceneState at absolute demo time `t` (loops). */
export function mockSceneAt(t: number, reducedMotion = false): SceneState {
  const looped = ((t % TOTAL) + TOTAL) % TOTAL
  let acc = 0
  let beat = SCRIPT[SCRIPT.length - 1]
  let localTime = 0
  for (const candidate of SCRIPT) {
    if (looped < acc + candidate.dur) {
      beat = candidate
      localTime = looped - acc
      break
    }
    acc += candidate.dur
  }
  return {
    state: beat.state,
    intensity: reducedMotion ? 0.45 : intensityFor(beat, localTime),
    speaker: beat.speaker ?? null,
    focusProduct: beat.focusProduct ?? null,
    choreography: beat.choreography ?? DEFAULT_CHOREOGRAPHY[beat.state],
    signal: beat.signal ?? 'offline',
    reducedMotion,
    sceneTime: localTime,
    sceneDuration: beat.dur,
    sceneId: beat.sceneId,
  }
}

export const MOCK_TOTAL_SECONDS = TOTAL

/**
 * Ticking hook driving the demo harness. `speed` scales time; `paused` holds
 * the current beat; `override` pins one state for inspection.
 */
export function useMockDirector(options: {
  speed?: number
  paused?: boolean
  override?: CoreState | null
  reducedMotion?: boolean
} = {}): SceneState {
  const { speed = 1, paused = false, override = null, reducedMotion = false } = options
  const [scene, setScene] = useState<SceneState>(() => mockSceneAt(0, reducedMotion))
  const clock = useRef(0)
  const last = useRef<number | null>(null)

  useEffect(() => {
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (last.current === null) last.current = now
      const dt = (now - last.current) / 1000
      last.current = now
      if (!paused) clock.current += dt * speed
      if (override) {
        // Pin the chosen state but keep a live intensity pulse.
        const base = mockSceneAt(clock.current, reducedMotion)
        setScene({ ...base, state: override, choreography: DEFAULT_CHOREOGRAPHY[override] })
      } else {
        setScene(mockSceneAt(clock.current, reducedMotion))
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      last.current = null
    }
  }, [speed, paused, override, reducedMotion])

  return scene
}
