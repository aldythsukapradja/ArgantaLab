// GB-4 · The chat rail — the Lovable loop. First message builds, every message
// after that revises. See useForge.ts's header for why this calls builder-core
// directly instead of routing through the Core agent loop.
import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Sparkles } from 'lucide-react'
import type { ForgeTurn } from './useForge'

interface Props {
  turns: ForgeTurn[]
  busy: boolean
  /** Empty canvas → the composer's language switches from "revise" to "build". */
  hasArtifact: boolean
  placeholder: string
  onSend: (text: string) => void
}

export function ChatRail({ turns, busy, hasArtifact, placeholder, onSend }: Props) {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [turns])

  // Grow the composer with the draft, capped by CSS max-height.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [draft])

  const submit = () => {
    const t = draft.trim()
    if (!t || busy) return
    onSend(t)
    setDraft('')
  }

  return (
    <div className="forge-rail">
      <div className="forge-turns">
        {turns.length === 0 && (
          <div className="forge-turn system">
            <div className="bubble" style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
              <Sparkles size={13} style={{ flexShrink: 0, marginTop: 2, color: 'var(--acc)' }} />
              <span>
                Describe what you want and I'll build it. After that, just say what to change —
                <b> "make the header dark"</b>, <b>"add a leaderboard"</b> — and I'll ship a new version.
              </span>
            </div>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} className={`forge-turn ${t.role}${t.tone && t.tone !== 'ok' ? ` ${t.tone}` : ''}`}>
            <div className="bubble">
              {t.pending ? (
                <span className="row" style={{ gap: 7 }}>
                  {t.text}
                  <span className="forge-dots"><i className="forge-dot" /><i className="forge-dot" /><i className="forge-dot" /></span>
                </span>
              ) : t.text}
            </div>
            {t.version != null && !t.pending && <span className="meta">v{t.version}</span>}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="forge-composer">
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
          }}
          placeholder={hasArtifact ? 'What should I change?' : placeholder}
          aria-label={hasArtifact ? 'Describe a change' : 'Describe what to build'}
          disabled={busy}
        />
        <div className="row">
          <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
            {busy ? 'Working…' : 'Enter to send · Shift+Enter for a new line'}
          </span>
          <button
            className="forge-btn primary"
            onClick={submit}
            disabled={!draft.trim() || busy}
            aria-label={hasArtifact ? 'Send revision' : 'Build it'}
            style={{ padding: '6px 11px' }}
          >
            <ArrowUp size={13} /> {hasArtifact ? 'Send' : 'Build'}
          </button>
        </div>
      </div>
    </div>
  )
}
