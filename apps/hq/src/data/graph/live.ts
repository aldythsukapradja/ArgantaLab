// Command live layer — calls the P3 read-side RPCs (migration_command_graph.sql).
// Offline (no Supabase keys / not operator) every call returns null and the UI
// keeps its honest "—" + source badge. Nothing is invented.

import { supabase, cloudEnabled } from '../../lib/supabase'

export interface W2FPoint { week: string; families: number; w2f: number }
export interface CurrState { state: string; families: number }
export interface KFactor { sent: number; accepted: number; k: number }
export interface SurfaceHealth { surface_id: string; events: number }

async function call<T>(fn: string): Promise<T | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc(fn)
  if (error) { console.warn('[command]', fn, '→', error.message); return null }
  return (data ?? null) as T | null
}

export const commandLive = {
  w2fWeekly: () => call<W2FPoint[]>('w2f_weekly'),
  currStates: () => call<CurrState[]>('curr_states'),
  kFactor: () => call<KFactor[]>('k_factor'),
  surfaceHealth: () => call<SurfaceHealth[]>('surface_health'),
}
