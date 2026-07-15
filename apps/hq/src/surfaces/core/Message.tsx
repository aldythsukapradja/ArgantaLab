// C4b Step 3 — message rendering. Tool-trail is always-visible-but-quiet
// (C4a §3 decision); artifact bodies are minimal placeholders here — Step 5
// replaces them with the full ArtifactCard. Provenance footer per C4a §3.
import { useEffect, useRef, useState } from 'react'
import type { CoreMessage } from '../../lib/core'
import { asBlocks, MEDIA_BLOCK_KINDS, type CoreBlock } from './blocks'
import { CoreOrb } from './CoreOrb'
import { ArtifactCard } from './ArtifactCard'

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="core-msg core-msg-user">
      <div className="core-bubble">{text}</div>
    </div>
  )
}

export function AssistantMessage({ message, provider, model, streaming, errored }: {
  message: CoreMessage
  provider?: string | null
  model?: string | null
  streaming?: boolean
  /** True when this turn's stopReason was an honest failure (error/no-model). */
  errored?: boolean
}) {
  const blocks = asBlocks(message.blocks || [])
  const trail = blocks.filter(b => b.kind === 'tool-trail')
  const textBlock = blocks.find(b => b.kind === 'text') as Extract<CoreBlock, { kind: 'text' }> | undefined
  const mediaBlocks = blocks.filter(b => MEDIA_BLOCK_KINDS.has(b.kind))
  const errorBlocks = blocks.filter(b => b.kind === 'error') as Extract<CoreBlock, { kind: 'error' }>[]
  const savedAny = mediaBlocks.some((b: any) => !!b.assetId)

  // provenance shown: prefer the turn-level provider/model (works even with
  // no tool calls); fall back to the first tool-trail's, since older
  // persisted messages (pre this fix) only carry that.
  const provFallback = trail[0] as Extract<CoreBlock, { kind: 'tool-trail' }> | undefined
  const provText = provider ?? provFallback?.provider ?? null
  const modelText = model ?? provFallback?.model ?? null
  const costUsd = trail.reduce((s, t: any) => s + (t.costUsd || 0), 0)

  const orbState = errored ? 'error' : streaming ? 'speaking' : 'idle'

  return (
    <div className="core-msg core-msg-assistant">
      <CoreOrb state={orbState} size="avatar" />
      <div className="core-msg-body">
        {trail.map((t, i) => <ToolTrailLine key={i} block={t as any} />)}
        {errorBlocks.map((b, i) => <BlockedCard key={i} message={b.message} />)}
        {mediaBlocks.map((b, i) => <ArtifactCard key={i} block={b} />)}
        {textBlock && <TextReveal text={textBlock.text} skipAnimation={!streaming} />}
        {(provText || savedAny) && (
          <div className="core-provenance mono">
            {provText && <span>{provText}</span>}
            {modelText && <span> · {modelText}</span>}
            <span> · ${costUsd.toFixed(4)}</span>
            {savedAny && <span> · 📎 saved</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolTrailLine({ block }: { block: Extract<CoreBlock, { kind: 'tool-trail' }> }) {
  return (
    <div className="core-trail-line mono" title={block.tool ?? undefined}>
      <span className={block.ok ? 'core-trail-ok' : 'core-trail-fail'}>{block.ok ? '✓' : '✗'}</span>
      {' → '}{block.tool}
      {block.provider && <> · {block.provider}</>}
      {' · $' + (block.costUsd ?? 0).toFixed(4)}
      {' · ' + ((block.latencyMs ?? 0) / 1000).toFixed(1) + 's'}
    </div>
  )
}

// The trust-critical card (C4a §4): a governance-blocked tool call, rendered
// distinctly. v1 is dismiss-only — approve-and-resume needs C6/C7's mission
// runner, so this never shows a fake "Approve" button that can't actually
// resume the loop.
function BlockedCard({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="core-blocked-card">
      <p>I {message} Approvals arrive in a later build; for now this action stays parked.</p>
      <button className="core-artifact-btn core-artifact-btn-quiet" onClick={() => setDismissed(true)}>Understood</button>
    </div>
  )
}

// Fast word-cadence typewriter, capped at 1.2s total regardless of length
// (never make the founder wait twice). Click anywhere to skip to full text.
function TextReveal({ text, skipAnimation }: { text: string; skipAnimation?: boolean }) {
  const [shown, setShown] = useState(skipAnimation ? text : '')
  const doneRef = useRef(skipAnimation ?? false)

  useEffect(() => {
    if (skipAnimation) { setShown(text); doneRef.current = true; return }
    doneRef.current = false
    const words = text.split(' ')
    const totalMs = 1200
    const stepMs = Math.max(8, totalMs / Math.max(1, words.length))
    let i = 0
    const id = setInterval(() => {
      i++
      setShown(words.slice(0, i).join(' '))
      if (i >= words.length) { doneRef.current = true; clearInterval(id) }
    }, stepMs)
    return () => clearInterval(id)
  }, [text, skipAnimation])

  const skip = () => { if (!doneRef.current) { setShown(text); doneRef.current = true } }

  return <p className="core-text" onClick={skip}>{shown}</p>
}
