import { useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────
// useGesture — swipe + pinch hand tracking.
//
// Two gestures only: a horizontal swipe (reports 'left' | 'right') and a
// pinch (thumb+index tip closing) as a single 'close' trigger. No orb
// control, no landmark rendering. The model + WASM runtime are self-hosted
// under public/mediapipe (see docs/voice-gesture-copilot.md) — never fetched
// from a CDN, so this keeps working under the app's offline launch config.
//
// Off by default. Camera only opens when `active` is explicitly toggled on
// by the user. Detection runs at ~15fps against a hidden <video> element;
// nothing is ever painted to screen.
// ─────────────────────────────────────────────────────────────────────────

const MODEL_URL = '/mediapipe/hand_landmarker.task'
const WASM_DIR = '/mediapipe/wasm'
const DETECT_INTERVAL_MS = 66 // ~15fps
const SWIPE_WINDOW_MS = 350

export type GestureStatus = 'unsupported' | 'idle' | 'loading' | 'active' | 'denied'

export interface GestureHandlers {
  onSwipe: (dir: 'left' | 'right') => void
  /** Pinch (thumb+index close together) — used as a universal "close" gesture. */
  onPinch?: () => void
}

/**
 * Tunable thresholds — the "honest subset" of gesture config (P4). There are
 * only two real gestures (swipe, pinch); this tunes their sensitivity/timing
 * rather than pretending to offer arbitrary gesture→action mapping. Defaults
 * match the original hardcoded values.
 */
export interface GestureSettings {
  swipeEnabled: boolean
  pinchEnabled: boolean
  /** Fraction of frame width the palm must travel to register a swipe. Lower = more sensitive. */
  swipeThreshold: number
  swipeCooldownMs: number
  /** thumb↔index distance / hand-span ratio below which counts as pinched. Higher = easier to trigger. */
  pinchRatio: number
  pinchCooldownMs: number
  /** Flip left/right if the mirrored convention feels backwards on your setup. */
  invertSwipe: boolean
}

export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  swipeEnabled: true, pinchEnabled: true,
  swipeThreshold: 0.16, swipeCooldownMs: 700,
  pinchRatio: 0.35, pinchCooldownMs: 900,
  invertSwipe: false,
}

function isSupported() {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof WebAssembly !== 'undefined'
}

function dist2D(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function useGesture(
  handlers: GestureHandlers,
  opts: { reducedMotion?: boolean; settings?: Partial<GestureSettings> } = {},
) {
  const [status, setStatus] = useState<GestureStatus>(() => (isSupported() && !opts.reducedMotion ? 'idle' : 'unsupported'))
  const [handDetected, setHandDetected] = useState(false)   // live "your hand is seen" signal for the HUD
  const [lastSwipe, setLastSwipe] = useState<{ dir: 'left' | 'right'; at: number } | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<any>(null)
  const timerRef = useRef<number | null>(null)
  const activeRef = useRef(false)
  const historyRef = useRef<{ x: number; t: number }[]>([])
  const lastSwipeRef = useRef(0)
  const pinchingRef = useRef(false)
  const lastPinchRef = useRef(0)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  // Live-tunable — the control tab can change these without restarting the camera.
  const settingsRef = useRef<GestureSettings>({ ...DEFAULT_GESTURE_SETTINGS, ...opts.settings })
  settingsRef.current = { ...DEFAULT_GESTURE_SETTINGS, ...opts.settings }

  const teardown = useCallback(() => {
    activeRef.current = false
    if (timerRef.current != null) { clearTimeout(timerRef.current); timerRef.current = null }
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (landmarkerRef.current) { landmarkerRef.current.close(); landmarkerRef.current = null }
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current = null }
    historyRef.current = []
    pinchingRef.current = false
  }, [])

  const detectLoop = useCallback(() => {
    if (!activeRef.current) return
    const landmarker = landmarkerRef.current
    const video = videoRef.current
    if (landmarker && video && video.readyState >= 2) {
      const now = performance.now()
      const result = landmarker.detectForVideo(video, now)
      const hand = result?.landmarks?.[0]
      setHandDetected(!!hand)
      if (hand) {
        const s = settingsRef.current
        // Pinch: thumb tip (4) vs index tip (8), scaled by wrist(0)↔middle-MCP(9)
        // so it works the same whether the hand is close to or far from the camera.
        const handSpan = Math.max(0.02, dist2D(hand[0], hand[9]))
        const pinchRatio = dist2D(hand[4], hand[8]) / handSpan
        const isPinching = s.pinchEnabled && pinchRatio < s.pinchRatio
        if (isPinching && !pinchingRef.current && now - lastPinchRef.current > s.pinchCooldownMs) {
          lastPinchRef.current = now
          historyRef.current = [] // a pinch isn't a swipe — don't let the closing hand register as one
          handlersRef.current.onPinch?.()
        }
        pinchingRef.current = isPinching

        if (!isPinching && s.swipeEnabled) {
          // Landmark 9 = middle-finger MCP, a stable palm-center proxy.
          const rawX = hand[9].x
          const history = historyRef.current
          history.push({ x: rawX, t: now })
          while (history.length && now - history[0].t > SWIPE_WINDOW_MS) history.shift()
          if (now - lastSwipeRef.current > s.swipeCooldownMs && history.length >= 2) {
            const delta = history[history.length - 1].x - history[0].x
            if (Math.abs(delta) > s.swipeThreshold) {
              // Camera feed is un-mirrored (raw), but gestures should read like
              // a mirror (selfie convention): the user's physical right hand
              // motion increases rawX toward the camera's own left, so invert
              // by default; `invertSwipe` flips it back if that reads wrong.
              const mirrored: 'left' | 'right' = delta > 0 ? 'left' : 'right'
              const dir = s.invertSwipe ? (mirrored === 'left' ? 'right' : 'left') : mirrored
              lastSwipeRef.current = now
              historyRef.current = []
              setLastSwipe({ dir, at: Date.now() })
              handlersRef.current.onSwipe(dir)
            }
          }
        }
      }
    }
    timerRef.current = window.setTimeout(detectLoop, DETECT_INTERVAL_MS)
  }, [])

  const start = useCallback(async () => {
    if (!isSupported() || opts.reducedMotion) return
    setStatus('loading') // 7.5MB model takes ~1–2s — surface it so the button doesn't read "off"
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      await video.play()

      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(WASM_DIR)
      const landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      })

      streamRef.current = stream
      videoRef.current = video
      landmarkerRef.current = landmarker
      activeRef.current = true
      setStatus('active')
      detectLoop()
    } catch (err: any) {
      teardown()
      setStatus(err?.name === 'NotAllowedError' ? 'denied' : 'idle')
    }
  }, [detectLoop, teardown, opts.reducedMotion])

  const stop = useCallback(() => {
    teardown()
    setHandDetected(false)
    setStatus(prev => (prev === 'unsupported' ? prev : 'idle'))
  }, [teardown])

  const toggle = useCallback(() => {
    if (activeRef.current) stop()
    else void start()
  }, [start, stop])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && activeRef.current) stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [stop])

  useEffect(() => () => teardown(), [teardown])

  return { status, active: status === 'active', loading: status === 'loading', handDetected, lastSwipe, toggle }
}
