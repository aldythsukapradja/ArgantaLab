import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useDataStore, personById, firstName } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { ENERGY, ENERGY_LABEL, ENERGY_ORDER, todayISO, initials } from '@data/energy'
import { occurrencesOn, fmtTime, untilText, isoTomorrow, toMin, type Occ } from '@lib/cal'
import { IconChevron, IconPlus, IconDiamond, IconHistory, IconCalendar } from '@components/Icons'

export default function Today() {
  const events = useDataStore(s => s.events)
  const routines = useDataStore(s => s.routines)
  const circles = useDataStore(s => s.circles)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const go = useUiStore(s => s.go)

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const agenda = occurrencesOn(events, routines, todayISO(), activeCircleId)
  const next = agenda.find(a => toMin(a.end) > nowMin)
  const tomorrow = occurrencesOn(events, routines, isoTomorrow(), activeCircleId)
  const clashes = agenda.filter(a => a.clash).length

  const h = now.getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const travel = agenda.find(a => a.energy === 'memory')
  const summary = buildSummary(agenda.length, next, nowMin, clashes, travel)

  const owner = circle ? personById(circle.memberIds[0]) : undefined
  const ownerName = owner?.name ?? 'there'

  const mix: Record<string, number> = {}
  agenda.forEach(a => { mix[a.energy] = (mix[a.energy] || 0) + 1 })
  const maxE = Math.max(1, ...Object.values(mix))

  const root = useRef<HTMLDivElement | null>(null)
  const dot = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    if (!root.current) return
    gsap.fromTo(root.current.querySelectorAll('.rise'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' })
    if (dot.current) gsap.to(dot.current, { scale: 1.7, opacity: 0.35, repeat: -1, yoyo: true, duration: 1.1, ease: 'sine.inOut' })
  }, [])

  const accent0 = circle?.accent[0] ?? '#F43F5E'
  const accent1 = circle?.accent[1] ?? '#FB7185'

  return (
    <div className="fade-in" ref={root}>
      {/* Buddy pulse */}
      <button className="buddy-pulse rise" style={{ background: `linear-gradient(120deg, ${accent0}, ${accent1})` }} onClick={() => go('me')}>
        <span className="bp-orb"><span className="bp-spark" /></span>
        <span className="bp-meta"><b>Buddy</b><small>Level 7 · 1,240 / 1,500 XP</small></span>
        <span className="bp-dia"><IconDiamond width={15} height={15} /> 320</span>
      </button>

      {/* Greeting */}
      <div className="greet rise" style={{ marginTop: 14 }}>
        <h1>{greet}, {ownerName}</h1>
        <p>{summary}</p>
      </div>

      {/* Energy mix */}
      <div className="energy-row rise">
        {ENERGY_ORDER.map(k => (
          <div key={k} className="epill">
            <span className="ep-top" style={{ color: ENERGY[k] }}>{mix[k] || 0}</span>
            <span className="ep-bar"><i style={{ width: `${((mix[k] || 0) / maxE) * 100}%`, background: ENERGY[k] }} /></span>
            <span className="ep-lbl">{ENERGY_LABEL[k]}</span>
          </div>
        ))}
      </div>

      {/* Next up */}
      {next ? (
        <div className="card next-card rise" onClick={() => go('calendar')}>
          <div className="next-bar" style={{ background: `linear-gradient(90deg, ${ENERGY[next.energy]}, ${accent0})` }} />
          <div className="next-body">
            <div className="next-when" style={{ color: ENERGY[next.energy] }}>
              <span className="next-dot" ref={dot} style={{ background: ENERGY[next.energy] }} />
              {toMin(next.start) <= nowMin ? 'HAPPENING NOW' : `NEXT · ${untilText(nowMin, toMin(next.start))}`}
            </div>
            <div className="next-title">{next.title}</div>
            <div className="next-meta">{fmtTime(next.start)} – {fmtTime(next.end)} · {next.who.map(firstName).join(', ') || 'Everyone'}</div>
            <div className="next-foot">
              <Who who={next.who} />
              <span className="kind-tag">{next.kind === 'routine' ? <><IconHistory width={12} height={12} /> Routine</> : <><IconCalendar width={12} height={12} /> Event</>}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card allset rise">
          <div className="allset-ic">✓</div>
          <h3>You’re all set today</h3>
          <p>Nothing more needs you. Enjoy the evening.</p>
        </div>
      )}

      {/* Timeline */}
      <div className="section-label rise">Today · {agenda.length}</div>
      <div className="timeline rise">
        {agenda.length === 0 && <div className="list-empty">No plans today</div>}
        {agenda.map(a => {
          const past = toMin(a.end) <= nowMin
          return (
            <button key={a.id} className={`tl-row${past ? ' past' : ''}`} onClick={() => go('calendar')}>
              <span className="tl-time">{fmtTime(a.start)}</span>
              <span className="tl-rail"><i style={{ background: ENERGY[a.energy] }} /></span>
              <span className="tl-main">
                <b>{a.title}</b>
                <Who who={a.who} />
              </span>
              {a.clash && <span className="lr-clash">CLASH</span>}
              {a.kind === 'routine' && !a.clash && <IconHistory width={13} height={13} style={{ color: 'var(--faint)' }} />}
            </button>
          )
        })}
      </div>

      <button className="card tmrw rise" onClick={() => go('calendar')}>
        <span>Tomorrow · <b>{tomorrow.length} plan{tomorrow.length === 1 ? '' : 's'}</b></span>
        <IconChevron width={18} height={18} style={{ color: 'var(--accent)' }} />
      </button>

      <button className="fab" onClick={() => go('calendar')} aria-label="Add event"><IconPlus width={22} height={22} /></button>
    </div>
  )
}

function Who({ who }: { who: string[] }) {
  if (!who.length) return <small className="tl-who">Everyone</small>
  return (
    <span className="tl-who">
      {who.slice(0, 4).map(id => {
        const p = personById(id)
        return <span key={id} className="who-dot" style={{ background: p?.color || 'var(--faint)' }} title={p?.name}>{initials(p?.name || '?')}</span>
      })}
      <em>{who.map(firstName).join(', ')}</em>
    </span>
  )
}

function buildSummary(n: number, next: Occ | undefined, nowMin: number, clashes: number, travel?: Occ): string {
  if (n === 0) return 'A clear day ahead. Nothing scheduled.'
  const bits: string[] = []
  if (travel && travel.energy === 'memory') bits.push(`Travel day — ${travel.title} at ${fmtTime(travel.start)}.`)
  bits.push(`${n} plan${n === 1 ? '' : 's'} today${clashes ? `, ${clashes} clash` : ''}.`)
  if (next && toMin(next.start) > nowMin) bits.push(`Next: ${next.title} ${untilText(nowMin, toMin(next.start))}.`)
  return bits.join(' ')
}
