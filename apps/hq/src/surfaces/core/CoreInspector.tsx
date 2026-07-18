// T1 — the Core inspector: Context (what the current brain can see/do) and
// Missions (the persistent bridge mission ledger, all engines). Mounted as a
// slide-over from the topbar — the same pattern CoreHelp uses — so it works
// identically in inline, fullscreen, and panel mounts with zero layout churn
// on the production chat surface. Threads deliberately NOT duplicated here:
// they already have two homes (inline rail, fullscreen sheet).
import { useEffect, useState } from 'react'
import { X, ListChecks, ScanEye, RefreshCw, Loader2 } from 'lucide-react'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { getPreferredModelId } from '../../lib/modelPreference'
import type { Brain } from './ArgantaCore'
import './core-inspector.css'

interface MissionRow {
  id: string; goal: string; status: 'running' | 'done' | 'failed'
  engine?: string; cost_usd: number; created_at: string; updated_at: string
}

const read = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } }

export function CoreInspector({ brain, onClose }: { brain: Brain; onClose: () => void }) {
  const [scope, setScope] = useState<'context' | 'missions'>('context')
  return (
    <div className="cin-overlay" onClick={onClose}>
      <div className="cin" onClick={e => e.stopPropagation()} role="dialog" aria-label="Core inspector">
        <div className="cin-head">
          <div className="seg cin-seg" role="tablist">
            <button role="tab" aria-selected={scope === 'context'} className={scope === 'context' ? 'on' : ''} onClick={() => setScope('context')}><ScanEye size={13} /> Context</button>
            <button role="tab" aria-selected={scope === 'missions'} className={scope === 'missions' ? 'on' : ''} onClick={() => setScope('missions')}><ListChecks size={13} /> Missions</button>
          </div>
          <button className="cin-x" onClick={onClose} aria-label="Close inspector"><X size={15} /></button>
        </div>
        {scope === 'context' ? <ContextScope brain={brain} /> : <MissionsScope />}
      </div>
    </div>
  )
}

// ── Context: what THIS brain sees and is allowed to do. Honest by source —
// everything shown is read from the same settings the engines actually use. ──
function ContextScope({ brain }: { brain: Brain }) {
  if (brain === 'sovereign') {
    const model = getPreferredModelId() || 'auto (router picks)'
    return (
      <div className="cin-body">
        <Card title="Brain" rows={[['engine', 'Sovereign — Arganta Core LLM router'], ['model', model]]} />
        <Card title="Can see" rows={[
          ['data', 'live Supabase RPCs — growth, portfolio, engagement, valuation'],
          ['charts', '24-chart registry, rendered in-chat'],
          ['artifacts', 'sites · decks · games via the Builder seam'],
        ]} />
        <Card title="Boundaries" rows={[
          ['cost', 'free-tier providers only (sovereign-only mandate)'],
          ['writes', 'drafts and artifacts — publishing always goes through a gate'],
        ]} />
      </div>
    )
  }
  const isCodex = brain === 'codex'
  const prefix = isCodex ? 'hq_bridge_codex' : 'hq_bridge'
  const url = read(`${prefix}_url`) || read('hq_bridge_url') || 'ws://127.0.0.1:7717'
  const model = read(`${prefix}_model`) || 'default'
  const tokenSet = Boolean(read(`${prefix}_token`) || read('hq_bridge_token'))
  return (
    <div className="cin-body">
      <Card title="Brain" rows={[
        ['engine', isCodex ? 'Codex — local CLI via the Bridge' : 'Claude Code — Agent SDK via the Bridge'],
        ['model', model], ['bridge', url], ['token', tokenSet ? 'set' : 'not set'],
      ]} />
      <Card title="Can see" rows={[
        ['workspace', 'the ArgantaLab repo on your machine (mission cwd)'],
        ...(isCodex ? [] : [['tools', 'repo MCP servers — content, media-gen, pixel vault'] as [string, string]]),
      ]} />
      <Card title="Boundaries" rows={isCodex ? [
        ['sandbox', 'workspace-write · network off — blocked actions fail closed'],
        ['approvals', 'v1 sandbox-blocks instead of asking (parity is a planned v2)'],
      ] : [
        ['gated', 'deploys · pushes · migrations · spend — pause for your approval'],
        ['auto', 'reads, edits, tests run without asking'],
      ]} />
    </div>
  )
}

function Card({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="cin-card">
      <div className="cin-card-title">{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="cin-row"><span className="cin-k">{k}</span><span className="cin-v">{v}</span></div>
      ))}
    </div>
  )
}

// ── Missions: the persistent ledger the bridge writes (all engines). ─────────
function MissionsScope() {
  const [rows, setRows] = useState<MissionRow[] | null | 'loading'>('loading')
  const load = () => {
    if (!cloudEnabled) { setRows(null); return }
    supabase.from('mission')
      .select('id,goal,status,engine,cost_usd,created_at,updated_at')
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data, error }) => setRows(error ? null : (data as MissionRow[])))
  }
  useEffect(load, [])

  if (rows === 'loading') return <div className="cin-body cin-center"><Loader2 size={16} className="cin-spin" /></div>
  if (rows === null) return <div className="cin-body cin-center"><p className="cin-empty">Mission history needs Supabase (sign in) — the bridge records every mission to the <code>mission</code> table.</p></div>
  return (
    <div className="cin-body">
      <div className="cin-missions-head">
        <span>{rows.length ? `last ${rows.length} missions` : ''}</span>
        <button className="cin-refresh" onClick={load} title="Refresh"><RefreshCw size={12} /></button>
      </div>
      {!rows.length && <p className="cin-empty">No missions yet — run one from the Claude or Codex tab and it lands here.</p>}
      {rows.map(m => (
        <div key={m.id} className={'cin-mission cin-m-' + m.status}>
          <span className={'cin-mdot ' + m.status} />
          <div className="cin-mbody">
            <div className="cin-mgoal">{m.goal}</div>
            <div className="cin-msub">
              <span className={'cin-mengine' + (m.engine === 'codex' ? ' codex' : '')}>{m.engine || 'claude'}</span>
              <span>{m.status}</span>
              <span>{new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {m.cost_usd > 0 && <span>${Number(m.cost_usd).toFixed(3)}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
