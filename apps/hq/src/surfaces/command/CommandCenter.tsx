// Command Center — the Company group's operations cockpit. One screen that
// answers "is the machine alive?": FLEET (the three brains), INFRASTRUCTURE
// (local services + cloud organs), LAUNCH (remote start), PULSE (node facts).
// LOCAL truth is live from the bridge /health; cloud is one honest Supabase
// ping plus links until the status Worker lands. The old C-suite surface is one
// click away behind "Legacy".
import { useState } from 'react'
import { useHQ } from '../../shell/store'
import { ClaudeMark } from '../core/ClaudeMark'
import { OpenAIMark } from '../core/OpenAIMark'
import { ArgantaMark } from '../core/ArgantaMark'
import { useOps, useSupabasePing, useHeartbeat, useCloudStatus, useTelemetry, bridgeConfig, type BridgeReach } from './ops/useOps'
import { IntelligenceBand, fmtUsd } from './Intelligence'
import { Command } from './Command'
import './command-center.css'

const REACH_COPY: Record<BridgeReach, string> = {
  ok: 'Bridge online',
  unauthorized: 'Bridge reachable — token rejected',
  unreachable: 'Bridge unreachable — PC off, or bridge not running',
  'no-token': 'Not connected — set the bridge token in Agent → Claude Code',
}

export function CommandCenter() {
  const [legacy, setLegacy] = useState(false)
  if (legacy) {
    return (
      <div className="cc-legacy-wrap">
        <button className="cc-legacy-back" onClick={() => setLegacy(false)}>← Command Center</button>
        <Command />
      </div>
    )
  }
  return <Cockpit onLegacy={() => setLegacy(true)} />
}

