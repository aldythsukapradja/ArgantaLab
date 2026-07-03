// KIN FARM — analog of FarmVille / Hay Day, tuned for kids (crops take
// seconds-to-minutes, and keep growing in real time thanks to timestamps
// in the save file — the genre that teaches WHY saves matter).
// Sidekick waters one thirsty crop for free now and then.

import type { GenreFactory } from '../core'
import { rr, glow, txt, shade } from '../draw'

export const hint = 'Tap a plot to plant, water 💧 when thirsty, harvest when ready. Sell to grow the farm!'

const CROPS = [
  { key: 'carrot',  e: '🥕', name: 'Carrot',     cost: 5,  sell: 12,  time: 20 },
  { key: 'tomato',  e: '🍅', name: 'Tomato',     cost: 12, sell: 30,  time: 45 },
  { key: 'corn',    e: '🌽', name: 'Corn',       cost: 25, sell: 65,  time: 90 },
  { key: 'melon',   e: '🍉', name: 'Melon',      cost: 60, sell: 160, time: 180 },
  { key: 'star',    e: '⭐', name: 'Starfruit',  cost: 150, sell: 420, time: 360 },
]

interface Plot { crop: number; plantedAt: number; watered: boolean; wither: number }
interface FarmSave { coins: number; plots: Plot[]; unlockedPlots: number; totalHarvests: number }

