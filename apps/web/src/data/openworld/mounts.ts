// ============================================================
//  ARGANTALAB · OPENWORLD · MOUNT CATALOG  (content-as-data)
//  Mounts are bought in the Shop (diamonds only — cosmetic + utility, never
//  pay-to-win on learning). They give a cinematic entrance, a small passive
//  battle perk, one once-per-battle ability, and can GATE worlds (swim/flier).
//  Equipped overworld mount auto-rides into the Openworld battle.
//
//  `render` is the MountSprite art key; everything else is data. A new mount
//  that reuses a look = one row. Styles (skins/trails) live in mount_styles.
// ============================================================

import type { Rarity } from '@/data/cosmetics'
import type { MountGate } from './worlds'

export type MountPerk =
  | 'energyStart'   // +Energy on the first correct answer
  | 'guardOnce'     // a free Guard the first time you'd be hit
  | 'captureBoost'  // +Friendship meter gain
  | 'comboKeep'     // keep your combo through one miss

export interface MountDef {
  id: string            // 'mount:sandstrider'
  render: string        // MountSprite art key
  name: string
  rarity: Rarity
  price: number         // diamonds
  gate: MountGate       // worlds this mount can unlock ('none' = cosmetic ride only)
  perk: MountPerk
  perkValue: number     // magnitude the engine reads
  color: string
  blurb: string
}

const m = (
  render: string, name: string, rarity: Rarity, price: number,
  gate: MountGate, perk: MountPerk, perkValue: number, color: string, blurb: string,
): MountDef => ({ id: `mount:${render}`, render, name, rarity, price, gate, perk, perkValue, color, blurb })

export const MOUNTS: MountDef[] = [
  m('sandstrider', 'Sandstrider', 'common',    60,  'none',  'energyStart', 6,  '#f59e0b', 'A loyal desert runner. +Energy on your first correct answer.'),
  m('stormfin',    'Stormfin',    'rare',      120, 'swim',  'guardOnce',   1,  '#06b6d4', 'A tidal serpent — wade into World Lagoon and shrug off the first hit.'),
  m('updrift',     'Updrift',     'epic',      180, 'flier', 'comboKeep',   1,  '#8b5cf6', 'A sky-glider — reach Wonder Skyfield and keep your combo through a slip.'),
  m('arganterion', 'Arganterion', 'legendary', 320, 'none',  'captureBoost',20, '#facc15', 'The legendary guardian-mount. Befriend kin far more easily.'),
]

export const MOUNT_BY_ID: Record<string, MountDef> = Object.fromEntries(MOUNTS.map(x => [x.id, x]))
export const mount = (id: string): MountDef | undefined => MOUNT_BY_ID[id]
