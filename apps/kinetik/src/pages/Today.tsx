import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useAppStore } from '@store/appStore'
import { ENERGY, firstName, todayISO, type EnergyKey } from '@data/seed'
import { eventsOn, fmtTime, untilText, isoTomorrow } from '@lib/cal'
import { IconChevron, IconPlus } from '@components/Icons'

export default function Today() {
  const { events, activeCircleId, go } = useAppStore()
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const agenda = eventsOn(events, todayISO(), activeCircleId)
  const next = agenda.find(a => toMin(a.end) > nowMin)
  const tomorrow = eventsOn(events, isoTomorrow(), activeCircleId)
  const clashes = agenda.filter(a => a.clash).length
  const h = now.getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

  const dot = useRef<HTMLSpanElement | null>(null)
  const root = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    gsap.fromTo(root.current!.querySelectorAll('.rise'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out' })
    if (dot.current) gsap.to(dot.current, { scale: 1.6, opacity: 0.4, repeat: -1, yoyo: true, duration: 1.1, ease: 'sine.inOut' })
  }, [])

  return (
    <div className="fade-in" ref={root}>
      <div className="greet rise" style={{ marginTop: 6 }}>
        <h1>{greet}, Aldyth</h1>
        <p>{dowLabel(now)} · {agenda.length} today{clashes ? <> · <b style={{ color: 'var(--warn)' }}>{clashes} clash</b></> : null}</p>
      </div>

      {next ? (
        <div className="card next-card rise" style={{ marginTop: 14 }} onClick={() => go('calendar')}>
          <div className="next-bar" style={{ background: `linear-gradient(90deg,${ENERGY[next.energy]},var(--accent))` }} />
          <div className="next-body">
            <div className="next-when">
              <span className="next-dot" ref={dot} style={{ background: ENERGY[next.energy] }} />
              {toMin(next.start) <= nowMin ? 'HAPPENING NOW' : `NEXT · ${untilText(nowMin, toMin(next.start))}`}
            </div>
            <div className="next-title">{next.title}</div>
            <div className="next-meta">{fmtTime(next.start)} – {fmtTime(next.end)} · {next.who.map(firstName).join(', ')}{next.coach ? ` · ${next.coach}` : ''}</div>
            <button className="btn" style={{ marginTop: 12 }}>Details</button>
          </div>
        </div>
      ) : (
        <div className="card allset rise" style={{ marginTop: 14 }}>
          <div className="allset-ic">✓</div>
          <h3>You're all set today</h3>
          <p>Nothing more needs you. Enjoy the evening.</p>
        </div>
      )}

      <button className="card tmrw rise" onClick={() => go('calendar')}>
        <span>Tomorrow · <b>{tomorrow.length} event{tomorrow.length === 1 ? '' : 's'}</b></span>
        <IconChevron width={18} height={18} style={{ color: 'var(--accent)' }} />
      </button>

      <div className="section-label rise">Today · {agenda.length}</div>
      <div className="card list rise">
        {agenda.length === 0 && <div className="list-empty">No events today</div>}
        {agenda.map(a => (
          <button key={a.id} className="list-row" onClick={() => go('calendar')}>
            <span className="lr-time">{fmtTime(a.start)}</span>
            <span className="lr-bar" style={{ background: ENERGY[a.energy as EnergyKey] }} />
            <span className="lr-main">
              <b>{a.title}</b>
              <small>{a.who.map(firstName).join(', ')}</small>
            </span>
            {a.clash && <span className="lr-clash">CLASH</span>}
          </button>
        ))}
      </div>

      <button className="fab" onClick={() => go('calendar')} aria-label="Add event"><IconPlus width={22} height={22} /></button>
    </div>
  )
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const dowLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long' })
