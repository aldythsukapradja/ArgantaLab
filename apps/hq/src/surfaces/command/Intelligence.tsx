// Command Center v2 — the Intelligence band: SPEND (+ weekly history),
// WORKLOAD (ComfyUI compute), MODEL MAP, and SYSTEM (local machine health).
// LLM usage is 'est' (parsed from local logs — no official subscription-quota
// API exists), ComfyUI + machine numbers are 'live' (measured locally). The
// MODEL MAP is 'declared' config mirroring packages/ai/src/registry.js (the
// four-tier router), not a live measurement — it answers "which model is used
// where".
import { useState } from 'react'
import type { Telemetry } from './ops/useOps'

export const fmtTokens = (n: number): string =>
  n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(0) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(n)
export const fmtUsd = (n: number): string => n >= 100 ? '$' + Math.round(n) : '$' + n.toFixed(2)
/** Full comma-separated USD, e.g. $22,144 — for the secondary spend line. */
export const fmtUsdCommas = (n: number): string => '$' + Math.round(n).toLocaleString('en-US')
const fmtDuration = (sec: number): string => {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
/** 'YYYY-MM-DD' -> "May 1" */
const WEEK_DATE_LABEL = (iso: string): string =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// Series colors — consistent across the by-model pills and the history chart.
const SERIES_COLOR: Record<string, string> = {
  Opus: '#D97757', Sonnet: '#e8a383', Haiku: '#f4c9b0', Fable: '#c9648a', Codex: '#10A37F', Sovereign: '#6366f1',
}

// Declared routing map — mirrors packages/ai/src/registry.js COST_CLASS tiers.
// "Live counts" arrive once the four-tier router ledger is implemented (T5).
const MODEL_MAP: { tier: string; friendly: string; color: string; models: string[]; where: string }[] = [
  { tier: 'Sovereign', friendly: 'Free · local', color: '#6366f1', models: ['ComfyUI (SD1.5 · SDXL · Wan · AceStep)', 'Local LLM', 'Deterministic engines'], where: 'Media gen · Builder engines' },
  { tier: 'Sponsored', friendly: 'Free API', color: '#10b981', models: ['Cloudflare Llama', 'Groq Llama 3.3 70B', 'Gemini Flash'], where: 'Content copy · Core fallback' },
  { tier: 'Economy', friendly: 'Economy', color: '#f59e0b', models: ['DeepSeek Chat', 'Claude Haiku'], where: 'Cheap classify · summarize' },
  { tier: 'Frontier', friendly: 'Premium', color: '#ef4444', models: ['Claude Opus 4.8', 'Claude Sonnet', 'Codex'], where: 'Bridge missions · Core chat' },
]

export function IntelligenceBand({ telemetry: t }: { telemetry: Telemetry | null }) {
  const comfy = t?.comfy
  const sys = t?.system

  // Biggest spender first: rank Claude vs Codex by all-time tokens (a common,
  // comparable unit). Sovereign has no token basis (it's local compute), so it
  // always renders last as its own "free" category, never sorted against $.
  const spendCards = t ? [
    { id: 'claude', label: 'Claude', tokens: t.claude.allTime.tokens, usd: t.claude.allTime.costUsd, todayTok: t.claude.today.tokens, accent: '#D97757' },
    { id: 'codex', label: 'Codex', tokens: t.codex.allTime.tokens, usd: t.codex.allTime.costUsd, todayTok: t.codex.today.tokens, accent: '#10A37F' },
  ].sort((a, b) => b.tokens - a.tokens) : []

  return (
    <div className="cc-intel">
      {/* SPEND — token volume is the headline (what you actually used); the
          API-equivalent $ underneath answers "what would this have cost". */}
      <section className="cc-zone cc-spend">
        <h2 className="cc-zone-h">Spend <span>API-equivalent · est</span></h2>
        {t ? (
          <>
            <div className="cc-spend-row">
              {spendCards.map((c) => (
                <SpendCell key={c.id} label={c.label} tokens={c.tokens} usd={c.usd} todayTok={c.todayTok} accent={c.accent} />
              ))}
              <SpendCell label="Sovereign" tokens={null} usd={0} todayTok={null} accent="#6366f1" note={`${comfy?.jobsWeek ?? 0} local jobs this week — no metered cost`} />
            </div>

            {/* Grouped model pills — Claude's sub-models, Codex, and Sovereign's
                local media models, each under its own brain label. */}
            <PillGroup label="Claude">
              {t.claude.byModel.filter((m) => m.tokens > 0).map((m) => (
                <Pill key={m.label} color={SERIES_COLOR[m.label] || 'var(--tx3)'} label={m.label} count={m.tokens} usd={m.cost} />
              ))}
            </PillGroup>
            <PillGroup label="Codex">
              <Pill color={SERIES_COLOR.Codex} label="Codex" count={t.codex.allTime.tokens} usd={t.codex.allTime.costUsd} />
            </PillGroup>
            {comfy?.topModels && comfy.topModels.length > 0 && (
              <PillGroup label="Sovereign" sub="runs, not tokens — local & free">
                {comfy.topModels.map((m) => (
                  <Pill key={m.name} color={SERIES_COLOR.Sovereign} label={prettyModel(m.name)} count={m.runs} />
                ))}
              </PillGroup>
            )}

            <WeeklyChart weekly={t.weekly} />
          </>
        ) : <p className="cc-muted">Connect the bridge to see usage.</p>}
      </section>

      {/* WORKLOAD — ComfyUI (measured): real compute signals, not just a job
          count, so the scale of local work is visible. */}
      <section className="cc-zone cc-workload">
        <h2 className="cc-zone-h">Workload <span>ComfyUI · live</span></h2>
        {comfy?.up ? (
          <>
            <div className="cc-work-stats">
              <Stat n={comfy.jobsToday ?? 0} l="jobs today" />
              <Stat n={comfy.computeSec != null ? fmtDuration(comfy.computeSec) : '—'} l="compute time" />
              <Stat n={comfy.totalNodeExecutions != null ? fmtTokens(comfy.totalNodeExecutions) : '—'} l="node runs" />
              <Stat n={(comfy.queueRunning ?? 0) + (comfy.queuePending ?? 0)} l="in queue" />
            </div>
            {comfy.outputs && (
              <div className="cc-outputs">
                <OutputChip n={comfy.outputs.images} l="images" />
                <OutputChip n={comfy.outputs.videos} l="videos" />
                <OutputChip n={comfy.outputs.audios} l="audio" />
              </div>
            )}
            {comfy.vram && (
              <div className="cc-vram">
                <div className="cc-vram-label mono">VRAM {comfy.vram.usedGb} / {comfy.vram.totalGb} GB</div>
                <div className="cc-bar"><div className="cc-bar-fill" style={{ width: `${Math.min(100, (comfy.vram.usedGb / comfy.vram.totalGb) * 100)}%` }} /></div>
              </div>
            )}
            <div className="cc-topmodels">
              <div className="cc-topmodels-h">Top models</div>
              {(comfy.topModels || []).map((m) => (
                <div key={m.name} className="cc-topmodel"><span className="cc-topmodel-name mono">{prettyModel(m.name)}</span><span className="cc-topmodel-runs">{m.runs}</span></div>
              ))}
            </div>
            {comfy.comfyVersion && <div className="cc-work-ver mono">ComfyUI {comfy.comfyVersion}</div>}
          </>
        ) : <p className="cc-muted">ComfyUI offline — start it from the Launch zone.</p>}
      </section>

      {/* MODEL MAP — declared routing (which model runs where). */}
      <section className="cc-zone cc-modelmap">
        <h2 className="cc-zone-h">Model Map <span>routing · declared</span></h2>
        <div className="cc-tiers">
          {MODEL_MAP.map((tier) => (
            <div key={tier.tier} className="cc-tier" style={{ ['--tier' as string]: tier.color }}>
              <div className="cc-tier-head">
                <span className="cc-tier-dot" />
                <b>{tier.tier}</b>
                <i>{tier.friendly}</i>
              </div>
              <div className="cc-tier-models">{tier.models.join(' · ')}</div>
              <div className="cc-tier-where">↳ {tier.where}</div>
            </div>
          ))}
        </div>
        <p className="cc-provenance-note">Declared from the four-tier router registry. Live per-model call counts arrive with the router ledger.</p>
      </section>

      {/* SYSTEM — local machine health (measured via node:os). */}
      <section className="cc-zone cc-system">
        <h2 className="cc-zone-h">System <span>this machine · live</span></h2>
        {sys ? (
          <>
            <div className="cc-sys-stats">
              <Stat n={`${sys.ramUsedGb}`} l={`of ${sys.ramTotalGb} GB RAM`} />
              <Stat n={sys.cpuCount} l="CPU cores" />
              <Stat n={fmtDuration(sys.bridgeUptimeSec)} l="bridge uptime" />
            </div>
            <div className="cc-vram">
              <div className="cc-vram-label mono">RAM {sys.ramUsedGb} / {sys.ramTotalGb} GB</div>
              <div className="cc-bar"><div className="cc-bar-fill" style={{ width: `${Math.min(100, (sys.ramUsedGb / sys.ramTotalGb) * 100)}%` }} /></div>
            </div>
          </>
        ) : <p className="cc-muted">Connect the bridge to see machine health.</p>}
      </section>
    </div>
  )
}

function SpendCell({ label, tokens, usd, todayTok, accent, note }: {
  label: string; tokens: number | null; usd: number; todayTok: number | null; accent: string; note?: string
}) {
  return (
    <div className="cc-spend-cell" style={{ ['--accent' as string]: accent }}>
      <div className="cc-spend-label">{label}</div>
      {tokens != null ? (
        <>
          <div className="cc-spend-tok">{fmtTokens(tokens)}<span className="cc-spend-tok-unit">tok</span></div>
          <div className="cc-spend-usd mono">≈ {fmtUsdCommas(usd)} equiv</div>
          {todayTok != null && todayTok > 0 && <div className="cc-spend-today mono">+{fmtTokens(todayTok)} today</div>}
        </>
      ) : (
        <>
          <div className="cc-spend-tok">$0</div>
          <div className="cc-spend-usd mono">{note}</div>
        </>
      )}
    </div>
  )
}

/** A labeled row of model pills — one per brain (Claude / Codex / Sovereign),
 * so the "which model ran" breakdown reads as three groups, not one flat list. */
function PillGroup({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="cc-bymodel-group">
      <div className="cc-bymodel-group-label">{label}{sub && <i>{sub}</i>}</div>
      <div className="cc-bymodel">{children}</div>
    </div>
  )
}
function Pill({ color, label, count, usd }: { color: string; label: string; count: number; usd?: number }) {
  return (
    <span className="cc-bymodel-pill mono" style={{ ['--dot' as string]: color }}>
      <i className="cc-bymodel-dot" />{label} <b>{fmtTokens(count)}</b>{usd != null && usd > 0 && <i className="cc-bymodel-usd"> · {fmtUsd(usd)}</i>}
    </span>
  )
}

/** Dependency-free stacked bar chart: one bar per week, segments colored by
 * model, scaled against the busiest week. Fixed at 7-day buckets from the
 * founder's declared project start ("day 0"), never the first week with data.
 * A toggle switches the x-axis between real calendar dates and days-since-
 * start, both computed from the SAME buckets so they always agree. */
function WeeklyChart({ weekly }: { weekly: Telemetry['weekly'] }) {
  const [mode, setMode] = useState<'date' | 'day0'>('date')
  if (!weekly || weekly.length === 0) return null
  const totals = weekly.map((w) => Object.values(w.byModel).reduce((s, v) => s + v.cost, 0))
  const max = Math.max(0.01, ...totals)
  const series = [...new Set(weekly.flatMap((w) => Object.keys(w.byModel)))]
  return (
    <div className="cc-chart">
      <div className="cc-chart-h">
        Weekly spend by model <span>since project start</span>
        <div className="cc-chart-toggle">
          <button className={mode === 'date' ? 'active' : ''} onClick={() => setMode('date')}>Date</button>
          <button className={mode === 'day0' ? 'active' : ''} onClick={() => setMode('day0')}>Day 0</button>
        </div>
      </div>
      <div className="cc-chart-bars">
        {weekly.map((w, i) => (
          <div key={w.weekStart} className="cc-chart-col">
            <div className="cc-chart-stack" style={{ height: `${Math.max(2, (totals[i] / max) * 100)}%` }}>
              {series.filter((s) => w.byModel[s]).map((s) => (
                <div key={s} className="cc-chart-seg" style={{ background: SERIES_COLOR[s] || 'var(--tx3)', flex: w.byModel[s].cost }} title={`${s}: ${fmtUsd(w.byModel[s].cost)}`} />
              ))}
            </div>
            <div className="cc-chart-label mono">{mode === 'date' ? WEEK_DATE_LABEL(w.weekStart) : `D${w.dayOffset}`}</div>
          </div>
        ))}
      </div>
      <div className="cc-chart-legend">
        {series.map((s) => <span key={s} className="cc-legend-item"><i style={{ background: SERIES_COLOR[s] || 'var(--tx3)' }} />{s}</span>)}
      </div>
    </div>
  )
}

function Stat({ n, l }: { n: number | string; l: string }) {
  return <div className="cc-stat"><div className="cc-stat-n">{n}</div><div className="cc-stat-l">{l}</div></div>
}
function OutputChip({ n, l }: { n: number; l: string }) {
  return <div className="cc-output-chip"><b>{n}</b>{l}</div>
}

/** Shorten a checkpoint filename to a readable model name. */
function prettyModel(name: string): string {
  return name.replace(/\.(safetensors|ckpt|pt|gguf)$/i, '').replace(/_/g, ' ').slice(0, 34)
}
