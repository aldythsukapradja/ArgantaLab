import { supabase, cloudEnabled } from '../../lib/supabase'

// NPC data — the shared cast both games place. Read is public (anon-safe);
// write is operator-only. Mirrors heroData.ts's shape.

export interface NpcEntry { id: string; name: string; role: string; notes?: string | null; hasSpec: boolean; updatedAt?: string }
export interface NpcLoad { id: string; name: string; role: string; notes: string | null; spec: any | null }

export async function loadNpcRoster(): Promise<{ entries: NpcEntry[]; source: 'live' | 'offline' }> {
  if (!cloudEnabled) return { entries: [], source: 'offline' }
  try {
    const { data, error } = await supabase.rpc('hq_npc_roster')
    if (!error && Array.isArray(data)) return { entries: data as NpcEntry[], source: 'live' }
  } catch { /* fall through */ }
  return { entries: [], source: 'offline' }
}

export async function getNpc(id: string): Promise<NpcLoad | null> {
  if (!cloudEnabled) return null
  try {
    const { data, error } = await supabase.rpc('hq_npc_get', { p_id: id })
    if (!error && data) return { id: data.id, name: data.name, role: data.role, notes: data.notes ?? null, spec: data.spec || null }
  } catch { /* ignore */ }
  return null
}

export async function saveNpc(id: string | null, name: string, role: string, notes: string, spec: any): Promise<{ ok: boolean; message?: string; id?: string }> {
  if (!cloudEnabled) return { ok: false, message: 'Offline — sign in to save.' }
  try {
    const { data, error } = await supabase.rpc('hq_npc_save', { p_id: id, p_name: name, p_role: role, p_notes: notes, p_spec: spec })
    if (error) return { ok: false, message: error.message }
    return { ok: !!data?.ok, message: data?.message, id: data?.id }
  } catch (e) {
    return { ok: false, message: (e as any)?.message || 'Save failed.' }
  }
}

export async function deleteNpc(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!cloudEnabled) return { ok: false, message: 'Offline.' }
  try {
    const { data, error } = await supabase.rpc('hq_npc_delete', { p_id: id })
    if (error) return { ok: false, message: error.message }
    return { ok: !!data?.ok }
  } catch (e) {
    return { ok: false, message: (e as any)?.message || 'Delete failed.' }
  }
}
