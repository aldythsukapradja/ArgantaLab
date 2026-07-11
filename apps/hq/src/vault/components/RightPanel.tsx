// HQ Vault — right context panel: properties (editable frontmatter), links
// (backlinks / outgoing / broken / unlinked mentions), outline, related decisions.

import { useMemo, useState } from 'react'
import {
  SlidersHorizontal, Link2, ListTree, ArrowUpRight, ArrowDownLeft, Unlink, Scale, Sparkles,
} from 'lucide-react'
import { useVault, openByTarget } from '../store'
import { unlinkedMentions } from '../graph'
import { outline } from '../markdown'
import type { Product, NoteType, NoteStatus, Confidence } from '../types'
import { PRODUCTS, PRODUCT_COLOR, STATUS_LABEL } from '../types'

type RTab = 'props' | 'links' | 'outline'

const TYPES: NoteType[] = ['moc', 'note', 'strategy', 'decision', 'prompt', 'research', 'plan', 'spec',
  'layer', 'journey', 'lesson', 'atlas', 'map', 'method']
const STATUSES: NoteStatus[] = ['living', 'baseline', 'frozen', 'current', 'superseded',
  'seed', 'draft', 'active', 'shipped', 'archived']
const CONFS: Confidence[] = ['low', 'medium', 'high']

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="vp-row">
      <span className="vp-key">{label}</span>
      <span className="vp-val">{children}</span>
    </div>
  )
}

function NoteLinkRow({ id, hint }: { id: string; hint?: string }) {
  const note = useVault(s => s.notes[id])
  const openNote = useVault(s => s.openNote)
  if (!note) return null
  return (
    <button className="vp-link" onClick={() => openNote(id)}>
      <span className="vp-dot" style={{ background: PRODUCT_COLOR[note.fm.product] }} />
      <span className="vp-link-t">{note.fm.title}</span>
      {hint && <span className="vp-link-hint">{hint}</span>}
    </button>
  )
}

