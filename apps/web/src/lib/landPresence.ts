import { supabase, cloudEnabled } from './supabase'
import type { ResolvedOutfit } from '@/data/cosmetics'

// ============================================================
//  CO-OP PRESENCE (walk the Openworld together)
//  Co-op is simply SHARED PRESENCE: anyone in the same circle who enters an
//  ArgantaLand map appears on it, walking around live (their avatar + mount).
//  ONE circle-wide channel `land:{circleId}` — each explorer tracks
//  {id,name,world,x,y,outfit,mount}. The map filters to peers in the SAME world;
//  the "X is exploring — Join" notice OBSERVES the same channel (without tracking
//  itself) to see who's out there. No DB writes — presence is ephemeral.
// ============================================================

export interface Peer { id: string; name: string; world?: string; x?: number; y?: number; color?: string; outfit?: ResolvedOutfit; mount?: string }
export interface LandCtrl { move: (x: number, y: number) => void; update: (p: Partial<Peer>) => void; leave: () => void }

const collect = (ch: ReturnType<typeof supabase.channel>, selfId: string): Peer[] => {
  const state = ch.presenceState() as unknown as Record<string, Peer[]>
  const out: Peer[] = []
  for (const k in state) for (const p of state[k]) if (p && p.id && p.id !== selfId) out.push(p)
  return out
}

export function joinPresence(channelKey: string, me: Peer, onPeers: (peers: Peer[]) => void): LandCtrl {
  if (!cloudEnabled) return { move: () => {}, update: () => {}, leave: () => {} }
  const ch = supabase.channel(channelKey, { config: { presence: { key: me.id } } })
  ch.on('presence', { event: 'sync' }, () => onPeers(collect(ch, me.id)))
  let cur = me
  ch.subscribe(status => { if (status === 'SUBSCRIBED') ch.track(cur as unknown as Record<string, unknown>) })
  return {
    move(x, y) { cur = { ...cur, x, y }; ch.track(cur as unknown as Record<string, unknown>) },
    update(p) { cur = { ...cur, ...p }; ch.track(cur as unknown as Record<string, unknown>) },
    leave() { supabase.removeChannel(ch) },
  }
}

/** Enter the shared world: track my position on the circle channel (and see who
 *  else is here). me MUST carry `world` so the map can filter to this world. */
export function joinLand(circleId: string | null, me: Peer, onPeers: (peers: Peer[]) => void): LandCtrl {
  if (!cloudEnabled || !circleId) return { move: () => {}, update: () => {}, leave: () => {} }
  return joinPresence(`land:${circleId}`, me, onPeers)
}

/** Watch who's exploring (any world) WITHOUT joining — for the "X is exploring →
 *  Join" notice on Home / the world lobby. Returns an unsubscribe fn. */
export function observeCircle(circleId: string | null, selfId: string, onPeers: (peers: Peer[]) => void): () => void {
  if (!cloudEnabled || !circleId) return () => {}
  const ch = supabase.channel(`land:${circleId}`, { config: { presence: { key: `obs-${selfId}-${Math.random().toString(36).slice(2)}` } } })
  ch.on('presence', { event: 'sync' }, () => onPeers(collect(ch, selfId).filter(p => p.world)))
  ch.subscribe()   // NB: no track() → observe only, we don't appear as exploring
  return () => { supabase.removeChannel(ch) }
}
