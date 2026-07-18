// Today — ported 1:1 from apps/kinetik/src/pages/Today.tsx: hero + progress
// ring, focus/"up next" card, all-set celebration, tomorrow peek, and the
// timeline with a live "now" marker. Grounded: reads the same fetchCalendar
// rows as the board; nothing here is invented.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { ENERGY } from './data'
import { fetchCalendar, occurrencesOn, todayISO, isoTomorrow, toMin, fmtTime, untilText, type CalendarData, type Occ } from './calData'

export function TodayPage({ scope, name }: { scope: string[]; name: string }) {
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(id) }, [])
  useEffect(() => {
    let on = true; setLoading(true)
    fetchCalendar(scope).then(d => { if (on) { setData(d); setLoading(false) } }).catch(() => { if (on) { setData(null); setLoading(false) } })
    return () => { on = false }
  }, [scope.join(',')])

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const c0 = data?.accent[0] ?? '#DCA254', c1 = data?.accent[1] ?? '#8F6B3C'

  const agenda = useMemo(() => data ? occurrencesOn(data, todayISO()) : [], [data])
  const tomorrow = useMemo(() => data ? occurrencesOn(data, isoTomorrow()) : [], [data])
  const next = agenda.find(a => toMin(a.end) > nowMin)
  const nextIdx = next ? agenda.indexOf(next) : agenda.length
  const total = agenda.length
  const done = agenda.filter(a => toMin(a.end) <= nowMin).length
  const left = total - done
  const clashes = agenda.filter(a => a.clash).length
  const pct = total ? done / total : 0

  const h = now.getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const dateLine = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const summary = total === 0 ? 'A clear day ahead — enjoy it.'
    : left === 0 ? `All ${total} done — beautiful work.${clashes ? ` ${clashes} clashed.` : ''}`
    : `${done} of ${total} done · ${left} to go${clashes ? ` · ${clashes} clash` : ''}.`

  if (loading) return <div className="ac-acard ac-td-load">Loading today…</div>
  if (!data) return <div className="ac-acard ac-td-load">Couldn’t reach your calendar.</div>

  return (
    <div className="ac-td" style={{ ['--c0' as any]: c0, ['--c1' as any]: c1 }}>
      <header className="ac-td-hero">
        <span className="ac-td-hero-aura" />
        <div className="ac-td-hero-text">
          <span className="ac-td-eyebrow">{dateLine}</span>
          <h1 className="ac-td-greet">{greet}, {name}</h1>
          <p className="ac-td-sub">{summary}</p>
        </div>
        {total > 0 && <DayRing pct={pct} done={done} total={total} />}
      </header>

      {next ? <FocusCard occ={next} nowMin={nowMin} /> : <AllSet total={total} />}

      <TomorrowCard items={tomorrow} />

      <div className="ac-section-label">Today’s flow</div>
      <div className="ac-td-tl">
        {total === 0 && <div className="ac-td-tl-empty">No plans today — a blank canvas.</div>}
        {agenda.map((a, i) => (
          <Fragment key={a.id}>
            {i === nextIdx && <NowMarker now={now} />}
            <EventRow occ={a} past={toMin(a.end) <= nowMin} isNext={a === next} />
          </Fragment>
        ))}
        {total > 0 && nextIdx === total && <NowMarker now={now} />}
      </div>
    </div>
  )
}

function DayRing({ pct, done, total }: { pct: number; done: number; total: number }) {
  const R = 34, C = 2 * Math.PI * R, off = C * (1 - pct)
  return (
    <div className="ac-td-ring">
      <svg viewBox="0 0 80 80" className="ac-td-ring-svg">
        <defs><linearGradient id="ac-tdring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--c0)" /><stop offset="100%" stopColor="var(--c1)" /></linearGradient></defs>
        <circle cx="40" cy="40" r={R} className="ac-td-ring-track" />
        <circle cx="40" cy="40" r={R} className="ac-td-ring-bar" stroke="url(#ac-tdring)" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 40 40)" />
      </svg>
      <div className="ac-td-ring-c"><b>{done}</b><span>of {total}</span></div>
    </div>
  )
}

