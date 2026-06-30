import { useMemo, useState } from 'react'
import { Coins, RefreshCw, TrendingUp, Gem, CreditCard, Info } from 'lucide-react'
import {
  PRESETS, DEFAULT_GLOBALS, DRIVER_META, CASE_META,
  computeScenario, forecastCurve,
  type Case, type Drivers, type Globals,
} from '../data/monetization'

const CASES: Case[] = ['low', 'mid', 'high']

const usd = (n: number): string => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return '$' + (n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, '') + 'M'
  if (a >= 1_000) return '$' + (n / 1_000).toFixed(a >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return '$' + Math.round(n)
}
const fmtFamilies = (n: number): string => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(n))
// Strip float artifacts (0.07*100 = 7.000000000000001) before display.
const cleanNum = (n: number, dp: number): string => Number(n.toFixed(dp)).toString()

const GLOSSARY: { term: string; def: string }[] = [
  { term: 'ARR', def: 'Annual recurring revenue — MRR × 12.' },
  { term: 'MRR', def: 'Monthly recurring revenue — total predictable revenue per month.' },
  { term: 'ARPU', def: 'Average revenue per user — blended revenue per family per month.' },
  { term: 'LTV', def: 'Lifetime value — total gross profit one paying family brings over its life.' },
  { term: 'CAC', def: 'Customer acquisition cost — spend to acquire one paying family.' },
  { term: 'LTV : CAC', def: 'Value-to-cost ratio. Above 3× is the fundable bar.' },
  { term: 'Payback', def: 'Months of gross margin needed to earn back CAC. Under 12 is healthy.' },
  { term: 'IAP', def: 'In-app purchase — parents buying diamond packs for kids (consumable).' },
  { term: 'Conversion', def: 'Share of free families who upgrade to a paid subscription.' },
  { term: 'Churn', def: 'Share of paying subscribers who cancel each month.' },
  { term: 'Gross margin', def: 'Revenue left after direct costs (hosting, payment fees), as a %.' },
]

const caseColor = (c: Case): string => c === 'high' ? 'var(--ok)' : c === 'mid' ? 'var(--acc)' : 'var(--tx3)'

