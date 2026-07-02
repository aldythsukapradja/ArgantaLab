// ============================================================
//  ARGANTALAB · KINQUEST · SAVE STATE  (per-kid, localStorage)
//  Namespaced by pkey() so accounts on a shared device never mix quests.
//  Cloud-syncable later (one JSON blob → a kinquest_saves row) with no shape
//  change. v2 adds Pokémon-style persistence: party carries CURRENT hp and
//  kin XP between battles, a bag of earned items, the KinBook's "seen" list,
//  beaten route trainers, and the current map (town / route).
// ============================================================

import { pkey } from '../player'
import type { PartyKin } from './party'
import { maxHpFor } from './party'
import { applyXp, xpForWin, type XpResult } from './growth'
import { tierForBond } from '@/data/kinquest'
import { STARTERS, STARTER_LEVEL, REGIONS } from '@/data/kinquest'

const KEY = 'argantalab_kinquest_v1'

export interface KinQuestSave {
  started: boolean
  party: PartyKin[]
  currentRegion: string
  currentMap: string        // 'town' | 'route'
  unlocked: string[]        // region ids reachable
  seals: string[]           // region ids whose Keeper is beaten
  bag: Record<string, number>       // item id → count
  seen: string[]            // kin render keys ever encountered (KinBook)
  trainersBeaten: string[]  // route trainer ids (first-win reward guard)
  befriendedTotal: number
  battlesWon: number
  updated: string
}

function fresh(): KinQuestSave {
  return {
    started: false,
    party: [],
    currentRegion: 'cove',
    currentMap: 'town',
    unlocked: ['cove'],
    seals: [],
    bag: { potion: 1, berry: 1 },   // a gentle starter kit
    seen: [],
    trainersBeaten: [],
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
    // back-fill any missing fields on older saves (v1 → v2)
    return {
      ...fresh(), ...s,
      party: s.party ?? [],
      unlocked: s.unlocked ?? ['cove'],
      seals: s.seals ?? [],
      bag: s.bag ?? { potion: 1, berry: 1 },
      seen: s.seen ?? [],
      trainersBeaten: s.trainersBeaten ?? [],
      currentMap: s.currentMap ?? 'town',
    }
  } catch { return fresh() }
}

export function writeSave(s: KinQuestSave): void {
  s.updated = new Date().toISOString()
  try { localStorage.setItem(pkey(KEY), JSON.stringify(s)) } catch { /* ignore */ }
}

/** Begin the quest with a chosen starter. Overwrites the party only if empty. */
export function chooseStarter(render: string): KinQuestSave {
  const s = loadSave()
  const starter = STARTERS.find(x => x.render === render) ?? STARTERS[0]
  s.started = true
  if (s.party.length === 0) {
    s.party = [{ render: starter.render, level: STARTER_LEVEL, bond: 10, world: starter.world, xp: 0 }]
    if (!s.seen.includes(starter.render)) s.seen.push(starter.render)
  }
  writeSave(s)
  return s
}

/** Add a befriended kin to the party (dedup by render — bumps bond if owned). */
export function addKin(render: string, world: string, level: number): KinQuestSave {
  const s = loadSave()
  const owned = s.party.find(k => k.render === render)
  if (owned) { owned.bond = Math.min(100, owned.bond + 8) }
  else { s.party.push({ render, level, bond: 12, world, xp: 0 }) }
  if (!s.seen.includes(render)) s.seen.push(render)
  s.befriendedTotal += 1
  writeSave(s)
  return s
}

/** Persist each party member's hp after a battle (parallel to party order). */
export function setPartyHp(hps: number[]): KinQuestSave {
  const s = loadSave()
  s.party.forEach((k, i) => { if (typeof hps[i] === 'number') k.hp = Math.max(0, Math.round(hps[i])) })
  writeSave(s)
  return s
}

/** The Kin Center: fully rest every kin. Returns true if anyone needed it. */
export function healParty(): { save: KinQuestSave; healed: boolean } {
  const s = loadSave()
  let healed = false
  for (const k of s.party) {
    const max = maxHpFor(k.render, k.level, tierForBond(k.bond))
    if (k.hp == null || k.hp < max) healed = healed || (k.hp != null && k.hp < max)
    k.hp = max
  }
  writeSave(s)
  return { save: s, healed }
}

/** Make a party member the lead (index 0). */
export function setLead(index: number): KinQuestSave {
  const s = loadSave()
  if (index > 0 && index < s.party.length) {
    const [k] = s.party.splice(index, 1)
    s.party.unshift(k)
  }
  writeSave(s)
  return s
}

/** Pay battle XP (already computed by the battle via growth.ts) to one party
 *  member + bond. The battle screen animates the SAME applyXp math it hands
 *  us, so what the kid watched is exactly what persists. */
export function rewardKin(index: number, gainedXp: number, bondGain: number): { save: KinQuestSave; xp: XpResult | null } {
  const s = loadSave()
  const k = s.party[index]
  if (!k) { writeSave(s); return { save: s, xp: null } }
  const r = applyXp(k.level, k.xp ?? 0, gainedXp)
  // level-ups grow max hp — the new headroom arrives already filled
  if (r.levelsGained > 0) {
    const oldMax = maxHpFor(k.render, k.level, tierForBond(k.bond))
    const newMax = maxHpFor(k.render, r.level, tierForBond(k.bond))
    if (typeof k.hp === 'number') k.hp = Math.min(newMax, k.hp + (newMax - oldMax))
  }
  k.level = r.level
  k.xp = r.xp
  k.bond = Math.min(100, k.bond + bondGain)
  writeSave(s)
  return { save: s, xp: r }
}

/** Count a battle victory (once per battle, not per enemy). */
export function recordWin(): KinQuestSave {
  const s = loadSave()
  s.battlesWon += 1
  writeSave(s)
  return s
}

/** Mark kin as seen in the wild (KinBook silhouettes). */
export function markSeen(renders: string[]): KinQuestSave {
  const s = loadSave()
  for (const r of renders) if (!s.seen.includes(r)) s.seen.push(r)
  writeSave(s)
  return s
}

// ── bag ─────────────────────────────────────────────────────
export function grantItem(id: string, n = 1): KinQuestSave {
  const s = loadSave()
  s.bag[id] = (s.bag[id] ?? 0) + n
  writeSave(s)
  return s
}
/** Consume one item. Returns false if none left. */
export function consumeItem(id: string): boolean {
  const s = loadSave()
  if ((s.bag[id] ?? 0) <= 0) return false
  s.bag[id] -= 1
  writeSave(s)
  return true
}

export function beatTrainer(id: string): KinQuestSave {
  const s = loadSave()
  if (!s.trainersBeaten.includes(id)) s.trainersBeaten.push(id)
  writeSave(s)
  return s
}

/** Open a region's onward paths WITHOUT a Keeper (e.g. the tutorial cove). */
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

/** Set the map the player is standing in ('town' | 'route'). */
export function setMap(mapId: string): KinQuestSave {
  const s = loadSave()
  s.currentMap = mapId
  writeSave(s)
  return s
}

/** Whole-quest reset (for a "New Game" option). */
export function resetSave(): KinQuestSave {
  const s = fresh()
  writeSave(s)
  return s
}
