// The chat's LLM picker — the composer "brain pill" is a dropdown on desktop and
// a bottom SHEET on mobile (ChatGPT/Claude pattern). Lists Auto (cheapest-capable
// with fallback) plus every genuinely tools-capable free brain (Groq, Gemini).
// Anthropic/Claude are omitted on purpose — the gateway has no tool-call
// translation for them. On mobile the sheet also carries "Today's free usage"
// (the quota chips that used to sit permanently under the composer).
import { useEffect, useRef, useState } from 'react'
import { intelligenceRegistry } from '../../lib/ai'
import { getPreferredModelId, setPreferredModelId, subscribePreferredModel } from '../../lib/modelPreference'
import { friendlyModel, GEMINI_FREE_RPD_EST, type CoreStatus } from './useCoreStatus'
import { ProviderLogo } from './ProviderLogo'

interface Opt { id: string; label: string; sub: string }

function eligibleModels(): Opt[] {
  return (intelligenceRegistry as any[])
    .filter((m) => m.capabilities?.tools && m.execution === 'external-api' && !/claude|anthropic/i.test(m.id))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .map((m) => ({ id: m.id, label: friendlyModel(m.apiModel), sub: m.name }))
}

export function ModelPicker({ autoLabel, status, sessionCostUsd, sessionRuns }: {
  autoLabel: string
  /** Optional — when passed, the mobile sheet shows a "Today's free usage" section. */
  status?: CoreStatus
  sessionCostUsd?: number
  sessionRuns?: number
}) {
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
  // Compact label: just the model that will run. "Auto vs pinned" is shown inside
  // the menu (the active row), not crammed into the pill.
  const label = current ? current.label : autoLabel
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
        <ProviderLogo model={label} size={14} />
        <span className="core-brain-pill-txt">{label}</span>
        <svg className="core-brain-caret" width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="core-brain-scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="core-brain-menu" role="menu">
            <div className="core-brain-grip" aria-hidden />
            <button className={'core-brain-opt' + (!pref ? ' active' : '')} role="menuitem" onClick={() => pick(null)}>
              <b>Auto <span className="core-brain-rec">recommended</span></b>
              <i>cheapest capable · falls back automatically</i>
            </button>
            {opts.map((o) => (
              <button key={o.id} className={'core-brain-opt' + (pref === o.id ? ' active' : '')} role="menuitem" onClick={() => pick(o.id)}>
                <b><ProviderLogo model={o.label} size={16} /> {o.label}</b>
                <i>{o.sub}</i>
              </button>
            ))}
            <div className="core-brain-note">Applies to the chat and client-side generation. The footer under each reply shows the model that actually ran.</div>
            {status && (
              <div className="core-brain-usage">
                <div className="core-brain-usage-h">Today's free usage</div>
                {status.neurons && !status.neurons.error && (
                  <div className="core-brain-usage-row"><span>Cloudflare neurons</span><span>{status.neurons.used.toLocaleString()} / {status.neurons.cap.toLocaleString()}</span></div>
                )}
                <div className="core-brain-usage-row"><span>Gemini requests</span><span>{status.geminiToday} / {GEMINI_FREE_RPD_EST}</span></div>
                <div className="core-brain-usage-row"><span>Groq requests</span><span>{status.groqToday}</span></div>
                <div className="core-brain-usage-row"><span>This session</span><span>${(sessionCostUsd ?? 0).toFixed(4)} · {sessionRuns ?? 0} run{sessionRuns === 1 ? '' : 's'}</span></div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
