// ============================================================
//  ARGANTALAB · KINQUEST · PARTY & COMBATANT FACTORY  (pure)
//  Turns catalog kin + level/bond into battle-ready Combatants. Stats derive
//  from the catalog baseHp/power, scaled by level and evolution tier, so a
//  freshly-caught kin and a Keeper's ace are built the exact same way.
// ============================================================

import { kin as kinDef } from '@/data/openworld'
import type { Element } from '@/data/openworld'
import { tierForBond, tierStatMult, evolvedName } from '@/data/kinquest'
import type { Combatant } from './battle'

// A kin the player owns (saved).
export interface PartyKin {
  render: string       // catalog render key
  level: number
  bond: number         // 0..100 → drives evolution tier
  world: string
}

/** HP a combatant has at a given level+tier (from catalog baseHp). */
export function maxHpFor(render: string, level: number, tier: number): number {
  const base = kinDef(`kin:${render}`)?.baseHp ?? 90
  return Math.round((base * 0.6 + level * 6) * tierStatMult(tier))
}

/** Attack power at a given level+tier. */
export function powerFor(render: string, level: number, tier: number): number {
  return Math.round((10 + level * 1.6) * tierStatMult(tier))
}

/** Build a full battle Combatant from a render key + level + tier. */
export function makeCombatant(render: string, level: number, bondOrTier: number, opts: { asTier?: boolean } = {}): Combatant {
  const def = kinDef(`kin:${render}`)
  const tier = opts.asTier ? bondOrTier : tierForBond(bondOrTier)
  const maxHp = maxHpFor(render, level, tier)
  return {
    renderKey: render,
    name: evolvedName(render, tier),
    element: (def?.element ?? 'pattern') as Element,
    level,
    hp: maxHp,
    maxHp,
    power: powerFor(render, level, tier),
    tier,
    color: def?.color ?? '#8b5cf6',
  }
}

/** Build a Combatant from a saved PartyKin. */
export function combatantFromParty(k: PartyKin): Combatant {
  return makeCombatant(k.render, k.level, k.bond)
}

/** Build a wild enemy of a given render key within a level band. */
export function makeWildEnemy(render: string, level: number): Combatant {
  return makeCombatant(render, level, 0, { asTier: true })
}
