import { supabase, cloudEnabled } from './supabase'
import { myCircles } from './cloudAuth'

// ============================================================
//  REAL CO-OP (client) — two devices, one shared kin.
//  The enemy lives in a coop_session row on the server; every hit goes through a
//  security-definer RPC that COMPUTES the damage (the client never sends a number
//  it could forge). Supabase Realtime pushes coop_session + coop_member changes
//  to both devices, so we just re-pull coop_state on any change. Mirrors the
//  cloudEnabled-guard + graceful-degrade pattern of lib/nexus.ts / lib/mounts.ts.
// ============================================================

export interface CoopMember { person_id: string; display_name: string | null; hearts: number }
export interface CoopState {
  id: string; circle_id: string; host_id: string; kin_key: string; world_key: string
  enemy_hp: number; enemy_max_hp: number; enemy_shield: number
  status: 'open' | 'won' | 'lost'
  members: CoopMember[]
}
export interface CoopOpen { id: string; kin_key: string; world_key: string; host: string | null; members: number }

const ok = (d: unknown): CoopState | null => (d ? d as CoopState : null)

/** Host a co-op battle vs a kin in one of my circles. */
export async function coopCreate(circleId: string, kinKey: string, world: string, maxHp: number, shield: number): Promise<CoopState | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('coop_create',
    { p_circle: circleId, p_kin: kinKey, p_world: world, p_max_hp: maxHp, p_shield: shield })
  if (error) { console.warn('[coop] create failed:', error.message); return null }
  return ok(data)
}

/** Join an open battle in my circle. */
export async function coopJoin(sessionId: string): Promise<CoopState | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('coop_join', { p_session: sessionId })
  if (error) { console.warn('[coop] join failed:', error.message); return null }
  return ok(data)
}

/** Take an action — the server decides the result. move: 'strike' | 'break'. */
export async function coopAct(sessionId: string, move: 'strike' | 'break', correct: boolean): Promise<CoopState | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('coop_act', { p_session: sessionId, p_move: move, p_correct: correct })
  if (error) { console.warn('[coop] act failed:', error.message); return null }
  return ok(data)
}

/** Pull the authoritative shared state. */
export async function coopState(sessionId: string): Promise<CoopState | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('coop_state', { p_session: sessionId })
  if (error) { console.warn('[coop] state failed:', error.message); return null }
  return ok(data)
}

/** Open battles to join in a circle. */
export async function coopOpen(circleId: string): Promise<CoopOpen[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('coop_open', { p_circle: circleId })
  if (error) { console.warn('[coop] open failed:', error.message); return [] }
  return (data as CoopOpen[]) ?? []
}

/** Every open co-op battle across ALL my circles (for the Home invite banner). */
export async function coopOpenMine(): Promise<CoopOpen[]> {
  if (!cloudEnabled) return []
  const circles = await myCircles()
  if (circles.length === 0) return []
  const lists = await Promise.all(circles.map(c => coopOpen(c.id)))
  const seen = new Set<string>(); const out: CoopOpen[] = []
  for (const l of lists) for (const o of l) if (!seen.has(o.id)) { seen.add(o.id); out.push(o) }
  return out
}

/** Live-stream a session: calls onChange whenever the shared state moves.
 *  Returns an unsubscribe fn. */
export function subscribeCoop(sessionId: string, onChange: () => void): () => void {
  if (!cloudEnabled) return () => {}
  const ch = supabase.channel(`coop:${sessionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coop_session', filter: `id=eq.${sessionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coop_member', filter: `session_id=eq.${sessionId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}
