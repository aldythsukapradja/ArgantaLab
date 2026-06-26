import { pkey } from './player'
import { memStore } from './memStore'

// Which kin this player has EVER defeated/befriended — so the "first clear" bonus
// is paid once per kin, not on every battle (the openworld overpay fix). Per-kid
// namespaced (pkey), same local-cache pattern as learnProgress/adaptive.
const KEY = 'argantalab_kin_cleared_v1'

function load(): Set<string> {
  try { return new Set(JSON.parse(memStore.getItem(pkey(KEY)) || '[]') as string[]) } catch { return new Set() }
}
function save(s: Set<string>) { try { memStore.setItem(pkey(KEY), JSON.stringify([...s])) } catch { /* ignore */ } }

export function hasClearedKin(kinId: string): boolean { return load().has(kinId) }
export function markKinCleared(kinId: string) { const s = load(); if (!s.has(kinId)) { s.add(kinId); save(s) } }
