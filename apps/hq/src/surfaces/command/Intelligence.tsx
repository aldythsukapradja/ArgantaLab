// Command Center v2 — the Intelligence band: SPEND, WORKLOAD, and the MODEL MAP.
// LLM usage is 'est' (parsed from local logs — no official subscription-quota
// API exists), ComfyUI is 'live' (measured locally). The MODEL MAP is 'declared'
// config mirroring packages/ai/src/registry.js (the four-tier router), not a
// live measurement — it answers "which model is used where".
import type { Telemetry } from './ops/useOps'

export const fmtTokens = (n: number): string =>
  n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(0) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(n)
export const fmtUsd = (n: number): string => n >= 100 ? '$' + Math.round(n) : '$' + n.toFixed(2)

// Declared routing map — mirrors packages/ai/src/registry.js COST_CLASS tiers.
// "Live counts" arrive once the four-tier router ledger is implemented (T5).
const MODEL_MAP: { tier: string; friendly: string; color: string; models: string[]; where: string }[] = [
  { tier: 'Sovereign', friendly: 'Free · local', color: '#6366f1', models: ['ComfyUI (SD1.5 · SDXL · Wan · AceStep)', 'Local LLM', 'Deterministic engines'], where: 'Media gen · Builder engines' },
  { tier: 'Sponsored', friendly: 'Free API', color: '#10b981', models: ['Cloudflare Llama', 'Groq Llama 3.3 70B', 'Gemini Flash'], where: 'Content copy · Core fallback' },
  { tier: 'Economy', friendly: 'Economy', color: '#f59e0b', models: ['DeepSeek Chat', 'Claude Haiku'], where: 'Cheap classify · summarize' },
  { tier: 'Frontier', friendly: 'Premium', color: '#ef4444', models: ['Claude Opus 4.8', 'Claude Sonnet', 'Codex'], where: 'Bridge missions · Core chat' },
]

export function IntelligenceBand({ telemetry: t }: { telemetry: Telemetry | null }) {
  const claudeWeek = t?.claude.weekCostUsd ?? 0
  const comfy = t?.comfy

  return (
    <div className="cc-intel">
      {/* SPEND — API-equivalent value this week (subscription flat-rate, so this
          is "what it would cost on metered APIs", not a real charge). */}
      <section className="cc-zone cc-spend">
        <h2 className="cc-zone-h">Spend <span>API-equivalent · est</span></h2>
        {t ? (
          <div className="cc-spend-row">
            <SpendCell label="Claude · this week" value={fmtUsd(claudeWeek)} sub={`${t.claude.files} session files`} accent="#D97757" />
            <SpendCell label="Claude · today" value={fmtUsd(t.claude.today.costUsd)} sub={`${fmtTokens(t.claude.today.tokens)} tokens`} accent="#D97757" />
            <SpendCell label="Sovereign media" value="$0" sub={`${comfy?.jobsWeek ?? 0} Comfy jobs`} accent="#6366f1" />
            <SpendCell label="Codex" value="—" sub={`${t.codex.sessions} sessions`} accent="#10A37F" />
          </div>
        ) : <p className="cc-muted">Connect the bridge to see usage.</p>}
        {t && <div className="cc-bymodel">{t.claude.byModel.filter((m) => m.tokens > 0).map((m) => (
          <span key={m.label} className="cc-bymodel-pill mono">{m.label} <b>{fmtTokens(m.tokens)}</b>{m.cost > 0 && <i> · {fmtUsd(m.cost)}</i>}</span>
        ))}</div>}
      </section>

      {/* WORKLOAD — ComfyUI (measured). */}
      <section className="cc-zone cc-workload">
        <h2 className="cc-zone-h">Workload <span>ComfyUI · live</span></h2>
        {comfy?.up ? (
          <>
            <div className="cc-work-stats">
              <Stat n={comfy.jobsToday ?? 0} l="jobs today" />
              <Stat n={comfy.jobsWeek ?? 0} l="this week" />
              <Stat n={comfy.avgJobSec != null ? comfy.avgJobSec + 's' : '—'} l="avg job" />
              <Stat n={(comfy.queueRunning ?? 0) + (comfy.queuePending ?? 0)} l="in queue" />
            </div>
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
    </div>
  )
}

function SpendCell({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="cc-spend-cell" style={{ ['--accent' as string]: accent }}>
      <div className="cc-spend-val">{value}</div>
      <div className="cc-spend-label">{label}</div>
      <div className="cc-spend-sub mono">{sub}</div>
    </div>
  )
}
function Stat({ n, l }: { n: number | string; l: string }) {
  return <div className="cc-stat"><div className="cc-stat-n">{n}</div><div className="cc-stat-l">{l}</div></div>
}

/** Shorten a checkpoint filename to a readable model name. */
function prettyModel(name: string): string {
  return name.replace(/\.(safetensors|ckpt|pt|gguf)$/i, '').replace(/_/g, ' ').slice(0, 34)
}
