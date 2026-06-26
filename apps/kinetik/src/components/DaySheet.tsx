import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useDataStore } from '@store/dataStore'
import { occurrencesOn, fmtTime, toMin, type Occ } from '@lib/cal'
import { ENERGY, initials, isoOf, colorFor } from '@data/energy'
import type { Circle, Person, EnergyKey } from '@data/types'
import { IconPlus, IconTrash, IconCheck, IconHistory, IconPencil } from '@components/Icons'

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const endFrom = (start: string, dur: number): string => {
  const m = (toMin(start) + dur) % (24 * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const weekdayOf = (iso: string) => new Date(iso + 'T00:00').getDay()
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
const addMonths = (iso: string, n: number) => { const d = new Date(iso + 'T00:00'); d.setMonth(d.getMonth() + n); return isoOf(d) }
const errMsg = (e: unknown): string => {
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    return String(o.message || o.details || o.hint || o.code || JSON.stringify(o))
  }
  return String(e)
}

/* ============================================================
   DaySheet — the expanding day detail + quick-add, shared by the
   Calendar board/month and the Today timeline. Portals to <body>.
   ============================================================ */
export default function DaySheet({ iso, circle, members, onClose }: {
  iso: string; circle: Circle; members: Person[]; onClose: () => void
}) {
  const events = useDataStore(s => s.events)
  const routines = useDataStore(s => s.routines)
  const addEvent = useDataStore(s => s.addEvent)
  const addRoutine = useDataStore(s => s.addRoutine)
  const editEvent = useDataStore(s => s.editEvent)
  const editRoutine = useDataStore(s => s.editRoutine)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Occ | null>(null)

  const accent: [string, string] = [circle.accent[0], circle.accent[1]]
  const items = occurrencesOn(events, routines, iso, circle.id)
  const primaryIds = members.slice(0, 4).map(m => m.id)

  return createPortal(
    <>
      <DayDetail iso={iso} members={members} accent={accent} items={items} onClose={onClose} onAdd={() => setAdding(true)} onEdit={setEditing} />
      {adding && (
        <QuickAdd
          date={iso} members={members} primaryIds={primaryIds} circleId={circle.id} accent={accent}
          onClose={() => setAdding(false)}
          onAddEvent={async e => { await addEvent(e); setAdding(false) }}
          onAddRoutine={async r => { await addRoutine(r); setAdding(false) }}
        />
      )}
      {editing && (
        <EditPlan
          occ={editing} members={members} primaryIds={primaryIds} accent={accent}
          onClose={() => setEditing(null)}
          onSave={async patch => {
            if (editing.kind === 'routine') await editRoutine(editing.id, patch)
            else await editEvent(editing.id, patch)
            setEditing(null)
          }}
        />
      )}
    </>,
    document.body,
  )
}

/* ---------------- Day detail ---------------- */
function DayDetail({ iso, members, accent, items, onClose, onAdd, onEdit }: {
  iso: string; members: Person[]; accent: [string, string]
  items: Occ[]; onClose: () => void; onAdd: () => void; onEdit: (o: Occ) => void
}) {
  const removeEvent = useDataStore(s => s.removeEvent)
  const removeRoutine = useDataStore(s => s.removeRoutine)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const d = new Date(iso + 'T00:00')
  const byId = useMemo(() => new Map(members.map(p => [p.id, p])), [members])

  const del = async (o: Occ) => {
    if (busy) return
    setBusy(o.id); setErr('')
    try { o.kind === 'routine' ? await removeRoutine(o.id) : await removeEvent(o.id) }
    catch (e) { setErr(errMsg(e)) }
    finally { setBusy(null) }
  }

  return (
    <div className="sheet-scrim cal2-scrim2" onClick={onClose}>
      <div className="sheet cal2-sheet" style={{ ['--c0' as any]: accent[0], ['--c1' as any]: accent[1] }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="sheet-grip" onClick={onClose} aria-label="Close" />
        <div className="cal2-dd-head">
          <div>
            <div className="cal2-dd-dow">{WEEKDAYS_LONG[d.getDay()]}</div>
            <h3 className="cal2-dd-date">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</h3>
          </div>
          <span className="cal2-dd-count">{items.length} {items.length === 1 ? 'plan' : 'plans'}</span>
        </div>

        {err && <div className="cal2-err">{err}</div>}

        <div className="cal2-dd-list">
          {items.length === 0 && <div className="cal2-dd-empty">Nothing planned yet.</div>}
          {items.map(o => {
            const who = o.who.map(id => byId.get(id)).filter(Boolean) as Person[]
            return (
              <div key={o.id} className={`cal2-dd-item${o.clash ? ' clash' : ''}`}>
                <span className="cal2-dd-bar" style={{ background: ENERGY[o.energy as EnergyKey] }} />
                <div className="cal2-dd-body">
                  <div className="cal2-dd-title">{o.title}{o.kind === 'routine' && <span className="cal2-dd-weekly">Weekly</span>}{o.clash && <span className="cal2-dd-clash">Overlap</span>}</div>
                  <div className="cal2-dd-time">{fmtTime(o.start)} – {fmtTime(o.end)}</div>
                  <div className="cal2-dd-who">
                    {who.map(p => <span key={p.id} className="cal2-dd-av" style={{ background: colorFor(p.id) }} title={p.name}>{initials(p.name)}</span>)}
                  </div>
                </div>
                <span className="cal2-dd-acts">
                  <button className="cal2-dd-edit" onClick={() => onEdit(o)} aria-label="Edit"><IconPencil width={16} height={16} /></button>
                  <button className="cal2-dd-del" onClick={() => del(o)} disabled={busy === o.id} aria-label="Delete"><IconTrash width={16} height={16} /></button>
                </span>
              </div>
            )
          })}
        </div>

        <button className="btn grad cal2-dd-add" onClick={onAdd}><IconPlus width={18} height={18} /> Add a plan</button>
      </div>
    </div>
  )
}

/* ---------------- Quick add ---------------- */
const DURATIONS = [
  { m: 30, l: '30m' }, { m: 60, l: '1h' }, { m: 90, l: '1h 30' }, { m: 120, l: '2h' }, { m: 180, l: '3h' },
]
const REPEATS = [
  { k: '4w', l: '4 weeks' }, { k: '3m', l: '3 months' }, { k: '6m', l: '6 months' }, { k: 'always', l: 'Always' },
]
const untilFor = (date: string, k: string): string | null =>
  k === '4w' ? addDays(date, 28) : k === '3m' ? addMonths(date, 3) : k === '6m' ? addMonths(date, 6) : null

function QuickAdd({ date, members, primaryIds, circleId, accent, onClose, onAddEvent, onAddRoutine }: {
  date: string
  members: Person[]
  primaryIds: string[]
  circleId: string
  accent: [string, string]
  onClose: () => void
  onAddEvent: (e: { circleId: string; title: string; date: string; start: string; end: string; who: string[] }) => void | Promise<void>
  onAddRoutine: (r: { circleId: string; title: string; who: string[]; day: number; start: string; end: string; repeatUntil?: string }) => void | Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [who, setWho] = useState<string[]>([]) // start deselected — the user picks
  const [start, setStart] = useState('09:00')
  const [dur, setDur] = useState(60)
  const [weekly, setWeekly] = useState(false)
  const [repeatLen, setRepeatLen] = useState('3m')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const d = new Date(date + 'T00:00')

  const primary = members.filter(p => primaryIds.includes(p.id))
  const extra = members.filter(p => !primaryIds.includes(p.id))
  const allOn = who.length === members.length && members.length > 0
  const ok = title.trim() && who.length > 0 && !saving
  const until = weekly ? untilFor(date, repeatLen) : null

  useEffect(() => {
    const scroller = document.querySelector('.main') as HTMLElement | null
    const prev = scroller?.style.overflow ?? ''
    if (scroller) scroller.style.overflow = 'hidden'
    const t = setTimeout(() => inputRef.current?.focus(), 360)
    return () => { if (scroller) scroller.style.overflow = prev; clearTimeout(t) }
  }, [])

  const toggle = (id: string) => setWho(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id])
  const end = endFrom(start, dur)

  const save = async () => {
    setSaving(true); setErr('')
    try {
      if (weekly) await onAddRoutine({ circleId, title: title.trim(), who, day: weekdayOf(date), start, end, repeatUntil: until ?? undefined })
      else await onAddEvent({ circleId, title: title.trim(), date, start, end, who })
    } catch (e) { setErr(errMsg(e)); setSaving(false) }
  }

  const Chip = (p: Person) => {
    const on = who.includes(p.id)
    return (
      <button key={p.id} className={`cal2-who${on ? ' on' : ''}`} onClick={() => toggle(p.id)}
        style={on ? { background: colorFor(p.id), borderColor: 'transparent', color: '#fff' } : { borderColor: colorFor(p.id), color: colorFor(p.id) }}>
        <span className="cal2-who-av" style={{ background: on ? 'rgba(255,255,255,.28)' : colorFor(p.id), color: '#fff' }}>{initials(p.name)}</span>
        {p.name.split(' ')[0]}
      </button>
    )
  }

  return (
    <div className="sheet-scrim cal2-scrim2 cal2-scrim3" onClick={onClose}>
      <div className="sheet cal2-sheet" style={{ ['--c0' as any]: accent[0], ['--c1' as any]: accent[1] }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="sheet-grip" onClick={onClose} aria-label="Close" />
        <div className="cal2-dd-head">
          <div>
            <div className="cal2-dd-dow">{weekly ? `Every ${WEEKDAYS_LONG[d.getDay()]}` : WEEKDAYS_LONG[d.getDay()]}</div>
            <h3 className="cal2-dd-date">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</h3>
          </div>
        </div>

        <input ref={inputRef} className="field" placeholder="What's the plan?" value={title} onChange={e => setTitle(e.target.value)} />

        <div className="cal2-lbl">Who</div>
        <div className="cal2-who-wrap">
          <button className={`cal2-who all${allOn ? ' on' : ''}`} onClick={() => setWho(allOn ? [] : members.map(m => m.id))}>
            <IconCheck width={14} height={14} /> All
          </button>
          {primary.map(Chip)}
          {extra.length > 0 && !showMore && (
            <button className="cal2-who plus" onClick={() => setShowMore(true)} aria-label="Add more members"><IconPlus width={15} height={15} /></button>
          )}
          {showMore && extra.map(Chip)}
        </div>

        <div className="cal2-lbl">Time</div>
        <div className="cal2-time-row">
          <input className="field cal2-time" type="time" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div className="cal2-dur">
          {DURATIONS.map(o => (
            <button key={o.m} className={`cal2-durchip${dur === o.m ? ' on' : ''}`} onClick={() => setDur(o.m)}>{o.l}</button>
          ))}
        </div>

        <button className={`cal2-repeat${weekly ? ' on' : ''}`} onClick={() => setWeekly(w => !w)}>
          <span className="cal2-repeat-l"><IconHistory width={17} height={17} /> Repeat weekly</span>
          <span className={`cal2-toggle${weekly ? ' on' : ''}`}><span className="cal2-knob" /></span>
        </button>
        {weekly && (
          <>
            <div className="cal2-lbl">Repeat for</div>
            <div className="cal2-dur">
              {REPEATS.map(o => (
                <button key={o.k} className={`cal2-durchip${repeatLen === o.k ? ' on' : ''}`} onClick={() => setRepeatLen(o.k)}>{o.l}</button>
              ))}
            </div>
            <p className="cal2-repeat-note">
              Every {WEEKDAYS_LONG[d.getDay()]}{until ? ` until ${new Date(until + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ' — no end date'}.
            </p>
          </>
        )}

        {err && <div className="cal2-err">{err}</div>}

        <button className="btn grad cal2-save" disabled={!ok} onClick={save}>
          <IconPlus width={18} height={18} /> {saving ? 'Saving…' : weekly ? 'Add routine' : 'Add to calendar'}
        </button>
      </div>
    </div>
  )
}

/* ---------------- Edit plan ---------------- */
function EditPlan({ occ, members, primaryIds, accent, onClose, onSave }: {
  occ: Occ
  members: Person[]
  primaryIds: string[]
  accent: [string, string]
  onClose: () => void
  onSave: (patch: { title: string; who: string[]; start: string; end: string }) => void | Promise<void>
}) {
  const [title, setTitle] = useState(occ.title)
  const [who, setWho] = useState<string[]>(occ.who)
  const [start, setStart] = useState(occ.start)
  const [dur, setDur] = useState(Math.max(toMin(occ.end) - toMin(occ.start), 15))
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const primary = members.filter(p => primaryIds.includes(p.id))
  const extra = members.filter(p => !primaryIds.includes(p.id))
  const allOn = who.length === members.length && members.length > 0
  const ok = title.trim() && who.length > 0 && !saving
  const end = endFrom(start, dur)

  useEffect(() => {
    const scroller = document.querySelector('.main') as HTMLElement | null
    const prev = scroller?.style.overflow ?? ''
    if (scroller) scroller.style.overflow = 'hidden'
    return () => { if (scroller) scroller.style.overflow = prev }
  }, [])

  const toggle = (id: string) => setWho(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id])
  const save = async () => {
    setSaving(true); setErr('')
    try { await onSave({ title: title.trim(), who, start, end }) }
    catch (e) { setErr(errMsg(e)); setSaving(false) }
  }

  const Chip = (p: Person) => {
    const on = who.includes(p.id)
    return (
      <button key={p.id} className={`cal2-who${on ? ' on' : ''}`} onClick={() => toggle(p.id)}
        style={on ? { background: colorFor(p.id), borderColor: 'transparent', color: '#fff' } : { borderColor: colorFor(p.id), color: colorFor(p.id) }}>
        <span className="cal2-who-av" style={{ background: on ? 'rgba(255,255,255,.28)' : colorFor(p.id), color: '#fff' }}>{initials(p.name)}</span>
        {p.name.split(' ')[0]}
      </button>
    )
  }

  return (
    <div className="sheet-scrim cal2-scrim2 cal2-scrim3" onClick={onClose}>
      <div className="sheet cal2-sheet" style={{ ['--c0' as any]: accent[0], ['--c1' as any]: accent[1] }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="sheet-grip" onClick={onClose} aria-label="Close" />
        <div className="cal2-dd-head">
          <div>
            <div className="cal2-dd-dow">Edit {occ.kind === 'routine' ? 'routine' : 'plan'}</div>
            <h3 className="cal2-dd-date">{occ.title}</h3>
          </div>
        </div>

        <input className="field" placeholder="What's the plan?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />

        <div className="cal2-lbl">Who</div>
        <div className="cal2-who-wrap">
          <button className={`cal2-who all${allOn ? ' on' : ''}`} onClick={() => setWho(allOn ? [] : members.map(m => m.id))}>
            <IconCheck width={14} height={14} /> All
          </button>
          {primary.map(Chip)}
          {extra.length > 0 && !showMore && (
            <button className="cal2-who plus" onClick={() => setShowMore(true)} aria-label="Add more members"><IconPlus width={15} height={15} /></button>
          )}
          {showMore && extra.map(Chip)}
        </div>

        <div className="cal2-lbl">Time</div>
        <div className="cal2-time-row">
          <input className="field cal2-time" type="time" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div className="cal2-dur">
          {DURATIONS.map(o => (
            <button key={o.m} className={`cal2-durchip${dur === o.m ? ' on' : ''}`} onClick={() => setDur(o.m)}>{o.l}</button>
          ))}
        </div>

        {occ.kind === 'routine' && <p className="cal2-repeat-note">Weekly routine — repeats on this weekday.</p>}
        {err && <div className="cal2-err">{err}</div>}

        <button className="btn grad cal2-save" disabled={!ok} onClick={save}>
          <IconCheck width={18} height={18} /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
