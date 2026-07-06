// HQ Vault — the prompt library. Prompts are notes with `type: prompt`,
// shelved by pillar/craft, with one-click copy of the prompt body.

import { useMemo, useState } from 'react'
import { Terminal, Copy, Check, FilePlus2 } from 'lucide-react'
import { useVault } from '../store'
import { tokenizeBlocks } from '../markdown'
import type { VaultNote, Product } from '../types'
import { PRODUCT_COLOR } from '../types'

// Shelf resolution: product first, then craft tags for the cross-cutting shelves.
const SHELVES = ['HQ', 'KinetikCircle', 'ArgantaLabs', 'LashiraBloom', 'Investor', 'Research', 'Design', 'Engineering'] as const
type Shelf = typeof SHELVES[number]

function shelfOf(n: VaultNote): Shelf {
  // craft shelves (Design/Engineering) only claim cross-cutting HQ prompts;
  // a product prompt tagged "design" still belongs to its product shelf
  if (n.fm.product === 'HQ') {
    if (n.fm.tags.includes('design')) return 'Design'
    if (n.fm.tags.includes('engineering') && !n.fm.tags.includes('vault')) return 'Engineering'
  }
  return n.fm.product as Shelf
}

function promptBody(n: VaultNote): string {
  // the quoted block under "## Prompt body", falling back to first blockquote
  const blocks = tokenizeBlocks(n.body)
  let inSection = false
  for (const b of blocks) {
    if (b.kind === 'h') { inSection = b.text.toLowerCase().includes('prompt'); continue }
    if (b.kind === 'quote' && inSection) return b.lines.join('\n')
  }
  const q = blocks.find(b => b.kind === 'quote')
  return q && q.kind === 'quote' ? q.lines.join('\n') : n.body
}

export function PromptsView() {
  const notes = useVault(s => s.notes)
  const openNote = useVault(s => s.openNote)
  const createNote = useVault(s => s.createNote)
  const [shelf, setShelf] = useState<Shelf | 'all'>('all')
  const [copied, setCopied] = useState<string | null>(null)

  const prompts = useMemo(
    () => Object.values(notes).filter(n => n.fm.type === 'prompt'),
    [notes],
  )
  const shelves = useMemo(() => {
    const m = new Map<Shelf, VaultNote[]>()
    for (const s of SHELVES) m.set(s, [])
    for (const p of prompts) m.get(shelfOf(p))?.push(p)
    return m
  }, [prompts])

  const copy = async (n: VaultNote) => {
    try {
      await navigator.clipboard.writeText(promptBody(n))
      setCopied(n.id)
      setTimeout(() => setCopied(c => (c === n.id ? null : c)), 1400)
    } catch { /* clipboard unavailable */ }
  }

  const newPrompt = () => {
    const title = window.prompt('Prompt title', 'Prompt — ')
    if (!title?.trim()) return
    createNote(title, { type: 'prompt', status: 'draft', tags: ['prompt'] },
      `# ${title.trim()}\n\nWhat this prompt is for.\n\n## Prompt body\n\n> Paste the reusable prompt here.\n\n## Grading\n\n- How to judge the output\n\nIndex: [[Fable Build Prompts]]\n`)
  }

  const visible = shelf === 'all' ? SHELVES : [shelf]

  return (
    <div className="vpr">
      <div className="vd-head">
        <div>
          <div className="vd-title"><Terminal size={16} /> Prompt library</div>
          <div className="v-dim">Prompts are capital — {prompts.length} shelved, reusable, versioned as notes.</div>
        </div>
        <button className="vc-btn" onClick={newPrompt}><FilePlus2 size={13} /> New prompt</button>
      </div>

      <div className="vpr-shelves">
        <button className={'vg-chip' + (shelf === 'all' ? ' on' : '')} onClick={() => setShelf('all')}>All</button>
        {SHELVES.map(s => (
          <button key={s} className={'vg-chip' + (shelf === s ? ' on' : '')} onClick={() => setShelf(sh => sh === s ? 'all' : s)}>
            {s} <i className="vx-count">{shelves.get(s)?.length || 0}</i>
          </button>
        ))}
      </div>

      {visible.map(s => {
        const list = shelves.get(s) || []
        if (list.length === 0) return null
        return (
          <section key={s} className="vpr-shelf">
            <h3 className="vpr-shelf-h">
              <span className="vp-dot" style={{ background: PRODUCT_COLOR[s as Product] || '#8b7cf6' }} />
              {s}
            </h3>
            <div className="vpr-grid">
              {list.map(n => (
                <article key={n.id} className="vpr-card">
                  <header className="vpr-card-h" onClick={() => openNote(n.id)}>
                    {n.fm.title.replace(/^Prompt\s*[—-]\s*/, '')}
                  </header>
                  <pre className="vpr-body">{promptBody(n).slice(0, 260)}{promptBody(n).length > 260 ? '…' : ''}</pre>
                  <footer className="vpr-foot">
                    <span className="v-dim">{n.fm.status} · {n.fm.updated}</span>
                    <div className="vpr-actions">
                      <button className="vpr-copy" onClick={() => copy(n)}>
                        {copied === n.id ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
                      </button>
                      <button className="vpr-open" onClick={() => openNote(n.id)}>open</button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        )
      })}
      {prompts.length === 0 && (
        <div className="vg-empty" style={{ position: 'static', padding: 60 }}>No prompts yet — shelve your first build prompt.</div>
      )}
    </div>
  )
}
