// ============================================================
//  ARGANTALAB · KINQUEST · STARTERS
//  Three first-partner kin, one per play style — each is a `common`
//  catalog kin so its art + element already exist. The chosen starter
//  seeds the party at level 5 and evolves down its own chain.
// ============================================================

export interface Starter {
  render: string          // kin catalog render key
  world: string           // catalog world (for wild-kin theming)
  tagline: string
  style: string           // one-word play-style hint
}

export const STARTERS: Starter[] = [
  { render: 'countfox',  world: 'num', tagline: 'Brave & quick — hits hard and fast.',        style: 'Aggressive' },
  { render: 'letterowl', world: 'wrd', tagline: 'Wise & balanced — a steady first partner.',  style: 'Balanced' },
  { render: 'cloudcat',  world: 'won', tagline: 'Curious & tough — soaks hits, wins the long game.', style: 'Defensive' },
]

export const STARTER_LEVEL = 5
