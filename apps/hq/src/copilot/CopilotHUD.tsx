import { useEffect, useMemo, useRef, useState } from 'react'
import { Hand, Mic, Volume2, VolumeX } from 'lucide-react'
import type { IntentSpec } from './intents'
import './copilot.css'

// ─────────────────────────────────────────────────────────────────────────
// CopilotHUD — the "the system is working" panel. Rises above the mic while
// the voice mic is armed or the gesture camera is active. Shows a live
// waveform (mic amplitude), the interim transcript as you speak, the last
// recognized command, and gesture state (loading / hand-seen / last swipe).
// ─────────────────────────────────────────────────────────────────────────

const BAR_COUNT = 28
// Static per-bar envelope so the waveform reads like a voiceprint (tall in the
// middle, short at the edges) rather than a flat block.
const BAR_ENVELOPE = Array.from({ length: BAR_COUNT }, (_, i) => {
  const x = (i / (BAR_COUNT - 1)) * 2 - 1 // -1..1
  return 0.35 + 0.65 * Math.cos(x * 1.5) ** 2
})

function Waveform({ amplitude }: { amplitude: number }) {
  // Jitter each bar a little per frame so it feels alive even at steady volume.
  const [seed, setSeed] = useState(0)
  useEffect(() => {
    let raf = 0
    const loop = () => { setSeed(s => s + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="cp-wave" aria-hidden="true">
      {BAR_ENVELOPE.map((env, i) => {
        const jitter = 0.7 + 0.3 * Math.abs(Math.sin(seed * 0.15 + i * 0.9))
        const h = 8 + amplitude * 100 * env * jitter
        return <span key={i} style={{ height: `${Math.min(100, h)}%` }} />
      })}
    </div>
  )
}

export interface CopilotHUDProps {
  voiceArmed: boolean
  voiceStatus: string
  amplitude: number
  interim: string
  lastIntent: IntentSpec | null
  muted: boolean
  onToggleMute: () => void
  gestureActive: boolean
  gestureLoading: boolean
  handDetected: boolean
  lastSwipe: { dir: 'left' | 'right'; at: number } | null
  /** Where the HUD anchors: 'center' (orb home) or 'left' (global, above the dock). */
  corner?: 'center' | 'left'
}

export function CopilotHUD({
  voiceArmed, voiceStatus, amplitude, interim, lastIntent, muted, onToggleMute,
  gestureActive, gestureLoading, handDetected, lastSwipe, corner = 'center',
}: CopilotHUDProps) {
  const open = voiceArmed || gestureActive || gestureLoading
  // Hold the matched-command label briefly after it fires.
  const [flashLabel, setFlashLabel] = useState<string | null>(null)
  const lastIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (lastIntent && lastIntent.id !== lastIdRef.current) {
      lastIdRef.current = lastIntent.id
      setFlashLabel(lastIntent.label)
      const t = setTimeout(() => setFlashLabel(null), 2200)
      return () => clearTimeout(t)
    }
  }, [lastIntent])

  const swipeFresh = lastSwipe && Date.now() - lastSwipe.at < 900
  const status = useMemo(() => {
    if (flashLabel) return { cls: 'ok', text: flashLabel }
    if (interim) return { cls: 'hearing', text: interim }
    if (voiceArmed) return { cls: 'idle', text: 'Listening…' }
    if (gestureLoading) return { cls: 'idle', text: 'Loading hand model…' }
    if (gestureActive) return { cls: 'idle', text: handDetected ? 'Hand ready — swipe or pinch' : 'Show your hand' }
    return { cls: 'idle', text: '' }
  }, [flashLabel, interim, voiceArmed, gestureLoading, gestureActive, handDetected])

  if (!open) return null

  return (
    <div className={`cp-hud cp-hud-${corner} ${open ? 'is-open' : ''}`} role="status" aria-live="polite">
      <div className="cp-hud-inner">
        {voiceArmed && (
          <span className={`cp-badge ${voiceStatus === 'denied' ? 'warn' : 'live'}`}><Mic size={12} /></span>
        )}
        {(gestureActive || gestureLoading) && (
          <span className={`cp-badge ${gestureLoading ? 'idle' : handDetected ? 'live' : 'dim'}`}><Hand size={12} /></span>
        )}

        {voiceArmed && <Waveform amplitude={amplitude} />}

        <div className={`cp-transcript cp-${status.cls}`}>
          {status.text || <i className="cp-ph">Say “open portfolio”, “activate”, “help”…</i>}
        </div>

        {swipeFresh && <span className={`cp-swipe cp-swipe-${lastSwipe!.dir}`}>{lastSwipe!.dir === 'left' ? '‹' : '›'}</span>}

        {voiceArmed && (
          <button className="cp-mute" onClick={onToggleMute} aria-label={muted ? 'Unmute Jarvis replies' : 'Mute Jarvis replies'}
            title={muted ? 'Unmute replies' : 'Mute replies'}>
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}
