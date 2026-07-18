// The response language — grounded components only (G1 audit).
// The week board is a faithful port of KinetikCircle's cal2 board: same day
// header treatment (dow/date, today ring), same energy-colored event chips with
// the same ENERGY palette and title→energy derivation, routines rendered softer.
import type { Answer } from './brain'
import { Calendar } from './Calendar'
import { TodayPage } from './TodayPage'
import { PulsePage } from './PulsePage'
import { StoryPublish } from './StoryPublish'

function Chips({ chips, onChip }: { chips?: string[]; onChip: (s: string) => void }) {
  if (!chips?.length) return null
  return (
    <div className="ac-chips">
      {chips.map(c => <button key={c} className="ac-chip" onClick={() => onChip(c)}>{c}</button>)}
    </div>
  )
}

/** Busiest-day bar chart — events per weekday, today highlighted. */
function BarChart({ bars }: { bars: { label: string; value: number; today?: boolean }[] }) {
  const max = Math.max(1, ...bars.map(b => b.value))
  return (
    <div className="ac-acard">
      <div className="ac-bars">
        {bars.map((b, i) => (
          <div key={i} className={'ac-bar-col' + (b.today ? ' today' : '')}>
            <span className="ac-bar-val">{b.value || ''}</span>
            <i style={{ height: `${(b.value / max) * 100}%` }} />
            <em>{b.label}</em>
          </div>
        ))}
      </div>
    </div>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 28, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <div className="ac-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <defs><linearGradient id="ac-ember-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#DCA254" /><stop offset="1" stopColor="#8F6B3C" /></linearGradient></defs>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="url(#ac-ember-ring)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 32 32)" />
      </svg>
      <b>{pct}%</b>
    </div>
  )
}

function Kids({ kids }: { kids: { name: string; pct: number; streak: number; trend: string }[] }) {
  return (
    <div className="ac-acard">
      <div className="ac-kids">
        {kids.map(k => (
          <div key={k.name} className="ac-kid">
            <Ring pct={k.pct} />
            <div className="ac-kid-meta">
              <b>{k.name}</b>
              {k.streak > 0 && <><span className="ac-flame">🔥 {k.streak}-day streak</span><br /></>}
              <span>{k.trend}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnswerView({ a, onChip }: { a: Answer; onChip: (s: string) => void }) {
  if (a.kind === 'publish') return <StoryPublish draft={a.draft} />
  if (a.kind === 'error') {
    return <div className="ac-assistant"><div className="ac-error"><p>{a.lead}</p><button className="ac-chip" onClick={() => onChip('What can you do?')}>What can you do?</button></div></div>
  }
  if (a.kind === 'today') {
    return <div className="ac-assistant"><TodayPage scope={a.scope} name={a.name} /><Chips chips={a.chips} onChip={onChip} /></div>
  }
  if (a.kind === 'pulse') {
    return <div className="ac-assistant"><PulsePage scope={a.scope} /><Chips chips={a.chips} onChip={onChip} /></div>
  }
  return (
    <div className="ac-assistant">
      <div className="ac-answer-lead"><p>{a.lead}</p></div>
      {a.kind === 'calendar' && <Calendar scope={a.scope} initialView={a.view} />}
      {a.kind === 'chart' && <BarChart bars={a.bars} />}
      {a.kind === 'kids' && <Kids kids={a.kids} />}
      <Chips chips={a.chips} onChip={onChip} />
    </div>
  )
}
