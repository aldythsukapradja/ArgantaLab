// IG Simulator — Instagram mode of the AI Influencer Studio.
//
// Three panels inside the same non-scrollable deck: plan rail (week + slots),
// the phone (what followers will see), composer (edit the selected item).
// Everything is keyed by creatorId, so all five creators ride this pipeline —
// only the seed differs.
import { useEffect, useMemo, useState } from 'react'
import { Layers, Trash2, Send, Sparkles, ClipboardPaste, Loader2, ExternalLink, Lightbulb, CalendarPlus, Plus } from 'lucide-react'
import type { Creator } from '../influencerData'
import { LOOK_ORDER } from '../influencerData'
import { IgPhone } from './IgPhone'
import { sendToPostStudio } from './bridge'
import { cloudEnabled } from '../../../lib/supabase'
import { useHQ } from '../../../shell/store'
import {
  DOW, SLOTS, PLATFORMS, isoDay, uid, usePlan, weekOf,
  type IgKind, type IgPlanItem, type IgStatus, type Platform,
} from './planStore'

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

      <label className="igs-l">Platforms — one master, many outlets</label>
      <div className="igs-row">
        {PLATFORMS.map(p => {
          const on = (item.platforms ?? ['ig']).includes(p.id)
          return (
            <button
              key={p.id}
              className={'inf-pill' + (on ? ' on' : '')}
              onClick={() => {
                const cur = item.platforms ?? ['ig']
                set({ platforms: on ? cur.filter(x => x !== p.id) : [...cur, p.id] })
              }}
            >{p.label}</button>
          )
        })}
      </div>
      {(item.platforms ?? []).filter(p => p !== 'ig').map(p => {
        const label = PLATFORMS.find(x => x.id === p)?.label ?? p
        return (
          <div key={p}>
            <label className="igs-l">{label} caption override <span className="igs-opt">optional — falls back to the caption below</span></label>
            <textarea
              className="igs-ta sm"
              value={item.platformCaptions?.[p as Platform] ?? ''}
              onChange={e => set({ platformCaptions: { ...item.platformCaptions, [p]: e.target.value } })}
              placeholder={label === 'TikTok' ? 'Rawer, more spoken, no hashtag wall…' : label === 'YT Shorts' ? 'Title-as-hook, searchable phrasing…' : `${label} voice…`}
            />
          </div>
        )
      })}

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

      <label className="igs-l">Highlight bubble</label>
      <div className="igs-row">
        {creator.igKit.highlights.map(h => (
          <button key={h} className={'inf-pill' + (item.highlight === h ? ' on' : '')} onClick={() => set({ highlight: item.highlight === h ? undefined : h })}>{h}</button>
        ))}
      </div>

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

/** Fast brainstorm surface — capture the spark, tag it to a pillar, no day/kind
 * commitment yet. This is Exploration in the Content OS ladder (docs/arganta-
 * content-os.md §1): free, before anything costs a slot or a generation credit. */
