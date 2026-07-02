import { useRef, useState } from 'react'
import { Wallet, TrendingUp, X, FileText, Receipt, Building2, Waves, Percent, Layers } from 'lucide-react'
import { Office } from './Office'
import { SourceBadge } from './SourceBadge'
import {
  runModel, CASE_DEFAULTS, SLIDERS, DIAMOND_GRANT, HORIZONS,
  FIXED_MO, PROCESSING, INFRA_REG, REG_MULT,
  type Case, type Assumptions, type MonthRow, type ModelResult,
} from '../../data/graph/model'

const CASE_COLOR: Record<Case, string> = { low: 'var(--tx3)', mid: 'var(--acc)', high: 'var(--ok)' }

type StmtKey = 'pl' | 'opex' | 'capex' | 'cashflow' | 'npv'
const STMTS: { key: StmtKey; label: string; Icon: typeof FileText }[] = [
  { key: 'pl', label: 'Income (P&L)', Icon: FileText },
  { key: 'opex', label: 'OpEx', Icon: Receipt },
  { key: 'capex', label: 'CapEx', Icon: Building2 },
  { key: 'cashflow', label: 'Cashflow', Icon: Waves },
  { key: 'npv', label: 'NPV', Icon: Percent },
]

const fmt$ = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a < 10) return s + '$' + a.toFixed(2)
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return s + '$' + Math.round(a / 1e3) + 'k'
  return s + '$' + Math.round(a)
}
const fmtN = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

export function Treasury() {
  return <Office id="treasury" cockpit={<FinancialCockpit />} />
}

