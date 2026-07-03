// SKY ACE — analog of Galaga with a visible upgrade tree.
// Clear waves to evolve your ship through 3 tiers along the chosen
// path (guns / speed / tank). Sidekick 'zap' pot-shots one enemy a wave.

import type { GenreFactory } from '../core'
import { rr, glow, txt, shade } from '../draw'

export const hint = 'Move with ← → or drag. You fire automatically — clear every wave!'

interface Foe { x: number; y: number; hp: number; row: number; col: number; alive: boolean }
interface Shot { x: number; y: number; vy: number; mine: boolean }

export const make: GenreFactory = (g) => {
  const w = 480, h = 720
  const wavesToWin = g.num('waves', 5)
  const tree = g.str('tree', 'guns') // guns | speed | tank
  const foeSpeedMul = 0.7 + g.num('enemySpeed', 3) * 0.18

  let tier = 0 // 0..2, upgrades at wave 1/3 thirds
  let wave = 1
  let hx = w / 2
  let hp = tree === 'tank' ? 5 : 3
  const maxHp = () => (tree === 'tank' ? 5 + tier * 2 : 3 + (tree === 'tank' ? tier : 0))
  let foes: Foe[] = []
  let shots: Shot[] = []
  let fireT = 0
  let dir = 1
  let descend = 0
  let zapT = 0
  let stars = Array.from({ length: 40 }, () => ({ x: Math.random() * w, y: Math.random() * h, s: 0.5 + Math.random() * 1.8 }))

  function spawnWave() {
    foes = []
    const rows = 3 + Math.min(2, Math.floor(wave / 2)), cols = 7
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      foes.push({ x: 70 + c * 56, y: 80 + r * 48, hp: 1 + Math.floor(wave / 3), row: r, col: c, alive: true })
    dir = 1
    zapT = 1.5
    if (wave > 1) { g.toast(`Wave ${wave}!`); g.sfx.coin() }
    // upgrade points
    const newTier = Math.min(2, Math.floor(((wave - 1) / Math.max(1, wavesToWin - 1)) * 3))
    if (newTier > tier) {
      tier = newTier
      hp = Math.min(maxHp(), hp + 2)
      g.toast(`✨ SHIP EVOLVED — Tier ${tier + 1} ${tree === 'guns' ? 'guns' : tree === 'speed' ? 'thrusters' : 'armor'}!`)
      g.sfx.win()
      g.burst(hx, h - 110, '#fde047', 26, 260)
    }
  }
  spawnWave()

  const moveSpeed = () => 300 + (tree === 'speed' ? tier * 130 : 0) + 40
  const fireRate = () => 0.5 - (tree === 'guns' ? tier * 0.1 : 0) - (tree === 'speed' ? tier * 0.04 : 0)

  return {
    w, h,
    update(dt) {
      // movement
      const a = g.axis()
      hx += a.x * moveSpeed() * dt
      if (g.p.down) hx += (g.p.x - hx) * Math.min(1, dt * 12)
      hx = Math.max(30, Math.min(w - 30, hx))

      // auto-fire
      fireT -= dt
      if (fireT <= 0) {
        fireT = fireRate()
        g.sfx.tick()
        shots.push({ x: hx, y: h - 130, vy: -560, mine: true })
        if (tree === 'guns' && tier >= 1) { shots.push({ x: hx - 16, y: h - 120, vy: -560, mine: true }); shots.push({ x: hx + 16, y: h - 120, vy: -560, mine: true }) }
        if (tree === 'guns' && tier >= 2) { shots.push({ x: hx - 30, y: h - 112, vy: -520, mine: true }) ; shots.push({ x: hx + 30, y: h - 112, vy: -520, mine: true }) }
      }

      // sidekick zap: one enemy per wave
      if (g.sk?.power === 'zap' && zapT > 0) {
        zapT -= dt
        if (zapT <= 0) {
          const alive = foes.filter(f => f.alive)
          if (alive.length) {
            const f = alive[Math.floor(Math.random() * alive.length)]
            f.alive = false
            g.addScore(30); g.sfx.zap()
            g.burst(f.x, f.y, g.sk.color, 18, 220)
            g.toast(`${g.sk.name} zapped one! ${g.sk.emoji}`)
          }
        }
      }

      // formation march
      const alive = foes.filter(f => f.alive)
      if (!alive.length) {
        wave++
        if (wave > wavesToWin) return g.gameOver(true, { Waves: wavesToWin, Ship: `Tier ${tier + 1}` })
        spawnWave(); return
      }
      const minX = Math.min(...alive.map(f => f.x)), maxX = Math.max(...alive.map(f => f.x))
      const speed = (40 + wave * 8) * foeSpeedMul
      let drop = 0
      if ((dir > 0 && maxX > w - 40) || (dir < 0 && minX < 40)) { dir *= -1; drop = 14 }
      for (const f of foes) { f.x += dir * speed * dt; f.y += drop; f.y += descend * dt }
      // enemy fire
      if (Math.random() < dt * (0.5 + wave * 0.15)) {
        const shooter = alive[Math.floor(Math.random() * alive.length)]
        shots.push({ x: shooter.x, y: shooter.y + 16, vy: 240 * foeSpeedMul, mine: false })
      }
      // reach bottom = lose
      if (alive.some(f => f.y > h - 170)) return g.gameOver(false, { Wave: wave })

      // shots
      for (const s of shots) s.y += s.vy * dt
      for (const s of shots) {
        if (s.mine) {
          for (const f of foes) {
            if (f.alive && Math.abs(f.x - s.x) < 22 && Math.abs(f.y - s.y) < 20) {
              f.hp--; s.y = -999
              if (f.hp <= 0) { f.alive = false; g.addScore(20 + wave * 5); g.sfx.pop(); g.burst(f.x, f.y, g.world.accent, 12, 200) }
            }
          }
        } else if (Math.abs(s.x - hx) < 24 && Math.abs(s.y - (h - 110)) < 24) {
          s.y = h + 999
          hp--
          g.shake(8); g.sfx.hit()
          if (hp <= 0) return g.gameOver(false, { Wave: wave, Ship: `Tier ${tier + 1}` })
        }
      }
      shots = shots.filter(s => s.y > -40 && s.y < h + 40)
      for (const st of stars) { st.y += st.s * 60 * dt; if (st.y > h) { st.y = -4; st.x = Math.random() * w } }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      c.fillStyle = 'rgba(255,255,255,.7)'
      for (const st of stars) c.fillRect(st.x, st.y, st.s, st.s * 2)
      // foes
      for (const f of foes) {
        if (!f.alive) continue
        const wob = Math.sin(g.frame * 0.1 + f.col) * 3
        c.fillStyle = shade(g.world.accent, -20 + f.row * 18)
        rr(c, f.x - 16, f.y - 12 + wob, 32, 24, 8); c.fill()
        c.fillStyle = '#fff'
        c.fillRect(f.x - 8, f.y - 4 + wob, 5, 5); c.fillRect(f.x + 3, f.y - 4 + wob, 5, 5)
      }
      // shots
      for (const s of shots) {
        c.fillStyle = s.mine ? '#fde047' : '#f87171'
        rr(c, s.x - 2.5, s.y - 8, 5, 16, 2.5); c.fill()
      }
      // ship — evolves visually with tier
      const sy = h - 110
      glow(c, hx, sy + 18, 34 + tier * 8, g.look.a, 0.5)
      c.fillStyle = g.look.b
      c.beginPath(); c.moveTo(hx, sy - 26 - tier * 6); c.lineTo(hx + 24 + tier * 7, sy + 22); c.lineTo(hx - 24 - tier * 7, sy + 22); c.closePath(); c.fill()
      c.fillStyle = g.look.a
      c.beginPath(); c.moveTo(hx, sy - 14 - tier * 4); c.lineTo(hx + 13 + tier * 4, sy + 18); c.lineTo(hx - 13 - tier * 4, sy + 18); c.closePath(); c.fill()
      if (tier >= 1) { c.fillStyle = shade(g.look.a, 50); rr(c, hx - 34 - tier * 4, sy + 4, 12, 18, 4); c.fill(); rr(c, hx + 22 + tier * 4, sy + 4, 12, 18, 4); c.fill() }
      if (tier >= 2) glow(c, hx, sy + 30, 26, '#38bdf8', 0.8)
      // pilot = you
      g.hero(hx, sy - 4, 30, g.frame)
      if (g.sk) g.sidekick(hx - 52, sy - 12, 24)
      // HP + wave + tier chips
      for (let i = 0; i < maxHp(); i++) txt(c, i < hp ? '❤️' : '🖤', 24 + i * 24, h - 24, 16, undefined, 'left')
      txt(c, `Wave ${wave}/${wavesToWin}`, w - 16, h - 24, 15, 'rgba(255,255,255,.75)', 'right')
      txt(c, `${['◈', '◈◈', '◈◈◈'][tier]} ${tree.toUpperCase()}`, w - 16, h - 46, 12, g.world.glow, 'right')
    },
  }
}
