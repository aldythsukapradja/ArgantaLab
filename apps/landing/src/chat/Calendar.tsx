// The interactive calendar — KinetikCircle's cal2 board + month, ported into the
// chat. Board shows real member columns; both views navigate week/month and jump
// to Today. Energy chips + today treatment mirror Kinetik exactly. Grounded: all
// rows come from fetchCalendar(scope); nothing is invented.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ENERGY } from './data'
import { fetchCalendar, week, monthGrid, occurrencesOn, initials, addEvent, addRoutine, type CalendarData, type Occ, type Member } from './calData'
import { supabase, cloudEnabled } from '../lib/supabase'

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const shortT = (t: string) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'a' : 'p'; const h12 = h % 12 || 12; return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}` }

/** How many member columns fit without cramming — narrower screens show fewer,
 * the rest are still reachable by horizontal scroll (never hidden data, just
 * less crammed at a glance). Mirrors the spirit of Kinetik's own board-layout
 * picker, minus the extra UI: this picks a sane default from viewport width. */
function useMaxCols(): number {
  const [n, setN] = useState(() => (typeof window === 'undefined' ? 4 : window.innerWidth < 420 ? 2 : window.innerWidth < 640 ? 3 : 4))
  useEffect(() => {
    const onResize = () => setN(window.innerWidth < 420 ? 2 : window.innerWidth < 640 ? 3 : 4)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return n
}

export function Calendar({ scope, initialView = 'board' }: { scope: string[]; initialView?: 'board' | 'month' }) {
  const maxCols = useMaxCols()
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'board' | 'month'>(initialView)
  const [weekOff, setWeekOff] = useState(0)
  const [monthOff, setMonthOff] = useState(0)
  const [adding, setAdding] = useState<string | null>(null) // iso date being added to
  const key = scope.join(',')

  const load = useCallback((showSpin = false) => {
    if (showSpin) setLoading(true)
    fetchCalendar(scope).then(d => { setData(d); setLoading(false) }).catch(() => { setData(null); setLoading(false) })
  }, [key])

  useEffect(() => { load(true) }, [load])

  // Live: refetch whenever the family's events or routines change in the DB, so
  // an edit made in KinetikCircle (or here) shows up without a manual reload.
  useEffect(() => {
    if (!cloudEnabled || !scope.length) return
    let t: ReturnType<typeof setTimeout>
    const bump = () => { clearTimeout(t); t = setTimeout(() => load(false), 300) }
    const ch = supabase.channel('ac-cal-' + key)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kinetik_events' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kinetik_routines' }, bump)
      .subscribe()
    return () => { clearTimeout(t); supabase.removeChannel(ch) }
  }, [key, load])

  const days = useMemo(() => week(weekOff), [weekOff])
  const range = `${days[0].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
  const monthBase = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + monthOff); return d }, [monthOff])
  const monthLabel = monthBase.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const members = data?.members ?? []
  const visible = members.slice(0, maxCols)
  const c0 = data?.accent[0] ?? '#DCA254', c1 = data?.accent[1] ?? '#8F6B3C'
  const prev = () => view === 'board' ? setWeekOff(w => w - 1) : setMonthOff(m => m - 1)
  const next = () => view === 'board' ? setWeekOff(w => w + 1) : setMonthOff(m => m + 1)
  const today = () => { setWeekOff(0); setMonthOff(0) }
  const atToday = view === 'board' ? weekOff === 0 : monthOff === 0

  return (
    <div className="ac-cal" style={{ ['--c0' as any]: c0, ['--c1' as any]: c1 }}>
      <div className="ac-cal-bar">
        <div className="ac-cal-seg">
          <button className={'ac-cal-seg-btn' + (view === 'board' ? ' on' : '')} onClick={() => setView('board')}>Board</button>
          <button className={'ac-cal-seg-btn' + (view === 'month' ? ' on' : '')} onClick={() => setView('month')}>Month</button>
        </div>
        <div className="ac-cal-nav">
          {!atToday && <button className="ac-cal-today" onClick={today}>Today</button>}
          <button className="ac-cal-navbtn" onClick={prev} aria-label="Previous">‹</button>
          <span className="ac-cal-range">{view === 'board' ? (weekOff === 0 ? 'This week' : range) : monthLabel}</span>
          <button className="ac-cal-navbtn" onClick={next} aria-label="Next">›</button>
          <button className="ac-cal-add" onClick={() => setAdding(new Date().toISOString().slice(0, 10))} aria-label="Add event">＋</button>
        </div>
      </div>

      {adding && data && (
        <AddEvent
          iso={adding} members={members} circleId={scope[0]}
          onClose={() => setAdding(null)}
          onSaved={() => { setAdding(null); load(false) }}
        />
      )}

      {/* Today, always visible — every event today regardless of who it's for, so
          nothing hides just because it isn't assigned to a board column. */}
      {data && view === 'board' && weekOff === 0 && (() => {
        const todayIso = new Date().toISOString().slice(0, 10)
        const items = occurrencesOn(data, todayIso)
        return (
          <div className="ac-cal-today-strip">
            <span className="ac-cal-today-lbl">Today</span>
            {items.length ? items.map(e => <Chip key={e.id} e={e} />) : <span className="ac-cal-today-empty">Nothing on today.</span>}
          </div>
        )
      })()}

      {loading ? <div className="ac-cal-load">Loading your calendar…</div>
        : !data ? <div className="ac-cal-load">Couldn’t reach your calendar.</div>
        : view === 'board' ? (
          <div className="ac-cal-scroll">
            <div className="ac-cal-board" style={{ gridTemplateColumns: `40px repeat(${Math.max(visible.length, 1)}, minmax(64px, 1fr))` }}>
              <div className="ac-cal-corner" />
              {visible.map(p => (
                <div key={p.id} className="ac-cal-head">
                  <span className="ac-cal-av" style={{ background: p.color }}>{initials(p.name)}</span>
                  <span className="ac-cal-hname">{p.name.split(' ')[0]}</span>
                </div>
              ))}
              {visible.length === 0 && <div className="ac-cal-head"><span className="ac-cal-hname">No members</span></div>}
              {days.map(d => {
                const items = occurrencesOn(data, d.iso)
                return (
                  <div key={d.iso} style={{ display: 'contents' }}>
                    <button className={'ac-cal-day' + (d.isToday ? ' today' : '') + (d.isWeekend ? ' wknd' : '')} onClick={() => setAdding(d.iso)} title="Add on this day">
                      <span className="ac-cal-dow">{DOW[d.dow]}</span>
                      <span className="ac-cal-date">{d.date.getDate()}</span>
                    </button>
                    {(visible.length ? visible : [null]).map((p, pi) => (
                      <button key={p?.id ?? pi} className={'ac-cal-cell' + (d.isWeekend ? ' wknd' : '') + (d.isToday ? ' today' : '')} onClick={() => setAdding(d.iso)}>
                        {items.filter(e => !p || e.who.length === 0 || e.who.includes(p.id)).map(e => <Chip key={e.id} e={e} />)}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="ac-cal-scroll"><MonthView data={data} base={monthBase} onPick={setAdding} /></div>
        )}
    </div>
  )
}

function Chip({ e }: { e: Occ }) {
  return (
    <span className={'ac-cal-chip' + (e.routine ? ' routine' : '') + (e.clash ? ' clash' : '')} style={{ ['--ec' as any]: ENERGY[e.energy] }}>
      <b>{e.title}</b>{e.start && <i>{shortT(e.start)}</i>}
    </span>
  )
}

function MonthView({ data, base, onPick }: { data: CalendarData; base: Date; onPick: (iso: string) => void }) {
  const cells = monthGrid(base.getFullYear(), base.getMonth())
  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return (
    <div className="ac-cal-month">
      <div className="ac-cal-mhead">{WEEKDAYS.map((w, i) => <span key={w} className={'ac-cal-mh' + (i === 0 || i === 6 ? ' wknd' : '')}>{w}</span>)}</div>
      <div className="ac-cal-mbody">
        {weeks.map((wk, wi) => (
          <div key={wi} className="ac-cal-mrow">
            {wk.map(c => {
              const items = c.inMonth ? occurrencesOn(data, c.iso) : []
              return (
                <button key={c.iso} className={'ac-cal-mcell' + (c.inMonth ? '' : ' out') + (c.isToday ? ' today' : '') + (c.isWeekend ? ' wknd' : '')} onClick={() => c.inMonth && onPick(c.iso)}>
                  <span className="ac-cal-mnum">{c.date.getDate()}</span>
                  {items.slice(0, 3).map(e => (
                    <span key={e.id} className="ac-cal-mpill" style={{ ['--pc' as any]: ENERGY[e.energy] }}>
                      {e.start && <i>{shortT(e.start)}</i>}<span className="ac-cal-mpill-t">{e.title}</span>
                    </span>
                  ))}
                  {items.length > 3 && <span className="ac-cal-mmore">+{items.length - 3}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// Duration quick-picks + repeat lengths — same choices as Kinetik's QuickAdd,
// trimmed to the handful a parent actually reaches for.
const DURATIONS = [15, 30, 45, 60, 90, 120]
const durLabel = (m: number) => m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}m`
const REPEATS: { k: '4w' | '3m' | '6m' | 'always'; l: string }[] = [{ k: '4w', l: '4 weeks' }, { k: '3m', l: '3 months' }, { k: '6m', l: '6 months' }, { k: 'always', l: 'Always' }]
function untilFor(dateIso: string, k: string): string | null {
  if (k === 'always') return null
  const d = new Date(dateIso + 'T00:00:00')
  if (k === '4w') d.setDate(d.getDate() + 28)
  else if (k === '3m') d.setMonth(d.getMonth() + 3)
  else if (k === '6m') d.setMonth(d.getMonth() + 6)
  return d.toISOString().slice(0, 10)
}
function endFrom(start: string, dur: number): string {
  const [h, m] = start.split(':').map(Number)
  const total = (h * 60 + m + dur) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** The quick-add form — mirrors Kinetik's real QuickAdd fields (title, who,
 * time + duration, weekly repeat) one for one, but in Arganta's own visual
 * language: warm Starpaper sheet, Fraunces heading, ember chips — no purple
 * gradients or Kinetik chrome. Writes a real kinetik_events or (when "repeat
 * weekly" is on) kinetik_routines row; the realtime subscription or onSaved
 * refetch brings it straight onto the board. */
function AddEvent({ iso, members, circleId, onClose, onSaved }: {
  iso: string; members: Member[]; circleId: string; onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(iso)
  const [start, setStart] = useState('09:00')
  const [dur, setDur] = useState(60)
  const [who, setWho] = useState<string[]>([])
  const [weekly, setWeekly] = useState(false)
  const [repeatLen, setRepeatLen] = useState<'4w' | '3m' | '6m' | 'always'>('3m')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 200); return () => clearTimeout(t) }, [])

  const d = new Date(date + 'T00:00:00')
  const weekdayLong = d.toLocaleDateString(undefined, { weekday: 'long' })
  const allOn = who.length === members.length && members.length > 0
  const until = weekly ? untilFor(date, repeatLen) : null
  const toggle = (id: string) => setWho(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id])

  const save = async () => {
    if (!title.trim()) { setErr('Give it a name.'); return }
    setSaving(true); setErr('')
    try {
      const end = endFrom(start, dur)
      if (weekly) await addRoutine({ circleId, title: title.trim(), day: d.getDay(), start, end, who })
      else await addEvent({ circleId, title: title.trim(), date, start, end, who })
      onSaved()
    } catch (e) { setErr((e as Error).message || 'Could not save.'); setSaving(false) }
  }

  return (
    <div className="ac-cal-addscrim" onClick={onClose}>
      <div className="ac-cal-add-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Add to calendar">
        <div className="ac-cal-add-grip" />
        <div className="ac-cal-add-head">
          <div>
            <div className="ac-cal-add-dow">{weekly ? `Every ${weekdayLong}` : weekdayLong}</div>
            <h3 className="ac-cal-add-date">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</h3>
          </div>
          <button className="ac-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <input ref={inputRef} className="ac-cal-add-in" placeholder="What's the plan?" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />

        {!weekly && <input className="ac-cal-add-in ac-cal-add-date-in" type="date" value={date} onChange={e => setDate(e.target.value)} />}

        {members.length > 0 && (
          <>
            <div className="ac-cal-add-lbl">Who</div>
            <div className="ac-cal-add-who">
              <button className={'ac-cal-add-chip all' + (allOn ? ' on' : '')} onClick={() => setWho(allOn ? [] : members.map(m => m.id))}>✓ All</button>
              {members.map(m => (
                <button key={m.id} className={'ac-cal-add-chip' + (who.includes(m.id) ? ' on' : '')} onClick={() => toggle(m.id)} style={who.includes(m.id) ? { ['--mc' as any]: m.color } : undefined}>
                  {m.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ac-cal-add-lbl">Time</div>
        <input className="ac-cal-add-in ac-cal-add-time-in" type="time" value={start} onChange={e => setStart(e.target.value)} />
        <div className="ac-cal-add-durs">
          {DURATIONS.map(m => <button key={m} className={'ac-cal-add-dur' + (dur === m ? ' on' : '')} onClick={() => setDur(m)}>{durLabel(m)}</button>)}
        </div>

        <button className={'ac-cal-add-repeat' + (weekly ? ' on' : '')} onClick={() => setWeekly(w => !w)}>
          <span>↻ Repeat weekly</span>
          <span className={'ac-cal-add-toggle' + (weekly ? ' on' : '')}><span /></span>
        </button>
        {weekly && (
          <>
            <div className="ac-cal-add-lbl">Repeat for</div>
            <div className="ac-cal-add-durs">
              {REPEATS.map(o => <button key={o.k} className={'ac-cal-add-dur' + (repeatLen === o.k ? ' on' : '')} onClick={() => setRepeatLen(o.k)}>{o.l}</button>)}
            </div>
            <p className="ac-cal-add-note">Every {weekdayLong}{until ? ` until ${new Date(until + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ' — no end date'}.</p>
          </>
        )}

        {err && <div className="ac-publish-err">{err}</div>}
        <button className="ac-cal-add-save" onClick={save} disabled={saving || !title.trim()}>{saving ? 'Saving…' : weekly ? 'Add routine' : 'Add to calendar'}</button>
      </div>
    </div>
  )
}
