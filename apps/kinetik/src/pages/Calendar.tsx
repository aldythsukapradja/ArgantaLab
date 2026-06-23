import { useState } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { week, occurrencesOn, fmtTime, DOW } from '@lib/cal'
import { ENERGY, initials } from '@data/energy'
import type { EnergyKey, Person } from '@data/types'
import { IconChevron, IconChevronL, IconPlus } from '@components/Icons'

export default function Calendar() {
  const events = useDataStore(s => s.events)
  const routines = useDataStore(s => s.routines)
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const addEvent = useDataStore(s => s.addEvent)
  const { activeCircleId, calWeekOffset, setWeekOffset, calFilter, setFilter } = useUiStore()

  const [adding, setAdding] = useState<string | null>(null) // iso date or null
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))
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
                {DOW[d.dow]}<small>{d.date.getDate()}</small>
                <button className="b-add" onClick={() => setAdding(d.iso)} aria-label="Add">+</button>
              </div>
              {cols.map(p => (
                <div key={p.id} className={`b-cell${d.isWeekend ? ' wknd' : ''}`}>
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
  const d = new Date(date + 'T00:00')
  const endOf = (s: string) => { const [h, m] = s.split(':').map(Number); return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
  const ok = title.trim() && who.length > 0 && !saving

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
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h3 className="sheet-title">Add on {d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
        <input className="field" placeholder="What’s the plan?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
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
