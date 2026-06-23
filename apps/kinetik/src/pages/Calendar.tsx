import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { week, monthGrid, occurrencesOn, fmtTime, DOW } from '@lib/cal'
import { ENERGY, initials } from '@data/energy'
import type { EnergyKey, Person } from '@data/types'
import { IconChevron, IconChevronL, IconPlus } from '@components/Icons'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Calendar() {
  const root = useRef<HTMLDivElement | null>(null)
  const events = useDataStore(s => s.events)
  const routines = useDataStore(s => s.routines)
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const addEvent = useDataStore(s => s.addEvent)
  const {
    activeCircleId, calWeekOffset, setWeekOffset, calFilter, setFilter,
    calView, setCalView, calMonthOffset, setMonthOffset,
  } = useUiStore()

  const [adding, setAdding] = useState<string | null>(null) // iso date or null
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))
  const cols = members.filter(p => !calFilter || calFilter.includes(p.id))
  const days = week(calWeekOffset)
  const range = `${days[0].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`

  // Month header label
  const monthBase = new Date(); monthBase.setDate(1); monthBase.setMonth(monthBase.getMonth() + calMonthOffset)
  const monthLabel = monthBase.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const toggle = (id: string) => {
    if (!calFilter) { setFilter([id]); return }
    const next = calFilter.includes(id) ? calFilter.filter(x => x !== id) : [...calFilter, id]
    setFilter(next.length === 0 || next.length === members.length ? null : next)
  }

  useEffect(() => {
    if (!root.current) return
    const tl = gsap.timeline()
    tl.fromTo(root.current.querySelector('.cal-toolbar'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'cubic.out' }, 0)
    tl.fromTo(root.current.querySelector('.cal-filters'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: 'cubic.out' }, 0.1)
    tl.fromTo(root.current.querySelector('.cal-stage'), { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'cubic.out' }, 0.2)
  }, [calWeekOffset, calMonthOffset, calFilter, calView])

  return (
    <div className="fade-in" ref={root}>
      {/* Toolbar: view toggle + period nav */}
      <div className="cal-toolbar">
        <div className="view-toggle">
          <button className={`vt-btn${calView === 'board' ? ' on' : ''}`} onClick={() => setCalView('board')}>Board</button>
          <button className={`vt-btn${calView === 'month' ? ' on' : ''}`} onClick={() => setCalView('month')}>Month</button>
        </div>
        {calView === 'board' ? (
          <div className="cal-nav-row">
            <button className="cal-nav-btn" onClick={() => setWeekOffset(calWeekOffset - 1)} aria-label="Previous week"><IconChevronL width={14} height={14} /></button>
            <span className="cal-range">{calWeekOffset === 0 ? 'This week' : range}</span>
            <button className="cal-nav-btn" onClick={() => setWeekOffset(calWeekOffset + 1)} aria-label="Next week"><IconChevron width={14} height={14} /></button>
          </div>
        ) : (
          <div className="cal-nav-row">
            <button className="cal-nav-btn" onClick={() => setMonthOffset(calMonthOffset - 1)} aria-label="Previous month"><IconChevronL width={14} height={14} /></button>
            <span className="cal-range">{monthLabel}</span>
            <button className="cal-nav-btn" onClick={() => setMonthOffset(calMonthOffset + 1)} aria-label="Next month"><IconChevron width={14} height={14} /></button>
          </div>
        )}
      </div>

      {/* Member filters (board only) */}
      {calView === 'board' && (
        <div className="cal-filters">
          <button className={`chip${!calFilter ? ' on' : ''}`} onClick={() => setFilter(null)}>All</button>
          {members.map(p => {
            const on = calFilter?.includes(p.id)
            return <button key={p.id} className={`chip${on ? ' on' : ''}`} style={on ? { background: p.color, borderColor: 'transparent' } : { borderColor: p.color, color: p.color }} onClick={() => toggle(p.id)}>{p.name}</button>
          })}
        </div>
      )}

      <div className="cal-stage">
        {calView === 'board' ? (
          <div className="card board" style={{ gridTemplateColumns: `42px repeat(${Math.max(cols.length, 1)}, 1fr)` }}>
            <div className="b-corner" />
            {cols.map(p => (
              <div key={p.id} className="b-head">
                <span className="b-av" style={{ background: p.color }}>{initials(p.name)}</span>
              </div>
            ))}

            {days.map(d => {
              const dayItems = occurrencesOn(events, routines, d.iso, activeCircleId)
              return (
                <div key={d.iso} className="b-rowgroup" style={{ display: 'contents' }}>
                  <div className={`b-day${d.isToday ? ' today' : ''}${d.isWeekend ? ' wknd' : ''}`}>
                    <span className="b-dow">{DOW[d.dow]}</span>
                    <span className="b-date">{d.date.getDate()}</span>
                    <button className="b-add" onClick={() => setAdding(d.iso)} aria-label="Add">+</button>
                  </div>
                  {cols.map(p => (
                    <div key={p.id} className={`b-cell${d.isWeekend ? ' wknd' : ''}${d.isToday ? ' today' : ''}`}>
                      {dayItems.filter(e => e.who.includes(p.id)).map(e => (
                        <button key={e.id} className={`ev-chip${e.clash ? ' clash' : ''}${e.kind === 'routine' ? ' routine' : ''}`} style={{ background: ENERGY[e.energy as EnergyKey] }}>
                          <b>{e.title}</b><small>{fmtTime(e.start)}</small>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ) : (
          <MonthView
            year={monthBase.getFullYear()}
            month={monthBase.getMonth()}
            events={events}
            routines={routines}
            activeCircleId={activeCircleId}
            onPickDay={iso => setAdding(iso)}
          />
        )}
      </div>

      {adding && circle && (
        <QuickAdd
          date={adding}
          members={members}
          circleId={circle.id}
          onClose={() => setAdding(null)}
          onSave={async (e) => { await addEvent(e); setAdding(null) }}
        />
      )}
    </div>
  )
}

/* ---------- Month view ---------- */
function MonthView({ year, month, events, routines, activeCircleId, onPickDay }: {
  year: number; month: number
  events: ReturnType<typeof useDataStore.getState>['events']
  routines: ReturnType<typeof useDataStore.getState>['routines']
  activeCircleId: string
  onPickDay: (iso: string) => void
}) {
  const cells = monthGrid(year, month)
  return (
    <div className="month-wrap">
      <div className="month-head">
        {WEEKDAYS.map((w, i) => <span key={w} className={`mh-col${i === 0 || i === 6 ? ' wknd' : ''}`}>{w}</span>)}
      </div>
      <div className="month-grid">
        {cells.map(c => {
          const items = c.inMonth ? occurrencesOn(events, routines, c.iso, activeCircleId) : []
          return (
            <button
              key={c.iso}
              className={`m-cell${c.inMonth ? '' : ' out'}${c.isToday ? ' today' : ''}${c.isWeekend ? ' wknd' : ''}`}
              onClick={() => c.inMonth && onPickDay(c.iso)}
            >
              <span className="m-num">{c.date.getDate()}</span>
              <span className="m-dots">
                {items.slice(0, 4).map(e => <span key={e.id} className="m-dot" style={{ background: ENERGY[e.energy as EnergyKey] }} />)}
              </span>
              {items.length > 4 && <span className="m-more">+{items.length - 4}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Quick Add bottom-sheet ---------- */
function QuickAdd({ date, members, circleId, onClose, onSave }: {
  date: string
  members: Person[]
  circleId: string
  onClose: () => void
  onSave: (e: { circleId: string; title: string; date: string; start: string; end: string; who: string[] }) => void | Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [who, setWho] = useState<string[]>([])
  const [start, setStart] = useState('09:00')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const d = new Date(date + 'T00:00')
  const endOf = (s: string) => { const [h, m] = s.split(':').map(Number); return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
  const ok = title.trim() && who.length > 0 && !saving

  // Lock the page behind the sheet so iOS doesn't scroll the body, and
  // focus the title only AFTER the slide-up settles (focusing during the
  // transform animation is what caused the jump-scroll on mobile).
  useEffect(() => {
    // The app scrolls inside `.main`, not the body — lock that so iOS can't
    // scroll the page behind the sheet (the old jump-to-bottom behaviour).
    const scroller = document.querySelector('.main') as HTMLElement | null
    const prev = scroller?.style.overflow ?? ''
    if (scroller) scroller.style.overflow = 'hidden'
    const t = setTimeout(() => inputRef.current?.focus(), 440)
    return () => { if (scroller) scroller.style.overflow = prev; clearTimeout(t) }
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await onSave({ circleId, title: title.trim(), date, start, end: endOf(start), who })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="sheet-grip" onClick={onClose} aria-label="Close" />
        <h3 className="sheet-title">Add on {d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
        <input ref={inputRef} className="field" placeholder="What’s the plan?" value={title} onChange={e => setTitle(e.target.value)} />
        <div className="sheet-lbl">Who</div>
        <div className="cal-filters" style={{ paddingLeft: 0 }}>
          {members.map(p => {
            const on = who.includes(p.id)
            return <button key={p.id} className={`chip${on ? ' on' : ''}`} style={on ? { background: p.color, borderColor: 'transparent' } : { borderColor: p.color, color: p.color }} onClick={() => setWho(on ? who.filter(x => x !== p.id) : [...who, p.id])}>{p.name}</button>
          })}
        </div>
        <div className="sheet-lbl">Time</div>
        <input className="field" type="time" value={start} onChange={e => setStart(e.target.value)} />
        <button className="btn grad" style={{ width: '100%', marginTop: 16, opacity: ok ? 1 : 0.5 }} disabled={!ok} onClick={save}>
          <IconPlus width={18} height={18} /> {saving ? 'Saving…' : 'Add to calendar'}
        </button>
      </div>
    </div>
  )
}