function ConceptBoard({ creator, concepts, onAdd, onSchedule, onDelete }: {
  creator: Creator
  concepts: IgPlanItem[]
  onAdd: (text: string, kind: IgKind, pillar?: string) => void
  onSchedule: (item: IgPlanItem) => void
  onDelete: (id: string) => void
}) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<IgKind>('reel')
  const [pillar, setPillar] = useState('')

  function submit() {
    if (!text.trim()) return
    onAdd(text.trim(), kind, pillar || undefined)
    setText('')
  }

  const byPillar = useMemo(() => {
    const groups = new Map<string, IgPlanItem[]>()
    for (const c2 of concepts) {
      const key = c2.pillar || 'Unsorted'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(c2)
    }
    return groups
  }, [concepts])

  return (
    <>
      <div className="igs-concept-add">
        <textarea
          className="igs-ta sm" placeholder="Spark an idea… (the hook line, or just a fragment)"
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        />
        <div className="igs-row">
          {(['post', 'reel', 'story'] as IgKind[]).map(k => (
            <button key={k} className={'inf-pill' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        <select className="igs-in" value={pillar} onChange={e => setPillar(e.target.value)}>
          <option value="">No pillar yet</option>
          {creator.posts.pillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <button className="igs-send" disabled={!text.trim()} onClick={submit}><Plus size={11} /> Add idea</button>
      </div>

      <div className="igs-concepts">
        {concepts.length === 0 && <div className="inf-note">No ideas captured yet — the box above is a scratchpad, not a schedule.</div>}
        {[...byPillar.entries()].map(([pillarName, items]) => (
          <div key={pillarName} className="igs-concept-group">
            <div className="igs-concept-head">{pillarName}</div>
            {items.map(i => (
              <div key={i.id} className="igs-concept-card">
                <span className={'igs-k k-' + i.kind}>{KIND_LABEL[i.kind]}</span>
                <span className="igs-concept-text">{i.caption}</span>
                <button className="igs-icon" title="Schedule this" onClick={() => onSchedule(i)}><CalendarPlus size={11} /></button>
                <button className="igs-icon" title="Discard" onClick={() => onDelete(i.id)}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

export function IgSimulator({ c }: { c: Creator }) {
  const items = usePlan(s => s.items)
  const cloudLoaded = usePlan(s => s.cloudLoaded)
  const { upsert, remove, seedIfEmpty, loadFromCloud, reconcile } = usePlan()
  const [selId, setSel] = useState<string | null>(null)
  const [batch, setBatch] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const week = useMemo(() => weekOf(new Date()), [])
  const [day, setDay] = useState(() => isoDay(new Date()))

  // P5 — pull the durable plan in before anything auto-seeds, or a fresh
  // browser would seed Arganta locally and then double up once the cloud
  // rows land (same id space, so it'd merge as duplicates rather than dedupe).
  useEffect(() => { void loadFromCloud() }, [loadFromCloud])

  // Arganta ships seeded so the sim is useful on first open; the same call
  // seeds anyone else the moment the founder asks for it. Gated on the cloud
  // load settling first (or there being no cloud to wait for).
  const readyToSeed = !cloudEnabled || cloudLoaded
  useEffect(() => { if (readyToSeed && c.id === 'arganta') seedIfEmpty(c.id, week) }, [readyToSeed, c.id, week, seedIfEmpty])
  useEffect(() => { setSel(null) }, [c.id])

  // Posted-status readback: poll on the same 12s cadence Post Studio's own
  // inbox uses, so a 'sent' item flips to 'posted' once Buffer/Post Studio
  // actually publishes it — no new realtime pattern for one surface.
  useEffect(() => {
    if (!cloudEnabled) return
    void reconcile()
    const id = setInterval(() => void reconcile(), 12000)
    return () => clearInterval(id)
  }, [reconcile])

  const mine = useMemo(() => items.filter(i => i.creatorId === c.id), [items, c.id])
  const sel = mine.find(i => i.id === selId) ?? null
  const byDay = (d: string) => mine.filter(i => i.day === d && !i.isConcept)

  function add(kind: IgKind, forDay = day) {
    const t = new Date().toISOString()
    const item: IgPlanItem = {
      id: uid(), creatorId: c.id, kind, day: forDay,
      slot: kind === 'story' ? 'morning' : undefined,
      caption: '', hashtags: '', status: 'idea', platforms: ['ig'],
      look: 'normal', media: c.looks?.normal,
      createdAt: t, updatedAt: t,
    }
    upsert(item); setSel(item.id)
  }

  const seeded = mine.length > 0
  const [railMode, setRailMode] = useState<'plan' | 'ideas'>('plan')
  const [highlightFilter, setHighlightFilter] = useState<string | null>(null)
  const concepts = useMemo(() => mine.filter(i => i.isConcept), [mine])

  function addConcept(text: string, kind: IgKind, pillar?: string) {
    const t = new Date().toISOString()
    const item: IgPlanItem = {
      id: uid(), creatorId: c.id, kind, day: isoDay(new Date()),
      caption: text, hashtags: '', status: 'idea', platforms: ['ig'],
      pillar, isConcept: true, createdAt: t, updatedAt: t,
    }
    upsert(item)
  }
  function schedule(item: IgPlanItem) {
    upsert({ ...item, isConcept: false, day })
    setRailMode('plan'); setSel(item.id)
  }

  return (
    <div className="igs-body">
      {/* ── plan rail ── */}
      <div className="inf-card igs-rail">
        <div className="inf-h">
          <div className="igs-railtabs" role="group" aria-label="Rail mode">
            <button className={railMode === 'plan' ? 'on' : ''} onClick={() => setRailMode('plan')}>PLAN</button>
            <button className={railMode === 'ideas' ? 'on' : ''} onClick={() => setRailMode('ideas')}>
              <Lightbulb size={10} /> IDEAS{concepts.length > 0 ? ` (${concepts.length})` : ''}
            </button>
          </div>
          <span className="spacer" />
          <button className="igs-icon" title="Batch import" onClick={() => setBatch(true)}><ClipboardPaste size={12} /></button>
        </div>

        {railMode === 'plan' ? (
          <>
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
                  {(i.platforms?.length ?? 1) > 1 && <span className="igs-plat">×{i.platforms!.length}</span>}
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
          </>
        ) : (
          <ConceptBoard creator={c} concepts={concepts} onAdd={addConcept} onSchedule={schedule} onDelete={remove} />
        )}
      </div>

      {/* ── phone ── */}
      <div className="igs-stage">
        <IgPhone
          c={c} items={mine.filter(i => !i.isConcept)} selId={selId} onSelect={setSel} onAdd={k => add(k)} day={day}
          highlightFilter={highlightFilter} onHighlightFilter={setHighlightFilter}
        />
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
