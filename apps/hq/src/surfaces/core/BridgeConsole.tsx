// Bridge brain modes — "Claude Code" and "Codex" both drive the local Arganta
// Bridge (tools/arganta-bridge) over one token-gated WebSocket; the mission's
// `engine` field picks which agent runs it. Deliberately reuses Arganta Core's
// design system (same composer field, brain-pill model picker, message layout)
// so switching brains never changes the UI language — only the model list, the
// brand mark, and the accent colour change per engine.
import { useEffect, useRef, useState } from 'react'
import { BridgeClient, type BridgeEvent, type BridgeStatus } from '../../lib/bridge/client'
import { loadMission } from '../../lib/missions'
import { Markdown } from './Markdown'
import { ClaudeMark } from './ClaudeMark'
import { OpenAIMark } from './OpenAIMark'
import { openPreview } from './previewBus'
import './bridge.css'

// Pull previewable results out of a mission's text so the founder can SEE them
// in the chat: image URLs render inline, and pages (.html / localhost / deployed
// apps) get a one-click "Open preview" into the side pane. Only http(s) URLs are
// handled — a local `C:\…\out.png` can't be loaded by the browser (media-gen
// returns a Supabase public URL alongside the path, which is what we catch).
const IMG_RE = /https?:\/\/[^\s)"'<>\]]+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s)"'<>\]]*)?/gi
const URL_RE = /https?:\/\/[^\s)"'<>\]]+/gi
// LOCAL generated paths the bridge can serve via /file (inside generated-media or
// codex generated_images). Allows spaces + backslashes; stops at backtick/quote.
const LOCAL_RE = /(?:[A-Za-z]:[\\/]|[\\/])[^`\n\r"'<>|]*?(?:generated-media|generated_images)[\\/][^`\n\r"'<>|]*?\.(?:png|jpe?g|gif|webp|avif|svg|html?|mp4|webm|mp3|wav)/gi
const baseName = (p: string) => p.split(/[\\/]/).pop() || p
const isImageRef = (p: string) => /\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?|#|$)/i.test(p)

function extractPreviewables(text: string): { images: string[]; pages: string[] } {
  const images = Array.from(new Set(text.match(IMG_RE) || []))
  const imgSet = new Set(images)
  const pages = Array.from(new Set(text.match(URL_RE) || []))
    .filter((u) => !imgSet.has(u) && /(\.html?(\?|#|$)|localhost|127\.0\.0\.1|\.ts\.net|vercel\.app|\.pages\.dev)/i.test(u))
  return { images, pages }
}

/** `fileBase`/`token` (the connected bridge's http origin + token) let us also
 * preview LOCAL generated files — a codex built-in image or a single-file .html
 * that has no public URL — by pointing at the bridge's /file endpoint. */
function BridgePreviews({ text, fileBase, token }: { text: string; fileBase?: string; token?: string }) {
  const { images, pages } = extractPreviewables(text)
  const httpBasenames = new Set(images.map(baseName))
  const fileUrl = (p: string) => `${fileBase}/file?path=${encodeURIComponent(p)}&token=${encodeURIComponent(token || '')}`
  const locals = fileBase && token ? Array.from(new Set(text.match(LOCAL_RE) || [])) : []
  // Skip a local image the reply also gave as an http URL (media-gen returns both).
  const localImages = locals.filter((p) => isImageRef(p) && !httpBasenames.has(baseName(p))).map(fileUrl)
  const localPages = locals.filter((p) => /\.html?$/i.test(p)).map(fileUrl)

  const allImages = [...images, ...localImages]
  const allPages = [...pages, ...localPages]
  if (!allImages.length && !allPages.length) return null
  return (
    <div className="bf-previews">
      {allImages.map((src) => (
        <a key={src} className="bf-preview-img" href={src} target="_blank" rel="noreferrer" title="Open full size">
          {/* Hide the tile if the bytes can't be fetched (stale/forbidden/404) so
              a preview never shows a broken-image glyph. */}
          <img src={src} alt="Generated result" loading="lazy" onError={(e) => { const a = e.currentTarget.closest('.bf-preview-img') as HTMLElement | null; if (a) a.style.display = 'none' }} />
        </a>
      ))}
      {allPages.map((url) => (
        <button key={url} className="bf-preview-open" onClick={() => openPreview({ kind: 'url', title: 'Preview', url })}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 5.6 H14.5" stroke="currentColor" strokeWidth="1.4" /></svg>
          Open preview
        </button>
      ))}
    </div>
  )
}

export type BridgeEngine = 'claude' | 'codex'

type MarkComp = (p: { size?: number; color?: string }) => JSX.Element

interface EngineConfig {
  name: string            // "Claude Code" / "Codex"
  Mark: MarkComp
  accent: string          // brand colour for marks + capsule
  models: { id: string; label: string; sub: string }[]
  lsPrefix: string        // localStorage key namespace
  capsulePrefix: string   // prepended to the model label in the pill/capsule
  emptyCopy: string
  composerPlaceholder: string
}

const ENGINES: Record<BridgeEngine, EngineConfig> = {
  claude: {
    name: 'Claude Code',
    Mark: ClaudeMark,
    accent: '#D97757',
    // Aliases the Claude Code CLI understands.
    models: [
      { id: '', label: 'Default', sub: "Claude Code's default model" },
      { id: 'opus', label: 'Opus 4.8', sub: 'Most capable' },
      { id: 'sonnet', label: 'Sonnet', sub: 'Balanced' },
      { id: 'haiku', label: 'Haiku', sub: 'Fastest' },
    ],
    lsPrefix: 'hq_bridge',           // keeps the existing saved keys working
    capsulePrefix: 'Claude',
    emptyCopy: 'What should Claude Code do? It runs on your machine with your tools — try "run the media-core tests" or "generate an ARGANTA post and save it".',
    composerPlaceholder: 'Give Claude Code a mission…',
  },
  codex: {
    name: 'OpenAI',
    Mark: OpenAIMark,
    accent: '#10A37F',
    // Driven by the local Codex CLI. On a ChatGPT-account login the MODEL can't
    // be overridden (only the API-key path allows real model ids), but reasoning
    // EFFORT can — so the picker offers effort tiers, which the bridge passes as
    // `-c model_reasoning_effort`.
    models: [
      { id: '', label: 'Auto', sub: 'Your ChatGPT plan default' },
      { id: 'high', label: 'High', sub: 'Most thorough (slower)' },
      { id: 'medium', label: 'Medium', sub: 'Balanced' },
      { id: 'low', label: 'Low', sub: 'Fastest' },
    ],
    lsPrefix: 'hq_bridge_codex',     // internal key kept — don't break saved settings
    capsulePrefix: 'OpenAI',
    emptyCopy: 'What should OpenAI do? It runs on your machine in a sandbox (Codex CLI) — try "refactor the pixel adapter" or "write tests for the audio engine".',
    composerPlaceholder: 'Give OpenAI a mission…',
  },
}

/** Read a per-engine setting. Token/url fall back to the Claude bridge's saved
 * value (both engines share one bridge). The MODEL never falls back — models are
 * engine-specific (a Claude alias like "haiku" is invalid for Codex), so passing
 * `fallbackToClaude` is opt-in and used only for token/url. */
function readSetting(prefix: string, key: string, fallbackToClaude = false): string {
  const own = localStorage.getItem(`${prefix}_${key}`)
  if (own) return own
  if (fallbackToClaude && prefix !== 'hq_bridge') return localStorage.getItem(`hq_bridge_${key}`) || ''
  return ''
}

type FeedItem =
  | { kind: 'status' | 'tool'; label: string; id: number }
  | { kind: 'message'; text: string; id: number }
  | { kind: 'approval'; approvalId: string; tool: string; label: string; input: unknown; id: number; resolved?: 'approved' | 'denied' }
  | { kind: 'done'; ok: boolean; result?: string; costUsd?: number; modelLabel?: string; id: number }
  | { kind: 'error'; message: string; id: number }
  | { kind: 'user'; text: string; id: number }

/** Reconstruct a read-only feed from a persisted mission (goal → activity trail
 * → completion capsule). Same dedupe as the live done handler so the result body
 * isn't shown twice. */
async function reconstructMission(missionId: string, cfg: EngineConfig): Promise<FeedItem[] | null> {
  const m = await loadMission(missionId)
  if (!m) return null
  let id = 0
  const items: FeedItem[] = [{ kind: 'user', text: m.goal || '(no prompt)', id: id++ }]
  for (const ev of m.activity) {
    if (ev.type === 'status') items.push({ kind: 'status', label: ev.label || '', id: id++ })
    else if (ev.type === 'tool') items.push({ kind: 'tool', label: ev.label || '', id: id++ })
    else if (ev.type === 'message') items.push({ kind: 'message', text: ev.text || '', id: id++ })
    else if (ev.type === 'awaiting_approval') items.push({ kind: 'status', label: 'Approval: ' + (ev.label || ''), id: id++ })
  }
  const result = (m.result || '').trim()
  const lastMsg = [...items].reverse().find((x) => x.kind === 'message') as Extract<FeedItem, { kind: 'message' }> | undefined
  const echo = lastMsg && result && lastMsg.text.trim() === result
  items.push({
    kind: 'done', ok: m.status !== 'failed',
    result: echo ? undefined : (result || undefined),
    costUsd: m.costUsd || undefined,
    modelLabel: cfg.capsulePrefix || cfg.name, id: id++,
  })
  return items
}

export function BridgeConsole({ engine = 'claude', replayMissionId, onMissionSaved, onNewMission }: {
  engine?: BridgeEngine
  /** A past mission id to show read-only (from MissionsRail). null = live console. */
  replayMissionId?: string | null
  /** Called after a live mission completes so the rail can refresh its history. */
  onMissionSaved?: () => void
  /** Leave the read-only history view and return to a fresh live console. */
  onNewMission?: () => void
}) {
  const cfg = ENGINES[engine]
  const [status, setStatus] = useState<BridgeStatus>('idle')
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [draft, setDraft] = useState('')
  const [running, setRunning] = useState(false)
  const [token, setToken] = useState(() => readSetting(cfg.lsPrefix, 'token', true))
  // Normalize the saved model to a valid id for THIS engine — a stale/foreign
  // value (e.g. a Claude "haiku" left in storage) collapses to '' (Auto/Default)
  // instead of being sent to an engine that rejects it.
  const [model, setModel] = useState(() => {
    const saved = readSetting(cfg.lsPrefix, 'model')
    return cfg.models.some((m) => m.id === saved) ? saved : ''
  })
  const [bridgeUrl, setBridgeUrl] = useState(() => readSetting(cfg.lsPrefix, 'url', true))
  const [dialogOpen, setDialogOpen] = useState(false)
  // A past mission's reconstructed transcript (read-only), loaded when the rail
  // selects one. Kept separate from the live `feed` so history and live never mix.
  const [replay, setReplay] = useState<FeedItem[] | null>(null)
  const clientRef = useRef<BridgeClient | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const idRef = useRef(0)
  // Label of the model the in-flight mission is running on — captured at launch
  // so the completion capsule names the brain even if the picker changes after.
  const runModelRef = useRef<string>('')

  const push = (item: Omit<FeedItem, 'id'> | { kind: FeedItem['kind'] } & Record<string, unknown>) =>
    setFeed((f) => [...f, { ...(item as object), id: idRef.current++ } as FeedItem])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [feed])
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 6 * 22 + 16) + 'px'
  }, [draft])

  // Auto-connect on mount if a token is already saved.
  useEffect(() => { if (token && status === 'idle') void connect() }, []) // eslint-disable-line

  // Load (or clear) the read-only transcript when the rail selects a mission.
  useEffect(() => {
    if (!replayMissionId) { setReplay(null); return }
    let live = true
    reconstructMission(replayMissionId, cfg).then((items) => { if (live) setReplay(items || []) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayMissionId])

  async function connect() {
    if (!token) return
    localStorage.setItem(`${cfg.lsPrefix}_token`, token)
    if (bridgeUrl) localStorage.setItem(`${cfg.lsPrefix}_url`, bridgeUrl)
    const c = new BridgeClient({ token, url: bridgeUrl || undefined })
    c.onStatus = (s) => { setStatus(s); if (s === 'open') setDialogOpen(false) }
    c.onEvent = (e: BridgeEvent) => {
      switch (e.type) {
        case 'status': case 'tool': push({ kind: e.type, label: e.label }); break
        case 'message': push({ kind: 'message', text: e.text }); break
        case 'awaiting_approval': push({ kind: 'approval', approvalId: e.approvalId, tool: e.tool, label: e.label, input: e.input }); break
        case 'done': {
          // The final result almost always repeats the text already streamed as
          // a `message` — showing both is the "two identical cards" bug. Drop the
          // result body when it just echoes the last streamed message, leaving a
          // slim completion capsule (model + cost) instead of a duplicate wall.
          const result = e.result?.trim() || ''
          setFeed((f) => {
            const lastMsg = [...f].reverse().find((x) => x.kind === 'message') as Extract<FeedItem, { kind: 'message' }> | undefined
            const echo = lastMsg && result && lastMsg.text.trim() === result
            return [...f, { kind: 'done', ok: e.ok, result: echo ? undefined : (result || undefined), costUsd: e.costUsd, modelLabel: runModelRef.current || undefined, id: idRef.current++ } as FeedItem]
          })
          setRunning(false)
          // The mission is now persisted — let the rail pull it into history.
          onMissionSaved?.()
          break
        }
        case 'error': push({ kind: 'error', message: e.message }); setRunning(false); break
      }
    }
    clientRef.current = c
    try { await c.connect() } catch { /* status reflects it */ }
  }

  function run() {
    const c = clientRef.current
    if (!c || status !== 'open' || !draft.trim() || running) return
    // Only send a model the active engine actually offers; anything else → Auto.
    const validModel = cfg.models.some((m) => m.id === model) ? model : ''
    const label = (cfg.models.find((m) => m.id === validModel) || cfg.models[0]).label
    runModelRef.current = (cfg.capsulePrefix ? cfg.capsulePrefix + ' ' : '') + label
    push({ kind: 'user', text: draft.trim() })
    c.startMission(draft.trim(), { model: validModel || undefined, engine })
    setDraft('')
    setRunning(true)
  }

  function resolve(item: Extract<FeedItem, { kind: 'approval' }>, approved: boolean) {
    clientRef.current?.respondApproval(item.approvalId, approved, item.input)
    setFeed((f) => f.map((x) => (x.id === item.id ? { ...x, resolved: approved ? 'approved' : 'denied' } : x)))
  }

  const connected = status === 'open'
  const viewingHistory = !!replayMissionId
  const showing = viewingHistory ? (replay ?? []) : feed
  // The bridge's HTTP origin (for /file previews) is its WS url with the scheme
  // swapped: ws://→http://, wss://→https:// (so tailscale-serve wss stays https).
  const httpBase = (bridgeUrl || 'ws://127.0.0.1:7717').trim().replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/+$/, '')
  // The connect popup is the empty-state when there's nothing behind it, and an
  // on-demand overlay (via the reconnect pill) once a conversation exists — so a
  // dropped socket never wipes a feed the founder is reading. Never over the
  // read-only history view.
  const showDialog = !viewingHistory && !connected && (feed.length === 0 || dialogOpen)
  const showReconnect = !viewingHistory && !connected && feed.length > 0 && !dialogOpen
  const canDismiss = feed.length > 0

  return (
    <div className="core-convo bridge-convo">
      <div className="core-convo-scroll" ref={scrollRef}>
        <div className="core-convo-col">
          {!viewingHistory && feed.length === 0 && connected && (
            <div className="core-convo-empty">
              <p className="core-empty-copy">{cfg.emptyCopy}</p>
            </div>
          )}
          {viewingHistory && replay === null && (
            <div className="core-convo-empty"><p className="core-empty-copy">Loading mission…</p></div>
          )}
          {showing.map((it) => <FeedRow key={it.id} item={it} Mark={cfg.Mark} accent={cfg.accent} fileBase={httpBase} token={token} onResolve={resolve} />)}
        </div>
      </div>

      {showDialog && (
        <BridgeConnectDialog
          cfg={cfg} status={status} token={token} bridgeUrl={bridgeUrl}
          onToken={setToken} onUrl={setBridgeUrl} onConnect={connect}
          onClose={canDismiss ? () => setDialogOpen(false) : undefined}
        />
      )}

      <div className="core-composer">
        {viewingHistory ? (
          <div className="bridge-history-bar">
            <span>Viewing a past mission — read only.</span>
            <button className="bridge-newmission-btn" onClick={() => onNewMission?.()}>New mission</button>
          </div>
        ) : (
          <>
            {showReconnect && (
              <button className="bridge-reconnect-pill" onClick={() => setDialogOpen(true)}>
                <span className="bridge-dot bad" /> Bridge disconnected — reconnect
              </button>
            )}
            <div className="core-composer-field">
              <BridgeModelPicker cfg={cfg} model={model} onPick={(m) => { setModel(m); localStorage.setItem(`${cfg.lsPrefix}_model`, m) }} />
              <textarea
                ref={taRef}
                className="core-composer-input core-composer-textarea"
                placeholder={connected ? cfg.composerPlaceholder : 'Connect to the bridge first'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run() } }}
                disabled={!connected}
                rows={1}
              />
              <button className="core-composer-send" onClick={run} disabled={!connected || !draft.trim() || running} aria-label="Run mission">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5 L13 7.5 M8 2.5 L13 7.5 L8 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <div className="core-status-row mono">
              <span className="core-session-ticker">
                {connected ? (running ? 'running mission…' : 'local bridge · ready') : 'local bridge · disconnected'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Connect popup — replaces the old top bar so it can never collide with the
 * floating Core/brain capsule. Rendered inside .core-convo (not a portal) so
 * every mount mode keeps working. Dismissable only when a feed exists behind it. */
function BridgeConnectDialog({ cfg, status, token, bridgeUrl, onToken, onUrl, onConnect, onClose }: {
  cfg: EngineConfig
  status: BridgeStatus
  token: string
  bridgeUrl: string
  onToken: (v: string) => void
  onUrl: (v: string) => void
  onConnect: () => void
  onClose?: () => void
}) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="bridge-connect-scrim" onClick={onClose}>
      <div className="bridge-connect-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="bridge-connect-brand">
          <cfg.Mark size={20} />
          <span>{cfg.name} bridge</span>
          {onClose && <button className="bridge-dialog-close" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className={`bridge-connect-status ${status === 'unauthorized' ? 'bad' : status === 'connecting' ? 'warn' : ''}`}>
          <span className={`bridge-dot ${status === 'unauthorized' ? 'bad' : status === 'connecting' ? 'warn' : ''}`} />
          {status === 'unauthorized'
            ? "Can't reach the bridge — start it (npm start in tools/arganta-bridge) and check the URL/token"
            : status === 'connecting' ? 'Connecting…' : `Connect to your ${cfg.name} bridge`}
        </div>
        <label className="bridge-field">
          <span>Bridge URL</span>
          <input type="text" className="bridge-url" placeholder="ws://127.0.0.1:7717 (or wss://…ts.net on mobile)" value={bridgeUrl}
            onChange={(e) => onUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onConnect() }} />
          {/* Mixed-content guard: an HTTPS page (e.g. the deployed app on a phone)
              can't open an insecure ws:// socket — it must use wss://. This is the
              #1 "works on desktop, silently fails on mobile" trap. */}
          {typeof window !== 'undefined' && window.location.protocol === 'https:' && /^ws:\/\//i.test(bridgeUrl.trim()) && (
            <span className="bridge-field-warn">This page is HTTPS — a <code>ws://</code> address is blocked. Use your <code>wss://</code> Tailscale-serve URL (e.g. <code>wss://your-machine.tailXXXX.ts.net</code>).</span>
          )}
        </label>
        <label className="bridge-field">
          <span>Token</span>
          <input type="password" className="bridge-token" placeholder="Bridge token" value={token}
            onChange={(e) => onToken(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onConnect() }} />
        </label>
        <button className="bridge-connect-btn" onClick={onConnect} disabled={!token}>Connect</button>
      </div>
    </div>
  )
}

function BridgeModelPicker({ cfg, model, onPick }: { cfg: EngineConfig; model: string; onPick: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const current = cfg.models.find((m) => m.id === model) || cfg.models[0]
  const label = (s: string) => (cfg.capsulePrefix ? cfg.capsulePrefix + ' ' : '') + s
  return (
    <div className="core-brain-picker" ref={ref}>
      <button type="button" className="core-brain-pill mono" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title={`Choose the ${cfg.name} model`}>
        <cfg.Mark size={13} />
        <span className="core-brain-pill-txt">{label(current.label)}</span>
        <svg className="core-brain-caret" width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden><path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <>
          <div className="core-brain-scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="core-brain-menu" role="menu">
            {cfg.models.map((m) => (
              <button key={m.id || 'default'} className={'core-brain-opt' + (m.id === model ? ' active' : '')} role="menuitem" onClick={() => { onPick(m.id); setOpen(false) }}>
                <b>{label(m.label)}</b>
                <i>{m.sub}</i>
              </button>
            ))}
            <div className="core-brain-note">Runs locally through the Arganta Bridge. Gated actions (deploy, push, migrations, spend) pause for your approval.</div>
          </div>
        </>
      )}
    </div>
  )
}

