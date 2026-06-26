import { useState, useEffect, useRef, useMemo } from 'react'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { week, monthGrid, occurrencesOn, fmtTime, DOW, type Occ } from '@lib/cal'
import { ENERGY, initials, isoOf, colorFor } from '@data/energy'
import type { EnergyKey, Person } from '@data/types'
import { IconChevron, IconChevronL, IconSwitch, IconPhoto } from '@components/Icons'
import DaySheet from '@components/DaySheet'
import * as M from '@repo/momentsRepo'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_COLS = 4

export default function Calendar() {
  const root = useRef<HTMLDivElement | null>(null)
  const events = useDataStore(s => s.events)
  const routines = useDataStore(s => s.routines)
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const {
    activeCircleId, calWeekOffset, setWeekOffset,
    calView, setCalView, calMonthOffset, setMonthOffset,
    boardLayout, setBoardLayout,
  } = useUiStore()

  const [layoutOpen, setLayoutOpen] = useState(false)  // board-layout picker
  const [dayOpen, setDayOpen] = useState<string | null>(null) // iso → detail popup
  const [photoByDate, setPhotoByDate] = useState<Record<string, string>>({})

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  // Roster = the circle's LIVE (active) members only — the real database circle.
  const members = useMemo(
    () => people.filter(p => circle && circle.memberIds.includes(p.id)),
    [people, circle],
  )

  // Which members/columns to show, from the saved layout for this circle.
  // Falls back to the first up-to-4 members when nothing is saved yet.
  const saved = circle ? boardLayout[circle.id] : undefined
  const cols = Math.min(saved?.cols ?? Math.min(MAX_COLS, members.length || 1), MAX_COLS)
  const visible = useMemo(() => {
    const byId = new Map(members.map(m => [m.id, m]))
    const chosen = (saved?.members ?? []).map(id => byId.get(id)).filter(Boolean) as Person[]
    const list = chosen.length ? chosen : members.slice(0, cols)
    return list.slice(0, cols)
  }, [members, saved, cols])

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

  // Family moments → a soft photo backdrop on the day they happened. One signed
  // feed read per circle; we keep the most recent photo per date.
  useEffect(() => {
    if (!circle) return
    let alive = true
    M.fetchFeed(circle.id).then(posts => {
      if (!alive) return
      const map: Record<string, string> = {}
      for (const p of posts) {
        const iso = isoOf(new Date(p.createdAt))
        if (map[iso]) continue
        const photo = p.media.find(m => m.kind === 'photo' && m.url)
        if (photo?.url) map[iso] = photo.url
      }
      setPhotoByDate(map)
    }).catch(() => {})
    return () => { alive = false }
  }, [circle?.id])

  // Pop the column avatars whenever the chosen layout changes (live feedback).
  useEffect(() => {
    const heads = root.current?.querySelectorAll('.cal2-head .cal2-av')
    if (heads?.length) gsap.fromTo(heads, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'back.out(2)' })
  }, [visible.map(v => v.id).join(',')])

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
              {members.length > 0 && (
                <button className="cal2-swap" onClick={() => setLayoutOpen(true)} aria-label="Choose board members & columns" title="Board layout">
                  <IconSwitch width={15} height={15} />
                </button>
              )}
            </div>
            {visible.map(p => (
              <div key={p.id} className="cal2-head">
                <span className="cal2-av" style={{ background: colorFor(p.id) }}>{initials(p.name)}</span>
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
            events={events} routines={routines} members={members} photoByDate={photoByDate}
            activeCircleId={activeCircleId} onPickDay={setDayOpen}
          />
        )}
      </div>

      {/* Day detail + quick add (expands over both views) */}
      {dayOpen && circle && (
        <DaySheet iso={dayOpen} circle={circle} members={members} onClose={() => setDayOpen(null)} />
      )}

      {/* Board layout picker — saved per circle */}
      {layoutOpen && circle && (
        <BoardLayoutSheet
          members={members} accent={[c0, c1]}
          cols={cols} selected={visible.map(v => v.id)}
          onChange={layout => setBoardLayout(circle.id, layout)}
          onClose={() => setLayoutOpen(false)}
        />
      )}
    </div>
  )
}

