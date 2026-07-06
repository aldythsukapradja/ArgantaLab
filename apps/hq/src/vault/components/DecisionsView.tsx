// HQ Vault — the founder decision ledger. Renders every `type: decision` note
// as a structured entry: decision, context, options, chosen path, consequences.

import { useMemo } from 'react'
import { Scale, ArrowRight, FilePlus2 } from 'lucide-react'
import { useVault } from '../store'
import { tokenizeBlocks } from '../markdown'
import type { VaultNote } from '../types'
import { PRODUCT_COLOR, STATUS_LABEL, todayISO } from '../types'

interface Sections { decision: string; context: string; options: string[]; why: string; consequences: string[] }

// Pull the canonical sections out of a decision note's markdown.
function parseDecision(note: VaultNote): Sections {
  const out: Sections = { decision: '', context: '', options: [], why: '', consequences: [] }
  const blocks = tokenizeBlocks(note.body)
  let section = ''
  for (const b of blocks) {
    if (b.kind === 'h') {
      const t = b.text.toLowerCase()
      section = t.includes('option') ? 'options'
        : t.includes('context') ? 'context'
        : t.includes('why') ? 'why'
        : t.includes('consequence') ? 'consequences'
        : t.includes('decision') && b.level > 1 ? 'decision' : ''
      continue
    }
    const text = b.kind === 'p' ? b.text : ''
    if (section === 'decision' && text) out.decision += (out.decision ? ' ' : '') + text
    else if (section === 'context' && text) out.context += (out.context ? ' ' : '') + text
    else if (section === 'why' && text) out.why += (out.why ? ' ' : '') + text
    else if (section === 'options' && (b.kind === 'ol' || b.kind === 'ul')) out.options.push(...b.items.map(i => i.text))
    else if (section === 'consequences' && (b.kind === 'ol' || b.kind === 'ul')) out.consequences.push(...b.items.map(i => i.text))
  }
  return out
}

const strip = (s: string) => s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => a || t).replace(/\*\*/g, '')

export function DecisionsView() {
  const notes = useVault(s => s.notes)
  const index = useVault(s => s.index)
  const openNote = useVault(s => s.openNote)
  const createNote = useVault(s => s.createNote)

  const decisions = useMemo(
    () => Object.values(notes)
      .filter(n => n.fm.type === 'decision')
      .sort((a, b) => b.fm.updated.localeCompare(a.fm.updated)),
    [notes],
  )

  const newDecision = () => {
    const title = window.prompt('Decision title', 'Decision — ')
    if (!title?.trim()) return
    createNote(title, { type: 'decision', status: 'draft', tags: ['decision'] },
      `# ${title.trim()}\n\n## Decision\n\nWhat was decided, in one sentence.\n\n## Context\n\nWhy this came up now.\n\n## Options considered\n\n1. **Option A** — …\n2. **Option B** — …\n\n## Why\n\nThe reasoning behind the chosen path.\n\n## Consequences\n\n- What changes because of this\n`)
  }

  return (
    <div className="vd">
      <div className="vd-head">
        <div>
          <div className="vd-title"><Scale size={16} /> Founder decisions</div>
          <div className="v-dim">The append-only log of bets — {decisions.length} on record. A decision note is cheap; re-litigating isn't.</div>
        </div>
        <button className="vc-btn" onClick={newDecision}><FilePlus2 size={13} /> Log a decision</button>
      </div>

      <div className="vd-list">
        {decisions.map(n => {
          const d = parseDecision(n)
          const linked = index.outgoing[n.id] || []
          return (
            <article key={n.id} className="vd-card" style={{ borderLeftColor: PRODUCT_COLOR[n.fm.product] }}>
              <header className="vd-card-h" onClick={() => openNote(n.id)}>
                <span className="vd-card-t">{n.fm.title.replace(/^Decision\s*[—-]\s*/, '')}</span>
                <span className={'vb-status s-' + n.fm.status}>{STATUS_LABEL[n.fm.status]}</span>
                <span className={'vd-conf c-' + n.fm.confidence}>{n.fm.confidence} confidence</span>
                <span className="v-dim vd-date">{n.fm.updated}</span>
              </header>
              {d.decision && <p className="vd-decision">{strip(d.decision)}</p>}
              <div className="vd-grid">
                {d.context && (
                  <div className="vd-sec"><span className="vd-k">Context</span><p>{strip(d.context)}</p></div>
                )}
                {d.options.length > 0 && (
                  <div className="vd-sec"><span className="vd-k">Options considered</span>
                    <ol className="vd-opts">{d.options.map((o, i) => <li key={i}>{strip(o)}</li>)}</ol>
                  </div>
                )}
                {d.why && (
                  <div className="vd-sec vd-why"><span className="vd-k">Chosen path</span><p>{strip(d.why)}</p></div>
                )}
              </div>
              <footer className="vd-foot">
                <span className="v-badge" style={{ color: PRODUCT_COLOR[n.fm.product] }}>{n.fm.product}</span>
                {linked.slice(0, 4).map(id => notes[id] && (
                  <button key={id} className="vd-linked" onClick={() => openNote(id)}>
                    <ArrowRight size={10} /> {notes[id].fm.title}
                  </button>
                ))}
                <button className="vd-open" onClick={() => openNote(n.id)}>Open full note →</button>
              </footer>
            </article>
          )
        })}
        {decisions.length === 0 && (
          <div className="vg-empty" style={{ position: 'static', padding: 60 }}>
            No decisions logged yet. Every bet deserves a note.
          </div>
        )}
      </div>
      <div className="v-dim vd-note-hint">Decisions are ordinary notes with <code className="v-icode">type: decision</code> — edit them like any other note. Today: {todayISO()}</div>
    </div>
  )
}
