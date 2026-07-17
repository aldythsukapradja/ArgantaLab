// IG Simulator — Instagram mode of the AI Influencer Studio.
//
// Three panels inside the same non-scrollable deck: plan rail (week + slots),
// the phone (what followers will see), composer (edit the selected item).
// Everything is keyed by creatorId, so all five creators ride this pipeline —
// only the seed differs.
import { useEffect, useMemo, useState } from 'react'
import { Layers, Trash2, Send, Sparkles, ClipboardPaste, Loader2, ExternalLink } from 'lucide-react'
import type { Creator } from '../influencerData'
import { LOOK_ORDER } from '../influencerData'
import { IgPhone } from './IgPhone'
import { sendToPostStudio } from './bridge'
import { cloudEnabled } from '../../../lib/supabase'
import { useHQ } from '../../../shell/store'
import { DOW, SLOTS, isoDay, uid, usePlan, weekOf, type IgKind, type IgPlanItem, type IgStatus } from './planStore'

const STATUSES: IgStatus[] = ['idea', 'ready', 'sent', 'posted']
const KIND_LABEL: Record<IgKind, string> = { post: 'Post', reel: 'Reel', story: 'Story' }

function BatchPanel({ creator, onClose, onDone }: { creator: Creator; onClose: () => void; onDone: (n: number) => void }) {
  const importBatch = usePlan(s => s.importBatch)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const week = weekOf(new Date())

  const sample = JSON.stringify([
    { kind: 'reel', day: week[0], caption: 'This should not work.', hashtags: '#build #ai', look: 'normal' },
    { kind: 'post', day: week[1], caption: 'The failure report.', pillar: 'Failures' },
  ], null, 2)

  function run() {
    setErr(null)
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) { setErr('Expected a JSON array of items.'); return }
      onDone(importBatch(creator.id, parsed))
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Invalid JSON') }
  }

  return (
    <div className="igs-modal" role="dialog" aria-modal="true" aria-label="Batch import">
      <div className="igs-modal-in">
        <div className="inf-h">Batch import — {creator.name}<span className="spacer" />
          <button className="inf-copy" onClick={onClose}>CLOSE</button>
        </div>
        <div className="inf-note">Paste a JSON array. Plan a whole week in one go; unknown fields are ignored and anything missing falls back to sane defaults.</div>
        <textarea
          className="igs-ta" value={text} onChange={e => setText(e.target.value)}
          placeholder={sample} spellCheck={false}
        />
        {err && <div className="igs-err">{err}</div>}
        <div className="igs-modal-foot">
          <button className="inf-copy" onClick={() => setText(sample)}>USE SAMPLE</button>
          <span className="spacer" />
          <button className="inf-copy on" onClick={run} disabled={!text.trim()}>IMPORT</button>
        </div>
      </div>
    </div>
  )
}

