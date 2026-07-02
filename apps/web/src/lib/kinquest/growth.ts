// ============================================================
//  ARGANTALAB · KINQUEST · GROWTH  (pure kin XP + level math)
//  Kin now grow through a REAL XP curve instead of coin-flip level-ups:
//  a win pays XP to the kin that landed the finish, the battle screen fills
//  a visible XP bar, and crossing the threshold plays a "grew to Lv X!" beat.
//  All pure — proven by unit tests, shared by battle UI and the save layer.
// ============================================================

export const KIN_MAX_LEVEL = 30

/** XP needed to go from `level` to `level + 1`. Gentle early, steeper later. */
export function xpToNext(level: number): number {
  return 30 + Math.max(1, level) * 12
}

/** XP a battle pays out, from the beaten enemy's level (Keepers pay +50%). */
export function xpForWin(enemyLevel: number, isKeeper = false): number {
  const base = 16 + Math.max(1, enemyLevel) * 7
  return Math.round(isKeeper ? base * 1.5 : base)
}

export interface XpResult { level: number; xp: number; levelsGained: number }

/** Apply gained XP to (level, xp) → new level/xp, rolling over thresholds. */
export function applyXp(level: number, xp: number, gained: number): XpResult {
  let l = Math.max(1, level)
  let x = Math.max(0, xp) + Math.max(0, gained)
  let ups = 0
  while (l < KIN_MAX_LEVEL && x >= xpToNext(l)) {
    x -= xpToNext(l)
    l += 1
    ups += 1
  }
  if (l >= KIN_MAX_LEVEL) x = 0
  return { level: l, xp: x, levelsGained: ups }
}
