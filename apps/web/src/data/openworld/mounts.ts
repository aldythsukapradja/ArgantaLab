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

// A long prestige LADDER so a mount is a real, weeks-long goal (the diamond sink
// that keeps kids learning). Prices climb smoothly 500 → 20,000: the cheapest is
// Sandstrider (500) and the apex Arganterion (20,000). Rarity rises with price.
export const MOUNTS: MountDef[] = [
  m('sandstrider',   'Sandstrider',   'common',    500,   'none',  'energyStart', 6,  '#f59e0b', 'A loyal desert runner. +Energy on your first correct answer.'),
  m('meadowpony',    'Meadowpony',    'common',    1500,  'none',  'comboKeep',   1,  '#84cc16', 'A cheerful little pony that keeps your combo through one slip.'),
  m('stormfin',      'Stormfin',      'rare',      3000,  'swim',  'guardOnce',   1,  '#06b6d4', 'A tidal serpent — wade into World Lagoon and shrug off the first hit.'),
  m('emberfox',      'Emberfox',      'rare',      5000,  'none',  'energyStart', 9,  '#f97316', 'A blazing fox spirit — a big Energy burst on your first correct answer.'),
  m('frostelk',      'Frostelk',      'rare',      7500,  'none',  'captureBoost',14, '#38bdf8', 'A frost elk whose calm aura makes kin easier to befriend.'),
  m('updrift',       'Updrift',       'epic',      10000, 'flier', 'comboKeep',   1,  '#8b5cf6', 'A sky-glider — reach Wonder Skyfield and keep your combo through a slip.'),
  m('thunderram',    'Thunderram',    'epic',      13000, 'none',  'guardOnce',   1,  '#eab308', 'A storm ram that bodyguards you — shrug off the first hit each battle.'),
  m('shadowpanther', 'Shadowpanther', 'epic',      16000, 'none',  'energyStart', 12, '#6366f1', 'A sleek nightcat — a huge Energy head-start to open every fight.'),
  m('crystaldrake',  'Crystaldrake',  'legendary', 18000, 'flier', 'captureBoost',22, '#22d3ee', 'A crystalline dragon of the sky-isles; kin flock to befriend you.'),
  m('arganterion',   'Arganterion',   'legendary', 20000, 'none',  'captureBoost',26, '#facc15', 'The legendary guardian-mount — the apex ride. Befriend kin with ease.'),
]

export const MOUNT_BY_ID: Record<string, MountDef> = Object.fromEntries(MOUNTS.map(x => [x.id, x]))
export const mount = (id: string): MountDef | undefined => MOUNT_BY_ID[id]
