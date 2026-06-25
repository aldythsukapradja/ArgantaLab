import { useEffect, useRef, useState, Fragment } from 'react'
import { gsap } from 'gsap'
import { useDataStore, personById, firstName } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { ENERGY, todayISO, initials } from '@data/energy'
import { occurrencesOn, fmtTime, untilText, isoTomorrow, toMin, type Occ } from '@lib/cal'
import { IconChevron, IconHistory, IconCalendar, IconCheck } from '@components/Icons'
import DaySheet from '@components/DaySheet'

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export default function Today() {
  const events = useDataStore(s => s.events)
  const routines = useDataStore(s => s.routines)
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const me = useDataStore(s => s.me)
  const activeCircleId = useUiStore(s => s.activeCircleId)

  // Live clock — re-render every 30s so the countdown ticks and the "now" line moves.
  const [, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(id) }, [])

  // Tapping any plan / the focus / tomorrow expands that day's detail in place.
  const [dayOpen, setDayOpen] = useState<string | null>(null)

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = circle ? people.filter(p => circle.memberIds.includes(p.id)) : []
  const c0 = circle?.accent[0] ?? '#8B5CF6'
  const c1 = circle?.accent[1] ?? '#C4B5FD'
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const agenda = occurrencesOn(events, routines, todayISO(), activeCircleId)
  const tomorrow = occurrencesOn(events, routines, isoTomorrow(), activeCircleId)
  const next = agenda.find(a => toMin(a.end) > nowMin)
  const nextIdx = next ? agenda.indexOf(next) : agenda.length
  const total = agenda.length
  const done = agenda.filter(a => toMin(a.end) <= nowMin).length
  const left = total - done
  const clashes = agenda.filter(a => a.clash).length
  const pct = total ? done / total : 0

  const h = now.getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const ownerName = (me?.name ?? (circle ? personById(circle.memberIds[0])?.name : undefined) ?? 'there').split(' ')[0]
  const dateLine = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const summary = total === 0
    ? 'A clear day ahead — enjoy it.'
    : left === 0
      ? `All ${total} done — beautiful work.${clashes ? ` ${clashes} clashed.` : ''}`
      : `${done} of ${total} done · ${left} to go${clashes ? ` · ${clashes} clash` : ''}.`

  const root = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (!root.current) return
    const raf = requestAnimationFrame(() => setMounted(true))
    gsap.fromTo(root.current.querySelectorAll('.rise'),
      { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'cubic.out' })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="fade-in today2" ref={root} style={{ ['--c0' as any]: c0, ['--c1' as any]: c1 }}>
      {/* Hero */}
      <header className="td-hero rise">
        <div className="td-hero-aura" />
        <div className="td-hero-text">
          <span className="td-eyebrow">{dateLine}</span>
          <h1 className="td-greet">{greet}, {ownerName}</h1>
          <p className="td-sub">{summary}</p>
        </div>
        {total > 0 && <DayRing pct={pct} done={done} total={total} mounted={mounted} />}
      </header>

      {/* Focus / next */}
      {next
        ? <FocusCard occ={next} nowMin={nowMin} onOpen={() => setDayOpen(todayISO())} />
        : <AllSet total={total} />}

      {/* Tomorrow peek */}
      <TomorrowCard items={tomorrow} onOpen={() => setDayOpen(isoTomorrow())} />

      {/* Timeline */}
      <div className="section-label rise">Today’s flow</div>
      <div className="td-tl rise">
        {total === 0 && <div className="td-tl-empty">No plans today — a blank canvas.</div>}
        {agenda.map((a, i) => (
          <Fragment key={a.id}>
            {i === nextIdx && <NowMarker now={now} />}
            <EventRow occ={a} past={toMin(a.end) <= nowMin} isNext={a === next} onOpen={() => setDayOpen(todayISO())} />
          </Fragment>
        ))}
        {total > 0 && nextIdx === total && <NowMarker now={now} />}
      </div>

      {dayOpen && circle && (
        <DaySheet iso={dayOpen} circle={circle} members={members} onClose={() => setDayOpen(null)} />
      )}
    </div>
  )
}

/* ---------- Day progress ring ---------- */
function DayRing({ pct, done, total, mounted }: { pct: number; done: number; total: number; mounted: boolean }) {
  const R = 34
  const C = 2 * Math.PI * R
  const off = mounted ? C * (1 - pct) : C
  return (
    <div className="td-ring" aria-label={`${done} of ${total} done`}>
      <svg viewBox="0 0 80 80" className="td-ring-svg">
        <defs>
          <linearGradient id="tdring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--c0)" />
            <stop offset="100%" stopColor="var(--c1)" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={R} className="td-ring-track" />
        <circle cx="40" cy="40" r={R} className="td-ring-bar" stroke="url(#tdring)"
          strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 40 40)" />
      </svg>
      <div className="td-ring-c"><b>{done}</b><span>of {total}</span></div>
    </div>
  )
}

