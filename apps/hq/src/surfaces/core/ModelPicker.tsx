// The chat's LLM picker — the composer "brain pill" is now a dropdown. Lists
// Auto (the router's cheapest-capable pick, with automatic fallback) plus every
// genuinely tools-capable free brain in the registry (Groq, Gemini). Writing the
// choice to the shared modelPreference makes the chat AND client-side ai.* calls
// use it. Anthropic/Claude models are omitted here on purpose: the gateway has
// no tool-call translation for them, so they can't drive the tool-using chat.
import { useEffect, useRef, useState } from 'react'
import { intelligenceRegistry } from '../../lib/ai'
import { getPreferredModelId, setPreferredModelId, subscribePreferredModel } from '../../lib/modelPreference'
import { friendlyModel } from './useCoreStatus'

interface Opt { id: string; label: string; sub: string }

function eligibleModels(): Opt[] {
  return (intelligenceRegistry as any[])
    .filter((m) => m.capabilities?.tools && m.execution === 'external-api' && !/claude|anthropic/i.test(m.id))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .map((m) => ({ id: m.id, label: friendlyModel(m.apiModel), sub: m.name }))
}

export function ModelPicker({ autoLabel }: { autoLabel: string }) {
  const [pref, setPref] = useState<string | null>(getPreferredModelId())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => subscribePreferredModel(setPref), [])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const opts = eligibleModels()
  const current = pref ? opts.find((o) => o.id === pref) : null
  const label = current ? current.label : `Auto · ${autoLabel}`
  const pick = (id: string | null) => { setPreferredModelId(id); setOpen(false) }

  return (
    <div className="core-brain-picker" ref={ref}>
      <button
        type="button"
        className="core-brain-pill mono"
        title="Choose the LLM that answers your messages"
        aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="core-brain-dot" aria-hidden />
        {label}
        <svg className="core-brain-caret" width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="core-brain-menu" role="menu">
          <button className={'core-brain-opt' + (!pref ? ' active' : '')} role="menuitem" onClick={() => pick(null)}>
            <b>Auto <span className="core-brain-rec">recommended</span></b>
            <i>cheapest capable · falls back automatically</i>
          </button>
          {opts.map((o) => (
            <button key={o.id} className={'core-brain-opt' + (pref === o.id ? ' active' : '')} role="menuitem" onClick={() => pick(o.id)}>
              <b>{o.label}</b>
              <i>{o.sub}</i>
            </button>
          ))}
          <div className="core-brain-note">Applies to the chat and client-side generation. The footer under each reply shows the model that actually ran.</div>
        </div>
      )}
    </div>
  )
}
