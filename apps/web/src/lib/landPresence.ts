import { supabase, cloudEnabled } from './supabase'
import type { ResolvedOutfit } from '@/data/cosmetics'

// ============================================================
//  ARGANTALAND · co-op presence (see friends walking the map)
//  A lightweight Supabase Realtime PRESENCE channel per (circle, world): each
//  player tracks {x,y,name,outfit} and we get everyone else's live positions.
//  No DB writes — presence is ephemeral, exactly right for "who's here and where".
//  Scoped to the circle so a kid only sees their own family/friends roaming.
// ============================================================

export interface Peer { id: string; name: string; x: number; y: number; color?: string; outfit?: ResolvedOutfit }
export interface LandCtrl { move: (x: number, y: number) => void; leave: () => void }

export function joinLand(world: string, circleId: string | null, me: Peer, onPeers: (peers: Peer[]) => void): LandCtrl {
  if (!cloudEnabled) return { move: () => {}, leave: () => {} }
  const ch = supabase.channel(`land:${circleId ?? 'solo'}:${world}`, { config: { presence: { key: me.id } } })

  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState() as unknown as Record<string, Peer[]>
    const out: Peer[] = []
    for (const k in state) for (const p of state[k]) if (p && p.id && p.id !== me.id) out.push(p)
    onPeers(out)
  })

  let cur = me
  ch.subscribe(status => { if (status === 'SUBSCRIBED') ch.track(cur as unknown as Record<string, unknown>) })

  return {
    move(x, y) { cur = { ...cur, x, y }; ch.track(cur as unknown as Record<string, unknown>) },
    leave() { supabase.removeChannel(ch) },
  }
}
