// C4b Step 3 — the milestone: real loadMessages/sendMessage turn loop wired
// into the UI. Composer here is a minimal working input (full richness —
// tier pill, mic, stop button, auto-grow — arrives at Step 6).
import { useEffect, useRef, useState } from 'react'
import { loadMessages, sendMessage, type CoreMessage } from '../../lib/core'
import { UserMessage, AssistantMessage } from './Message'

const THINKING_LONG_MS = 8000

export function Conversation({ threadId, onThreadCreated, maxCostClass: _maxCostClass, onArtifact, compact }: {
  threadId: string | null
  onThreadCreated: (id: string) => void
  /** Ceiling for the composer's tier pill — wired at Step 6. */
  maxCostClass: number
  onArtifact?: (a: { assetId: string; kind: string }) => void
  compact?: boolean
}) {
  const [messages, setMessages] = useState<CoreMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [thinkingLong, setThinkingLong] = useState(false)
  const [lastProvenance, setLastProvenance] = useState<{ provider: string | null; model: string | null } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!threadId) { setMessages([]); return }
    let active = true
    loadMessages(threadId).then(rows => { if (active) setMessages(rows) })
    return () => { active = false }
  }, [threadId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    setSending(true)
    setThinkingLong(false)
    thinkingTimerRef.current = setTimeout(() => setThinkingLong(true), THINKING_LONG_MS)

    let tid = threadId
    if (!tid) {
      const { createThread } = await import('../../lib/core')
      tid = await createThread(text.slice(0, 60))
      if (tid) onThreadCreated(tid)
    }
    if (!tid) { setSending(false); return }

    // optimistic user bubble
    setMessages(m => [...m, { id: crypto.randomUUID(), threadId: tid!, role: 'user', content: text, blocks: [], toolCalls: [], runId: null, createdAt: new Date().toISOString() }])

    const result = await sendMessage(tid, text)
    if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current)
    setThinkingLong(false)
    setSending(false)
    setLastProvenance({ provider: result.provider, model: result.model })

    const fresh = await loadMessages(tid)
    setMessages(fresh)

    if (onArtifact) {
      for (const b of result.blocks as any[]) {
        if (b.assetId) onArtifact({ assetId: b.assetId, kind: b.kind })
      }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const isEmpty = messages.length === 0 && !sending

  return (
    <div className={'core-convo' + (compact ? ' core-convo-compact' : '')}>
      <div className="core-convo-scroll" ref={scrollRef}>
        {isEmpty ? (
          <div className="core-convo-empty">
            <div className="core-hero-orb-slot" aria-hidden="true" />
            <p className="core-empty-copy">
              I'm Arganta Core. I can make images, voice, websites, decks, brand kits and charts — for real, on your own infrastructure.
            </p>
          </div>
        ) : (
          <div className="core-convo-col">
            {messages.map((m, i) => {
              if (m.role === 'user') return <UserMessage key={m.id} text={m.content} />
              if (m.role === 'assistant') {
                const isLast = i === messages.length - 1
                return (
                  <AssistantMessage
                    key={m.id} message={m}
                    provider={isLast ? lastProvenance?.provider : undefined}
                    model={isLast ? lastProvenance?.model : undefined}
                    streaming={isLast}
                  />
                )
              }
              return null
            })}
            {sending && (
              <div className="core-msg core-msg-assistant">
                <div className="core-avatar" aria-hidden="true" />
                <div className="core-msg-body">
                  <div className="core-thinking mono">
                    {thinkingLong ? 'Still working — the free tier is slow, not stuck.' : 'thinking…'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="core-composer">
        <div className="core-composer-field">
          <input
            className="core-composer-input"
            placeholder="Message Arganta Core…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
          />
          <button className="core-composer-send" onClick={send} disabled={sending || !draft.trim()} aria-label="Send">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5 L13 7.5 M8 2.5 L13 7.5 L8 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