/* ---------------- Board layout picker ---------------- */
function BoardLayoutSheet({ members, accent, cols, selected, onChange, onClose }: {
  members: Person[]; accent: [string, string]
  cols: number; selected: string[]
  onChange: (layout: { cols: number; members: string[] }) => void
  onClose: () => void
}) {
  const [n, setN] = useState(Math.min(Math.max(cols, 1), Math.min(MAX_COLS, members.length || 1)))
  const [sel, setSel] = useState<string[]>(selected.slice(0, n))

  // Persist live so the board updates behind the sheet and survives reopen.
  useEffect(() => { onChange({ cols: n, members: sel }) }, [n, sel]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const scroller = document.querySelector('.main') as HTMLElement | null
    const prev = scroller?.style.overflow ?? ''
    if (scroller) scroller.style.overflow = 'hidden'
    return () => { if (scroller) scroller.style.overflow = prev }
  }, [])

  const setCols = (v: number) => { setN(v); setSel(s => s.slice(0, v)) }
  const toggle = (id: string) => setSel(s => {
    if (s.includes(id)) return s.filter(x => x !== id)
    if (s.length >= n) return [...s.slice(1), id] // at cap → slide the oldest out
    return [...s, id]
  })

  const colOptions = Array.from({ length: Math.min(MAX_COLS, Math.max(members.length, 1)) }, (_, i) => i + 1)

  return (
    <div className="sheet-scrim cal2-scrim2" onClick={onClose}>
      <div className="sheet cal2-sheet" style={{ ['--c0' as any]: accent[0], ['--c1' as any]: accent[1] }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="sheet-grip" onClick={onClose} aria-label="Close" />
        <div className="cal2-dd-head">
          <div>
            <div className="cal2-dd-dow">Board layout</div>
            <h3 className="cal2-dd-date">Who's on the board</h3>
          </div>
        </div>

        {/* live preview of the chosen columns */}
        <div className="cal2-lay-prev">
          {Array.from({ length: n }, (_, i) => {
            const m = sel[i] ? members.find(x => x.id === sel[i]) : undefined
            return (
              <div key={i} className="cal2-lay-col">
                <span className={`cal2-lay-slot${m ? ' on' : ''}`} style={m ? { background: colorFor(m.id) } : undefined}>{m ? initials(m.name) : i + 1}</span>
                <small>{m ? m.name.split(' ')[0] : '—'}</small>
              </div>
            )
          })}
        </div>

        <div className="cal2-lbl">Columns</div>
        <div className="cal2-dur">
          {colOptions.map(o => (
            <button key={o} className={`cal2-durchip${n === o ? ' on' : ''}`} onClick={() => setCols(o)}>{o}</button>
          ))}
        </div>

        <div className="cal2-lbl">Show these members <span className="cal2-lay-hint">pick up to {n}</span></div>
        <div className="cal2-lay-list">
          {members.map(m => {
            const idx = sel.indexOf(m.id)
            const on = idx >= 0
            return (
              <button key={m.id} className={`cal2-lay-item${on ? ' on' : ''}`} onClick={() => toggle(m.id)}>
                <span className="cal2-lay-av" style={{ background: colorFor(m.id) }}>{initials(m.name)}</span>
                <span className="cal2-lay-name">{m.name}</span>
                <span className={`cal2-lay-check${on ? ' on' : ''}`}>{on ? idx + 1 : ''}</span>
              </button>
            )
          })}
        </div>

        <button className="btn grad cal2-save" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

/* ---------------- Month view ---------------- */
function MonthView({ year, month, events, routines, members, photoByDate, activeCircleId, onPickDay }: {
  year: number; month: number
  events: ReturnType<typeof useDataStore.getState>['events']
  routines: ReturnType<typeof useDataStore.getState>['routines']
  members: Person[]
  photoByDate: Record<string, string>
  activeCircleId: string
  onPickDay: (iso: string) => void
}) {
  const cells = monthGrid(year, month)
  // Same live-member basis as the Board: only count entries involving a current
  // circle member, so the month dots match what the Board actually shows.
  const liveIds = new Set(members.map(m => m.id))
  const isLive = (o: Occ) => o.who.length === 0 || o.who.some(id => liveIds.has(id))
  const colorOf = (o: Occ): string => {
    const m = members.find(p => o.who.includes(p.id))
    return m ? colorFor(m.id) : ENERGY[o.energy as EnergyKey]
  }
  return (
    <div className="cal2-month">
      <div className="cal2-month-head">
        {WEEKDAYS.map((w, i) => <span key={w} className={`cal2-mh${i === 0 || i === 6 ? ' wknd' : ''}`}>{w}</span>)}
      </div>
      <div className="cal2-month-grid">
        {cells.map(c => {
          const items = c.inMonth ? occurrencesOn(events, routines, c.iso, activeCircleId).filter(isLive) : []
          const photo = c.inMonth ? photoByDate[c.iso] : undefined
          return (
            <button
              key={c.iso}
              className={`cal2-mcell${c.inMonth ? '' : ' out'}${c.isToday ? ' today' : ''}${c.isWeekend ? ' wknd' : ''}${photo ? ' has-photo' : ''}`}
              onClick={() => c.inMonth && onPickDay(c.iso)}
            >
              {photo && <img className="cal2-mphoto" src={photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
              <span className="cal2-mtop">
                <span className="cal2-mnum">{c.date.getDate()}</span>
                {photo && <IconPhoto className="cal2-mphoto-badge" width={13} height={13} />}
              </span>
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
