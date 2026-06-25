import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { week, monthGrid, occurrencesOn, fmtTime, toMin, DOW, type Occ } from '@lib/cal'
import { ENERGY, initials } from '@data/energy'
import type { EnergyKey, Person } from '@data/types'
import { IconChevron, IconChevronL, IconPlus, IconSwitch, IconTrash, IconCheck, IconHistory } from '@components/Icons'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MAX_COLS = 4

/** Minutes → end time, given a start HH:MM. */
const endFrom = (start: string, dur: number): string => {
  const m = (toMin(start) + dur) % (24 * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const weekdayOf = (iso: string) => new Date(iso + 'T00:00').getDay()
const errMsg = (e: unknown): string => {
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    return String(o.message || o.details || o.hint || o.code || JSON.stringify(o))
  }
  return String(e)
}

export default function Calendar() {
  const root = useRef<HTMLDivElement | null>(null)
  const events = useDataStore(s => s.events)
  const routines = useDataStore(s => s.routines)
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const addEvent = useDataStore(s => s.addEvent)
  const addRoutine = useDataStore(s => s.addRoutine)
  const {
    activeCircleId, calWeekOffset, setWeekOffset,
    calView, setCalView, calMonthOffset, setMonthOffset,
  } = useUiStore()

  const [rotate, setRotate] = useState(0)       // member-window offset
  const [dayOpen, setDayOpen] = useState<string | null>(null) // iso → detail popup
  const [adding, setAdding] = useState<string | null>(null)   // iso → quick-add sheet

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = useMemo(
    () => people.filter(p => circle && circle.memberIds.includes(p.id)),
    [people, circle],
  )

  // Up to 4 columns, equal width. With more members, a swap button rotates which
  // four are shown (the rest stay reachable, no horizontal overflow).
  const overflow = members.length > MAX_COLS
  const visible = useMemo(() => {
    if (members.length <= MAX_COLS) return members
    return Array.from({ length: MAX_COLS }, (_, i) => members[(rotate + i) % members.length])
  }, [members, rotate])

  const c0 = circle?.accent[0] ?? '#8B5CF6'
  const c1 = circle?.accent[1] ?? '#C4B5FD'

  const days = week(calWeekOffset)
  const range = `${days[0].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`

  const monthBase = new Date(); monthBase.setDate(1); monthBase.setMonth(monthBase.getMonth() + calMonthOffset)
  const monthLabel = monthBase.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  useEffect(() => {
    if (!root.current) return
    const tl = gsap.timeline()
    tl.fromTo(root.current.querySelector('.cal2-bar'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'cubic.out' }, 0)
    tl.fromTo(root.current.querySelector('.cal2-stage'), { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'cubic.out' }, 0.12)
  }, [calWeekOffset, calMonthOffset, calView])

  const doSwap = () => {
    setRotate(r => (r + 1) % Math.max(members.length, 1))
    const heads = root.current?.querySelectorAll('.cal2-head .cal2-av')
    if (heads) gsap.fromTo(heads, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'back.out(2)' })
  }

  return (
    <div className="fade-in cal2" ref={root} style={{ ['--c0' as any]: c0, ['--c1' as any]: c1 }}>
      {/* Toolbar */}
      <div className="cal2-bar">
        <div className="cal2-seg">
          <button className={`cal2-seg-btn${calView === 'board' ? ' on' : ''}`} onClick={() => setCalView('board')}>Board</button>
          <button className={`cal2-seg-btn${calView === 'month' ? ' on' : ''}`} onClick={() => setCalView('month')}>Month</button>
        </div>
        <div className="cal2-nav">
          <button className="cal2-nav-btn" onClick={() => calView === 'board' ? setWeekOffset(calWeekOffset - 1) : setMonthOffset(calMonthOffset - 1)} aria-label="Previous"><IconChevronL width={15} height={15} /></button>
          <span className="cal2-range">{calView === 'board' ? (calWeekOffset === 0 ? 'This week' : range) : monthLabel}</span>
          <button className="cal2-nav-btn" onClick={() => calView === 'board' ? setWeekOffset(calWeekOffset + 1) : setMonthOffset(calMonthOffset + 1)} aria-label="Next"><IconChevron width={15} height={15} /></button>
        </div>
      </div>

      <div className="cal2-stage">
        {calView === 'board' ? (
          <div className="cal2-board" style={{ gridTemplateColumns: `52px repeat(${Math.max(visible.length, 1)}, minmax(0, 1fr))` }}>
            {/* header row */}
            <div className="cal2-corner">
              {overflow && (
                <button className="cal2-swap" onClick={doSwap} aria-label="Swap members" title="Show other members">
                  <IconSwitch width={15} height={15} />
                </button>
              )}
            </div>
            {visible.map(p => (
              <div key={p.id} className="cal2-head">
                <span className="cal2-av" style={{ background: p.color }}>{initials(p.name)}</span>
                <span className="cal2-head-name">{p.name.split(' ')[0]}</span>
              </div>
            ))}

            {/* day rows */}
            {days.map(d => {
              const items = occurrencesOn(events, routines, d.iso, activeCircleId)
              return (
                <div key={d.iso} style={{ display: 'contents' }}>
                  <button className={`cal2-day${d.isToday ? ' today' : ''}${d.isWeekend ? ' wknd' : ''}`} onClick={() => setDayOpen(d.iso)}>
                    <span className="cal2-dow">{DOW[d.dow]}</span>
                    <span className="cal2-date">{d.date.getDate()}</span>
                  </button>
                  {visible.map(p => {
                    const mine = items.filter(e => e.who.includes(p.id))
                    return (
                      <button key={p.id} className={`cal2-cell${d.isWeekend ? ' wknd' : ''}${d.isToday ? ' today' : ''}`} onClick={() => setDayOpen(d.iso)}>
                        {mine.map(e => (
                          <span key={e.id} className={`cal2-chip${e.clash ? ' clash' : ''}${e.kind === 'routine' ? ' routine' : ''}`} style={{ background: ENERGY[e.energy as EnergyKey] }}>
                            <b>{e.title}</b><i>{fmtTime(e.start)}</i>
                          </span>
                        ))}
                        {mine.length === 0 && <span className="cal2-cell-add">+</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          <MonthView
            year={monthBase.getFullYear()} month={monthBase.getMonth()}
            events={events} routines={routines} members={members}
            activeCircleId={activeCircleId} onPickDay={setDayOpen}
          />
        )}
      </div>

      {/* Day detail popup — both views */}
      {dayOpen && circle && createPortal(
        <DayDetail
          iso={dayOpen} members={members} accent={[c0, c1]}
          items={occurrencesOn(events, routines, dayOpen, activeCircleId)}
          onClose={() => setDayOpen(null)}
          onAdd={() => setAdding(dayOpen)}
        />, document.body)}

      {/* Quick add sheet (renders above the detail) */}
      {adding && circle && createPortal(
        <QuickAdd
          date={adding} members={members} visibleIds={visible.map(v => v.id)}
          circleId={circle.id} accent={[c0, c1]}
          onClose={() => setAdding(null)}
          onAddEvent={async e => { await addEvent(e); setAdding(null) }}
          onAddRoutine={async r => { await addRoutine(r); setAdding(null) }}
        />, document.body)}
    </div>
  )
}

/* ---------------- Month view ---------------- */
function MonthView({ year, month, events, routines, members, activeCircleId, onPickDay }: {
  year: number; month: number
  events: ReturnType<typeof useDataStore.getState>['events']
  routines: ReturnType<typeof useDataStore.getState>['routines']
  members: Person[]
  activeCircleId: string
  onPickDay: (iso: string) => void
}) {
  const cells = monthGrid(year, month)
  const colorOf = (o: Occ): string => {
    const m = members.find(p => o.who.includes(p.id))
    return m?.color ?? ENERGY[o.energy as EnergyKey]
  }
  return (
    <div className="cal2-month">
      <div className="cal2-month-head">
        {WEEKDAYS.map((w, i) => <span key={w} className={`cal2-mh${i === 0 || i === 6 ? ' wknd' : ''}`}>{w}</span>)}
      </div>
      <div className="cal2-month-grid">
        {cells.map(c => {
          const items = c.inMonth ? occurrencesOn(events, routines, c.iso, activeCircleId) : []
          return (
            <button
              key={c.iso}
              className={`cal2-mcell${c.inMonth ? '' : ' out'}${c.isToday ? ' today' : ''}${c.isWeekend ? ' wknd' : ''}`}
              onClick={() => c.inMonth && onPickDay(c.iso)}
            >
              <span className="cal2-mnum">{c.date.getDate()}</span>
              {items.length > 0 && (
                <span className="cal2-mdots">
                  {items.slice(0, 4).map(e => <span key={e.id} className="cal2-mdot" style={{ background: colorOf(e) }} />)}
                  {items.length > 4 && <span className="cal2-mmore">+{items.length - 4}</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Day detail popup ---------------- */
function DayDetail({ iso, members, accent, items, onClose, onAdd }: {
  iso: string; members: Person[]; accent: [string, string]
  items: Occ[]; onClose: () => void; onAdd: () => void
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
                    {who.map(p => <span key={p.id} className="cal2-dd-av" style={{ background: p.color }} title={p.name}>{initials(p.name)}</span>)}
                  </div>
                </div>
                <button className="cal2-dd-del" onClick={() => del(o)} disabled={busy === o.id} aria-label="Delete"><IconTrash width={16} height={16} /></button>
              </div>
            )
          })}
        </div>

        <button className="btn grad cal2-dd-add" onClick={onAdd}><IconPlus width={18} height={18} /> Add a plan</button>
      </div>
    </div>
  )
}

/* ---------------- Quick add sheet ---------------- */
const DURATIONS = [
  { m: 30, l: '30m' }, { m: 60, l: '1h' }, { m: 90, l: '1h 30' }, { m: 120, l: '2h' }, { m: 180, l: '3h' },
]

function QuickAdd({ date, members, visibleIds, circleId, accent, onClose, onAddEvent, onAddRoutine }: {
  date: string
  members: Person[]
  visibleIds: string[]
  circleId: string
  accent: [string, string]
  onClose: () => void
  onAddEvent: (e: { circleId: string; title: string; date: string; start: string; end: string; who: string[] }) => void | Promise<void>
  onAddRoutine: (r: { circleId: string; title: string; who: string[]; day: number; start: string; end: string }) => void | Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [who, setWho] = useState<string[]>(visibleIds)
  const [start, setStart] = useState('09:00')
  const [dur, setDur] = useState(60)
  const [weekly, setWeekly] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const d = new Date(date + 'T00:00')

  // primary chips = the members visible on the board; the rest live behind "+"
  const primary = members.filter(p => visibleIds.includes(p.id))
  const extra = members.filter(p => !visibleIds.includes(p.id))
  const allOn = who.length === members.length && members.length > 0
  const ok = title.trim() && who.length > 0 && !saving

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
      if (weekly) await onAddRoutine({ circleId, title: title.trim(), who, day: weekdayOf(date), start, end })
      else await onAddEvent({ circleId, title: title.trim(), date, start, end, who })
    } catch (e) { setErr(errMsg(e)); setSaving(false) }
  }

  const Chip = (p: Person) => {
    const on = who.includes(p.id)
    return (
      <button key={p.id} className={`cal2-who${on ? ' on' : ''}`} onClick={() => toggle(p.id)}
        style={on ? { background: p.color, borderColor: 'transparent', color: '#fff' } : { borderColor: p.color, color: p.color }}>
        <span className="cal2-who-av" style={{ background: on ? 'rgba(255,255,255,.28)' : p.color, color: on ? '#fff' : '#fff' }}>{initials(p.name)}</span>
        {p.name.split(' ')[0]}
      </button>
    )
  }

  return (
    <div className="sheet-scrim cal2-scrim2" onClick={onClose}>
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
          <span className="cal2-time-end">ends {fmtTime(end)}</span>
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
        {weekly && <p className="cal2-repeat-note">Saved as a routine — repeats every {WEEKDAYS_LONG[d.getDay()]}.</p>}

        {err && <div className="cal2-err">{err}</div>}

        <button className="btn grad cal2-save" disabled={!ok} onClick={save}>
          <IconPlus width={18} height={18} /> {saving ? 'Saving…' : weekly ? 'Add routine' : 'Add to calendar'}
        </button>
      </div>
    </div>
  )
}
