// Command Center v2 — the Intelligence band: SPEND (+ monthly history),
// WORKLOAD (ComfyUI compute), MODEL MAP, and SYSTEM (local machine health).
// LLM usage is 'est' (parsed from local logs — no official subscription-quota
// API exists), ComfyUI + machine numbers are 'live' (measured locally). The
// MODEL MAP is 'declared' config mirroring packages/ai/src/registry.js (the
// four-tier router), not a live measurement — it answers "which model is used
// where".
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
const MONTH_LABEL = (mo: string): string => {
  const [y, m] = mo.split('-')
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// Series colors — consistent across the by-model pills and the history chart.
const SERIES_COLOR: Record<string, string> = {
  Opus: '#D97757', Sonnet: '#e8a383', Haiku: '#f4c9b0', Fable: '#c9648a', Codex: '#10A37F',
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
            <div className="cc-bymodel">{t.claude.byModel.filter((m) => m.tokens > 0).map((m) => (
              <span key={m.label} className="cc-bymodel-pill mono" style={{ ['--dot' as string]: SERIES_COLOR[m.label] || 'var(--tx3)' }}>
                <i className="cc-bymodel-dot" />{m.label} <b>{fmtTokens(m.tokens)}</b>{m.cost > 0 && <i className="cc-bymodel-usd"> · {fmtUsd(m.cost)}</i>}
              </span>
            ))}</div>
            <MonthlyChart monthly={t.monthly} />
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

/** Dependency-free stacked bar chart: one bar per month, segments colored by
 * model, scaled against the month with the highest total. Normalized to start
 * at the FIRST month either brain was used — never padded back to an
 * arbitrary calendar start. */
function MonthlyChart({ monthly }: { monthly: Telemetry['monthly'] }) {
  if (!monthly || monthly.length === 0) return null
  const totals = monthly.map((m) => Object.values(m.byModel).reduce((s, v) => s + v.cost, 0))
  const max = Math.max(0.01, ...totals)
  const series = [...new Set(monthly.flatMap((m) => Object.keys(m.byModel)))]
  return (
    <div className="cc-chart">
      <div className="cc-chart-h">Monthly spend by model <span>since first use</span></div>
      <div className="cc-chart-bars">
        {monthly.map((m, i) => (
          <div key={m.month} className="cc-chart-col">
            <div className="cc-chart-stack" style={{ height: `${Math.max(2, (totals[i] / max) * 100)}%` }}>
              {series.filter((s) => m.byModel[s]).map((s) => (
                <div key={s} className="cc-chart-seg" style={{ background: SERIES_COLOR[s] || 'var(--tx3)', flex: m.byModel[s].cost }} title={`${s}: ${fmtUsd(m.byModel[s].cost)}`} />
              ))}
            </div>
            <div className="cc-chart-label mono">{MONTH_LABEL(m.month)}</div>
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
