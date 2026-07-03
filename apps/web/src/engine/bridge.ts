// ============================================================
//  BRIDGE SDK — runs INSIDE the game iframe.
//  Generated games live in a sandboxed srcDoc iframe (opaque origin,
//  no localStorage), so all persistence goes over postMessage to the
//  parent app, which owns the session and the real storage.
//  Every call resolves even with no parent listening (timeout →
//  in-memory fallback) so published games never hang.
// ============================================================

import type { BridgeRequest, BridgeResponse, SaveSlot, ScoreRow } from './types'

const TIMEOUT = 900

export class Bridge {
  private seq = 1
  private pending = new Map<number, (ok: boolean, payload: unknown) => void>()
  // In-memory fallback so standalone games still "work" for the session.
  private memSlots: SaveSlot[] = []
  private memScores: ScoreRow[] = []
  connected = false

  constructor(public gameId: string, private playerName: string) {
    window.addEventListener('message', (e: MessageEvent) => {
      const m = e.data as BridgeResponse
      if (!m || m.arganta !== true || m.type !== 'result') return
      const cb = this.pending.get(m.id)
      if (cb) { this.pending.delete(m.id); this.connected = true; cb(m.ok, m.payload) }
    })
    this.post('ready')
  }

  private post(type: BridgeRequest['type'], payload?: unknown): Promise<{ ok: boolean; payload: unknown }> {
    const id = this.seq++
    const msg: BridgeRequest = { arganta: true, id, gameId: this.gameId, type, payload }
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) resolve({ ok: false, payload: undefined })
      }, TIMEOUT)
      this.pending.set(id, (ok, p) => { clearTimeout(timer); resolve({ ok, payload: p }) })
      try { window.parent?.postMessage(msg, '*') } catch { /* standalone */ }
    })
  }

  async save(slot: number, data: unknown, label: string): Promise<boolean> {
    const row: SaveSlot = { slot, data, label, savedAt: Date.now() }
    const r = await this.post('save', row)
    if (!r.ok) { this.memSlots = [...this.memSlots.filter(s => s.slot !== slot), row] }
    return true
  }

  async load(): Promise<SaveSlot[]> {
    const r = await this.post('load')
    if (r.ok && Array.isArray(r.payload)) return r.payload as SaveSlot[]
    return this.memSlots
  }

  async submitScore(score: number, meta?: Record<string, unknown>): Promise<void> {
    const row: ScoreRow = { name: this.playerName, score, at: Date.now(), me: true }
    const r = await this.post('score', { score, meta })
    if (!r.ok) this.memScores.push(row)
  }

  async leaderboard(): Promise<{ best: ScoreRow[]; circle: ScoreRow[] }> {
    const r = await this.post('leaderboard')
    if (r.ok && r.payload) return r.payload as { best: ScoreRow[]; circle: ScoreRow[] }
    const best = [...this.memScores].sort((a, b) => b.score - a.score).slice(0, 8)
    return { best, circle: best }
  }

  quit(): void { this.post('quit') }
}
