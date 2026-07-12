import { it } from 'vitest'
import { LOCAL_ITEMS } from './learn'
import { DRILLS_BY_WORLD } from './drills'

it('pacing audit dump', () => {
  const avgItemXp = LOCAL_ITEMS.reduce((a, i) => a + (i.xp ?? 10), 0) / LOCAL_ITEMS.length
  console.log('\n=== Journey item xp ===')
  console.log('avg item.xp across bundled bank:', avgItemXp.toFixed(2))

  console.log('\n=== Drill rounds (xp = round-completion bonus only) ===')
  let totalRoundXp = 0, totalRounds = 0
  for (const [world, drills] of Object.entries(DRILLS_BY_WORLD)) {
    for (const d of drills as { title: string; rounds: number; xp: number; gen: (s?: string) => { xp?: number }[] }[]) {
      const sample = d.gen('explorer')
      const itemXpSum = sample.reduce((a, i) => a + (i.xp ?? 0), 0)
      const roundTotal = itemXpSum + d.xp
      totalRoundXp += roundTotal; totalRounds++
      console.log(`${world}/${d.title}: ${sample.length} items, itemXp=${itemXpSum}, bonus=${d.xp}, ROUND TOTAL=${roundTotal}`)
    }
  }
  console.log(`\navg xp per single drill round: ${(totalRoundXp / totalRounds).toFixed(1)} (n=${totalRounds})`)
})
