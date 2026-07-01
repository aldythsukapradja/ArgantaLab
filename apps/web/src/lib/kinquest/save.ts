// ============================================================
//  ARGANTALAB · KINQUEST · SAVE STATE  (per-kid, localStorage)
//  Namespaced by pkey() so accounts on a shared device never mix quests.
//  Cloud-syncable later (one JSON blob → a kinquest_saves row) with no shape
//  change. Holds the party, bonds/levels, earned Seals, and map progress.
// ============================================================

import { pkey } from '../player'
import type { PartyKin } from './party'
import { STARTERS, STARTER_LEVEL, REGIONS } from '@/data/kinquest'

const KEY = 'argantalab_kinquest_v1'

export interface KinQuestSave {
  started: boolean
  party: PartyKin[]
  currentRegion: string
  unlocked: string[]        // region ids reachable
  seals: string[]           // region ids whose Keeper is beaten
  befriendedTotal: number
  battlesWon: number
  updated: string
}

function fresh(): KinQuestSave {
  return {
    started: false,
    party: [],
    currentRegion: 'cove',
    unlocked: ['cove'],
    seals: [],
    befriendedTotal: 0,
    battlesWon: 0,
    updated: new Date().toISOString(),
  }
}

export function loadSave(): KinQuestSave {
  try {
    const raw = localStorage.getItem(pkey(KEY))
    if (!raw) return fresh()
    const s = JSON.parse(raw) as KinQuestSave
    // back-fill any missing fields on older saves
    return { ...fresh(), ...s, party: s.party ?? [], unlocked: s.unlocked ?? ['cove'], seals: s.seals ?? [] }
  } catch { return fresh() }
}

export function writeSave(s: KinQuestSave): void {
  s.updated = new Date().toISOString()
  try { localStorage.setItem(pkey(KEY), JSON.stringify(s)) } catch { /* ignore */ }
}

/** Begin the quest with a chosen starter. Idempotent-ish: overwrites party if empty. */
export function chooseStarter(render: string): KinQuestSave {
  const s = loadSave()
  const starter = STARTERS.find(x => x.render === render) ?? STARTERS[0]
  s.started = true
  if (s.party.length === 0) {
    s.party = [{ render: starter.render, level: STARTER_LEVEL, bond: 10, world: starter.world }]
  }
  writeSave(s)
  return s
}

/** Add a befriended kin to the party (dedup by render — bumps bond if owned). */
export function addKin(render: string, world: string, level: number): KinQuestSave {
  const s = loadSave()
  const owned = s.party.find(k => k.render === render)
  if (owned) { owned.bond = Math.min(100, owned.bond + 8) }
  else { s.party.push({ render, level, bond: 12, world }) }
  s.befriendedTotal += 1
  writeSave(s)
  return s
}

/** Grant XP-as-bond + a level bump to the active (first) party kin after a win. */
export function rewardParty(bond: number, levelUps = 0): KinQuestSave {
  const s = loadSave()
  const lead = s.party[0]
  if (lead) {
    lead.bond = Math.min(100, lead.bond + bond)
    lead.level += levelUps
  }
  s.battlesWon += 1
  writeSave(s)
  return s
}

/** Open a region's onward paths WITHOUT a Keeper (e.g. the tutorial cove).
 *  Returns the new save + the ids that were newly unlocked. */
export function openRegionPaths(regionId: string): { save: KinQuestSave; opened: string[] } {
  const s = loadSave()
  const reg = REGIONS.find(r => r.id === regionId)
  const opened: string[] = []
  for (const nxt of reg?.unlocks ?? []) {
    if (!s.unlocked.includes(nxt)) { s.unlocked.push(nxt); opened.push(nxt) }
  }
  writeSave(s)
  return { save: s, opened }
}

/** Record a Keeper defeat: earn the Seal, unlock the next region(s). */
export function beatKeeper(regionId: string): KinQuestSave {
  const s = loadSave()
  if (!s.seals.includes(regionId)) s.seals.push(regionId)
  const reg = REGIONS.find(r => r.id === regionId)
  for (const nxt of reg?.unlocks ?? []) {
    if (!s.unlocked.includes(nxt)) s.unlocked.push(nxt)
  }
  writeSave(s)
  return s
}

/** Set the region the player is standing in (for the map's "current" glow). */
export function setRegion(regionId: string): KinQuestSave {
  const s = loadSave()
  s.currentRegion = regionId
  if (!s.unlocked.includes(regionId)) s.unlocked.push(regionId)
  writeSave(s)
  return s
}

/** Whole-quest reset (for a "New Game" option). */
export function resetSave(): KinQuestSave {
  const s = fresh()
  writeSave(s)
  return s
}
