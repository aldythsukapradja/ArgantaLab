// GB-3 · The empty state — a big prompt box over a starter gallery. This is
// the Lovable/Base44 front door: one sentence in, a working artifact out. The
// starters are real briefs (forgeConfig.ts), not prompt templates the founder
// has to fill in.
import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import type { ForgeConfig, Starter } from './forgeConfig'
import type { ArtifactKind } from '../../builder-core/generate'

interface Props {
  cfg: ForgeConfig
  kind: ArtifactKind
  busy: boolean
  onBuild: (brief: string, opts?: { kind?: ArtifactKind; genre?: string; templateId?: string }) => void
}

export function StarterGallery({ cfg, kind, busy, onBuild }: Props) {
  const [draft, setDraft] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { taRef.current?.focus() }, [])
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [draft])

  const submit = () => {
    const t = draft.trim()
    if (!t || busy) return
    onBuild(t, { kind })
  }

  const pick = (s: Starter) => {
    if (busy) return
    onBuild(s.brief, { kind, genre: s.genre, templateId: s.templateId })
  }

  return (
    <div className="forge-empty">
      <div className="forge-empty-in">
        <h2>{cfg.emptyTitle}</h2>
        <p>{cfg.emptyBlurb}</p>

        <div className="forge-prompt">
          <textarea
            ref={taRef}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder={cfg.promptPlaceholder}
            aria-label={`Describe the ${cfg.noun.toLowerCase()} to build`}
            disabled={busy}
          />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--tx3)' }}>
              {busy ? 'Building…' : 'Enter to build'}
            </span>
            <button className="forge-btn primary" onClick={submit} disabled={!draft.trim() || busy}>
              <ArrowUp size={13} /> Build it
            </button>
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--tx3)', textAlign: 'left' }}>
            OR START FROM
          </span>
          <div className="forge-starters">
            {cfg.starters.map((s) => (
              <button key={s.id} className="forge-starter" onClick={() => pick(s)} disabled={busy} title={s.hint}>
                <span className="emoji">{s.emoji}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="label" style={{ display: 'block' }}>{s.label}</span>
                  <span className="hint">{s.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
