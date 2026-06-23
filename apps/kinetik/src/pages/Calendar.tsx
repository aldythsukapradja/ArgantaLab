import { useState, useMemo } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { week, occurrencesOn, fmtTime, DOW, monthGrid } from '@lib/cal'
import type { MonthCell } from '@lib/cal'
import { initials } from '@data/energy'
import type { Person } from '@data/types'
import { IconChevron, IconChevronL, IconPlus } from '@components/Icons'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEK_DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const DURS = [{ min: 15, label: '15m' }, { min: 30, label: '30m' }, { min: 60, label: '1h' }, { min: 90, label: '1h30' }, { min: 120, label: '2h' }]

const addMin = (hhmm: string, min: number) => {
  const [h, m] = hhmm.split(':').map(Number)
  const t = (h * 60 + m + min) % (24 * 60)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const durText = (min: number) =>
  min < 60 ? `${min}m` : min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h ${min % 60}m`

export default function Calendar() {
  const events     = useDataStore(s => s.events)
  const routines   = useDataStore(s => s.routines)
  const circles    = useDataStore(s => s.circles)
  const people     = useDataStore(s => s.people)
  const addEvent   = useDataStore(s => s.addEvent)
  const addRoutine = useDataStore(s => s.addRoutine)
  const {
    activeCircleId,
    calWeekOffset, setWeekOffset,
    calFilter, setFilter,
    calView, setCalView,
    calMonthOffset, setMonthOffset,
  } = useUiStore()

  const [adding, setAdding] = useState<string | null>(null)
  const circle  = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))
  const cols    = calFilter ? members.filter(p => calFilter.includes(p.id)) : members

  const toggle = (id: string) => {
    if (!calFilter) { setFilter([id]); return }
    const next = calFilter.includes(id) ? calFilter.filter(x => x !== id) : [...calFilter, id]
    setFilter(next.length === 0 || next.length === members.length ? null : next)
  }

  // Board: 7-day week
  const days  = week(calWeekOffset)
  const range = `${days[0].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`

  // Month: target month derived from offset
  const now = new Date()
  const targetDate = new Date(now.getFullYear(), now.getMonth() + calMonthOffset, 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cells = useMemo(() => monthGrid(targetDate.getFullYear(), targetDate.getMonth()), [calMonthOffset])

  const activePeopleOn = (dateIso: string): Person[] => {
    const occs = occurrencesOn(events, routines, dateIso, activeCircleId)
    const ids  = new Set(occs.flatMap(o => o.who))
    return members.filter(p => (!calFilter || calFilter.includes(p.id)) && ids.has(p.id))
  }

  const navLabel = calView === 'board'
    ? (calWeekOffset === 0 ? 'This week' : range)
    : `${MONTHS[targetDate.getMonth()]} ${targetDate.getFullYear()}`

  const navPrev = () => calView === 'board' ? setWeekOffset(calWeekOffset - 1) : setMonthOffset(calMonthOffset - 1)
  const navNext = () => calView === 'board' ? setWeekOffset(calWeekOffset + 1) : setMonthOffset(calMonthOffset + 1)

  return (
    <div className="fade-in">
      {/* ── Toolbar: view toggle + navigation ── */}
      <div className="cal-toolbar">
        <div className="view-toggle">
          <button className={`vt-btn${calView === 'board' ? ' on' : ''}`} onClick={() => setCalView('board')}>Board</button>
          <button className={`vt-btn${calView === 'month' ? ' on' : ''}`} onClick={() => setCalView('month')}>Month</button>
        </div>
        <div className="cal-nav-row">
          <button className="cal-nav-btn" onClick={navPrev} aria-label="Previous"><IconChevronL width={13} height={13} /></button>
          <span className="cal-range">{navLabel}</span>
          <button className="cal-nav-btn" onClick={navNext} aria-label="Next"><IconChevron width={13} height={13} /></button>
        </div>
      </div>

      {/* ── Person filter ── */}
      <div className="cal-filters">
        <button className={`chip${!calFilter ? ' on' : ''}`} onClick={() => setFilter(null)}>All</button>
        {members.map(p => {
          const on = calFilter?.includes(p.id)
          return (
            <button
              key={p.id}
              className={`chip${on ? ' on' : ''}`}
              style={on
                ? { background: p.color, borderColor: 'transparent', color: '#fff' }
                : { borderColor: `${p.color}70`, color: p.color }}
              onClick={() => toggle(p.id)}
            >
              {p.name.split(' ')[0]}
            </button>
          )
        })}
      </div>

      {/* ── Board view ── */}
      {calView === 'board' && (
        <div className="card board" style={{ gridTemplateColumns: `40px repeat(${Math.max(cols.length, 1)}, 1fr)` }}>
          {/* Corner */}
          <div className="b-corner" />
          {/* Column headers: avatar + name */}
          {cols.map(p => (
            <div key={p.id} className="b-head">
              <span className="b-av" style={{ background: p.color }}>{initials(p.name)}</span>
              <span className="b-col-name">{p.name.split(' ')[0]}</span>
            </div>
          ))}
          {/* Day rows */}
          {days.map(d => {
            const dayItems = occurrencesOn(events, routines, d.iso, activeCircleId)
            return (
              <div key={d.iso} style={{ display: 'contents' }}>
                <div className={`b-day${d.isToday ? ' today' : ''}${d.isWeekend ? ' wknd' : ''}`}>
                  <span>{DOW[d.dow]}</span>
                  <small>{d.date.getDate()}</small>
                  <button className="b-add" onClick={() => setAdding(d.iso)} aria-label="Add">+</button>
                </div>
                {cols.map(p => (
                  <div key={p.id} className={`b-cell${d.isWeekend ? ' wknd' : ''}`}>
                    {dayItems.filter(e => e.who.includes(p.id)).map(e => (
                      <button
                        key={e.id}
                        className={`ev-chip${e.clash ? ' clash' : ''}${e.kind === 'routine' ? ' routine' : ''}`}
                        style={{ background: p.color }}
                      >
                        <b>{e.title}</b>
                        <small>{fmtTime(e.start)}</small>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Month view ── */}
      {calView === 'month' && (
        <div className="month-wrap">
          <div className="month-head">
            {WEEK_DAYS.map(d => (
              <span key={d} className={`mh-col${d === 'SUN' || d === 'SAT' ? ' wknd' : ''}`}>{d}</span>
            ))}
          </div>
          <div className="month-grid card">
            {cells.map((cell: MonthCell) => {
              const active  = activePeopleOn(cell.iso)
              const visible = active.slice(0, 3)
              const rest    = active.length - 3
              return (
                <button
                  key={cell.iso}
                  className={`m-cell${cell.isToday ? ' today' : ''}${cell.isWeekend ? ' wknd' : ''}${!cell.inMonth ? ' out' : ''}`}
                  disabled={!cell.inMonth}
                  onClick={() => setAdding(cell.iso)}
                >
                  <span className="m-num">{cell.date.getDate()}</span>
                  {active.length > 0 && (
                    <div className="m-dots">
                      {visible.map(p => <span key={p.id} className="m-dot" style={{ background: p.color }} />)}
                      {rest > 0 && <span className="m-more">+{rest}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          <div className="month-legend">
            {members.map(p => (
              <span key={p.id} className="ml-item">
                <span className="ml-dot" style={{ background: p.color }} />
                {p.name.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Add sheet ── */}
      {adding && circle && (
        <QuickAdd
          date={adding}
          members={members}
          circleId={circle.id}
          onClose={() => setAdding(null)}
          onSave={async (e) => {
            if (e.repeat) {
              // Recurring → a real weekly routine on that weekday.
              const day = new Date(e.date + 'T00:00').getDay()
              await addRoutine({ circleId: e.circleId, title: e.title, who: e.who, day, start: e.start, end: e.end })
            } else {
              await addEvent({ circleId: e.circleId, title: e.title, date: e.date, start: e.start, end: e.end, who: e.who })
            }
            setAdding(null)
          }}
        />
      )}
    </div>
  )
}

function QuickAdd({ date, members, circleId, onClose, onSave }: {
  date: string
  members: Person[]
  circleId: string
  onClose: () => void
  onSave: (e: { circleId: string; title: string; date: string; start: string; end: string; who: string[]; repeat: boolean }) => void | Promise<void>
}) {
  const now = new Date()
  const [title,      setTitle]      = useState('')
  const [who,        setWho]        = useState<string[]>([])
  const [pickedDate, setPickedDate] = useState(date)
  const [start,      setStart]      = useState(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`)
  const [durMin,     setDurMin]     = useState(60)
  const [repeat,     setRepeat]     = useState(false)
  const [saving,     setSaving]     = useState(false)

  const endTime  = addMin(start, durMin)
  const endLabel = `Ends ${fmtTime(endTime)} · ${durText(durMin)}`
  const ok       = title.trim().length > 0 && who.length > 0 && !saving

  const toggleWho = (id: string) => setWho(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id])

  const save = async () => {
    if (!ok) return
    setSaving(true)
    try { await onSave({ circleId, title: title.trim(), date: pickedDate, start, end: endTime, who, repeat }) }
    finally { setSaving(false) }
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h3 className="sheet-title">Quick Add</h3>

        <input
          className="field"
          placeholder="What's happening?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
        />

        <div className="sheet-lbl">Who</div>
        <div className="qa-who">
          {members.map(p => {
            const on = who.includes(p.id)
            return (
              <button
                key={p.id}
                className={`chip${on ? ' on' : ''}`}
                style={on
                  ? { background: p.color, borderColor: 'transparent', color: '#fff' }
                  : { borderColor: `${p.color}70`, color: p.color }}
                onClick={() => toggleWho(p.id)}
              >
                {p.name.split(' ')[0]}
              </button>
            )
          })}
        </div>

        <div className="qa-datetime">
          <input className="field" type="date" value={pickedDate} onChange={e => setPickedDate(e.target.value)} />
          <input className="field" type="time" value={start}      onChange={e => setStart(e.target.value)} />
        </div>

        <div className="sheet-lbl">Duration</div>
        <div className="qa-durs">
          {DURS.map(d => (
            <button
              key={d.min}
              className={`dur-chip${durMin === d.min ? ' on' : ''}`}
              onClick={() => setDurMin(d.min)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="qa-end-label">
          {endLabel}
          {repeat && ` · repeats every ${new Date(pickedDate + 'T00:00').toLocaleDateString(undefined, { weekday: 'long' })}`}
        </p>

        <label className="qa-repeat">
          <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
          Repeat weekly
        </label>

        <button
          className="btn grad"
          style={{ width: '100%', marginTop: 18, opacity: ok ? 1 : 0.4 }}
          disabled={!ok}
          onClick={save}
        >
          <IconPlus width={17} height={17} />
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  )
}