function FinancialCockpit() {
  const [kase, setCase] = useState<Case | 'all'>('mid')
  const [a, setA] = useState<Assumptions>(CASE_DEFAULTS.mid)
  const [view, setView] = useState<'cashflow' | 'families'>('cashflow')
  const [months, setMonths] = useState(24)
  const [drawer, setDrawer] = useState<StmtKey | null>(null)

  const isAll = kase === 'all'
  const r = runModel(a, months)
  const cases: Case[] = ['low', 'mid', 'high']
  const compare = isAll ? cases.map(c => ({ c, res: runModel(CASE_DEFAULTS[c], months) })) : []
  const hLabel = HORIZONS.find(h => h.months === months)?.label ?? `${months}mo`

  function pick(c: Case | 'all') { setCase(c); if (c !== 'all') setA(CASE_DEFAULTS[c]) }
  function set<K extends keyof Assumptions>(k: K, v: number) { setA(prev => ({ ...prev, [k]: v })) }

  const positive = r.contributionPerActive > 0
  const series: Series[] = isAll
    ? compare.map(({ c, res }) => ({ label: c, color: CASE_COLOR[c], rows: res.rows, dashed: c === 'low' }))
    : [{ label: kase, color: positive ? 'var(--ok)' : 'var(--bad)', rows: r.rows, fill: true }]

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><Wallet size={14} /> Financial cockpit <SourceBadge source="simulated" small /></div>
        <div className="seg">
          {(['low', 'mid', 'high', 'all'] as (Case | 'all')[]).map(c => (
            <button key={c} className={kase === c ? 'on' : ''} onClick={() => pick(c)} style={{ textTransform: 'capitalize' }}>
              {c === 'all' ? <><Layers size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Compare</> : c}
            </button>
          ))}
        </div>
      </div>

      {!isAll && (
        <div className={'insight ' + (positive ? 'ok' : 'warn')} style={{ alignItems: 'center' }}>
          <TrendingUp size={15} />
          <div style={{ fontSize: 12 }}>
            {positive
              ? <>Unit economics <b>positive</b> — break-even ~<b>{r.steadyBreakeven ? Math.round(r.steadyBreakeven) : '—'}</b> active families, cash-positive {r.firstPositiveMonth ? <>month <b>{r.firstPositiveMonth}</b></> : <b>not in {hLabel}</b>}.</>
              : <>Unit economics <b>negative</b> — contribution {fmt$(r.contributionPerActive)}/active is below the infra load. Scaling makes it worse; raise conversion or price, or cut infra.</>}
          </div>
        </div>
      )}

      {!isAll && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
          <Kpi label="Contribution / active" value={fmt$(r.contributionPerActive)} tone={positive ? 'ok' : 'bad'} />
          <Kpi label="Break-even families" value={r.steadyBreakeven ? Math.round(r.steadyBreakeven).toString() : 'never'} tone={r.steadyBreakeven ? undefined : 'bad'} />
          <Kpi label={`NPV · ${hLabel}`} value={fmt$(r.npv)} tone={r.npv >= 0 ? 'ok' : 'bad'} />
          <Kpi label="Families · end" value={fmtN(r.endActive)} />
          <Kpi label="💎 mint / mo" value={fmtN(r.endPayers * DIAMOND_GRANT)} />
        </div>
      )}

      {isAll && (
        <div style={{ border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--bg)' }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--tx3)', padding: '8px 12px' }}>
            <span style={{ width: 62 }}>Case</span><span style={{ flex: 1, textAlign: 'right' }}>Contrib/act</span><span style={{ flex: 1, textAlign: 'right' }}>Break-even</span><span style={{ flex: 1, textAlign: 'right' }}>NPV {hLabel}</span><span style={{ flex: 1, textAlign: 'right' }}>Families</span>
          </div>
          {compare.map(({ c, res }) => (
            <div key={c} className="row" style={{ justifyContent: 'space-between', fontSize: 12, padding: '9px 12px', borderTop: '1px solid var(--bd)' }}>
              <span className="row" style={{ gap: 6, width: 62 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: CASE_COLOR[c] }} /><b style={{ textTransform: 'capitalize' }}>{c}</b></span>
              <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--mono)', color: res.contributionPerActive > 0 ? 'var(--ok)' : 'var(--bad)' }}>{fmt$(res.contributionPerActive)}</span>
              <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--mono)' }}>{res.steadyBreakeven ? Math.round(res.steadyBreakeven) : 'never'}</span>
              <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--mono)', color: res.npv >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{fmt$(res.npv)}</span>
              <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtN(res.endActive)}</span>
            </div>
          ))}
        </div>
      )}

      {/* chart */}
      <div>
        <div className="spread" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{view === 'cashflow' ? 'Cumulative net cashflow' : 'Active families'} · {hLabel}</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="seg">
              {HORIZONS.map(h => <button key={h.key} className={months === h.months ? 'on' : ''} onClick={() => setMonths(h.months)}>{h.label}</button>)}
            </div>
            <div className="seg">
              <button className={view === 'cashflow' ? 'on' : ''} onClick={() => setView('cashflow')}>Cashflow</button>
              <button className={view === 'families' ? 'on' : ''} onClick={() => setView('families')}>Families</button>
            </div>
          </div>
        </div>
        <FancyChart series={series} view={view} />
        {isAll && (
          <div className="row" style={{ gap: 14, marginTop: 8, fontSize: 11, color: 'var(--tx2)', flexWrap: 'wrap' }}>
            {cases.map(c => <span key={c} className="row" style={{ gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: CASE_COLOR[c] }} /><span style={{ textTransform: 'capitalize' }}>{c}{c === 'low' ? ' (dashed)' : ''}</span></span>)}
          </div>
        )}
      </div>

      {!isAll && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STMTS.map(s => (
              <button key={s.key} className="chip" onClick={() => setDrawer(s.key)} style={{ gap: 6, cursor: 'pointer' }}>
                <s.Icon size={13} /> {s.label}
              </button>
            ))}
          </div>
          {drawer && <StatementDrawer stmt={drawer} a={a} r={r} onClose={() => setDrawer(null)} />}

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
              Household D30 <b>{Math.round(r.householdD30 * 100)}%</b> = 1 − (1 − kid)(1 − parent). Demand sliders lift the family curve; money sliders convert it to cash.
            </div>
          </div>
        </>
      )}
      {isAll && <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Comparing the three preset cases at their defaults over {hLabel}. Pick a single case to edit assumptions and open the statements.</div>}
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

interface Series { label: string; color: string; rows: MonthRow[]; dashed?: boolean; fill?: boolean }

