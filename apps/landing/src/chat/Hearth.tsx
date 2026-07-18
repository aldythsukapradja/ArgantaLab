// The Hearth (F1 §3.1) — mark, greeting, the Pulse card (the daily-open engine),
// and tappable starter cards that ARE the capability transparency.
import { Mark } from './Mark'

const STARTERS = [
  { title: 'This week', sub: 'Everything on the family calendar', send: 'What’s happening this week?' },
  { title: 'The kids', sub: 'Progress, streaks, and what to cheer', send: 'How are the kids doing?' },
  { title: 'Dinner', sub: 'This week’s meals and groceries', send: 'What’s for dinner this week?' },
  { title: 'A bedtime story', sub: 'Starring your kid, ready in seconds', send: 'Tell a bedtime story' },
  { title: 'The budget', sub: 'Where this month is going', send: 'How’s the budget this month?' },
  { title: 'Busiest day', sub: 'See the week’s crunch before it hits', send: 'What’s our busiest day?' },
  { title: 'Share this week', sub: 'A ready-to-post win for Instagram', send: 'Share this week’s win on Instagram' },
]

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 5) return `Up late, ${name}?`
  if (h < 12) return `Good morning, ${name}.`
  if (h < 18) return `Hello, ${name}.`
  return `Good evening, ${name}.`
}

export function Hearth({ name, circleLabel, spanning, onAsk }: { name: string; circleLabel?: string; spanning?: boolean; onAsk: (q: string) => void }) {
  const sub = spanning
    ? 'Looking across all your circles.'
    : circleLabel ? `What does ${circleLabel} need?` : 'What does the family need?'
  return (
    <div className="ac-hearth">
      <div className="ac-col">
        <div className="ac-hearth-mark"><Mark size={44} breathe="slow" /></div>
        <h1 className="ac-greeting">{greeting(name)}</h1>
        <p className="ac-subline">{sub}</p>

        <button className="ac-pulse" onClick={() => onAsk('Give me today’s picture')} style={{ animationDelay: '40ms' }}>
          <b>Swim at 4, Baginda’s on a 6-day streak, and the grocery run is tomorrow.</b>
          <span>Tap for the full picture</span>
        </button>

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
