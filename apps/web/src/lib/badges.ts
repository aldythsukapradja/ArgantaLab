// ============================================================
//  BADGES — the full collection (retention layer)
//  Combines the existing per-world skill/completion badges with CROSS-FEATURE
//  badges that reward playing the WHOLE app: publishing games, keeping a streak
//  (a full daily circle), taming every kin, finishing every world, and climbing
//  the seasonal rank. All computed from LOCAL signals (client-first) so the
//  collection works offline; the rank tier is passed in once Pass D lands.
// ============================================================

import { WORLDS } from '@/data/learn'
import { KIN } from '@/data/openworld'
import { earnedBadges, worldComplete } from './learnProgress'
import { hasClearedKin } from './openworldClears'
import { loadMyGames } from './myGames'
import { getStreak } from './streak'

export interface BadgeView { key: string; name: string; icon: string; group: string; earned: boolean }

/** Cross-feature + per-world collector badges, from local signals. */
export function crossBadges(rankTier = 0): BadgeView[] {
  const published = loadMyGames().filter(g => g.published).length
  const streak = getStreak()
  const allKin = KIN.every(k => hasClearedKin(k.id))
  const allWorlds = WORLDS.every(w => worldComplete(w))

  const list: BadgeView[] = [
    { key: 'first-game', name: 'First Publish',  icon: '🚀', group: 'Build',   earned: published >= 1 },
    { key: 'game-maker', name: 'Game Maker',     icon: '🎮', group: 'Build',   earned: published >= 5 },
    { key: 'streak-7',   name: '7-Day Streak',   icon: '🔥', group: 'Habit',   earned: streak >= 7 },
    { key: 'streak-30',  name: '30-Day Streak',  icon: '🌟', group: 'Habit',   earned: streak >= 30 },
    { key: 'kin-master', name: 'Kin Master',     icon: '🐾', group: 'Explore', earned: allKin },
    { key: 'scholar',    name: 'Grand Scholar',  icon: '🎓', group: 'Learn',   earned: allWorlds },
    { key: 'ranked',     name: 'Ranked Climber', icon: '🏆', group: 'Rank',    earned: rankTier >= 2 },
    { key: 'ranked-top', name: 'Season Champion', icon: '👑', group: 'Rank',   earned: rankTier >= 5 },
  ]

  // per-world collector: clear every kin in that world
  WORLDS.forEach(w => {
    const kin = KIN.filter(k => k.world === w.key.toLowerCase())
    const done = kin.length > 0 && kin.every(k => hasClearedKin(k.id))
    list.push({ key: `tamer-${w.key}`, name: `${w.name} Tamer`, icon: '🛡️', group: 'Explore', earned: done })
  })
  return list
}

/** Existing per-world skill / world-complete badges. */
export function worldBadgeViews(): BadgeView[] {
  const out: BadgeView[] = []
  for (const w of WORLDS) {
    const earned = earnedBadges(w)
    for (const b of w.badges) out.push({ key: `${w.key}:${b.key}`, name: b.name, icon: b.icon, group: w.name, earned: earned.has(b.key) })
  }
  return out
}

/** The whole collection, per-world first then cross-feature. */
export function allBadges(rankTier = 0): BadgeView[] {
  return [...worldBadgeViews(), ...crossBadges(rankTier)]
}