function FeedRow({ item, Mark, accent, fileBase, token, onResolve }: { item: FeedItem; Mark: MarkComp; accent: string; fileBase?: string; token?: string; onResolve: (i: Extract<FeedItem, { kind: 'approval' }>, a: boolean) => void }) {
  switch (item.kind) {
    case 'user':
      return <div className="core-msg core-msg-user"><div className="core-msg-bubble">{item.text}</div></div>
    case 'status': return <div className="core-msg core-msg-assistant"><div className="core-msg-body"><div className="bf-status">{item.label}</div></div></div>
    case 'tool': return <div className="core-msg core-msg-assistant"><div className="core-msg-body"><div className="bf-tool"><span className="bf-tick" />{item.label}</div></div></div>
    case 'message': return <div className="core-msg core-msg-assistant"><div className="core-msg-body"><Markdown className="bf-msg" text={item.text} /><BridgePreviews text={item.text} fileBase={fileBase} token={token} /></div></div>
    case 'error': return <div className="core-msg core-msg-assistant"><div className="core-msg-body"><div className="bf-error">⚠ {item.message}</div></div></div>
    case 'done':
      return (
        <div className="core-msg core-msg-assistant"><div className="core-msg-body">
          <div className={`bf-done ${item.ok ? 'ok' : 'bad'}`}>
            <div className="bf-done-head">
              <strong>{item.ok ? 'Mission complete' : 'Mission failed'}</strong>
              {item.modelLabel && (
                <span className="bf-model-capsule mono" style={{ borderColor: accent + '66' }}><Mark size={12} />{item.modelLabel}</span>
              )}
              {item.costUsd != null && <span className="bf-cost">${item.costUsd.toFixed(4)}</span>}
            </div>
            {item.result && <Markdown className="bf-result" text={item.result} />}
            {item.result && <BridgePreviews text={item.result} fileBase={fileBase} token={token} />}
          </div>
        </div></div>
      )
    case 'approval':
      return (
        <div className="core-msg core-msg-assistant"><div className="core-msg-body">
          <div className={`bf-approval ${item.resolved || ''}`}>
            <div className="bf-approval-head">Approval required · <code>{item.tool}</code></div>
            <div className="bf-approval-label">{item.label}</div>
            {!item.resolved ? (
              <div className="bf-approval-actions">
                <button className="bf-approve" onClick={() => onResolve(item, true)}>Approve</button>
                <button className="bf-deny" onClick={() => onResolve(item, false)}>Deny</button>
              </div>
            ) : <div className={`bf-approval-done ${item.resolved}`}>{item.resolved === 'approved' ? 'Approved' : 'Denied'}</div>}
          </div>
        </div></div>
      )
  }
}
