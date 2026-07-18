// The Hearth — mark, greeting, the Pulse card, starter cards.
// GROUNDED (G1): the Pulse is composed from the family's real rows (today's
// calendar + the kids' live streaks) each time the Hearth mounts. No data →
// it says so warmly. It is never a hard-coded sentence.
import { useEffect, useState } from 'react'
import { Mark } from './Mark'
import { fetchWeek, fetchKidReports } from './data'

const STARTERS = [
  { title: 'This week', sub: 'The family calendar, Kinetik-style', send: 'What’s happening this week?' },
  { title: 'The kids', sub: 'Live streaks and progress from ArgantaLab', send: 'How are the kids doing?' },
  { title: 'Busiest day', sub: 'See the week’s crunch before it hits', send: 'What’s our busiest day?' },
  { title: 'Share this week', sub: 'Post a real win to Instagram', send: 'Share this week’s win on Instagram' },
]

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 5) return `Up late, ${name}?`
  if (h < 12) return `Good morning, ${name}.`
  if (h < 18) return `Hello, ${name}.`
  return `Good evening, ${name}.`
}

function usePulse(scope: string[]) {
  const [pulse, setPulse] = useState<string | null>(null)
  useEffect(() => {
    if (!scope.length) { setPulse(null); return }
    let on = true
    Promise.all([fetchWeek(scope), fetchKidReports(scope)]).then(([wk, kids]) => {
      if (!on) return
      const parts: string[] = []
      const today = wk?.days.find(d => d.today)
      if (today?.events.length) {
        const e = today.events[0]
        parts.push(e.time ? `${e.title} at ${e.time} today` : `${e.title} today`)
      }
      const streaker = (kids ?? []).filter(k => k.hasData && k.streak >= 2).sort((a, b) => b.streak - a.streak)[0]
      if (streaker) parts.push(`${streaker.name}'s on a ${streaker.streak}-day streak`)
      if (!parts.length && wk) {
        setPulse(wk.count > 0 ? `${wk.count} thing${wk.count === 1 ? '' : 's'} on this week — today's clear.` : null)
        return
      }
      setPulse(parts.length ? parts.join(', and ') + '.' : null)
    }).catch(() => { if (on) setPulse(null) })
    return () => { on = false }
  }, [scope.join(',')])
  return pulse
}

export function Hearth({ name, scope, circleLabel, spanning, onAsk }: {
  name: string; scope: string[]; circleLabel?: string; spanning?: boolean; onAsk: (q: string) => void
}) {
  const pulse = usePulse(scope)
  const sub = spanning
    ? 'Looking across all your circles.'
    : circleLabel ? `What does ${circleLabel} need?` : 'What does the family need?'
  return (
    <div className="ac-hearth">
      <div className="ac-col">
        <div className="ac-hearth-mark"><Mark size={44} breathe="slow" /></div>
        <h1 className="ac-greeting">{greeting(name)}</h1>
        <p className="ac-subline">{sub}</p>

        {pulse && (
          <button className="ac-pulse" onClick={() => onAsk('Give me today’s picture')} style={{ animationDelay: '40ms' }}>
            <b>{pulse}</b>
            <span>Tap for the full picture</span>
          </button>
        )}

        <div className="ac-cards">
          {STARTERS.map((s, i) => (
            <button key={s.title} className="ac-card" style={{ animationDelay: `${80 + i * 40}ms` }} onClick={() => onAsk(s.send)}>
              <b>{s.title}</b>
              <span>{s.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
