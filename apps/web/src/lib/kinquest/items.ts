// ============================================================
//  ARGANTALAB · KINQUEST · BAG ITEMS  (content-as-data)
//  Usable battle items. EARNED, never bought — the diamond rule stays intact
//  (diamonds buy cosmetics only, never battle power): the Market hands out a
//  daily freebie, trainers drop one on a first win, Keepers pay one on a seal.
// ============================================================

export interface ItemDef {
  id: string
  name: string
  emoji: string
  blurb: string
  effect: 'heal' | 'befriend'
  power: number          // heal: fraction of maxHp restored; befriend: chance boost
}

export const ITEMS: ItemDef[] = [
  { id: 'potion', name: 'Berry Juice', emoji: '🧃', blurb: 'Restores half of a kin\'s health.', effect: 'heal', power: 0.5 },
  { id: 'berry',  name: 'Bond Berry',  emoji: '🫐', blurb: 'Makes a wild kin much easier to befriend.', effect: 'befriend', power: 0.22 },
]

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map(i => [i.id, i]))
export const item = (id: string): ItemDef | undefined => ITEM_BY_ID[id]
