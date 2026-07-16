// C4b — real loadMessages/sendMessage turn loop wired into the UI, plus the
// full Step 6 composer (tier pill, mic dictation, stop button, session cost).
import { useEffect, useRef, useState } from 'react'
import { loadMessages, sendMessage, type CoreMessage } from '../../lib/core'
import { UserMessage, AssistantMessage } from './Message'
import { CoreOrb } from './CoreOrb'
import { Composer } from './Composer'
import { useCoreStatus } from './useCoreStatus'

const ERROR_STOP_REASONS = new Set(['error', 'no-model'])
// artifact block kinds — a turn that produced one of these did real work, so a
// no-model/max-steps stop is a partial success, not a hard error (don't paint it red).
const ARTIFACT_KINDS = new Set(['image', 'audio', 'website', 'deck', 'brand', 'chart'])

const THINKING_LONG_MS = 8000

const STARTER_CHIPS = [
  'Make a brand kit for…',
  "Chart this week's growth",
  'Generate an image of…',
  'Draft a landing page',
]

export function Conversation({ threadId, onThreadCreated, onArtifact, compact, hasThreads }: {
  threadId: string | null
  onThreadCreated: (id: string) => void
  /** Accepted for compatibility with the mount contract; the composer now shows
   * a live model picker instead of a static tier ceiling, so it's unused here. */
  maxCostClass?: number
  onArtifact?: (a: { assetId: string; kind: string }) => void
  compact?: boolean
  /** Whether any thread exists yet — distinguishes first-open from new-thread copy (C4a §5). */
  hasThreads?: boolean
}) {
  const [messages, setMessages] = useState<CoreMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [thinkingLong, setThinkingLong] = useState(false)
  const [lastProvenance, setLastProvenance] = useState<{ provider: string | null; model: string | null; errored: boolean } | null>(null)
  const [sessionCostUsd, setSessionCostUsd] = useState(0)
  const [sessionRuns, setSessionRuns] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
    const controller = new AbortController()
    abortRef.current = controller

    let tid = threadId
    if (!tid) {
      const { createThread } = await import('../../lib/core')
      tid = await createThread(text.slice(0, 60))
      if (tid) onThreadCreated(tid)
    }
    if (!tid) { setSending(false); return }

    // optimistic user bubble
    setMessages(m => [...m, { id: crypto.randomUUID(), threadId: tid!, role: 'user', content: text, blocks: [], toolCalls: [], runId: null, createdAt: new Date().toISOString() }])

    const result = await sendMessage(tid, text, { signal: controller.signal })
    abortRef.current = null
    if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current)
    setThinkingLong(false)
    setSending(false)
    const producedArtifact = (result.blocks as any[]).some(b => ARTIFACT_KINDS.has(b.kind))
    setLastProvenance({ provider: result.provider, model: result.model, errored: ERROR_STOP_REASONS.has(result.stopReason) && !producedArtifact })
    setSessionCostUsd(c => c + result.costUsd)
    setSessionRuns(n => n + 1)

    const fresh = await loadMessages(tid)
    setMessages(fresh)

    if (onArtifact) {
      for (const b of result.blocks as any[]) {
        if (b.assetId) onArtifact({ assetId: b.assetId, kind: b.kind })
      }
    }
  }

  const stop = () => { abortRef.current?.abort() }

  // Live model + quota status. Refreshes after every turn (sessionRuns bumps)
  // and whenever the founder changes the model preference.
  const status = useCoreStatus(sessionRuns)
  // What "Auto" resolves to right now — shown inside the picker's Auto option.
  const autoLabel = status.readyBrain?.label ?? 'connecting…'

  const isEmpty = messages.length === 0 && !sending

  return (
    <div className={'core-convo' + (compact ? ' core-convo-compact' : '')}>
      <div className="core-convo-scroll" ref={scrollRef}>
        {isEmpty ? (
          <div className="core-convo-empty">
            <CoreOrb state="idle" size="hero" />
            {hasThreads ? (
              <p className="core-empty-copy">What are we making?</p>
            ) : (
              <>
                <p className="core-empty-copy">
                  I'm Arganta Core. I can make images, voice, websites, decks, brand kits and charts — for real, on your own infrastructure.
                </p>
                <div className="core-starter-chips">
                  {STARTER_CHIPS.map(chip => (
                    <button key={chip} className="core-starter-chip" onClick={() => setDraft(chip)}>{chip}</button>
                  ))}
                </div>
              </>
            )}
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
                    errored={isLast ? lastProvenance?.errored : undefined}
                  />
                )
              }
              return null
            })}
            {sending && (
              <div className="core-msg core-msg-assistant">
                <CoreOrb state={thinkingLong ? 'thinking-long' : 'thinking'} size="avatar" />
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
      <Composer
        draft={draft} onDraftChange={setDraft} onSend={send} onStop={stop}
        sending={sending} autoLabel={autoLabel} status={status}
        sessionCostUsd={sessionCostUsd} sessionRuns={sessionRuns}
      />
    </div>
  )
}
