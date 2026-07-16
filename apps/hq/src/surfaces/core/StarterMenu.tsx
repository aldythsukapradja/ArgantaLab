// C5-B7 · The "✦ Start" popover — prompt pills by category, reachable from the
// topbar in every mount mode (the old starter chips only appeared on a brand-new
// empty thread, so once you had any history there was no way to rediscover what
// Core can do).
//
// Clicking a pill PRE-FILLS the composer, never auto-sends: these are starting
// points the founder edits, and auto-sending would spend real model budget on a
// mis-tap.
import { useEffect, useRef, useState } from 'react'
import { STARTER_CATEGORIES } from './promptStarters'

export function PromptStarters({ onPick, onClose }: { onPick: (text: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(STARTER_CATEGORIES[0].id)
  const ref = useRef<HTMLDivElement>(null)
  const active = STARTER_CATEGORIES.find(c => c.id === tab) ?? STARTER_CATEGORIES[0]

  // Click-outside + Escape, the two ways anyone expects a popover to close.
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  return (
    <div className="core-starters" ref={ref} role="dialog" aria-label="Prompt starters">
      <div className="core-starters-tabs" role="tablist">
        {STARTER_CATEGORIES.map(c => (
          <button
            key={c.id} role="tab" aria-selected={c.id === tab}
            className={'core-starters-tab' + (c.id === tab ? ' is-on' : '')}
            onClick={() => setTab(c.id)}
          >{c.label}</button>
        ))}
      </div>
      <div className="core-starters-hint">{active.hint}</div>
      <div className="core-starters-pills">
        {active.pills.map(p => (
          <button key={p} className="core-starter-pill" onClick={() => { onPick(p); onClose() }} title={p}>{p}</button>
        ))}
      </div>
    </div>
  )
}

/** The topbar trigger + its popover, as one unit — so each mount mode adds a
 * single element instead of repeating the open/close state three times. */
export function StartersButton({ onPick }: { onPick: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="core-starters-wrap">
      <button
        className={'core-starters-btn' + (open ? ' is-on' : '')}
        onClick={() => setOpen(o => !o)}
        aria-label="Prompt starters" aria-expanded={open}
        title="Prompt starters — things Core can actually do"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M7 1.4 L8.4 5 L12 6.4 L8.4 7.8 L7 11.4 L5.6 7.8 L2 6.4 L5.6 5 Z" fill="currentColor" />
        </svg>
        <span>Start</span>
      </button>
      {open && <PromptStarters onPick={onPick} onClose={() => setOpen(false)} />}
    </div>
  )
}
