// The response language (F2 manifest). One plain lead sentence → a component →
// refine chips. Each renderer is small and calm; nothing here uses jargon.
import type { Answer, WeekDay, KidStat } from './brain'
import { StoryPublish } from './StoryPublish'

function Chips({ chips, onChip }: { chips?: string[]; onChip: (s: string) => void }) {
  if (!chips?.length) return null
  return (
    <div className="ac-chips">
      {chips.map(c => <button key={c} className="ac-chip" onClick={() => onChip(c)}>{c}</button>)}
    </div>
  )
}

function WeekStrip({ days }: { days: WeekDay[] }) {
  return (
    <div className="ac-acard">
      <div className="ac-week">
        {days.map(d => (
          <div key={d.dow + d.date} className={'ac-day' + (d.today ? ' ac-day--today' : '')}>
            <em>{d.dow}</em><b>{d.date}</b>
            <div className="ac-dots">{d.events.map((_, i) => <span key={i} className="ac-dot" />)}</div>
            {d.events.map((e, i) => <div key={i} className="ac-evt">{e}</div>)}
          </div>
        ))}
      </div>
    </div>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 28, c = 2 * Math.PI * r, off = c * (1 - pct / 100)
  return (
    <div className="ac-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="url(#ac-ember)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 32 32)" />
        <defs><linearGradient id="ac-ember" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#DCA254" /><stop offset="1" stopColor="#8F6B3C" /></linearGradient></defs>
      </svg>
      <b>{pct}%</b>
    </div>
  )
}

function Kids({ kids }: { kids: KidStat[] }) {
  return (
    <div className="ac-acard">
      <div className="ac-kids">
        {kids.map(k => (
          <div key={k.name} className="ac-kid">
            <Ring pct={k.pct} />
            <div className="ac-kid-meta">
              <b>{k.name}</b>
              <span className="ac-flame">🔥 {k.streak}-day streak</span><br />
              <span>{k.trend}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniChart({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(1, ...bars.map(b => b.value))
  return (
    <div className="ac-acard">
      <div className="ac-chart">
        {bars.map(b => (
          <div key={b.label} className="ac-chart-col">
            <i style={{ height: `${(b.value / max) * 100}%` }} />
            <em>{b.label}</em>
          </div>
        ))}
      </div>
    </div>
  )
}

function Budget({ spent, budget, cats }: { spent: number; budget: number; cats: { label: string; amount: number }[] }) {
  const pct = Math.min(100, Math.round((spent / budget) * 100))
  const fmt = (n: number) => '$' + n.toLocaleString()
  return (
    <div className="ac-acard">
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
        <span>{fmt(spent)} spent</span><span style={{ color: 'var(--ink-soft)' }}>of {fmt(budget)}</span>
      </div>
      <div className="ac-bar"><i style={{ width: pct + '%' }} /></div>
      {cats.map(c => <div key={c.label} className="ac-catrow"><span>{c.label}</span><span>{fmt(c.amount)}</span></div>)}
    </div>
  )
}

function Story({ title, body }: { title: string; body: string[] }) {
  const read = () => {
    try {
      const u = new SpeechSynthesisUtterance(title + '. ' + body.join(' '))
      u.rate = 0.92; u.pitch = 1.05
      speechSynthesis.cancel(); speechSynthesis.speak(u)
    } catch { /* no speech synthesis — the text is right there to read */ }
  }
  return (
    <div className="ac-acard ac-story">
      <h4>{title}</h4>
      {body.map((p, i) => <p key={i}>{p}</p>)}
      <button className="ac-readaloud" onClick={read}>▶ Read it to us</button>
    </div>
  )
}

function SampleNote({ provenance }: { provenance: 'measured' | 'sample' }) {
  if (provenance !== 'sample') return null
  return <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8, opacity: .8 }}>Sample data — this becomes your family's real numbers once connected.</div>
}

export function AnswerView({ a, onChip }: { a: Answer; onChip: (s: string) => void }) {
  if (a.kind === 'publish') return <StoryPublish draft={a.draft} />
  if (a.kind === 'picker') {
    return (
      <div className="ac-assistant">
        <div className="ac-answer-lead"><p>{a.lead}</p></div>
        <div className="ac-chips">{a.options.map(o => <button key={o.send} className="ac-chip" onClick={() => onChip(o.send)}>{o.label}</button>)}</div>
      </div>
    )
  }
  if (a.kind === 'error') {
    return <div className="ac-assistant"><div className="ac-error"><p>{a.lead}</p><button className="ac-chip" onClick={() => onChip('What can you do?')}>What can you do?</button></div></div>
  }
  return (
    <div className="ac-assistant">
      <div className="ac-answer-lead"><p>{a.lead}</p></div>
      {a.kind === 'week' && <WeekStrip days={a.days} />}
      {a.kind === 'kids' && <Kids kids={a.kids} />}
      {a.kind === 'chart' && <MiniChart bars={a.bars} />}
      {a.kind === 'budget' && <Budget spent={a.spent} budget={a.budget} cats={a.cats} />}
      {a.kind === 'story' && <Story title={a.title} body={a.body} />}
      {a.kind !== 'text' && <SampleNote provenance={a.provenance} />}
      <Chips chips={a.chips} onChip={onChip} />
    </div>
  )
}
