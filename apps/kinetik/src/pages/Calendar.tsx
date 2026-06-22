import { useState } from 'react'
import { useAppStore } from '@store/appStore'
import { week, eventsOn, fmtTime, DOW } from '@lib/cal'
import { CIRCLES, PEOPLE, ENERGY, initials, type EnergyKey } from '@data/seed'
import { IconChevron, IconChevronL, IconPlus } from '@components/Icons'

export default function Calendar() {
  const { events, activeCircleId, calWeekOffset, setWeekOffset, calFilter, setFilter, addEvent } = useAppStore()
  const [adding, setAdding] = useState<string | null>(null)   // iso date or null
  const circle = CIRCLES.find(c => c.id === activeCircleId) ?? CIRCLES[0]
  const members = PEOPLE.filter(p => circle.memberIds.includes(p.id))
  const cols = members.filter(p => !calFilter || calFilter.includes(p.id))
  const days = week(calWeekOffset)
  const range = `${days[0].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`

  const toggle = (id: string) => {
    if (!calFilter) { setFilter([id]); return }
    const next = calFilter.includes(id) ? calFilter.filter(x => x !== id) : [...calFilter, id]
    setFilter(next.length === 0 || next.length === members.length ? null : next)
  }

  return (
    <div className="fade-in">
      <div className="cal-nav">
        <button className="chip" onClick={() => setWeekOffset(calWeekOffset - 1)} aria-label="Previous week"><IconChevronL width={16} height={16} /></button>
        <span className="cal-range">{calWeekOffset === 0 ? 'This week' : range}</span>
        <button className="chip" onClick={() => setWeekOffset(calWeekOffset + 1)} aria-label="Next week"><IconChevron width={16} height={16} /></button>
      </div>

      <div className="cal-filters">
        <button className={`chip${!calFilter ? ' on' : ''}`} onClick={() => setFilter(null)}>All</button>
        {members.map(p => {
          const on = calFilter?.includes(p.id)
          return <button key={p.id} className={`chip${on ? ' on' : ''}`} style={on ? { background: p.color, borderColor: 'transparent' } : { borderColor: p.color, color: p.color }} onClick={() => toggle(p.id)}>{p.name}</button>
        })}
      </div>

      <div className="card board" style={{ gridTemplateColumns: `42px repeat(${cols.length}, 1fr)` }}>
        <div className="b-corner" />
        {cols.map(p => (
          <div key={p.id} className="b-head">
            <span className="b-av" style={{ background: p.color }}>{initials(p.name)}</span>
          </div>
        ))}

        {days.map(d => {
          const dayEvents = eventsOn(events, d.iso, activeCircleId)
          return (
            <div key={d.iso} className="b-rowgroup" style={{ display: 'contents' }}>
              <div className={`b-day${d.isToday ? ' today' : ''}${d.isWeekend ? ' wknd' : ''}`}>
                {DOW[d.dow]}<small>{d.date.getDate()}</small>
                <button className="b-add" onClick={() => setAdding(d.iso)} aria-label="Add">+</button>
              </div>
              {cols.map(p => (
                <div key={p.id} className={`b-cell${d.isWeekend ? ' wknd' : ''}`}>
                  {dayEvents.filter(e => e.who.includes(p.id)).map(e => (
                    <button key={e.id} className={`ev-chip${e.clash ? ' clash' : ''}`} style={{ background: ENERGY[e.energy as EnergyKey] }}>
                      <b>{e.title}</b><small>{fmtTime(e.start)}</small>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {adding && <QuickAdd date={adding} members={members} onClose={() => setAdding(null)} onSave={(e) => { addEvent(e); setAdding(null) }} />}
    </div>
  )
}

function QuickAdd({ date, members, onClose, onSave }: {
  date: string
  members: typeof PEOPLE
  onClose: () => void
  onSave: (e: { circleId: string; title: string; date: string; start: string; end: string; who: string[]; energy: EnergyKey }) => void
}) {
  const activeCircleId = useAppStore(s => s.activeCircleId)
  const [title, setTitle] = useState('')
  const [who, setWho] = useState<string[]>([])
  const [start, setStart] = useState('09:00')
  const energy: EnergyKey = 'mind'
  const d = new Date(date + 'T00:00')
  const endOf = (s: string) => { const [h, m] = s.split(':').map(Number); return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
  const ok = title.trim() && who.length > 0

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h3 className="sheet-title">Add on {d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
        <input className="field" placeholder="What's the plan?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        <div className="sheet-lbl">Who</div>
        <div className="cal-filters" style={{ paddingLeft: 0 }}>
          {members.map(p => {
            const on = who.includes(p.id)
            return <button key={p.id} className={`chip${on ? ' on' : ''}`} style={on ? { background: p.color, borderColor: 'transparent' } : { borderColor: p.color, color: p.color }} onClick={() => setWho(on ? who.filter(x => x !== p.id) : [...who, p.id])}>{p.name}</button>
          })}
        </div>
        <div className="sheet-lbl">Time</div>
        <input className="field" type="time" value={start} onChange={e => setStart(e.target.value)} />
        <button className="btn grad" style={{ width: '100%', marginTop: 16, opacity: ok ? 1 : 0.5 }} disabled={!ok}
          onClick={() => onSave({ circleId: activeCircleId, title: title.trim(), date, start, end: endOf(start), who, energy })}>
          <IconPlus width={18} height={18} /> Add to calendar
        </button>
      </div>
    </div>
  )
}