function Composer({ item, creator, onChange, onDelete }: {
  item: IgPlanItem; creator: Creator
  onChange: (next: IgPlanItem) => void
  onDelete: () => void
}) {
  const set = (p: Partial<IgPlanItem>) => onChange({ ...item, ...p })
  const markStatus = usePlan(s => s.markStatus)
  const go = useHQ(s => s.go)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function send() {
    setSending(true); setErr(null)
    const res = await sendToPostStudio(item, creator)
    setSending(false)
    if (res.ok) markStatus(item.id, 'sent', res.draftId)
    else setErr(res.error)
  }

  return (
    <>
      <div className="inf-h">Composer<span className="spacer" />
        <button className="igs-icon" onClick={onDelete} title="Delete item"><Trash2 size={12} /></button>
      </div>

      <div className="igs-row">
        {(['post', 'reel', 'story'] as IgKind[]).map(k => (
          <button key={k} className={'inf-pill' + (item.kind === k ? ' on' : '')} onClick={() => set({ kind: k })}>{KIND_LABEL[k]}</button>
        ))}
      </div>

      <label className="igs-l">Day</label>
      <input className="igs-in" type="date" value={item.day} onChange={e => set({ day: e.target.value })} />

      {item.kind === 'story' && (
        <>
          <label className="igs-l">Slot</label>
          <div className="igs-row">
            {SLOTS.map(s => (
              <button key={s} className={'inf-pill' + (item.slot === s ? ' on' : '')} onClick={() => set({ slot: s })}>{s}</button>
            ))}
          </div>
        </>
      )}

      <label className="igs-l">Media — quick-fill from looks</label>
      <div className="igs-row">
        {creator.looks && LOOK_ORDER.map(l => (
          <button
            key={l}
            className={'inf-pill' + (item.look === l ? ' on' : '')}
            onClick={() => set({ look: l, media: creator.looks![l] })}
          >{l}</button>
        ))}
        <button className="inf-pill" onClick={() => set({ media: undefined, look: undefined })}>none</button>
      </div>
      {item.media && <img className="igs-prev" src={item.media} alt="" />}

      <label className="igs-l">Caption</label>
      <textarea className="igs-ta sm" value={item.caption} onChange={e => set({ caption: e.target.value })} />

      <label className="igs-l">Hashtags</label>
      <input className="igs-in" value={item.hashtags} onChange={e => set({ hashtags: e.target.value })} placeholder="#build #ai" />

      <label className="igs-l">Pillar</label>
      <select className="igs-in" value={item.pillar ?? ''} onChange={e => set({ pillar: e.target.value || undefined })}>
        <option value="">—</option>
        {creator.posts.pillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
      </select>

      <label className="igs-l">Status</label>
      <div className="igs-row">
        {STATUSES.map(s => (
          <button key={s} className={'inf-pill st-' + s + (item.status === s ? ' on' : '')} onClick={() => set({ status: s })}>{s}</button>
        ))}
      </div>

      <div className="igs-row" style={{ marginTop: 4 }}>
        <button className={'inf-pill' + (item.pinned ? ' on' : '')} onClick={() => set({ pinned: !item.pinned })}>📌 pinned</button>
      </div>

      {item.status === 'sent' || item.status === 'posted' ? (
        <button className="igs-send sent" onClick={() => go('broadcast')}>
          <ExternalLink size={11} /> Open in Post Studio
        </button>
      ) : (
        <button
          className="igs-send"
          disabled={!cloudEnabled || sending || !item.caption.trim()}
          onClick={send}
          title={!cloudEnabled ? 'Connect Supabase to send drafts' : !item.caption.trim() ? 'Add a caption first' : undefined}
        >
          {sending ? <Loader2 size={11} className="igs-spin" /> : <Send size={11} />}
          {sending ? 'Sending…' : 'Send to Post Studio'}
        </button>
      )}
      {err && <div className="igs-err">{err}</div>}
      <div className="inf-note" style={{ fontSize: 9 }}>Post Studio stays the single publish gate — the bridge lands this in its drafts inbox, never straight to Instagram.</div>
    </>
  )
}

export function IgSimulator({ c }: { c: Creator }) {
  const items = usePlan(s => s.items)
  const { upsert, remove, seedIfEmpty } = usePlan()
  const [selId, setSel] = useState<string | null>(null)
  const [batch, setBatch] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const week = useMemo(() => weekOf(new Date()), [])
  const [day, setDay] = useState(() => isoDay(new Date()))

  // Arganta ships seeded so the sim is useful on first open; the same call
  // seeds anyone else the moment the founder asks for it.
  useEffect(() => { if (c.id === 'arganta') seedIfEmpty(c.id, week) }, [c.id, week, seedIfEmpty])
  useEffect(() => { setSel(null) }, [c.id])

  const mine = useMemo(() => items.filter(i => i.creatorId === c.id), [items, c.id])
  const sel = mine.find(i => i.id === selId) ?? null
  const byDay = (d: string) => mine.filter(i => i.day === d)

  function add(kind: IgKind, forDay = day) {
    const t = new Date().toISOString()
    const item: IgPlanItem = {
      id: uid(), creatorId: c.id, kind, day: forDay,
      slot: kind === 'story' ? 'morning' : undefined,
      caption: '', hashtags: '', status: 'idea',
      look: 'normal', media: c.looks?.normal,
      createdAt: t, updatedAt: t,
    }
    upsert(item); setSel(item.id)
  }

  const seeded = mine.length > 0

  return (
    <div className="igs-body">
      {/* ── plan rail ── */}
      <div className="inf-card igs-rail">
        <div className="inf-h">Plan<span className="spacer" />
          <button className="igs-icon" title="Batch import" onClick={() => setBatch(true)}><ClipboardPaste size={12} /></button>
        </div>
        <div className="igs-week">
          {week.map((d, i) => {
            const n = byDay(d).length
            return (
              <button key={d} className={'igs-dow' + (d === day ? ' on' : '')} onClick={() => setDay(d)}>
                <b>{DOW[i]}</b>
                <span>{d.slice(8)}</span>
                {n > 0 && <i>{n}</i>}
              </button>
            )
          })}
        </div>
        <div className="inf-note" style={{ fontSize: 9 }}>{c.weekly[week.indexOf(day)] ?? ''}</div>
        {toast && <div className="igs-toast">{toast}</div>}

        <div className="igs-slots">
          {byDay(day).length === 0 && <div className="inf-note">Nothing planned for this day.</div>}
          {byDay(day).map(i => (
            <button key={i.id} className={'igs-slot' + (i.id === selId ? ' sel' : '')} onClick={() => setSel(i.id)}>
              <span className={'igs-k k-' + i.kind}>{KIND_LABEL[i.kind]}</span>
              <span className="igs-cap">{i.caption || <em>untitled</em>}</span>
              <span className={'igs-st st-' + i.status}>{i.status}</span>
            </button>
          ))}
        </div>

        <div className="igs-adds">
          <button className="inf-pill" onClick={() => add('post')}>+ post</button>
          <button className="inf-pill" onClick={() => add('reel')}>+ reel</button>
          <button className="inf-pill" onClick={() => add('story')}>+ story</button>
        </div>
        {!seeded && (
          <button className="igs-seed" onClick={() => usePlan.getState().seedIfEmpty(c.id, week)}>
            <Sparkles size={11} /> Seed {c.name}'s week from the blueprint
          </button>
        )}
      </div>

      {/* ── phone ── */}
      <div className="igs-stage">
        <IgPhone c={c} items={mine} selId={selId} onSelect={setSel} onAdd={k => add(k)} day={day} />
      </div>

      {/* ── composer ── */}
      <div className="inf-card igs-comp">
        {sel
          ? <Composer item={sel} creator={c} onChange={upsert} onDelete={() => { remove(sel.id); setSel(null) }} />
          : (
            <>
              <div className="inf-h">Composer</div>
              <div className="igs-empty">
                <Layers size={22} />
                <p>Pick a tile in the phone or a slot in the rail to edit it.</p>
                <p className="dim">Empty tiles are unfilled slots — the holes in the grid a follower would see.</p>
              </div>
            </>
          )}
      </div>

      {batch && (
        <BatchPanel
          creator={c}
          onClose={() => setBatch(false)}
          onDone={n => { setToast(`Imported ${n} item${n === 1 ? '' : 's'}.`); setTimeout(() => setToast(null), 3000) }}
        />
      )}
    </div>
  )
}
