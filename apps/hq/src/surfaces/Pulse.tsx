import { useEffect, useState, type ReactNode } from 'react'
import { Users, Flame, Target, Gamepad2, Gem, BookOpen, Sparkles, Lightbulb } from 'lucide-react'
import { live } from '../data/live'
import type { SchemaInsights } from '../data/types'
import { Kpi } from '../components/Kpi'
import { Empty, Loading } from '../components/Empty'
import { compact, pct } from '../lib/format'

function deriveInsight(i: SchemaInsights): { tone: 'tl' | 'warn' | 'ok'; text: ReactNode } | null {
  if (i.attemptsTotal === 0) {
    return { tone: 'tl', text: <>No learning attempts recorded yet — metrics light up as soon as the first lesson is answered.</> }
  }
  if (i.accuracyPct !== null && i.accuracyPct < 55) {
    return { tone: 'warn', text: <>30-day accuracy is <b>{pct(i.accuracyPct)}</b> — content difficulty may be outrunning learners. Review the hardest skills.</> }
  }
  if (i.learners > 0 && i.activeLearners7d / i.learners < 0.2) {
    return { tone: 'warn', text: <>Only <b>{compact(i.activeLearners7d)}</b> of <b>{compact(i.learners)}</b> learners were active this week (&lt;20%). Re-engagement is the lever.</> }
  }
  return { tone: 'ok', text: <><b>{compact(i.activeLearners7d)}</b> weekly active learners with <b>{pct(i.accuracyPct)}</b> accuracy — healthy core loop.</> }
}

export function Pulse() {
  const [i, setI] = useState<SchemaInsights | null | undefined>(undefined)
  useEffect(() => { live.schemaInsights().then((d) => setI(d)) }, [])

  if (i === undefined) return <Pad><Loading label="Computing live metrics…" /></Pad>
  if (i === null) return (
    <Pad>
      <Empty title="Metrics need a live connection">
        Every number on Pulse comes from a real aggregate (<span className="src">hq_schema_insights()</span>).
        Connect Supabase and sign in as operator — no placeholder values are ever shown.
      </Empty>
    </Pad>
  )

  const ins = deriveInsight(i)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="h1">Pulse</div>
        <div className="sub">North-star health · every tile wired to a real query</div>
      </div>

      {ins && (
        <div className={'insight ' + ins.tone}>
          <Lightbulb size={15} /><div>{ins.text}</div>
        </div>
      )}

      <div className="kpi-grid">
        <Kpi label="Weekly active learners" value={i.activeLearners7d} icon={<Users size={13} />}
          sub={<>of {compact(i.learners)} total</>} />
        <Kpi label="Attempts (7d)" value={i.attempts7d} icon={<Flame size={13} />}
          sub={<>{compact(i.attemptsTotal)} all-time</>} />
        <Kpi label="Accuracy (30d)" value={i.accuracyPct === null ? '—' : pct(i.accuracyPct)} icon={<Target size={13} />}
          accent={i.accuracyPct !== null && i.accuracyPct >= 55 ? 'ok' : 'warn'} sub="correct / attempts" />
        <Kpi label="Games built" value={i.gamesTotal} icon={<Gamepad2 size={13} />}
          sub={<>{compact(i.gamesPublic)} public</>} />
        <Kpi label="Diamond float" value={i.diamondsFloat} icon={<Gem size={13} />} sub="held across learners" />
        <Kpi label="Live content" value={i.itemsLive} icon={<BookOpen size={13} />}
          sub={<>{compact(i.worldsLive)} worlds live</>} />
      </div>

      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Sparkles size={15} />
        <div>VC scorecard (Rule of 40, NRR, Burn Multiple, k-factor) activates once revenue + cohort events flow through <span className="src">hq_event</span>. Until then these are the live engagement primitives — real, not estimated.</div>
      </div>
    </div>
  )
}

function Pad({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div><div className="h1">Pulse</div><div className="sub">North-star health · every tile wired to a real query</div></div>
    {children}
  </div>
}