function FocusCard({ occ, nowMin }: { occ: Occ; nowMin: number }) {
  const happening = toMin(occ.start) <= nowMin
  const count = untilText(nowMin, toMin(occ.start))
  return (
    <div className="ac-td-focus">
      <span className="ac-td-focus-aura" />
      <span className="ac-td-focus-row">
        <span className="ac-td-focus-when"><span className={'ac-td-pulse' + (happening ? ' live' : '')} />{happening ? 'Happening now' : 'Up next'}</span>
        <span className="ac-td-focus-count">{happening ? <em>now</em> : <>{count}</>}</span>
      </span>
      <span className="ac-td-focus-title">{occ.title}</span>
      <span className="ac-td-focus-meta">{fmtTime(occ.start)} – {fmtTime(occ.end)}</span>
      <span className="ac-td-focus-foot">
        <Who who={occ.who} names />
        <span className="ac-td-kind">{occ.routine ? 'Routine' : 'Event'}</span>
      </span>
    </div>
  )
}

function AllSet({ total }: { total: number }) {
  return (
    <div className="ac-td-allset">
      <span className="ac-td-allset-check">
        <svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="25" className="ac-tac-ring" /><path d="M17 29l7.5 7.5L40 20" className="ac-tac-tick" /></svg>
      </span>
      <h3>{total > 0 ? 'You’re all set' : 'A clear day'}</h3>
      <p>{total > 0 ? `All ${total} plan${total === 1 ? '' : 's'} done. Enjoy the rest of your day.` : 'Nothing on the agenda. Savor the calm.'}</p>
    </div>
  )
}

function TomorrowCard({ items }: { items: Occ[] }) {
  return (
    <div className="ac-td-tmrw">
      <span className="ac-td-tmrw-bar" />
      <span className="ac-td-tmrw-body">
        <span className="ac-td-tmrw-head">
          <span className="ac-td-tmrw-label">TOMORROW</span>
          <span className="ac-td-tmrw-count">{items.length} plan{items.length === 1 ? '' : 's'}</span>
        </span>
        {items.length > 0 ? (
          <span className="ac-td-tmrw-list">
            {items.slice(0, 3).map(t => (
              <span className="ac-td-tmrw-it" key={t.id}>
                <span className="ac-td-tmrw-t">{fmtTime(t.start)}</span>
                <span className="ac-td-tmrw-dot" style={{ background: ENERGY[t.energy] }} />
                <span className="ac-td-tmrw-ti">{t.title}</span>
              </span>
            ))}
            {items.length > 3 && <span className="ac-td-tmrw-more">+{items.length - 3} more</span>}
          </span>
        ) : <span className="ac-td-tmrw-empty">Nothing planned yet — a free day ahead.</span>}
      </span>
    </div>
  )
}

function NowMarker({ now }: { now: Date }) {
  const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0')
  return (
    <div className="ac-td-now">
      <span className="ac-td-now-time">{fmtTime(`${hh}:${mm}`)}</span>
      <span className="ac-td-now-node" />
      <span className="ac-td-now-track"><span className="ac-td-now-pill">Now</span></span>
    </div>
  )
}

function EventRow({ occ, past, isNext }: { occ: Occ; past: boolean; isNext: boolean }) {
  return (
    <div className={'ac-td-ev' + (past ? ' past' : '') + (isNext ? ' next' : '')}>
      <span className="ac-td-ev-time">{fmtTime(occ.start)}</span>
      <span className="ac-td-ev-node" style={{ ['--dot' as any]: ENERGY[occ.energy] }} />
      <span className="ac-td-ev-body">
        <b>{occ.title}</b>
        <Who who={occ.who} names compact />
      </span>
      {occ.clash && <span className="ac-td-ev-clash">CLASH</span>}
    </div>
  )
}

function Who({ who, names, compact }: { who: string[]; names?: boolean; compact?: boolean }) {
  if (!who.length) return names ? <span className="ac-td-who"><em>Everyone</em></span> : null
  return <span className={'ac-td-who' + (compact ? ' compact' : '')}>{names && <em>{who.length} {who.length === 1 ? 'person' : 'people'}</em>}</span>
}
