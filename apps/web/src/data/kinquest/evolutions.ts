// ============================================================
//  ARGANTALAB · KINQUEST · EVOLUTIONS
//  A kin grows through 3 TIERS as its Bond rises. Tier is a data-driven
//  overlay on the SAME art (bigger + an evolved aura), so evolution is
//  real today and swaps to bespoke sprites later with zero engine change:
//  when a tier-2/3 sprite exists, give it its own `render` key in kin.ts
//  and point the chain at it — nothing else moves.
//
//  Bond thresholds (tier-up points): 0 → tier1, 30 → tier2, 70 → tier3.
//  Chains named for the notable kin; any kin without a chain still tiers
//  up (stat + aura) keeping its base name.
// ============================================================

import { kin as kinDef } from '@/data/openworld'

export const BOND_TIER2 = 30
export const BOND_TIER3 = 70

/** 0-based tier (0,1,2) for a bond value. */
export function tierForBond(bond: number): number {
  if (bond >= BOND_TIER3) return 2
  if (bond >= BOND_TIER2) return 1
  return 0
}

// Evolved display names per base render key. [tier1, tier2, tier3].
// Only kin with a defined chain get renamed; others keep their base name.
const CHAINS: Record<string, [string, string, string]> = {
  // ── starters ──
  countfox:  ['Countfox', 'Calcufox', 'Primefox'],
  letterowl: ['Letterowl', 'Scribeowl', 'Sageowl'],
  cloudcat:  ['Cloudcat', 'Stormcat', 'Nebulcat'],
  // ── keeper signatures ──
  tenturtle:  ['Tenturtle', 'Baseturtle', 'Placeshell'],
  primeroc:   ['Primeroc', 'Primeraptor', 'Primeregent'],
  spellynx:   ['Spellynx', 'Spelleon', 'Grammalynx'],
  grammargon: ['Grammargon', 'Syntaxwyrm', 'Lexidrake'],
  moodlamb:   ['Moodlamb', 'Calmram', 'Auraram'],
  auroracrane:['Auroracrane', 'Auroraheron', 'Auroraphoenix'],
  cometcolt:  ['Cometcolt', 'Cometstallion', 'Starcharger'],
  novabear:   ['Novabear', 'Superbear', 'Galaxursa'],
  mapturtle:  ['Mapturtle', 'Atlasturtle', 'Globeshell'],
  globewhale: ['Globewhale', 'Continentwhale', 'Terraleviath'],
  pixelslime: ['Pixelslime', 'Bitslime', 'Byteslime'],
  mechmouse:  ['Mechmouse', 'Cogmouse', 'Cybermouse'],
  datadragon: ['Datadragon', 'Cipherdrake', 'Omnidrake'],
}

/** The display name of a kin instance at a given tier. */
export function evolvedName(renderKey: string, tier: number): string {
  const chain = CHAINS[renderKey]
  if (chain) return chain[Math.max(0, Math.min(2, tier))]
  return kinDef(`kin:${renderKey}`)?.name ?? renderKey
}

/** Does this kin visibly change name at this tier-up? (drives the "evolved!" moment) */
export function evolvesAt(renderKey: string, fromTier: number, toTier: number): boolean {
  const chain = CHAINS[renderKey]
  if (!chain) return false
  return chain[fromTier] !== chain[toTier]
}

/** Stat scale from tier: tier1 ×1, tier2 ×1.35, tier3 ×1.8. */
export function tierStatMult(tier: number): number {
  return [1, 1.35, 1.8][Math.max(0, Math.min(2, tier))]
}
