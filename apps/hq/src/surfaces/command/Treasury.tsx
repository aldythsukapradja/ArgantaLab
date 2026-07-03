import { useState } from 'react'
import { Wallet, TrendingUp, X, FileText, Receipt, Building2, Waves, Percent, Layers, Scale, ArrowUpRight } from 'lucide-react'
import { Office } from './Office'
import { SourceBadge } from './SourceBadge'
import { CashflowChart, ValuationFootballField, type RSeries, type FFRow } from '../../components/rcharts'
import { ReportPanel } from './reports/Briefing'
import { buildFinancialReport } from '../../data/reports/financial'
import { buildValuationReport } from '../../data/reports/valuation'
import { valuationEstimate, valuationLevers } from '../../data/graph/valuation'
import {
  runModel, CASE_DEFAULTS, SLIDERS, DIAMOND_GRANT, HORIZONS,
  FIXED_MO, PROCESSING, INFRA_REG, REG_MULT,
  type Case, type Assumptions, type ModelResult,
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Office id="treasury" cockpit={<FinancialCockpit />} />
      <ValuationPanel />
      <ReportPanel report={buildFinancialReport()} label="Financial report" />
      <ReportPanel report={buildValuationReport()} label="Valuation report" />
    </div>
  )
}

// ── The Actuary — valuation panel (six methods + what would move it) ─────────
function ValuationPanel() {
  const e = valuationEstimate('current')
  const levers = valuationLevers()
  const ff: FFRow[] = [
    ...e.methods.map(m => ({ label: m.label, sub: m.provenance, low: m.low, high: m.high })),
    { label: 'Recommended', sub: 'synthesized', low: e.recommended.low, high: e.recommended.high, highlight: true },
  ]
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><Scale size={14} /> Valuation · The Actuary <SourceBadge source={e.synthesized.provenance} small /></div>
        <div style={{ fontSize: 12, color: 'var(--tx2)' }}>recommended <b style={{ color: 'var(--acc-text)', fontFamily: 'var(--mono)' }}>${e.recommended.low}M–${e.recommended.high}M</b> pre-money</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
        <Kpi label="Recommended low" value={`$${e.recommended.low}M`} />
        <Kpi label="Recommended high" value={`$${e.recommended.high}M`} />
        <Kpi label="Weighting" value={e.synthesized.weightsMode} />
        <Kpi label="Top lever" value={levers[0] ? `+$${levers[0].estImpactUsdM}M` : '—'} tone="ok" />
      </div>

      <ValuationFootballField rows={ff} />

      <div style={{ fontSize: 10.5, color: 'var(--tx3)', lineHeight: 1.5 }}>{e.driverOfChange}</div>

      {/* what would move it — the founder's dynamic to-do */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>What would move it <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>· ranked by $ impact</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {levers.map((l, i) => (
            <div key={i} className="spread" style={{ gap: 10, padding: '8px 10px', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', background: 'var(--bg)', flexWrap: 'wrap' }}>
              <div className="row" style={{ gap: 8, minWidth: 0 }}>
                <ArrowUpRight size={13} style={{ color: 'var(--ok)', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5 }}>{l.action}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="pill pill-mut" style={{ fontSize: 9.5, fontFamily: 'var(--mono)' }}>{l.node}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ok)', fontFamily: 'var(--mono)' }}>+${l.estImpactUsdM}M</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--tx3)', lineHeight: 1.5 }}>Six standard early-stage methods, computed off the ontology graph + founder-set constants. No method calls an LLM. The range re-rates when <span style={{ fontFamily: 'var(--mono)' }}>stage.pay</span> flips live — the synthesis weights invert at first real payers.</div>
    </div>
  )
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
  const acc = (row: { cum: number; active: number }) => (view === 'cashflow' ? row.cum : row.active)
  let chartData: Record<string, number>[]
  let series: RSeries[]
  if (isAll) {
    const nrows = compare[0].res.rows.length
    chartData = Array.from({ length: nrows }, (_, i) => {
      const o: Record<string, number> = { i }
      compare.forEach(({ c, res }) => { o[c] = acc(res.rows[i]) })
      return o
    })
    series = cases.map(c => ({ key: c, label: c, color: CASE_COLOR[c], dashed: c === 'low' }))
  } else {
    chartData = r.rows.map((row, i) => ({ i, v: acc(row) }))
    series = [{ key: 'v', label: kase, color: positive ? 'var(--ok)' : 'var(--bad)', fill: true }]
  }

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
        <CashflowChart data={chartData} series={series} kind={view === 'cashflow' ? 'money' : 'count'} months={months} />
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
