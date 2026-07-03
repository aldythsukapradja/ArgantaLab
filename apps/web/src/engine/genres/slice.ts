// SLICE STORM — analog of Fruit Ninja.
// Fruit arcs up, swipe to slice, bombs end the run (sidekick 'bomb'
// or 'shield' powers soften that). Combo multipliers for multi-slices.

import type { GenreFactory } from '../core'
import { glow, txt, emoji } from '../draw'

export const hint = 'Swipe through the fruit! Never slice a bomb.'

const FRUIT = [
  { e: '🍉', color: '#f43f5e', pts: 10 }, { e: '🍊', color: '#fb923c', pts: 10 },
  { e: '🍋', color: '#facc15', pts: 10 }, { e: '🍇', color: '#a855f7', pts: 15 },
  { e: '🍓', color: '#ef4444', pts: 15 }, { e: '🥝', color: '#84cc16', pts: 20 },
]

interface Thing { x: number; y: number; vx: number; vy: number; r: number; e: string; color: string; pts: number; bomb: boolean; sliced: boolean; spin: number; a: number }
interface Half { x: number; y: number; vx: number; vy: number; e: string; a: number; va: number; life: number }

export const make: GenreFactory = (g) => {
  const w = 480, h = 720
  const gravity = 260 + g.num('gravity', 3) * 90
  const perWave = g.num('spawn', 3)
  const bombPct = g.num('bombs', 12) / 100
  let things: Thing[] = []
  let halves: Half[] = []
  let trail: { x: number; y: number; t: number }[] = []
  let lives = 3
  let combo = 0, comboT = 0
  let waveT = 1
  let bombSaves = g.sk && (g.sk.power === 'bomb' || g.sk.power === 'shield') ? 1 : 0
  let doubleT = 0

  function spawnWave() {
    const n = perWave + (g.score > 300 ? 1 : 0) + (g.score > 800 ? 1 : 0)
    for (let i = 0; i < n; i++) {
      const bomb = Math.random() < bombPct
      const f = FRUIT[Math.floor(Math.random() * FRUIT.length)]
      things.push({
        x: 60 + Math.random() * (w - 120), y: h + 40,
        vx: (Math.random() - 0.5) * 240,
        vy: -(620 + Math.random() * 220),
        r: 34, e: bomb ? '💣' : f.e, color: bomb ? '#334155' : f.color,
        pts: f.pts, bomb, sliced: false, spin: (Math.random() - 0.5) * 6, a: 0,
      })
    }
  }

  return {
    w, h,
    update(dt) {
      waveT -= dt
      if (waveT <= 0) { spawnWave(); waveT = 1.6 + Math.random() * 0.9 }
      comboT -= dt
      if (comboT <= 0) combo = 0
      doubleT = Math.max(0, doubleT - dt)

      // blade trail
      if (g.p.down) trail.push({ x: g.p.x, y: g.p.y, t: 0.18 })
      for (const t of trail) t.t -= dt
      trail = trail.filter(t => t.t > 0)

      const swiping = g.p.down && Math.hypot(g.p.vx, g.p.vy) > 350

      for (const t of things) {
        t.x += t.vx * dt; t.y += t.vy * dt; t.vy += gravity * dt; t.a += t.spin * dt
        if (swiping && !t.sliced && Math.hypot(g.p.x - t.x, g.p.y - t.y) < t.r + 14) {
          t.sliced = true
          if (t.bomb) {
            if (bombSaves > 0) {
              bombSaves--
              g.toast(`${g.sk!.name} flicked the bomb away! ${g.sk!.emoji}`)
              g.burst(t.x, t.y, g.sk!.color, 20, 220)
              g.sfx.zap()
            } else {
              g.shake(14, 0.5); g.sfx.boom()
              g.burst(t.x, t.y, '#f97316', 30, 320)
              lives = 0
              return g.gameOver(false, { 'Best combo': `x${Math.max(1, combo)}` })
            }
          } else {
            combo++; comboT = 0.8
            const mult = (combo >= 3 ? 2 : 1) * (doubleT > 0 ? 2 : 1)
            g.addScore(t.pts * mult)
            g.sfx.pop()
            g.burst(t.x, t.y, t.color, 14, 240)
            halves.push(
              { x: t.x - 10, y: t.y, vx: -140 + (Math.random() - 0.5) * 60, vy: t.vy * 0.4, e: t.e, a: 0, va: -5, life: 1 },
              { x: t.x + 10, y: t.y, vx: 140 + (Math.random() - 0.5) * 60, vy: t.vy * 0.4, e: t.e, a: 0, va: 5, life: 1 },
            )
            if (combo === 3) g.toast('Combo x2! 🔥')
            if (g.sk?.power === 'double' && combo === 5 && doubleT <= 0) { doubleT = 6; g.toast(`${g.sk.name} doubles your points! ${g.sk.emoji}`) }
          }
        }
      }
      // missed fruit costs a life
      for (const t of things) {
        if (!t.sliced && !t.bomb && t.y > h + 60 && t.vy > 0) {
          t.sliced = true
          lives--
          g.sfx.hit()
          if (lives <= 0) return g.gameOver(false, { 'Best combo': `x${Math.max(1, combo)}` })
        }
      }
      things = things.filter(t => !(t.sliced || (t.y > h + 80 && t.vy > 0)))
      for (const hf of halves) { hf.x += hf.vx * dt; hf.y += hf.vy * dt; hf.vy += gravity * dt; hf.a += hf.va * dt; hf.life -= dt }
      halves = halves.filter(hf => hf.life > 0)
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      // dojo floor glow
      glow(c, w / 2, h * 0.9, 260, g.world.accent, 0.18)
      // hero stands at the bottom, cheering your slices
      g.hero(60, h - 60, 64, g.frame)
      if (g.sk) g.sidekick(120, h - 66, 34)
      // halves
      for (const hf of halves) {
        c.save(); c.translate(hf.x, hf.y); c.rotate(hf.a); c.globalAlpha = Math.max(0, hf.life)
        emoji(c, hf.e, 0, 0, 40); c.restore()
      }
      // fruit
      for (const t of things) {
        c.save(); c.translate(t.x, t.y); c.rotate(t.a)
        if (t.bomb) { glow(c, 0, 0, 46, '#f87171', 0.4 + Math.sin(g.frame * 0.3) * 0.15) }
        emoji(c, t.e, 0, 0, 56)
        c.restore()
      }
      // blade trail
      if (trail.length > 1) {
        c.strokeStyle = '#fff'; c.lineCap = 'round'
        for (let i = 1; i < trail.length; i++) {
          c.globalAlpha = trail[i].t / 0.18 * 0.9
          c.lineWidth = 2 + (i / trail.length) * 7
          c.beginPath(); c.moveTo(trail[i - 1].x, trail[i - 1].y); c.lineTo(trail[i].x, trail[i].y); c.stroke()
        }
        c.globalAlpha = 1
      }
      // lives + combo
      for (let i = 0; i < 3; i++) txt(c, i < lives ? '❤️' : '🖤', w - 30 - i * 30, 84, 20)
      if (combo >= 3) txt(c, `COMBO x${combo}`, w / 2, 100, 26, '#fbbf24')
      if (doubleT > 0) txt(c, '⭐ DOUBLE POINTS ⭐', w / 2, 130, 16, '#fde047')
      if (bombSaves > 0 && g.sk) txt(c, `${g.sk.emoji} bomb-save ready`, 90, h - 110, 13, 'rgba(255,255,255,.6)')
    },
  }
}