export function RightPanel({ noteId }: { noteId: string }) {
  const [tab, setTab] = useState<RTab>('props')
  const note = useVault(s => s.notes[noteId])
  const notes = useVault(s => s.notes)
  const index = useVault(s => s.index)
  const updateFrontmatter = useVault(s => s.updateFrontmatter)
  const renameNote = useVault(s => s.renameNote)

  const mentions = useMemo(
    () => (note ? unlinkedMentions(noteId, notes, index) : []),
    [noteId, notes, index, note],
  )
  const heads = useMemo(() => (note ? outline(note.body) : []), [note])
  const relatedDecisions = useMemo(() => {
    if (!note) return []
    return Object.values(notes)
      .filter(n => n.fm.type === 'decision' && n.id !== noteId &&
        (n.fm.product === note.fm.product ||
          index.outgoing[n.id]?.includes(noteId) || index.outgoing[noteId]?.includes(n.id)))
      .map(n => n.id)
  }, [note, notes, index, noteId])

  if (!note) return null
  const backs = index.backlinks[noteId] || []
  const outs = index.outgoing[noteId] || []
  const broken = index.broken[noteId] || []

  return (
    <aside className="v-right">
      <div className="v-right-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'props'} className={tab === 'props' ? 'on' : ''} onClick={() => setTab('props')} title="Properties"><SlidersHorizontal size={13} /><span>Properties</span></button>
        <button role="tab" aria-selected={tab === 'links'} className={tab === 'links' ? 'on' : ''} onClick={() => setTab('links')} title="Links"><Link2 size={13} /><span>Links</span>{(backs.length + broken.length) > 0 && <i className="v-right-count">{backs.length + broken.length}</i>}</button>
        <button role="tab" aria-selected={tab === 'outline'} className={tab === 'outline' ? 'on' : ''} onClick={() => setTab('outline')} title="Outline"><ListTree size={13} /><span>Outline</span></button>
      </div>

      <div className="v-right-body">
        {tab === 'props' && (
          <div className="vp-props">
            <PropRow label="title">
              <input className="vp-input" value={note.fm.title}
                onChange={e => renameNote(noteId, e.target.value)} />
            </PropRow>
            <PropRow label="product">
              <select className="vp-select" value={note.fm.product}
                onChange={e => updateFrontmatter(noteId, { product: e.target.value as Product })}>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </PropRow>
            <PropRow label="type">
              <select className="vp-select" value={note.fm.type}
                onChange={e => updateFrontmatter(noteId, { type: e.target.value as NoteType })}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </PropRow>
            <PropRow label="status">
              <select className="vp-select" value={note.fm.status}
                onChange={e => updateFrontmatter(noteId, { status: e.target.value as NoteStatus })}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </PropRow>
            <PropRow label="confidence">
              <div className="vp-conf">
                {CONFS.map(c => (
                  <button key={c} className={'vp-conf-b' + (note.fm.confidence === c ? ' on' : '')}
                    onClick={() => updateFrontmatter(noteId, { confidence: c })}>{c}</button>
                ))}
              </div>
            </PropRow>
            <PropRow label="tags">
              <input className="vp-input" value={note.fm.tags.join(', ')}
                placeholder="comma, separated"
                onChange={e => updateFrontmatter(noteId, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
            </PropRow>
            <PropRow label="owner">
              <input className="vp-input" value={note.fm.owner}
                onChange={e => updateFrontmatter(noteId, { owner: e.target.value })} />
            </PropRow>
            <PropRow label="updated"><span className="vp-ro">{note.fm.updated}</span></PropRow>

            {relatedDecisions.length > 0 && (
              <div className="vp-sec">
                <div className="vp-sec-h"><Scale size={12} /> Related decisions</div>
                {relatedDecisions.map(id => <NoteLinkRow key={id} id={id} />)}
              </div>
            )}
          </div>
        )}

        {tab === 'links' && (
          <div className="vp-links">
            <div className="vp-sec">
              <div className="vp-sec-h"><ArrowDownLeft size={12} /> Backlinks <i>{backs.length}</i></div>
              {backs.length === 0 && <div className="vp-none">Nothing links here yet.</div>}
              {backs.map(id => <NoteLinkRow key={id} id={id} />)}
            </div>
            <div className="vp-sec">
              <div className="vp-sec-h"><ArrowUpRight size={12} /> Outgoing <i>{outs.length}</i></div>
              {outs.length === 0 && <div className="vp-none">No outgoing links. Add one with [[…]].</div>}
              {outs.map(id => <NoteLinkRow key={id} id={id} />)}
            </div>
            {broken.length > 0 && (
              <div className="vp-sec">
                <div className="vp-sec-h vp-broken"><Unlink size={12} /> Broken <i>{broken.length}</i></div>
                {broken.map(t => (
                  <button key={t} className="vp-link vp-link-broken"
                    title="Create this note"
                    onClick={() => openByTarget(t, true)}>
                    <span className="vp-dot vp-dot-broken" />
                    <span className="vp-link-t">{t}</span>
                    <span className="vp-link-hint">create</span>
                  </button>
                ))}
              </div>
            )}
            {mentions.length > 0 && (
              <div className="vp-sec">
                <div className="vp-sec-h"><Sparkles size={12} /> Unlinked mentions <i>{mentions.length}</i></div>
                {mentions.map(id => <NoteLinkRow key={id} id={id} />)}
              </div>
            )}
          </div>
        )}

        {tab === 'outline' && (
          <div className="vp-outline">
            {heads.length === 0 && <div className="vp-none">No headings in this note.</div>}
            {heads.map((h, i) => (
              <div key={i} className="vp-oline" style={{ paddingLeft: 8 + (h.level - 1) * 13 }}>
                <span className={'vp-olvl l' + h.level}>H{h.level}</span>
                <span className="vp-otext">{h.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