export function Monetization({ liveFamilies }: { liveFamilies: number | null }) {
  const [families, setFamilies] = useState(() => Math.max(liveFamilies ?? 0, 10_000))
  const [drivers, setDrivers] = useState<Record<Case, Drivers>>(() => structuredClone(PRESETS))
  const [g, setG] = useState<Globals>(DEFAULT_GLOBALS)
  const [glossary, setGlossary] = useState(false)

  const results = useMemo(
    () => Object.fromEntries(CASES.map(c => [c, computeScenario(drivers[c], families, g)])) as Record<Case, ReturnType<typeof computeScenario>>,
    [drivers, families, g],
  )
  const curves = useMemo(
    () => Object.fromEntries(CASES.map(c => [c, forecastCurve(drivers[c], g, families)])) as Record<Case, ReturnType<typeof forecastCurve>>,
    [drivers, g, families],
  )

  const setDriver = (c: Case, key: keyof Drivers, sliderVal: number) => {
    const meta = DRIVER_META.find(m => m.key === key)!
    setDrivers(d => ({ ...d, [c]: { ...d[c], [key]: meta.fromSlider(sliderVal) } }))
  }
  const reset = () => { setDrivers(structuredClone(PRESETS)); setG(DEFAULT_GLOBALS) }

  return (
    <div className="msim" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Coins size={15} />
        <div style={{ flex: 1 }}>The forecast runs two streams — <b>subscription</b> (parents pay monthly) plus <b>diamond IAP</b> (parents buy packs for kids) — through Low / Mid / High driver sets. Drag any assumption; every number and the curve update live.</div>
        <button className="chip" onClick={() => setGlossary(s => !s)} style={{ flex: 'none' }} aria-expanded={glossary}>
          <Info size={13} /> {glossary ? 'Hide' : 'Abbreviations'}
        </button>
      </div>

      {glossary && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>What the abbreviations mean</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '8px 18px' }}>
            {GLOSSARY.map(x => (
              <div key={x.term} className="row" style={{ gap: 9, alignItems: 'baseline' }}>
                <span style={{ flex: 'none', minWidth: 74, fontSize: 12, fontWeight: 600, color: 'var(--acc-text)', fontFamily: 'var(--mono)' }}>{x.term}</span>
                <span style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.45 }}>{x.def}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scale + global assumptions */}
      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Modelling at {fmtFamilies(families)} active families</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>live today: {liveFamilies == null ? '—' : fmtFamilies(liveFamilies)} · drag to model the path to scale</div>
          </div>
        </div>
        <input type="range" min={100} max={100_000} step={100} value={families} onChange={e => setFamilies(parseFloat(e.target.value))} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          <GlobalSlider label="Gross margin" value={Math.round(g.margin * 100)} min={50} max={95} step={1} fmt={v => v + '%'}
            onChange={v => setG(s => ({ ...s, margin: v / 100 }))} />
          <GlobalSlider label="CAC · per paying family" value={g.cac} min={5} max={120} step={1} fmt={v => '$' + v}
            onChange={v => setG(s => ({ ...s, cac: v }))} />
        </div>
      </div>

      {/* Outcome cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {CASES.map(c => {
          const r = results[c]
          const m = CASE_META[c]
          const healthy = r.ltvCac != null && r.ltvCac >= 3
          return (
            <div key={c} className="card" style={{ padding: 16, borderColor: c === 'mid' ? 'var(--acc)' : 'var(--bd2)', borderWidth: c === 'mid' ? 1.5 : 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="spread">
                <span style={{ fontSize: 12.5, fontWeight: 600, color: caseColor(c) }}>{m.label}</span>
                <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{m.blurb}</span>
              </div>
              <div>
                <div style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-.02em' }}>{usd(r.arr)}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>ARR · {usd(r.mrr)}/mo</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, color: 'var(--tx2)' }}>
                <Split label="Subscription" icon={<CreditCard size={11} />} value={usd(r.subMrr)} pct={r.mrr > 0 ? r.subMrr / r.mrr : 0} color="var(--acc)" />
                <Split label="Diamond IAP" icon={<Gem size={11} />} value={usd(r.iapMrr)} pct={r.mrr > 0 ? r.iapMrr / r.mrr : 0} color="var(--mag)" />
              </div>
              <div style={{ display: 'flex', gap: 14, paddingTop: 8, borderTop: '1px solid var(--bd)', fontSize: 11.5 }}>
                <div><div style={{ color: 'var(--tx3)' }}>LTV</div><div style={{ fontWeight: 600 }}>{usd(r.ltv)}</div></div>
                <div><div style={{ color: 'var(--tx3)' }}>LTV:CAC</div><div style={{ fontWeight: 600, color: healthy ? 'var(--ok)' : 'var(--warn)' }}>{r.ltvCac == null ? '—' : r.ltvCac.toFixed(1) + '×'}</div></div>
                <div><div style={{ color: 'var(--tx3)' }}>Payback</div><div style={{ fontWeight: 600 }}>{r.paybackMo == null ? '—' : Math.round(r.paybackMo) + 'mo'}</div></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Forecast chart */}
      <div className="card" style={{ padding: 16 }}>
        <div className="spread" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 600 }}><TrendingUp size={14} /> Projected ARR vs active families</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>the fan of outcomes from today to {fmtFamilies(families)} families</div>
          </div>
          <div className="row" style={{ gap: 14, fontSize: 11, color: 'var(--tx2)' }}>
            {CASES.slice().reverse().map(c => (
              <span key={c} className="row" style={{ gap: 5 }}><span style={{ width: 12, height: 3, borderRadius: 2, background: caseColor(c) }} /> {c}</span>
            ))}
          </div>
        </div>
        <ScenarioChart curves={curves} families={families} />
      </div>

      {/* Editable assumption matrix */}
      <div className="card" style={{ padding: 16 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 600 }}><Info size={14} /> Assumptions · drag to flex each case</div>
          <button className="chip" onClick={reset}><RefreshCw size={13} /> Reset to presets</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1.3fr) repeat(3,1fr)', gap: '7px 14px', alignItems: 'center' }}>
          <div />
          {CASES.map(c => <div key={c} style={{ fontSize: 11.5, fontWeight: 600, color: caseColor(c), textAlign: 'center' }}>{c.toUpperCase()}</div>)}
          {DRIVER_META.map(meta => (
            <DriverRow key={meta.key} label={meta.label} unit={meta.unit}>
              {CASES.map(c => {
                const sv = meta.toSlider(drivers[c][meta.key])
                return (
                  <div key={c} className="row" style={{ gap: 7 }}>
                    <input type="range" min={meta.min} max={meta.max} step={meta.step} value={sv}
                      onChange={e => setDriver(c, meta.key, parseFloat(e.target.value))} style={{ flex: 1, minWidth: 0 }} />
                    <span style={{ width: 46, textAlign: 'right', fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {meta.unit === '$' ? '$' + cleanNum(sv, 2) : cleanNum(sv, 1) + '%'}
                    </span>
                  </div>
                )
              })}
            </DriverRow>
          ))}
        </div>
      </div>

      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Gem size={15} />
        <div>Your live <b>diamonds-spent-per-kid</b> metric is the leading indicator for the IAP buyer rate — calibrate the Mid case against it before launch, and the forecast stops being a guess.</div>
      </div>
    </div>
  )
}