function Cockpit({ onLegacy }: { onLegacy: () => void }) {
  const go = useHQ((s) => s.go)
  const { health, reach, lastChecked, loading, refetch, launch } = useOps()
  const supa = useSupabasePing()
  const cloud = useCloudStatus()
  const { telemetry } = useTelemetry()
  const hb = useHeartbeat(reach !== 'ok')
  const { token } = bridgeConfig()
  const cloudTile = (id: string) => cloud?.find((t) => t.id === id)

  const engine = (id: string) => health?.engines.find((e) => e.id === id)
  const service = (id: string) => health?.services.find((s) => s.id === id)
  const online = reach === 'ok'

  return (
    <div className="cc">
      <header className="cc-head">
        <div className="cc-head-l">
          <h1 className="cc-title">Command Center</h1>
          <span className={`cc-reach cc-reach-${reach}`}>
            <span className="cc-dot" />{REACH_COPY[reach]}
          </span>
        </div>
        <div className="cc-head-r mono">
          {health && <span className="cc-node">{health.node} · bridge v{health.bridgeVersion} · node {health.nodeVersion}</span>}
          {lastChecked && <span className="cc-checked">{loading ? 'checking…' : `updated ${timeAgo(lastChecked)}`}</span>}
          <button className="cc-refresh" onClick={refetch} title="Refresh">⟳</button>
          <button className="cc-legacy-btn" onClick={onLegacy}>Legacy</button>
        </div>
      </header>

      {!token && (
        <div className="cc-banner">
          Connect the bridge first: open <b>Agent → Claude Code</b>, enter your bridge URL + token, then return here.
          <button className="cc-banner-cta" onClick={() => go('core')}>Open Agent</button>
        </div>
      )}

      <div className="cc-grid">
        {/* FLEET ------------------------------------------------------ */}
        <section className="cc-zone cc-fleet">
          <h2 className="cc-zone-h">Fleet <span>the brains</span></h2>
          <div className="cc-brains">
            <BrainCard mark={<ArgantaMark size={22} />} name="Sovereign" accent="#6366f1"
              ready sub="Local models · always on" onOpen={() => go('core')}
              foot={telemetry ? <span className="cc-brain-usage mono">{telemetry.comfy.jobsToday ?? 0} media jobs today</span> : undefined} />
            <BrainCard mark={<ClaudeMark size={22} />} name="Claude Code" accent="#D97757"
              ready={online && !!engine('claude')?.ready} sub={online ? 'Runs on your machine' : 'Bridge offline'}
              onOpen={() => go('core')}
              foot={telemetry ? <QuotaStrip label={`${fmtUsd(telemetry.claude.today.costUsd)} today · est`} pct={telemetry.claude.fivehFillPct} /> : undefined} />
            <BrainCard mark={<OpenAIMark size={22} />} name="Codex" accent="#10A37F"
              ready={online && !!engine('codex')?.ready} sub={engine('codex')?.detail || (online ? 'Sandbox CLI' : 'Bridge offline')}
              onOpen={() => go('core')}
              foot={telemetry ? <span className="cc-brain-usage mono">{telemetry.codex.sessions} sessions</span> : undefined} />
          </div>
        </section>

        {/* INFRASTRUCTURE -------------------------------------------- */}
        <section className="cc-zone cc-infra">
          <h2 className="cc-zone-h">Infrastructure <span>local + cloud</span></h2>
          <div className="cc-tiles">
            <Tile label="Bridge" state={online ? 'up' : 'down'} detail={online ? 'Claude + Codex' : REACH_COPY[reach]} source="live" />
            <Tile label="ComfyUI" state={!online ? 'unknown' : service('comfy')?.up ? 'up' : 'down'}
              detail={service('comfy')?.detail || 'image gen'} source={online ? 'live' : 'unknown'} />
            {/* Supabase: prefer the Worker's probe, else the browser ping. */}
            {(() => { const c = cloudTile('supabase'); return c
              ? <Tile label="Supabase" state={c.up ? 'up' : 'down'} detail={c.detail || `${c.ms}ms`} source="live" />
              : <Tile label="Supabase" state={supa.reach === 'ok' ? 'up' : supa.reach === 'down' ? 'down' : 'unknown'}
                  detail={supa.ms != null ? `${supa.ms}ms` : 'database'} source={supa.reach === 'unknown' ? 'unknown' : 'live'} /> })()}
            {/* Vercel / Cloudflare / Buffer: live from the status Worker (P2), else link tiles. */}
            <CloudTile fallbackLabel="Vercel · HQ" fallbackDetail="deploys" href="https://vercel.com/dashboard" target={cloudTile('vercel')} />
            <CloudTile fallbackLabel="Cloudflare" fallbackDetail="workers · media" href="https://dash.cloudflare.com" target={cloudTile('cloudflare')} />
            <CloudTile fallbackLabel="Buffer · IG" fallbackDetail="publishing" href="https://publish.buffer.com" target={cloudTile('buffer')} />
          </div>
          <p className="cc-provenance-note">
            <b>live</b> = probed just now · <b>pending</b> = link only until the status Worker is deployed (P2).
          </p>
        </section>

        {/* LAUNCH ---------------------------------------------------- */}
        <section className="cc-zone cc-launch">
          <h2 className="cc-zone-h">Launch <span>ignition</span></h2>
          {!online ? (
            <div className="cc-launch-off">
              {hb && <p className="cc-lastseen">Node <b>{hb.node}</b> last seen <b>{timeAgo(new Date(hb.at).getTime())}</b></p>}
              <p>{reach === 'unreachable'
                ? 'Your PC is off or the bridge isn’t running. Software can’t power on a machine that’s off — turn the laptop on, and the bridge auto-starts at login.'
                : REACH_COPY[reach]}</p>
            </div>
          ) : (
            <div className="cc-launch-list">
              {(health?.services.filter((s) => s.launchable) || []).map((s) => (
                <LaunchRow key={s.id} id={s.id} label={s.label} up={s.up} onLaunch={launch} />
              ))}
              {(health?.services.filter((s) => s.launchable).length === 0) && <p className="cc-muted">No launchable services registered.</p>}
            </div>
          )}
        </section>

        {/* PULSE ----------------------------------------------------- */}
        <section className="cc-zone cc-pulse">
          <h2 className="cc-zone-h">Pulse <span>node</span></h2>
          <ul className="cc-facts mono">
            <li><span>node</span><b>{health?.node || '—'}</b></li>
            <li><span>bridge</span><b>{health ? `v${health.bridgeVersion}` : '—'}</b></li>
            <li><span>runtime</span><b>{health?.nodeVersion || '—'}</b></li>
            <li><span>reach</span><b className={`cc-reach-${reach}`}>{reach}</b></li>
            <li><span>checked</span><b>{lastChecked ? timeAgo(lastChecked) : '—'}</b></li>
          </ul>
          <button className="cc-pulse-cta" onClick={() => go('core')}>Run a mission →</button>
        </section>
      </div>

      {/* INTELLIGENCE band — LLM usage, ComfyUI workload, model routing map. */}
      <IntelligenceBand telemetry={telemetry} />
    </div>
  )
}