export const make: GenreFactory = (g) => {
  const w = 480, h = 720
  const paceMul = { zen: 1.6, normal: 1, sprint: 0.5 }[g.str('pace', 'normal')] ?? 1
  const startPlots = g.num('plots', 6)

  let coins = 25
  let totalHarvests = 0
  let unlockedPlots = startPlots
  const MAX_PLOTS = 12
  let plots: Plot[] = Array.from({ length: MAX_PLOTS }, () => ({ crop: -1, plantedAt: 0, watered: true, wither: 0 }))
  let menuFor = -1        // plot index with the seed menu open
  let sidekickT = 12
  let heroTarget = { x: w / 2, y: 400 }
  let heroPos = { x: w / 2, y: 400 }

  const COLS3 = 3
  const plotXY = (i: number) => ({
    x: 70 + (i % COLS3) * 140,
    y: 190 + Math.floor(i / COLS3) * 118,
  })
  const growTime = (p: Plot) => CROPS[p.crop].time * paceMul * (p.watered ? 1 : 2.2)
  const progress = (p: Plot) => p.crop < 0 ? 0 : Math.min(1, (Date.now() - p.plantedAt) / 1000 / growTime(p))

  return {
    w, h,
    serialize(): FarmSave { return { coins, plots, unlockedPlots, totalHarvests } },
    restore(d: unknown) {
      const s = d as FarmSave
      if (!s || !Array.isArray(s.plots)) return
      coins = s.coins; unlockedPlots = s.unlockedPlots; totalHarvests = s.totalHarvests ?? 0
      plots = Array.from({ length: MAX_PLOTS }, (_, i) => s.plots[i] ?? { crop: -1, plantedAt: 0, watered: true, wither: 0 })
      g.toast('Welcome back! Your crops kept growing 🌱')
      g.onScore(coins)
    },
    update(dt) {
      g.onScore(coins) // HUD shows coins
      // hero wanders to the last tapped plot
      heroPos.x += (heroTarget.x - heroPos.x) * Math.min(1, dt * 4)
      heroPos.y += (heroTarget.y - heroPos.y) * Math.min(1, dt * 4)

      // crops get thirsty at 40-70% growth
      for (const p of plots) {
        if (p.crop >= 0 && p.watered && progress(p) > 0.4 && progress(p) < 0.95 && Math.random() < dt * 0.02) p.watered = false
      }
      // sidekick auto-water
      sidekickT -= dt
      if (g.sk && sidekickT <= 0) {
        sidekickT = 20
        const thirsty = plots.findIndex(p => p.crop >= 0 && !p.watered)
        if (thirsty >= 0) {
          plots[thirsty].watered = true
          const xy = plotXY(thirsty)
          g.burst(xy.x, xy.y, '#38bdf8', 12, 140)
          g.toast(`${g.sk.name} watered your ${CROPS[plots[thirsty].crop].name}! ${g.sk.emoji}`)
          g.sfx.pop()
        }
      }

      if (!g.p.justDown) return
      // seed menu?
      if (menuFor >= 0) {
        const my = h - 120
        const idx = Math.floor((g.p.x - 10) / 92)
        if (g.p.y > my - 40 && g.p.y < my + 40 && idx >= 0 && idx < CROPS.length) {
          const crop = CROPS[idx]
          if (coins >= crop.cost) {
            coins -= crop.cost
            plots[menuFor] = { crop: idx, plantedAt: Date.now(), watered: true, wither: 0 }
            g.sfx.pop()
            const xy = plotXY(menuFor)
            g.burst(xy.x, xy.y, '#84cc16', 10, 120)
            const t = plotXY(menuFor); heroTarget = { x: t.x, y: t.y + 40 }
          } else { g.toast(`Need ${crop.cost - coins} more coins!`); g.sfx.hit() }
        }
        menuFor = -1
        return
      }
      // plots
      for (let i = 0; i < MAX_PLOTS; i++) {
        const xy = plotXY(i)
        if (Math.abs(g.p.x - xy.x) > 62 || Math.abs(g.p.y - xy.y) > 52) continue
        heroTarget = { x: xy.x, y: xy.y + 46 }
        if (i >= unlockedPlots) {
          const price = 40 + (i - startPlots) * 45
          if (i === unlockedPlots && coins >= price) {
            coins -= price; unlockedPlots++
            g.toast('New plot unlocked! 🎉'); g.sfx.win()
          } else if (i === unlockedPlots) g.toast(`Unlock for 🪙${price}`)
          return
        }
        const p = plots[i]
        if (p.crop < 0) { menuFor = i; g.sfx.tick(); return }
        if (!p.watered) { p.watered = true; g.burst(xy.x, xy.y, '#38bdf8', 12, 140); g.sfx.pop(); return }
        if (progress(p) >= 1) {
          const crop = CROPS[p.crop]
          coins += crop.sell
          totalHarvests++
          g.addScore(0) // keep HUD synced via onScore above
          plots[i] = { crop: -1, plantedAt: 0, watered: true, wither: 0 }
          g.burst(xy.x, xy.y, '#fde047', 16, 200)
          g.sfx.coin()
          g.toast(`+🪙${crop.sell} ${crop.name}!`)
          if (totalHarvests === 10) g.toast('10 harvests! Your farm is thriving 🌟')
        }
        return
      }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      // farm ground
      c.fillStyle = shade(g.world.tile, -8)
      rr(c, 12, 130, w - 24, 470, 20); c.fill()
      // barn header
      txt(c, `🪙 ${coins}`, 22, 92, 24, '#fde047', 'left')
      txt(c, `🧺 ${totalHarvests} harvests`, w - 20, 92, 15, 'rgba(255,255,255,.7)', 'right')
      // plots
      for (let i = 0; i < MAX_PLOTS; i++) {
        const xy = plotXY(i)
        const locked = i >= unlockedPlots
        c.fillStyle = locked ? 'rgba(0,0,0,.3)' : shade(g.world.tile, -26)
        rr(c, xy.x - 60, xy.y - 46, 120, 96, 12); c.fill()
        c.strokeStyle = 'rgba(0,0,0,.25)'
        rr(c, xy.x - 60, xy.y - 46, 120, 96, 12); c.stroke()
        if (locked) {
          const price = 40 + (i - startPlots) * 45
          txt(c, i === unlockedPlots ? `🔒 ${price}` : '🔒', xy.x, xy.y, 20, 'rgba(255,255,255,.5)')
          continue
        }
        const p = plots[i]
        if (p.crop < 0) { txt(c, '＋', xy.x, xy.y, 30, 'rgba(255,255,255,.35)'); continue }
        const pr = progress(p)
        const crop = CROPS[p.crop]
        // sprout → grown
        const size = 14 + pr * 26
        if (pr >= 1) glow(c, xy.x, xy.y - 6, 40, '#fde047', 0.45 + Math.sin(g.frame * 0.15) * 0.15)
        txt(c, pr < 0.35 ? '🌱' : pr < 1 ? '🌿' : crop.e, xy.x, xy.y - 6, size + (pr >= 1 ? Math.sin(g.frame * 0.15) * 2 : 0))
        // progress bar
        c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, xy.x - 44, xy.y + 30, 88, 8, 4); c.fill()
        c.fillStyle = pr >= 1 ? '#fde047' : '#4ade80'; rr(c, xy.x - 44, xy.y + 30, 88 * pr, 8, 4); c.fill()
        if (!p.watered) txt(c, '💧', xy.x + 42, xy.y - 30, 20 + Math.sin(g.frame * 0.2) * 3)
        if (pr >= 1) txt(c, 'TAP!', xy.x, xy.y + 46, 11, '#fde047')
      }
      // hero + sidekick wandering the farm
      g.hero(heroPos.x, heroPos.y, 54, g.frame)
      if (g.sk) g.sidekick(heroPos.x - 40, heroPos.y - 8, 26)
      // seed menu
      if (menuFor >= 0) {
        const my = h - 120
        c.fillStyle = 'rgba(5,8,25,.92)'
        rr(c, 6, my - 46, w - 12, 92, 16); c.fill()
        CROPS.forEach((crop, i) => {
          const x = 10 + i * 92
          c.fillStyle = coins >= crop.cost ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.06)'
          rr(c, x, my - 38, 86, 76, 12); c.fill()
          txt(c, crop.e, x + 43, my - 14, 24)
          txt(c, `🪙${crop.cost}`, x + 43, my + 12, 12, coins >= crop.cost ? '#fde047' : '#f87171')
          txt(c, `${Math.round(crop.time * paceMul)}s`, x + 43, my + 28, 10, 'rgba(255,255,255,.5)')
        })
      } else {
        txt(c, 'Tip: crops keep growing even after you save & leave!', w / 2, h - 40, 13, 'rgba(255,255,255,.45)')
      }
    },
  }
}
