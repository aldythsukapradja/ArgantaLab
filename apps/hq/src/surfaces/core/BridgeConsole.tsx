// Brain mode "Claude Code" — drives the local Arganta Bridge. Deliberately
// reuses Arganta Core's design system (same composer field, brain-pill model
// picker, message layout) so switching brains never changes the UI language.
// The only visible difference is the model list (Claude models) and the
// operational activity feed (Reading repository / Editing files / Approve-Deny).
import { useEffect, useRef, useState } from 'react'
import { BridgeClient, type BridgeEvent, type BridgeStatus } from '../../lib/bridge/client'
import { Markdown } from './Markdown'
import { ClaudeMark } from './ClaudeMark'
import './bridge.css'

type FeedItem =
  | { kind: 'status' | 'tool'; label: string; id: number }
  | { kind: 'message'; text: string; id: number }
  | { kind: 'approval'; approvalId: string; tool: string; label: string; input: unknown; id: number; resolved?: 'approved' | 'denied' }
  | { kind: 'done'; ok: boolean; result?: string; costUsd?: number; modelLabel?: string; id: number }
  | { kind: 'error'; message: string; id: number }
  | { kind: 'user'; text: string; id: number }

const TOKEN_KEY = 'hq_bridge_token'
const MODEL_KEY = 'hq_bridge_model'
const URL_KEY = 'hq_bridge_url'

// Claude models the Bridge can run (aliases the Claude Code CLI understands).
const MODELS: { id: string; label: string; sub: string }[] = [
  { id: '', label: 'Default', sub: "Claude Code's default model" },
  { id: 'opus', label: 'Opus 4.8', sub: 'Most capable' },
  { id: 'sonnet', label: 'Sonnet', sub: 'Balanced' },
  { id: 'haiku', label: 'Haiku', sub: 'Fastest' },
]

export function BridgeConsole() {
  const [status, setStatus] = useState<BridgeStatus>('idle')
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [draft, setDraft] = useState('')
  const [running, setRunning] = useState(false)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_KEY) || '')
  const [bridgeUrl, setBridgeUrl] = useState(() => localStorage.getItem(URL_KEY) || '')
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

  async function connect() {
    if (!token) return
    localStorage.setItem(TOKEN_KEY, token)
    if (bridgeUrl) localStorage.setItem(URL_KEY, bridgeUrl)
    const c = new BridgeClient({ token, url: bridgeUrl || undefined })
    c.onStatus = setStatus
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
          setRunning(false); break
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
    runModelRef.current = 'Claude ' + (MODELS.find((m) => m.id === model) || MODELS[0]).label
    push({ kind: 'user', text: draft.trim() })
    c.startMission(draft.trim(), { model: model || undefined })
    setDraft('')
    setRunning(true)
  }

  function resolve(item: Extract<FeedItem, { kind: 'approval' }>, approved: boolean) {
    clientRef.current?.respondApproval(item.approvalId, approved, item.input)
    setFeed((f) => f.map((x) => (x.id === item.id ? { ...x, resolved: approved ? 'approved' : 'denied' } : x)))
  }

  const connected = status === 'open'

  return (
    <div className="core-convo bridge-convo">
      {!connected && (
        <div className="bridge-connect-bar">
          <span className={`bridge-dot ${status === 'unauthorized' ? 'bad' : status === 'connecting' ? 'warn' : ''}`} />
          <span className="bridge-connect-label">
            {status === 'unauthorized' ? "Can't reach the bridge — start it (npm start in tools/arganta-bridge) and check the URL/token" : 'Connect to your Claude Code bridge'}
          </span>
          <input type="text" className="bridge-url" placeholder="ws://127.0.0.1:7717 (or your Tailscale IP)" value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') connect() }} />
          <input type="password" className="bridge-token" placeholder="Bridge token" value={token}
            onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') connect() }} />
          <button className="bridge-connect-btn" onClick={connect} disabled={!token}>Connect</button>
        </div>
      )}

      <div className="core-convo-scroll" ref={scrollRef}>
        <div className="core-convo-col">
          {feed.length === 0 && connected && (
            <div className="core-convo-empty">
              <p className="core-empty-copy">What should Claude Code do? It runs on your machine with your tools — try "run the media-core tests" or "generate an ARGANTA post and save it".</p>
            </div>
          )}
          {feed.map((it) => <FeedRow key={it.id} item={it} onResolve={resolve} />)}
        </div>
      </div>

      <div className="core-composer">
        <div className="core-composer-field">
          <BridgeModelPicker model={model} onPick={(m) => { setModel(m); localStorage.setItem(MODEL_KEY, m) }} />
          <textarea
            ref={taRef}
            className="core-composer-input core-composer-textarea"
            placeholder={connected ? 'Give Claude Code a mission…' : 'Connect to the bridge first'}
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
      </div>
    </div>
  )
}

function BridgeModelPicker({ model, onPick }: { model: string; onPick: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const current = MODELS.find((m) => m.id === model) || MODELS[0]
  return (
    <div className="core-brain-picker" ref={ref}>
      <button type="button" className="core-brain-pill mono" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Choose the Claude model">
        <ClaudeMark size={13} />
        <span className="core-brain-pill-txt">Claude {current.label}</span>
        <svg className="core-brain-caret" width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden><path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <>
          <div className="core-brain-scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="core-brain-menu" role="menu">
            {MODELS.map((m) => (
              <button key={m.id || 'default'} className={'core-brain-opt' + (m.id === model ? ' active' : '')} role="menuitem" onClick={() => { onPick(m.id); setOpen(false) }}>
                <b>Claude {m.label}</b>
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

function FeedRow({ item, onResolve }: { item: FeedItem; onResolve: (i: Extract<FeedItem, { kind: 'approval' }>, a: boolean) => void }) {
  switch (item.kind) {
    case 'user':
      return <div className="core-msg core-msg-user"><div className="core-msg-bubble">{item.text}</div></div>
    case 'status': return <div className="core-msg core-msg-assistant"><div className="core-msg-body"><div className="bf-status">{item.label}</div></div></div>
    case 'tool': return <div className="core-msg core-msg-assistant"><div className="core-msg-body"><div className="bf-tool"><span className="bf-tick" />{item.label}</div></div></div>
    case 'message': return <div className="core-msg core-msg-assistant"><div className="core-msg-body"><Markdown className="bf-msg" text={item.text} /></div></div>
    case 'error': return <div className="core-msg core-msg-assistant"><div className="core-msg-body"><div className="bf-error">⚠ {item.message}</div></div></div>
    case 'done':
      return (
        <div className="core-msg core-msg-assistant"><div className="core-msg-body">
          <div className={`bf-done ${item.ok ? 'ok' : 'bad'}`}>
            <div className="bf-done-head">
              <strong>{item.ok ? 'Mission complete' : 'Mission failed'}</strong>
              {item.modelLabel && (
                <span className="bf-model-capsule mono"><ClaudeMark size={12} />{item.modelLabel}</span>
              )}
              {item.costUsd != null && <span className="bf-cost">${item.costUsd.toFixed(4)}</span>}
            </div>
            {item.result && <Markdown className="bf-result" text={item.result} />}
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
