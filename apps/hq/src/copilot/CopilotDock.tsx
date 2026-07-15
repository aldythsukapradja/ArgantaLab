import { Hand, HelpCircle, Mic } from 'lucide-react'
import type { VoiceStatus } from './useVoice'
import type { GestureStatus } from './useGesture'
import './copilot.css'

// ─────────────────────────────────────────────────────────────────────────
// CopilotDock — the persistent voice/gesture control. Always visible (except
// on the immersive orb home, which has its own centre mic) so voice + gesture
// are reachable from every surface. Lives embedded in the Rail sidebar
// (`inline`), right above the operator's name — not floating over content.
// ─────────────────────────────────────────────────────────────────────────

export interface CopilotDockProps {
  armed: boolean
  voiceStatus: VoiceStatus
  gestureActive: boolean
  gestureLoading: boolean
  gestureStatus: GestureStatus
  onToggleVoice: () => void
  onToggleGesture: () => void
  onOpenHelp: () => void
  /** Render embedded in a sidebar (Rail) instead of as a floating pill. */
  inline?: boolean
}

export function CopilotDock({
  armed, voiceStatus, gestureActive, gestureLoading, gestureStatus,
  onToggleVoice, onToggleGesture, onOpenHelp, inline = false,
}: CopilotDockProps) {
  const voiceUnsupported = voiceStatus === 'unsupported'
  const gestureUnsupported = gestureStatus === 'unsupported'
  return (
    <div className={inline ? 'cp-dock cp-dock-inline' : 'cp-dock'} role="toolbar" aria-label="Jarvis copilot">
      <button
        className={`cp-dock-mic ${armed ? 'is-on' : ''} ${voiceStatus === 'denied' ? 'is-warn' : ''}`}
        onClick={onToggleVoice} disabled={voiceUnsupported} aria-pressed={armed}
        aria-label={voiceUnsupported ? 'Voice not supported' : armed ? 'Stop voice commands' : 'Start voice commands'}
        title={voiceStatus === 'denied' ? 'Microphone permission denied' : armed ? 'Listening — click to stop' : 'Voice commands'}>
        <span className="cp-dock-ring" aria-hidden="true" />
        <Mic size={18} />
      </button>

      {!gestureUnsupported && (
        <button
          className={`cp-dock-btn ${gestureActive ? 'is-on' : ''}`}
          onClick={onToggleGesture} aria-pressed={gestureActive}
          aria-label={gestureActive ? 'Turn off hand gesture' : 'Turn on hand gesture'}
          title={gestureActive ? 'Hand gesture on — swipe / pinch' : gestureLoading ? 'Loading hand model…' : 'Hand gesture (camera)'}>
          <Hand size={16} className={gestureLoading ? 'spin' : ''} />
        </button>
      )}

      <button className="cp-dock-btn" onClick={onOpenHelp} aria-label="Voice & gesture commands" title="Voice & gesture commands">
        <HelpCircle size={16} />
      </button>
    </div>
  )
}
