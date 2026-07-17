// Client for the Arganta Bridge (tools/arganta-bridge): a token-gated localhost
// WebSocket that drives Claude Code and streams back an activity feed. Framework
// -agnostic — BridgeConsole.tsx renders on top of this.

export type BridgeEvent =
  | { type: 'status'; label: string; missionId: string }
  | { type: 'tool'; label: string; tool: string; missionId: string }
  | { type: 'message'; text: string; missionId: string }
  | { type: 'awaiting_approval'; approvalId: string; tool: string; label: string; input: unknown; missionId: string }
  | { type: 'artifact'; label: string; uri?: string; missionId: string }
  | { type: 'done'; ok: boolean; result?: string; costUsd?: number; missionId: string }
  | { type: 'error'; message: string; missionId: string }

export type BridgeStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'unauthorized'

export interface BridgeConfig {
  url?: string   // default ws://127.0.0.1:7717
  token: string
}

const DEFAULT_URL = 'ws://127.0.0.1:7717'

export class BridgeClient {
  private ws: WebSocket | null = null
  private cfg: BridgeConfig
  status: BridgeStatus = 'idle'
  onEvent?: (e: BridgeEvent) => void
  onStatus?: (s: BridgeStatus) => void

  constructor(cfg: BridgeConfig) {
    this.cfg = cfg
  }

  private setStatus(s: BridgeStatus) {
    this.status = s
    this.onStatus?.(s)
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const base = this.cfg.url || DEFAULT_URL
      const url = `${base}/?token=${encodeURIComponent(this.cfg.token)}`
      this.setStatus('connecting')
      let opened = false
      try {
        this.ws = new WebSocket(url)
      } catch (e) {
        this.setStatus('closed')
        return reject(e)
      }
      this.ws.onopen = () => { opened = true; this.setStatus('open'); resolve() }
      this.ws.onmessage = (ev) => {
        try { this.onEvent?.(JSON.parse(ev.data as string)) } catch { /* ignore */ }
      }
      this.ws.onclose = () => {
        // A close before open with no error is almost always the 401 handshake.
        this.setStatus(opened ? 'closed' : 'unauthorized')
        if (!opened) reject(new Error('bridge rejected connection (token? not running?)'))
      }
      this.ws.onerror = () => { if (!opened) this.setStatus('unauthorized') }
    })
  }

  /** Start a mission. Returns the missionId used. */
  startMission(prompt: string, opts?: { cwd?: string; missionId?: string; model?: string }): string {
    const missionId = opts?.missionId || `m_${Date.now().toString(36)}`
    this.send({ type: 'mission', missionId, prompt, cwd: opts?.cwd, model: opts?.model })
    return missionId
  }

  /** Resolve a gated tool. */
  respondApproval(approvalId: string, approved: boolean, input?: unknown) {
    this.send({ type: 'approval', approvalId, approved, input })
  }

  private send(msg: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  close() {
    this.ws?.close()
    this.ws = null
    this.setStatus('closed')
  }
}
