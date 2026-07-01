import { useState } from 'react'
import { Wallet, TrendingUp } from 'lucide-react'
import { Office } from './Office'
import { SourceBadge } from './SourceBadge'
import {
  runModel, CASE_DEFAULTS, SLIDERS, DIAMOND_GRANT,
  type Case, type Assumptions, type MonthRow,
} from '../../data/graph/model'

const fmt$ = (n: number) => (Math.abs(n) >= 1e6 ? (n < 0 ? '-' : '') + '$' + (Math.abs(n) / 1e6).toFixed(2) + 'M'
  : Math.abs(n) >= 1e3 ? (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n) / 1e3) + 'k'
  : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)))
const fmtN = (n: number) => n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

export function Treasury() {
  return <Office id="treasury" cockpit={<FinancialCockpit />} />
}

function FinancialCockpit() {
  const [kase, setCase] = useState<Case>('mid')
  const [a, setA] = useState<Assumptions>(CASE_DEFAULTS.mid)
  const [view, setView] = useState<'cashflow' | 'families'>('cashflow')
  const r = runModel(a)

  function pick(c: Case) { setCase(c); setA(CASE_DEFAULTS[c]) }
  function set<K extends keyof Assumptions>(k: K, v: number) { setA(prev => ({ ...prev, [k]: v })) }

  const positive = r.contributionPerActive > 0
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><Wallet size={14} /> Financial cockpit <SourceBadge source="simulated" small /></div>
        <div className="seg">
          {(['low', 'mid', 'high'] as Case[]).map(c => (
            <button key={c} className={kase === c ? 'on' : ''} onClick={() => pick(c)} style={{ textTransform: 'capitalize' }}>{c}</button>
          ))}
        </div>
      </div>

      {/* verdict line */}
      <div className={'insight ' + (positive ? 'ok' : 'warn')} style={{ alignItems: 'center' }}>
        <TrendingUp size={15} />
        <div style={{ fontSize: 12 }}>
          {positive
            ? <>Unit economics <b>positive</b> — break-even ~<b>{r.steadyBreakeven ? Math.round(r.steadyBreakeven) : '—'}</b> active families, cash-positive {r.firstPositiveMonth ? <>month <b>{r.firstPositiveMonth}</b></> : <b>not in 24mo</b>}.</>
            : <>Unit economics <b>negative</b> — contribution {fmt$(r.contributionPerActive)}/active is below the infra load. Scaling makes it worse. Raise conversion or price, or cut infra.</>}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        <Kpi label="Contribution / active" value={fmt$(r.contributionPerActive)} tone={positive ? 'ok' : 'bad'} />
        <Kpi label="Break-even families" value={r.steadyBreakeven ? Math.round(r.steadyBreakeven).toString() : 'never'} tone={r.steadyBreakeven ? undefined : 'bad'} />
        <Kpi label="NPV · 24mo" value={fmt$(r.npv)} tone={r.npv >= 0 ? 'ok' : 'bad'} />
        <Kpi label="Families · mo24" value={fmtN(r.endActive)} />
        <Kpi label="💎 mint / mo" value={fmtN(r.endPayers * DIAMOND_GRANT)} />
      </div>

      {/* chart */}
      <div>
        <div className="spread" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{view === 'cashflow' ? 'Cumulative net cashflow · 24mo' : 'Active families · 24mo'}</span>
          <div className="seg">
            <button className={view === 'cashflow' ? 'on' : ''} onClick={() => setView('cashflow')}>Cashflow</button>
            <button className={view === 'families' ? 'on' : ''} onClick={() => setView('families')}>Families</button>
          </div>
        </div>
        <FanChart rows={r.rows} view={view} />
      </div>

      {/* sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, borderTop: '1px solid var(--bd)', paddingTop: 10 }}>
        {SLIDERS.map(s => {
          const raw = s.pct ? (a[s.key] as number) * 100 : (a[s.key] as number)
          const disp = s.pct ? `${raw.toFixed(0)}%` : `$${(a[s.key] as number).toFixed(2)}`
          return (
            <div key={s.key}>
              <label className="row" style={{ justifyContent: 'space-between', fontSize: 11.5, color: 'var(--tx2)', marginBottom: 3 }}>
                <span>{s.label}</span><b style={{ fontFamily: 'var(--mono)', color: 'var(--acc-text)' }}>{disp}</b>
              </label>
              <input type="range" min={s.min} max={s.max} step={s.step} value={raw}
                onChange={e => set(s.key, s.pct ? +e.target.value / 100 : +e.target.value)}
                style={{ width: '100%' }} />
            </div>
          )
        })}
        <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
          Household D30 <b>{Math.round(r.householdD30 * 100)}%</b> = 1 − (1 − kid)(1 − parent). Demand sliders lift the family curve; money sliders convert it to cash. Base wires live at P3.
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'ok' ? 'var(--ok)' : tone === 'bad' ? 'var(--bad)' : 'var(--tx)'
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', padding: '9px 11px' }}>
      <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 3 }}>{value}</div>
    </div>
  )
}

function FanChart({ rows, view }: { rows: MonthRow[]; view: 'cashflow' | 'families' }) {
  const W = 560, H = 150, padL = 44, padR = 10, padT = 12, padB = 20
  const vals = rows.map(r => view === 'cashflow' ? r.cum : r.active)
  const min = Math.min(0, ...vals), max = Math.max(1, ...vals)
  const x = (i: number) => padL + (i * (W - padL - padR)) / (rows.length - 1)
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB)
  const path = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(view === 'cashflow' ? r.cum : r.active).toFixed(1)}`).join(' ')
  const zeroY = y(0)
  const pos = view === 'cashflow' ? rows[rows.length - 1].cum >= 0 : true
  const stroke = view === 'families' ? 'var(--acc)' : pos ? 'var(--ok)' : 'var(--bad)'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label={view}>
      {[0, 0.5, 1].map(f => {
        const gy = padT + f * (H - padT - padB)
        return <line key={f} x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="var(--bd)" strokeWidth={1} />
      })}
      {min < 0 && <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--bd2)" strokeWidth={1} strokeDasharray="3 3" />}
      <text className="axlab" x={padL - 6} y={y(max) + 3} textAnchor="end" fontSize={9} fill="var(--tx3)">{view === 'cashflow' ? fmt$(max) : fmtN(max)}</text>
      <text className="axlab" x={padL - 6} y={y(min) + 3} textAnchor="end" fontSize={9} fill="var(--tx3)">{view === 'cashflow' ? fmt$(min) : fmtN(min)}</text>
      {[0, 6, 12, 18, 23].map(i => <text key={i} x={x(i)} y={H - 5} textAnchor="middle" fontSize={9} fill="var(--tx3)">m{i + 1}</text>)}
      <path d={path} fill="none" stroke={stroke} strokeWidth={2.4} strokeLinejoin="round" />
      <circle cx={x(rows.length - 1)} cy={y(view === 'cashflow' ? rows[rows.length - 1].cum : rows[rows.length - 1].active)} r={3.2} fill={stroke} />
    </svg>
  )
}