function BrainCard({ mark, name, accent, ready, sub, onOpen, foot }: {
  mark: React.ReactNode; name: string; accent: string; ready: boolean; sub: string; onOpen: () => void; foot?: React.ReactNode
}) {
  return (
    <button className="cc-brain" onClick={onOpen} style={{ ['--brain-accent' as string]: accent }}>
      <div className="cc-brain-top">{mark}<span className={`cc-pill ${ready ? 'ok' : 'off'}`}>{ready ? 'ready' : 'offline'}</span></div>
      <div className="cc-brain-name">{name}</div>
      <div className="cc-brain-sub">{sub}</div>
      {foot && <div className="cc-brain-foot">{foot}</div>}
      <div className="cc-brain-open">Open →</div>
    </button>
  )
}

/** Compact usage strip on a brain card: a label + a self-calibrating fill bar
 * (no official quota API exists, so the bar is relative to the busiest day). */
function QuotaStrip({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="cc-quota">
      <span className="cc-quota-label mono">{label}</span>
      <div className="cc-bar cc-bar-sm"><div className="cc-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  )
}

type TileState = 'up' | 'down' | 'unknown' | 'link'
function Tile({ label, state, detail, source, href }: { label: string; state: TileState; detail: string; source: 'live' | 'pending' | 'unknown'; href?: string }) {
  const inner = (
    <>
      <div className="cc-tile-top">
        <span className={`cc-tile-dot cc-tile-${state}`} />
        <span className="cc-tile-label">{label}</span>
        <span className={`cc-src cc-src-${source}`}>{source}</span>
      </div>
      <div className="cc-tile-detail">{state === 'unknown' ? '— unknown' : detail}</div>
    </>
  )
  return href
    ? <a className="cc-tile" href={href} target="_blank" rel="noreferrer">{inner}</a>
    : <div className="cc-tile">{inner}</div>
}

/** A cloud tile that shows live status from the status Worker when available,
 * else degrades to a link tile marked "pending". */
function CloudTile({ fallbackLabel, fallbackDetail, href, target }: {
  fallbackLabel: string; fallbackDetail: string; href: string; target?: { label: string; up: boolean; ms: number; detail?: string }
}) {
  if (target) return <Tile label={target.label} state={target.up ? 'up' : 'down'} detail={target.detail || `${target.ms}ms`} source="live" />
  return <Tile label={fallbackLabel} state="link" detail={fallbackDetail} source="pending" href={href} />
}

function LaunchRow({ id, label, up, onLaunch }: { id: string; label: string; up: boolean; onLaunch: (s: string) => Promise<{ ok: boolean; message: string }> }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const start = async () => {
    setBusy(true); setMsg('')
    const r = await onLaunch(id)
    setMsg(r.message); setBusy(false)
  }
  return (
    <div className="cc-launch-row">
      <span className={`cc-tile-dot cc-tile-${up ? 'up' : 'down'}`} />
      <span className="cc-launch-name">{label}</span>
      <span className="cc-launch-msg">{msg}</span>
      <button className="cc-start" disabled={busy || up} onClick={start}>{up ? 'running' : busy ? 'starting…' : 'Start'}</button>
    </div>
  )
}

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.round(s / 60)}m ago`
}