function Split({ label, icon, value, pct, color }: { label: string; icon: React.ReactNode; value: string; pct: number; color: string }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <span className="row" style={{ gap: 4, width: 96, flex: 'none', color: 'var(--tx2)' }}>{icon}{label}</span>
      <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(pct * 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ width: 44, textAlign: 'right', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function GlobalSlider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="spread" style={{ marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%' }} />
    </div>
  )
}

function DriverRow({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{label} <span style={{ color: 'var(--tx3)', fontSize: 11 }}>({unit})</span></div>
      {children}
    </>
  )
}

function ScenarioChart({ curves, families }: { curves: Record<Case, { families: number; arr: number }[]>; families: number }) {
  const W = 760, H = 220, padL = 46, padR = 64, padT = 14, padB = 26
  const maxArr = Math.max(1, ...CASES.flatMap(c => curves[c].map(p => p.arr)))
  const x = (f: number) => padL + (f / Math.max(1, families)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - v / maxArr) * (H - padT - padB)
  const line = (pts: { families: number; arr: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.families).toFixed(1)},${y(p.arr).toFixed(1)}`).join(' ')
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => f * maxArr)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label="Projected ARR fan chart by active families">
      {gridVals.map((v, i) => {
        const gy = y(v)
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="var(--bd)" strokeWidth={1} />
            <text x={padL - 6} y={gy + 3} fontSize={10} fill="var(--tx3)" textAnchor="end">{usd(v)}</text>
          </g>
        )
      })}
      {[0, 0.5, 1].map((f, i) => (
        <text key={i} x={x(families * f)} y={H - 8} fontSize={10} fill="var(--tx3)" textAnchor="middle">{fmtFamilies(families * f)}</text>
      ))}
      {CASES.map(c => {
        const pts = curves[c]
        const end = pts[pts.length - 1]
        return (
          <g key={c}>
            <path d={line(pts)} fill="none" stroke={caseColor(c)} strokeWidth={c === 'mid' ? 2.5 : 2} strokeLinejoin="round" />
            <circle cx={x(end.families)} cy={y(end.arr)} r={3} fill={caseColor(c)} />
            <text x={x(end.families) + 6} y={y(end.arr) + 3} fontSize={11} fontWeight={600} fill={caseColor(c)}>{usd(end.arr)}</text>
          </g>
        )
      })}
    </svg>
  )
}