// Catmull-Rom → cubic bézier for a smooth (non-overshooting-ish) curve.
function catmull(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function FancyChart({ series, view }: { series: Series[]; view: 'cashflow' | 'families' }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const W = 620, H = 210, padL = 52, padR = 16, padT = 14, padB = 26
  const val = (row: MonthRow) => (view === 'cashflow' ? row.cum : row.active)
  const n = series[0].rows.length
  const flat = series.flatMap(s => s.rows.map(val))
  const min = Math.min(0, ...flat), max = Math.max(1, ...flat)
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1)
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB)
  const base = y(min), zeroY = y(0)
  const longRange = n > 30
  const ticks = [...new Set([0, 0.2, 0.4, 0.6, 0.8, 1].map(f => Math.round(f * (n - 1))))]
  const tickLabel = (i: number) => (longRange ? `${2026 + Math.floor(i / 12)}` : `m${i + 1}`)

  function onMove(e: React.MouseEvent) {
    const svg = ref.current; if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - padL) / (W - padL - padR)) * (n - 1))))
    setHover(i)
  }

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }}
      role="img" aria-label={view} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <defs>
        {series.map((s, si) => (
          <linearGradient key={si} id={`fg${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.color} stopOpacity="0.26" />
            <stop offset="1" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const gy = padT + f * (H - padT - padB)
        return <line key={f} x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="var(--bd)" strokeWidth={1} />
      })}
      <text x={padL - 8} y={y(max) + 3} textAnchor="end" fontSize={9.5} fill="var(--tx3)">{view === 'cashflow' ? fmt$(max) : fmtN(max)}</text>
      <text x={padL - 8} y={y(min) + 3} textAnchor="end" fontSize={9.5} fill="var(--tx3)">{view === 'cashflow' ? fmt$(min) : fmtN(min)}</text>
      {min < 0 && <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--bd2)" strokeWidth={1} strokeDasharray="4 4" />}
      {ticks.map(i => <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize={9.5} fill="var(--tx3)">{tickLabel(i)}</text>)}
      {series.map((s, si) => {
        const pts = s.rows.map((row, i) => ({ x: x(i), y: y(val(row)) }))
        const d = catmull(pts)
        return (
          <g key={si}>
            {s.fill && <path d={`${d} L${x(n - 1).toFixed(1)},${base.toFixed(1)} L${x(0).toFixed(1)},${base.toFixed(1)} Z`} fill={`url(#fg${si})`} />}
            <path d={d} fill="none" stroke={s.color} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
            <circle cx={x(n - 1)} cy={y(val(s.rows[n - 1]))} r={3.4} fill={s.color} />
          </g>
        )
      })}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={base} stroke="var(--tx3)" strokeWidth={1} strokeDasharray="3 3" />
          {series.map((s, si) => <circle key={si} cx={x(hover)} cy={y(val(s.rows[hover]))} r={3.6} fill="var(--bg)" stroke={s.color} strokeWidth={2} />)}
          <g transform={`translate(${Math.min(x(hover) + 8, W - 118)},${padT + 4})`}>
            <rect width={110} height={15 + series.length * 14} rx={6} fill="var(--bg2)" stroke="var(--bd2)" />
            <text x={8} y={13} fontSize={9.5} fill="var(--tx3)">{longRange ? `${2026 + Math.floor(hover / 12)}` : `month ${hover + 1}`}</text>
            {series.map((s, si) => (
              <text key={si} x={8} y={14 + (si + 1) * 14} fontSize={10} fill={s.color} fontWeight={600}>
                {series.length > 1 ? `${s.label}: ` : ''}{view === 'cashflow' ? fmt$(val(s.rows[hover])) : fmtN(val(s.rows[hover]))}
              </text>
            ))}
          </g>
        </g>
      )}
    </svg>
  )
}

// ── detail drawer (right on desktop, full-page on mobile via min()) ──────────
function StatementDrawer({ stmt, a, r, onClose }: { stmt: StmtKey; a: Assumptions; r: ModelResult; onClose: () => void }) {
  const title = STMTS.find(s => s.key === stmt)!.label
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(460px,100vw)', background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', display: 'flex', flexDirection: 'column' }}>
        <div className="spread" style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
          <div className="row" style={{ gap: 8 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span><SourceBadge source="simulated" small /></div>
          <button onClick={onClose} aria-label="Close" style={{ cursor: 'pointer', color: 'var(--tx2)' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {stmt === 'pl' && <PL a={a} r={r} />}
          {stmt === 'opex' && <OpEx a={a} r={r} />}
          {stmt === 'capex' && <CapEx />}
          {stmt === 'cashflow' && <Cashflow r={r} />}
          {stmt === 'npv' && <NPVStmt r={r} />}
        </div>
      </div>
    </div>
  )
}

function totals(r: ModelResult, a: Assumptions) {
  let rev = 0, infra = 0, net = 0
  for (const row of r.rows) { rev += row.revenue; infra += row.active * a.infraActive + row.active * REG_MULT * INFRA_REG; net += row.net }
  const proc = rev * PROCESSING, netRev = rev - proc, fixed = FIXED_MO * r.rows.length
  const cac = netRev - infra - net - fixed
  return { rev, proc, netRev, infra, fixed, cac, net }
}

function LI({ label, value, bold, indent, tone }: { label: string; value: string; bold?: boolean; indent?: boolean; tone?: 'ok' | 'bad' | 'mut' }) {
  const c = tone === 'ok' ? 'var(--ok)' : tone === 'bad' ? 'var(--bad)' : tone === 'mut' ? 'var(--tx3)' : 'var(--tx)'
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', paddingLeft: indent ? 12 : 0, borderTop: bold ? '1px solid var(--bd2)' : '1px solid var(--bd)' }}>
      <span style={{ fontSize: 12, fontWeight: bold ? 700 : 400, color: indent ? 'var(--tx2)' : 'var(--tx)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: bold ? 700 : 500, color: c }}>{value}</span>
    </div>
  )
}
const note = (t: string) => <div style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: 10, lineHeight: 1.5 }}>{t}</div>

function PL({ a, r }: { a: Assumptions; r: ModelResult }) {
  const t = totals(r, a)
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>24-month totals</div>
      <LI label="Revenue (subscription)" value={fmt$(t.rev)} />
      <LI label="Store processing (15%)" value={'-' + fmt$(t.proc)} indent tone="mut" />
      <LI label="Net revenue" value={fmt$(t.netRev)} bold />
      <LI label="COGS — infra" value={'-' + fmt$(t.infra)} indent tone="mut" />
      <LI label="Gross profit" value={fmt$(t.netRev - t.infra)} bold />
      <LI label="OpEx — fixed" value={'-' + fmt$(t.fixed)} indent tone="mut" />
      <LI label="OpEx — acquisition (CAC)" value={'-' + fmt$(t.cac)} indent tone="mut" />
      <LI label="Net income" value={fmt$(t.net)} bold tone={t.net >= 0 ? 'ok' : 'bad'} />
      {note('Diamonds are a bundled perk (a mint), not cash — excluded from the P&L. Base wires to live families at P3; rates stay simulated.')}
    </div>
  )
}