/* ---------- Focus / next-up card ---------- */
function FocusCard({ occ, nowMin, onOpen }: { occ: Occ; nowMin: number; onOpen: () => void }) {
  const happening = toMin(occ.start) <= nowMin
  const count = untilText(nowMin, toMin(occ.start)).replace(/^in /, '')
  return (
    <button className="td-focus rise" onClick={onOpen}>
      <span className="td-focus-aura" />
      <span className="td-focus-row">
        <span className="td-focus-when"><span className={`td-pulse${happening ? ' live' : ''}`} />{happening ? 'Happening now' : 'Up next'}</span>
        <span className="td-focus-count">{happening ? <em>now</em> : <>in <b>{count}</b></>}</span>
      </span>
      <span className="td-focus-title">{occ.title}</span>
      <span className="td-focus-meta">{fmtTime(occ.start)} – {fmtTime(occ.end)}</span>
      <span className="td-focus-foot">
        <WhoAvatars who={occ.who} names />
        <span className="kind-tag">{occ.kind === 'routine' ? <><IconHistory width={12} height={12} /> Routine</> : <><IconCalendar width={12} height={12} /> Event</>}</span>
      </span>
    </button>
  )
}

/* ---------- All-set celebratory state ---------- */
function AllSet({ total }: { total: number }) {
  return (
    <div className="td-allset rise">
      <span className="td-allset-aura" />
      <span className="td-spark s1" /><span className="td-spark s2" /><span className="td-spark s3" /><span className="td-spark s4" />
      <span className="td-allset-check">
        <svg viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="25" className="tac-ring" />
          <path d="M17 29l7.5 7.5L40 20" className="tac-tick" />
        </svg>
      </span>
      <h3>{total > 0 ? 'You’re all set' : 'A clear day'}</h3>
      <p>{total > 0 ? `All ${total} plan${total === 1 ? '' : 's'} done. Enjoy the rest of your day.` : 'Nothing on the agenda. Savor the calm.'}</p>
    </div>
  )
}

/* ---------- Tomorrow peek ---------- */
function TomorrowCard({ items, onOpen }: { items: Occ[]; onOpen: () => void }) {
  return (
    <button className="td-tmrw rise" onClick={onOpen}>
      <span className="td-tmrw-bar" />
      <span className="td-tmrw-body">
        <span className="td-tmrw-head">
          <span className="td-tmrw-label">TOMORROW</span>
          <span className="td-tmrw-count">{items.length} plan{items.length === 1 ? '' : 's'}</span>
          <IconChevron width={18} height={18} className="td-tmrw-caret" />
        </span>
        {items.length > 0 ? (
          <span className="td-tmrw-list">
            {items.slice(0, 3).map(t => (
              <span className="td-tmrw-it" key={t.id}>
                <span className="td-tmrw-t">{fmtTime(t.start)}</span>
                <span className="td-tmrw-dot" style={{ background: ENERGY[t.energy] }} />
                <span className="td-tmrw-ti">{t.title}</span>
                <WhoAvatars who={t.who} compact />
              </span>
            ))}
            {items.length > 3 && <span className="td-tmrw-more">+{items.length - 3} more</span>}
          </span>
        ) : <span className="td-tmrw-empty">Nothing planned yet — a free day ahead.</span>}
      </span>
    </button>
  )
}

/* ---------- Timeline pieces ---------- */
function NowMarker({ now }: { now: Date }) {
  return (
    <div className="td-now">
      <span className="td-now-time">{fmtTime(hhmm(now))}</span>
      <span className="td-now-node" />
      <span className="td-now-track"><span className="td-now-pill">Now</span></span>
    </div>
  )
}

function EventRow({ occ, past, isNext, onOpen }: { occ: Occ; past: boolean; isNext: boolean; onOpen: () => void }) {
  return (
    <button className={`td-ev${past ? ' past' : ''}${isNext ? ' next' : ''}`} onClick={onOpen}>
      <span className="td-ev-time">{fmtTime(occ.start)}</span>
      <span className="td-ev-node" style={{ ['--dot' as any]: ENERGY[occ.energy] }}>
        {past && <IconCheck width={11} height={11} />}
      </span>
      <span className="td-ev-body">
        <b>{occ.title}</b>
        <WhoAvatars who={occ.who} names compact />
      </span>
      {occ.clash && <span className="td-ev-clash">CLASH</span>}
      {occ.kind === 'routine' && !occ.clash && <IconHistory width={13} height={13} className="td-ev-rep" />}
    </button>
  )
}

/* ---------- Shared avatars ---------- */
function WhoAvatars({ who, names, compact }: { who: string[]; names?: boolean; compact?: boolean }) {
  if (!who.length) return names ? <span className="td-who"><em>Everyone</em></span> : null
  const max = compact ? 3 : 4
  return (
    <span className={`td-who${compact ? ' compact' : ''}`}>
      <span className="td-who-av">
        {who.slice(0, max).map(id => {
          const p = personById(id)
          return <span key={id} className="who-dot" style={{ background: p?.color || 'var(--faint)' }} title={p?.name}>{initials(p?.name || '?')}</span>
        })}
      </span>
      {names && <em>{who.map(firstName).join(', ')}</em>}
    </span>
  )
}
