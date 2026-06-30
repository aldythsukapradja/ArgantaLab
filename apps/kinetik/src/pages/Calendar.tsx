import { useState, useEffect, useRef, useMemo } from 'react'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { week, monthGrid, occurrencesOn, blocksOn, blocksInRange, fmtTime, DOW, type Occ } from '@lib/cal'
import { ENERGY, initials, isoOf, colorFor } from '@data/energy'
import type { EnergyKey, Person, KEvent } from '@data/types'
import { IconChevron, IconChevronL, IconSwitch, IconPhoto, IconCalendar, IconCheck, IconToday } from '@components/Icons'
import DaySheet from '@components/DaySheet'
import * as M from '@repo/momentsRepo'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_COLS = 4

/** Compact time for a month pill: "9a", "2:30p". */
const shortT = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h < 12 ? 'a' : 'p'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}`
}

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
  const [blockOpen, setBlockOpen] = useState(false)    // block-out-dates sheet
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
          <button
            className="cal2-today-btn"
            disabled={calView === 'board' ? calWeekOffset === 0 : calMonthOffset === 0}
            onClick={() => calView === 'board' ? setWeekOffset(0) : setMonthOffset(0)}
            title="Jump to today"
          >
            <IconToday width={14} height={14} /><span>Today</span>
          </button>
          <button className="cal2-nav-btn" onClick={() => calView === 'board' ? setWeekOffset(calWeekOffset - 1) : setMonthOffset(calMonthOffset - 1)} aria-label="Previous"><IconChevronL width={15} height={15} /></button>
          <span className="cal2-range">{calView === 'board' ? (calWeekOffset === 0 ? 'This week' : range) : monthLabel}</span>
          <button className="cal2-nav-btn" onClick={() => calView === 'board' ? setWeekOffset(calWeekOffset + 1) : setMonthOffset(calMonthOffset + 1)} aria-label="Next"><IconChevron width={15} height={15} /></button>
        </div>
        {circle && (
          <button className="cal2-block-btn" onClick={() => setBlockOpen(true)} title="Block out a range of dates">
            <IconCalendar width={15} height={15} /><span>Block</span>
          </button>
        )}
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
              const dayBlocks = blocksOn(events, d.iso, activeCircleId).filter(b => b.who.length === 0 || b.who.some(id => members.some(m => m.id === id)))
              const blocked = dayBlocks.length > 0
              return (
                <div key={d.iso} style={{ display: 'contents' }}>
                  <button className={`cal2-day${d.isToday ? ' today' : ''}${d.isWeekend ? ' wknd' : ''}${blocked ? ' blocked' : ''}`} onClick={() => setDayOpen(d.iso)}>
                    <span className="cal2-dow">{DOW[d.dow]}</span>
                    <span className="cal2-date">{d.date.getDate()}</span>
                    {blocked && <span className="cal2-day-block" title={dayBlocks.map(b => b.title).join(', ')}>{dayBlocks[0].title.split(' ')[0]}</span>}
                  </button>
                  {visible.map(p => {
                    const mine = items.filter(e => e.who.includes(p.id))
                    return (
                      <button key={p.id} className={`cal2-cell${d.isWeekend ? ' wknd' : ''}${d.isToday ? ' today' : ''}${blocked ? ' blocked' : ''}`} onClick={() => setDayOpen(d.iso)}>
                        {mine.map(e => (
                          <span key={e.id} className={`cal2-chip${e.clash ? ' clash' : ''}${e.kind === 'routine' ? ' routine' : ''}`} style={{ ['--ec' as any]: ENERGY[e.energy as EnergyKey] }}>
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

      {/* Block-out-dates sheet */}
      {blockOpen && circle && (
        <BlockSheet
          circleId={circle.id} members={members} accent={[c0, c1]}
          onClose={() => setBlockOpen(false)}
        />
      )}
    </div>
  )
}

/* ---------------- Block out dates sheet ---------------- */
function BlockSheet({ circleId, members, accent, onClose }: {
  circleId: string; members: Person[]; accent: [string, string]; onClose: () => void
}) {
  const addBlock = useDataStore(s => s.addBlock)
  const today = isoOf(new Date())
  const [title, setTitle] = useState('')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [who, setWho] = useState<string[]>(members.map(m => m.id)) // default: whole circle
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const scroller = document.querySelector('.main') as HTMLElement | null
    const prev = scroller?.style.overflow ?? ''
    if (scroller) scroller.style.overflow = 'hidden'
    const t = setTimeout(() => inputRef.current?.focus(), 360)
    return () => { if (scroller) scroller.style.overflow = prev; clearTimeout(t) }
  }, [])

  // Keep the range sane: end never before start.
  const end = to < from ? from : to
  const allOn = who.length === members.length && members.length > 0
  const dayCount = Math.round((new Date(end + 'T00:00').getTime() - new Date(from + 'T00:00').getTime()) / 86400000) + 1
  const ok = title.trim() && who.length > 0 && !saving

  const toggle = (id: string) => setWho(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id])

  const save = async () => {
    setSaving(true); setErr('')
    try {
      await addBlock({ circleId, title: title.trim(), date: from, endDate: end, who })
      onClose()
    } catch (e) {
      setErr(e && typeof e === 'object' ? String((e as Record<string, unknown>).message ?? e) : String(e))
      setSaving(false)
    }
  }

  return (
    <div className="sheet-scrim cal2-scrim2 cal2-scrim3" onClick={onClose}>
      <div className="sheet cal2-sheet" style={{ ['--c0' as any]: accent[0], ['--c1' as any]: accent[1] }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="sheet-grip" onClick={onClose} aria-label="Close" />
        <div className="cal2-dd-head">
          <div>
            <div className="cal2-dd-dow">Block out dates</div>
            <h3 className="cal2-dd-date">Set a date range</h3>
          </div>
          <span className="cal2-dd-count">{dayCount} day{dayCount === 1 ? '' : 's'}</span>
        </div>

        <input ref={inputRef} className="field" placeholder="What's it for? (e.g. trip, exams, event)" value={title} onChange={e => setTitle(e.target.value)} />

        <div className="cal2-lbl">From → To</div>
        <div className="cal2-block-dates">
          <input className="field cal2-time" type="date" value={from} onChange={e => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value) }} />
          <span className="cal2-block-arrow"><IconChevron width={16} height={16} /></span>
          <input className="field cal2-time" type="date" value={end} min={from} onChange={e => setTo(e.target.value)} />
        </div>

        <div className="cal2-lbl">Who it's for</div>
        <div className="cal2-who-wrap">
          <button className={`cal2-who all${allOn ? ' on' : ''}`} onClick={() => setWho(allOn ? [] : members.map(m => m.id))}>
            <IconCheck width={14} height={14} /> Everyone
          </button>
          {members.map(p => {
            const on = who.includes(p.id)
            return (
              <button key={p.id} className={`cal2-who${on ? ' on' : ''}`} onClick={() => toggle(p.id)}
                style={on ? { background: colorFor(p.id), borderColor: 'transparent', color: '#fff' } : { borderColor: colorFor(p.id), color: colorFor(p.id) }}>
                <span className="cal2-who-av" style={{ background: on ? 'rgba(255,255,255,.28)' : colorFor(p.id), color: '#fff' }}>{initials(p.name)}</span>
                {p.name.split(' ')[0]}
              </button>
            )
          })}
        </div>

        {err && <div className="cal2-err">{err}</div>}

        <button className="btn grad cal2-save" disabled={!ok} onClick={save}>
          <IconCalendar width={18} height={18} /> {saving ? 'Saving…' : `Block ${dayCount} day${dayCount === 1 ? '' : 's'}`}
        </button>
      </div>
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

/* ---------------- Month view (Outlook-style: event pills + spanning blocks) ---------------- */
const NUM_H = 26   // px reserved at the top of each cell for the date number
const BAR_H = 19   // px per block lane

interface BlockSeg { block: KEvent; startCol: number; endCol: number; span: number; lane: number; showLabel: boolean }

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
  // circle member, so the month matches what the Board actually shows.
  const liveIds = new Set(members.map(m => m.id))
  const isLive = (o: { who: string[] }) => o.who.length === 0 || o.who.some(id => liveIds.has(id))
  // Unified with the Board: every entry is coloured by its ENERGY, not by member.
  const colorOf = (o: Occ): string => ENERGY[o.energy as EnergyKey]

  // Chunk the 35/42 cells into week rows.
  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  // All blocks intersecting this month grid (live members only).
  const allBlocks = blocksInRange(events, cells[0].iso, cells[cells.length - 1].iso, activeCircleId).filter(isLive)

  return (
    <div className="cal2-month">
      <div className="cal2-month-head">
        {WEEKDAYS.map((w, i) => <span key={w} className={`cal2-mh${i === 0 || i === 6 ? ' wknd' : ''}`}>{w}</span>)}
      </div>
      <div className="cal2-month-body">
        {weeks.map((wk, wi) => (
          <MonthWeek
            key={wi} cells={wk} blocks={allBlocks}
            events={events} routines={routines} activeCircleId={activeCircleId}
            isLive={isLive} colorOf={colorOf} photoByDate={photoByDate} onPickDay={onPickDay}
          />
        ))}
      </div>
    </div>
  )
}

function MonthWeek({ cells, blocks, events, routines, activeCircleId, isLive, colorOf, photoByDate, onPickDay }: {
  cells: ReturnType<typeof monthGrid>
  blocks: KEvent[]
  events: ReturnType<typeof useDataStore.getState>['events']
  routines: ReturnType<typeof useDataStore.getState>['routines']
  activeCircleId: string
  isLive: (o: { who: string[] }) => boolean
  colorOf: (o: Occ) => string
  photoByDate: Record<string, string>
  onPickDay: (iso: string) => void
}) {
  const weekStart = cells[0].iso
  const weekEnd = cells[cells.length - 1].iso

  // Lay block spans out into lanes for this week (greedy, longest-first).
  const segs: BlockSeg[] = []
  const laneEnds: number[] = []  // laneEnds[k] = endCol of last seg placed in lane k
  const intersecting = blocks
    .filter(b => b.date <= weekEnd && (b.endDate ?? b.date) >= weekStart)
    .map(b => {
      const s = b.date < weekStart ? weekStart : b.date
      const e = (b.endDate ?? b.date) > weekEnd ? weekEnd : (b.endDate ?? b.date)
      const startCol = Math.max(0, cells.findIndex(c => c.iso === s))
      const endCol = Math.max(startCol, cells.findIndex(c => c.iso === e))
      return { b, startCol, endCol, showLabel: b.date >= weekStart || startCol === 0 }
    })
    .sort((a, z) => a.startCol - z.startCol || (z.endCol - z.startCol) - (a.endCol - a.startCol))

  for (const it of intersecting) {
    let lane = 0
    while (laneEnds[lane] !== undefined && laneEnds[lane] >= it.startCol) lane++
    laneEnds[lane] = it.endCol
    segs.push({ block: it.b, startCol: it.startCol, endCol: it.endCol, span: it.endCol - it.startCol + 1, lane, showLabel: it.showLabel })
  }
  const laneCount = laneEnds.length
  const lanesH = laneCount * BAR_H
  const maxPills = Math.max(1, 3 - laneCount)

  return (
    <div className="cal2-wk">
      {cells.map(c => {
        const items = c.inMonth ? occurrencesOn(events, routines, c.iso, activeCircleId).filter(isLive) : []
        const photo = c.inMonth ? photoByDate[c.iso] : undefined
        const shown = items.slice(0, maxPills)
        const overflow = items.length - shown.length
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
            <span className="cal2-lanes" style={{ height: lanesH }} aria-hidden />
            <span className="cal2-pills">
              {shown.map(e => (
                <span key={e.id} className={`cal2-mpill${e.clash ? ' clash' : ''}`} style={{ ['--pc' as any]: colorOf(e) }}>
                  <i>{shortT(e.start)}</i>{e.title}
                </span>
              ))}
              {overflow > 0 && <span className="cal2-mmore">+{overflow} more</span>}
            </span>
          </button>
        )
      })}

      {/* Spanning block bars overlay (aligned to the 7 equal columns) */}
      {segs.length > 0 && (
        <div className="cal2-wk-bars" style={{ top: NUM_H }}>
          {segs.map(s => {
            const isStart = s.block.date >= weekStart
            const isEnd = (s.block.endDate ?? s.block.date) <= weekEnd
            return (
              <span
                key={s.block.id}
                className={`cal2-wbar${isStart ? ' start' : ''}${isEnd ? ' end' : ''}`}
                style={{
                  left: `calc(${(s.startCol / 7) * 100}% + 3px)`,
                  width: `calc(${(s.span / 7) * 100}% - 6px)`,
                  top: s.lane * BAR_H,
                }}
                onClick={ev => { ev.stopPropagation(); onPickDay(cells[s.startCol].iso) }}
                title={s.block.title}
              >
                {s.showLabel && <span className="cal2-wbar-label">{s.block.title}</span>}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