function OpEx({ a, r }: { a: Assumptions; r: ModelResult }) {
  const t = totals(r, a)
  const mo = r.rows.length
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>Fixed · monthly</div>
      <LI label="Supabase Pro" value="$25" indent />
      <LI label="Vercel Pro" value="$20" indent />
      <LI label="Domains / email / misc" value="$15" indent />
      <LI label="Agent OS (LLM)" value="$3" indent />
      <LI label="Fixed / mo" value={'$' + FIXED_MO} bold />
      <div style={{ fontSize: 11, color: 'var(--tx3)', margin: '12px 0 6px' }}>Variable · 24-mo total</div>
      <LI label={`Infra ($${a.infraActive.toFixed(2)}/active)`} value={fmt$(t.infra)} indent />
      <LI label={`Acquisition ($${a.cac.toFixed(2)}/active)`} value={fmt$(t.cac)} indent />
      <LI label="Total OpEx (24mo)" value={fmt$(t.fixed + t.infra + t.cac)} bold />
      {note(`Fixed × ${mo} months = ${fmt$(t.fixed)}. The solo + agents cost base is the moat: break-even is a unit condition, not a scale one.`)}
    </div>
  )
}

function CapEx() {
  return (
    <div>
      <LI label="Capitalized build / dev" value="$0" tone="mut" />
      <LI label="Content authoring (capitalized)" value="$0" tone="mut" />
      <LI label="Equipment" value="$0" tone="mut" />
      <LI label="Total CapEx" value="$0" bold />
      {note('A solo software company is almost entirely OpEx — build and content are expensed as incurred, not capitalized. CapEx stays ~$0 until there is hardware or capitalizable long-lived investment. Shown for completeness and honesty.')}
    </div>
  )
}

function Cashflow({ r }: { r: ModelResult }) {
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--tx3)', padding: '4px 0' }}>
        <span>Month</span><span>Net</span><span>Cumulative</span>
      </div>
      {r.rows.map(row => (
        <div key={row.m} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--bd)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>m{row.m}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: row.net >= 0 ? 'var(--ok)' : 'var(--bad)', width: 70, textAlign: 'right' }}>{fmt$(row.net)}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: row.cum >= 0 ? 'var(--tx)' : 'var(--bad)', width: 80, textAlign: 'right' }}>{fmt$(row.cum)}</span>
        </div>
      ))}
      {note(`First cash-positive month: ${r.firstPositiveMonth ?? 'not within 24mo'}. 24-mo cumulative: ${fmt$(r.cumNet)}.`)}
    </div>
  )
}

function NPVStmt({ r }: { r: ModelResult }) {
  const rm = Math.pow(1.15, 1 / 12) - 1
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--tx3)', padding: '4px 0' }}>
        <span>Month</span><span>Net</span><span>PV @15%</span>
      </div>
      {r.rows.map(row => (
        <div key={row.m} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--bd)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>m{row.m}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--tx2)', width: 70, textAlign: 'right' }}>{fmt$(row.net)}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--tx)', width: 80, textAlign: 'right' }}>{fmt$(row.net / Math.pow(1 + rm, row.m))}</span>
        </div>
      ))}
      <LI label="NPV (24mo @ 15%/yr)" value={fmt$(r.npv)} bold tone={r.npv >= 0 ? 'ok' : 'bad'} />
      {note('Discounted at 15%/yr. NPV is dominated by the trajectory past month 24 — the terminal run-rate matters more than the two-year sum.')}
    </div>
  )
}
