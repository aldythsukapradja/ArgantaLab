import { supabase } from './supabase'
import { pkey } from './player'
import { memStore } from './memStore'

// Cross-device sync for the learn engine. State lives in the in-memory store for
// the session; the cloud `learn_state` row is the single source of truth. Keys
// are namespaced per active player (pkey) to match learnProgress/adaptive.

const NODES_BASE = 'argantalab_nodes_v1'
const MASTERY_BASE = 'argantalab_mastery_v1'
const NODES_KEY = () => pkey(NODES_BASE)
const MASTERY_KEY = () => pkey(MASTERY_BASE)

type Dict = Record<string, Record<string, unknown>>
function read(k: string): Dict { try { return JSON.parse(memStore.getItem(k) || '{}') } catch { return {} } }
function write(k: string, v: Dict) { try { memStore.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

/** Push the current local learn state up (debounced by the caller). */
export async function pushLearnState(uid: string): Promise<void> {
  try {
    await supabase.from('learn_state').upsert({
      user_id: uid, nodes: read(NODES_KEY()), mastery: read(MASTERY_KEY()), updated_at: new Date().toISOString(),
    })
  } catch { /* offline / table missing — ignore */ }
}

/** Pull cloud state on login, MERGE with local (best progress wins), write back. */
export async function pullLearnState(uid: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('learn_state').select('nodes,mastery').eq('user_id', uid).maybeSingle()
    if (error) { await pushLearnState(uid); return false }
    if (!data) { await pushLearnState(uid); return false }  // first login: seed from local

    const cloudNodes = (data.nodes as Dict) || {}
    const cloudMastery = (data.mastery as Dict) || {}
    const localNodes = read(NODES_KEY())
    const localMastery = read(MASTERY_KEY())

    // nodes: union; a node is done if either side says done, keep max stars
    const nodes: Dict = { ...localNodes }
    for (const k of new Set([...Object.keys(cloudNodes), ...Object.keys(localNodes)])) {
      const a = localNodes[k] as { status?: string; stars?: number } | undefined
      const b = cloudNodes[k] as { status?: string; stars?: number } | undefined
      nodes[k] = {
        status: a?.status === 'done' || b?.status === 'done' ? 'done' : 'open',
        stars: Math.max(a?.stars ?? 0, b?.stars ?? 0),
      }
    }
    // mastery: union; keep the higher mastery/box/lastSeen
    const mastery: Dict = { ...localMastery }
    for (const k of new Set([...Object.keys(cloudMastery), ...Object.keys(localMastery)])) {
      const a = localMastery[k] as { mastery?: number; box?: number; lastSeen?: number } | undefined
      const b = cloudMastery[k] as { mastery?: number; box?: number; lastSeen?: number } | undefined
      mastery[k] = {
        mastery: Math.max(a?.mastery ?? 0, b?.mastery ?? 0),
        box: Math.max(a?.box ?? 1, b?.box ?? 1),
        lastSeen: Math.max(a?.lastSeen ?? 0, b?.lastSeen ?? 0),
      }
    }

    write(NODES_KEY(), nodes)
    write(MASTERY_KEY(), mastery)
    await pushLearnState(uid)  // persist the merged result
    return true
  } catch { return false }
}
