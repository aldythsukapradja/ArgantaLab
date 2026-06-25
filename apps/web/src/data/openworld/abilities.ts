// ============================================================
//  ARGANTALAB · OPENWORLD · ABILITY CATALOG  (content-as-data)
//  The combat *engine* is built once and is content-agnostic; the moves
//  themselves live here as plain data rows — mirroring data/cosmetics.ts.
//  Each ability has a `render` key the AbilitySprite/icon switches on, a
//  `kind` the engine understands, an Energy `cost`, and a `power`.
//
//  Adding a new move = one row here (+ a DB row later). Only a brand-new
//  VISUAL needs a new render fn. Stats / cost / text are all just data.
// ============================================================

export type AbilityKind =
  | 'strike'   // cheap, reliable damage — the bread-and-butter
  | 'charge'   // costs a turn; the next damaging hit is multiplied
  | 'shield'   // block the next enemy attack
  | 'break'    // weakness break: bonus damage, strips enemy shield, builds capture
  | 'focus'    // make the next question easier for less Energy (a ramp)
  | 'surge'    // co-op: boost a teammate (no-op in solo/bot fills the slot)

export interface AbilityDef {
  id: string            // unique, e.g. 'ab:strike'
  render: string        // icon/art key
  name: string
  kind: AbilityKind
  cost: number          // Energy spent to fire
  power: number         // damage (strike/break) or multiplier×10 (charge) or block (shield)
  element?: string      // for `break`: which enemy weakness tag it exploits
  desc: string
}

const a = (
  render: string, name: string, kind: AbilityKind, cost: number, power: number,
  desc: string, element?: string,
): AbilityDef => ({ id: `ab:${render}`, render, name, kind, cost, power, desc, element })

// ── The starter roster (every companion can bring 3 into a battle) ──
//  The kid-facing battle uses three clear choices after each question — Strike,
//  Weakness Break, and Power Up — so there is never a "guard then end turn" two-
//  step. A correct answer ONLY charges Energy (no automatic hit): ALL damage comes
//  from the move the kid deliberately picks. Strike and Weakness Break cost the
//  same (⚡10) so they're true peer choices; Power Up (kind 'charge') costs an EXTRA
//  question instead of Energy to charge the next hit ~2.2×. Numbers are the
//  Monte-Carlo-proven kit (sim.ts): careful=1.00 / smart≈0.99 / naive≈0.29.
export const ABILITIES: AbilityDef[] = [
  a('strike',  'Strike',         'strike', 10, 16, 'A reliable hit. Cheap and always useful.'),
  a('charge',  'Power Up',       'charge', 0,  22, 'Answer one more question to charge — your next attack lands ~2.2× as hard.'),
  a('break',   'Weakness Break', 'break',  10, 12, 'Exploit the enemy’s weakness: bonus damage, strips its shield, fills the Friendship meter.', 'pattern'),
  a('shield',  'Guard',          'shield', 10, 1,  'Block the enemy’s next attack completely. (Retired from the default kit.)'),
  a('focus',   'Focus',          'focus',  8,  0,  'Make your next question easier — a gentle ramp when you’re stuck.'),
  a('surge',   'Team Surge',     'surge',  14, 12, 'Send Energy to a teammate. (Co-op — a bot ally holds this slot for now.)'),
]

export const ABILITY_BY_ID: Record<string, AbilityDef> = Object.fromEntries(ABILITIES.map(x => [x.id, x]))
export const ability = (id: string): AbilityDef | undefined => ABILITY_BY_ID[id]

// The default 3-move kit a fresh player starts with: Strike, Weakness Break, Power Up.
export const DEFAULT_LOADOUT: string[] = ['ab:strike', 'ab:break', 'ab:charge']
