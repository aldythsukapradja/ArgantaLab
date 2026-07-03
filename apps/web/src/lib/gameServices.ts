// ============================================================
//  ARGANTA GAME SERVICES — the parent-app side of the bridge.
//  Generated games run in sandboxed srcDoc iframes (opaque origin,
//  no storage), so they postMessage save/load/score/leaderboard
//  requests up to us. We answer from per-player localStorage and
//  best-effort mirror scores/saves to Supabase when signed in
//  (degrading silently like gamesCloud does).
//
//  Install once: installGameServices() from App.tsx.
// ============================================================

import { pkey } from './player'
import { supabase } from './supabase'
import type { BridgeRequest, BridgeResponse, SaveSlot, ScoreRow } from '@/engine/types'

const SAVE_BASE = 'argantalab_gamesaves_v1'
const SCORE_BASE = 'argantalab_gamescores_v1'
const MAX_SCORES = 60

type SaveMap = Record<string, SaveSlot[]>          // gameId → slots
type ScoreMap = Record<string, ScoreRow[]>         // gameId → rows (desc not guaranteed)

function read<T>(base: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(pkey(base)) || '') as T } catch { return fallback }
}
function write(base: string, v: unknown) {
  try { localStorage.setItem(pkey(base), JSON.stringify(v)) } catch { /* full/blocked */ }
}

// ── local operations (always work) ──
export function getSlots(gameId: string): SaveSlot[] {
  return read<SaveMap>(SAVE_BASE, {})[gameId] ?? []
}
export function putSlot(gameId: string, slot: SaveSlot) {
  const all = read<SaveMap>(SAVE_BASE, {})
  all[gameId] = [...(all[gameId] ?? []).filter(s => s.slot !== slot.slot), slot]
  write(SAVE_BASE, all)
}
export function addScore(gameId: string, name: string, score: number) {
  const all = read<ScoreMap>(SCORE_BASE, {})
  const rows = all[gameId] ?? []
  rows.push({ name, score, at: Date.now(), me: true })
  rows.sort((a, b) => b.score - a.score)
  all[gameId] = rows.slice(0, MAX_SCORES)
  write(SCORE_BASE, all)
}
export function getScores(gameId: string): ScoreRow[] {
  return (read<ScoreMap>(SCORE_BASE, {})[gameId] ?? []).sort((a, b) => b.score - a.score)
}
/** Best score across a game (for rank badges on the shelf). */
export function bestScore(gameId: string): number {
  return getScores(gameId)[0]?.score ?? 0
}

// ── cloud mirror (best-effort; table may not exist yet) ──
let cloudUser: { id: string; name: string } | null = null
export function setGameServicesUser(u: { id: string; name: string } | null) { cloudUser = u }

async function cloudScore(gameId: string, score: number, meta: unknown) {
  if (!cloudUser) return
  try {
    await supabase.from('game_scores').insert({
      user_id: cloudUser.id, game_id: gameId, player_name: cloudUser.name, score, meta: meta ?? null,
    })
  } catch { /* table not migrated yet — local still works */ }
}
async function cloudCircleScores(gameId: string): Promise<ScoreRow[] | null> {
  try {
    const { data, error } = await supabase.from('game_scores')
      .select('player_name,score,created_at,user_id')
      .eq('game_id', gameId).order('score', { ascending: false }).limit(10)
    if (error || !data) return null
    return data.map(r => ({
      name: (r.player_name as string) ?? 'Player',
      score: r.score as number,
      at: r.created_at ? Date.parse(r.created_at as string) : Date.now(),
      me: cloudUser ? r.user_id === cloudUser.id : false,
    }))
  } catch { return null }
}

// ── the bridge listener ──
let installed = false
export function installGameServices() {
  if (installed) return
  installed = true
  window.addEventListener('message', async (e: MessageEvent) => {
    const m = e.data as BridgeRequest
    if (!m || m.arganta !== true || !m.type || m.type === ('result' as never)) return
    const src = e.source as Window | null
    if (!src) return
    const reply = (ok: boolean, payload?: unknown) => {
      const res: BridgeResponse = { arganta: true, id: m.id, type: 'result', ok, payload }
      try { src.postMessage(res, '*') } catch { /* gone */ }
    }
    switch (m.type) {
      case 'ready': return reply(true)
      case 'save': {
        const slot = m.payload as SaveSlot
        if (!slot || typeof slot.slot !== 'number') return reply(false)
        putSlot(m.gameId, slot)
        return reply(true)
      }
      case 'load': return reply(true, getSlots(m.gameId))
      case 'score': {
        const p = m.payload as { score: number; meta?: unknown }
        if (!p || typeof p.score !== 'number') return reply(false)
        addScore(m.gameId, cloudUser?.name ?? 'You', p.score)
        cloudScore(m.gameId, p.score, p.meta)
        return reply(true)
      }
      case 'leaderboard': {
        const best = getScores(m.gameId).slice(0, 8)
        const circle = (await cloudCircleScores(m.gameId)) ?? best
        return reply(true, { best, circle })
      }
      case 'quit': return reply(true)
      default: return reply(false)
    }
  })
}
