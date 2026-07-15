// C4b Step 6 — the composer (C4a §7): auto-grow textarea, Enter/Shift+Enter,
// tier ceiling pill, mic dictation, stop-mid-turn, session cost ticker.
//
// Two honest scope notes:
// - Tier pill is DISPLAY-ONLY (shows the maxCostClass ceiling). Core's
//   orchestrate task requires a Sponsored floor (runtime.ts) and selectModel
//   has no per-call ceiling override today — wiring a real multi-tier
//   selector would mean changing @arganta/ai's routing, out of scope for an
//   additive UI change. A pill that looked selectable but changed nothing
//   would be dishonest, so it's a status chip, not a control, until that
//   routing exists.
// - Mic does NOT reuse copilot's useVoice hook — that hook's onresult
//   immediately matches the transcript against the fixed-phrase intent
//   registry and never returns raw text to its caller, so it can't dictate
//   into a text field. This uses the same underlying Web Speech API in the
//   same lifecycle pattern, parallel to useVoice, not a shared instance.
import { useEffect, useRef, useState } from 'react'
import { CoreOrb } from './CoreOrb'

const TIER_LABEL: Record<number, string> = { 0: 'Sovereign', 1: 'Sponsored', 2: 'Economical', 3: 'Premium' }

function getRecognitionCtor(): (new () => any) | null {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
}

export function Composer({ draft, onDraftChange, onSend, onStop, sending, maxCostClass, sessionCostUsd, sessionRuns }: {
  draft: string
  onDraftChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  sending: boolean
  maxCostClass: number
  sessionCostUsd: number
  sessionRuns: number
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const recRef = useRef<any>(null)
  const [listening, setListening] = useState(false)
  const micSupported = !!getRecognitionCtor()

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 6 * 22 + 16) + 'px'
  }, [draft])

  useEffect(() => () => { recRef.current?.abort?.() }, [])

  const toggleMic = () => {
    if (listening) { recRef.current?.stop?.(); return }
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? ''
      if (transcript) onDraftChange((draft ? draft + ' ' : '') + transcript)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sending) onSend() }
  }

  return (
    <div className="core-composer">
      <div className="core-composer-field">
        <span className="core-tier-pill mono" title="Model tier ceiling for this conversation">
          {TIER_LABEL[maxCostClass] ?? `Tier ${maxCostClass}`}
        </span>
        <textarea
          ref={taRef}
          className="core-composer-input core-composer-textarea"
          placeholder="Message Arganta Core…"
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
        />
        {listening && <CoreOrb state="listening" size="avatar" />}
        {micSupported && (
          <button
            className={'core-composer-mic' + (listening ? ' core-composer-mic-on' : '')}
            onClick={toggleMic}
            aria-label={listening ? 'Stop dictation' : 'Start dictation'}
            title={listening ? 'Listening…' : 'Dictate'}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="5" y="1.5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2.5 7.5a5 5 0 0 0 10 0M7.5 12.5v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {sending ? (
          <button className="core-composer-send core-composer-stop" onClick={onStop} aria-label="Stop">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="0.5" y="0.5" width="10" height="10" rx="1.5" fill="currentColor" /></svg>
          </button>
        ) : (
          <button className="core-composer-send" onClick={onSend} disabled={!draft.trim()} aria-label="Send">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5 L13 7.5 M8 2.5 L13 7.5 L8 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>
      <div className="core-session-ticker mono">
        session · ${sessionCostUsd.toFixed(4)} · {sessionRuns} run{sessionRuns === 1 ? '' : 's'}
      </div>
    </div>
  )
}
