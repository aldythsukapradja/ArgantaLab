// HORDE RUN — analog of Mob Control / the viral IG zombie-army runners.
// Your crowd of hero-clones auto-runs and auto-fires; steer through math
// gates (×2, +10, −5…) to grow the army, survive zombie waves, beat the
// boss gate. The gates are real arithmetic — sneaky education.

import type { GenreFactory } from '../core'
import { rr, glow, txt } from '../draw'

export const hint = 'Drag left/right to steer your army through the best math gates!'

interface Gate { y: number; left: { label: string; apply: (n: number) => number }; right: { label: string; apply: (n: number) => number }; used: boolean }
interface Zombie { x: number; y: number; hp: number; big: boolean }
interface Shot { x: number; y: number }

export const make: GenreFactory = (g) => {
  const w = 480, h = 720
  const gatesN = g.num('length', 5)
  const mathMode = g.str('math', 'mix')
  const waveN = g.num('zombies', 3)

  let army = 5
  let hx = w / 2
  let scroll = 0
  const SPEED = 190
  let shots: Shot[] = []
  let fireT = 0
  let boss: { hp: number; max: number; y: number } | null = null
  let won = false

  // build the track: alternating gates and zombie packs
  const gates: Gate[] = []
  const zombies: Zombie[] = []
  const segment = 620
  function mkOp(good: boolean): { label: string; apply: (n: number) => number } {
    const roll = mathMode === 'add' ? g.ri(0, 1) : mathMode === 'mult' ? g.ri(2, 3) : g.ri(0, 3)
    if (good) {
      if (roll === 0) { const n = g.ri(4, 15); return { label: `+${n}`, apply: v => v + n } }
      if (roll === 1) { const n = g.ri(2, 6); return { label: `+${n * 2}`, apply: v => v + n * 2 } }
      if (roll === 2) { return { label: '×2', apply: v => v * 2 } }
      return { label: '×3', apply: v => v * 3 }
    } else {
      if (roll === 0) { const n = g.ri(3, 12); return { label: `−${n}`, apply: v => Math.max(1, v - n) } }
      if (roll === 1) { const n = g.ri(2, 8); return { label: `−${n}`, apply: v => Math.max(1, v - n) } }
      return { label: '÷2', apply: v => Math.max(1, Math.floor(v / 2)) }
    }
  }
  for (let i = 0; i < gatesN; i++) {
    const y = -(i + 1) * segment
    const goodLeft = g.rng() < 0.5
    gates.push({ y, left: mkOp(goodLeft), right: mkOp(!goodLeft), used: false })
    // zombie pack between gates
    const packY = y + segment / 2
    const packSize = 3 + i * 2 + waveN
    for (let z = 0; z < packSize; z++)
      zombies.push({ x: 60 + g.rng() * (w - 120), y: packY - g.rng() * 160, hp: 1 + Math.floor(i / 2), big: false })
  }
  const bossY = -(gatesN + 1) * segment
  boss = { hp: 30 + gatesN * 14 + waveN * 8, max: 30 + gatesN * 14 + waveN * 8, y: bossY }

  const armyPositions = (): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = []
    const n = Math.min(army, 40) // cap drawn clones
    for (let i = 0; i < n; i++) {
      const ring = Math.floor((Math.sqrt(i)))
      const a = i * 2.4
      out.push({ x: hx + Math.cos(a) * ring * 17, y: h - 150 + Math.sin(a) * ring * 11 })
    }
    return out
  }

  return {
    w, h,
    update(dt) {
      if (won) return
      // steer
      const a = g.axis()
      hx += a.x * 320 * dt
      if (g.p.down) hx += (g.p.x - hx) * Math.min(1, dt * 10)
      hx = Math.max(50, Math.min(w - 50, hx))

      scroll += SPEED * dt
      g.addScore(Math.max(0, Math.floor(SPEED * dt * 0.03)))

      // auto-fire (bigger army = more bullets); sidekick fires too
      fireT -= dt
      if (fireT <= 0) {
        fireT = Math.max(0.09, 0.3 - army * 0.004)
        const spread = Math.min(army, 6)
        for (let i = 0; i < spread; i++) shots.push({ x: hx + (i - (spread - 1) / 2) * 14, y: h - 170 })
        if (g.sk) shots.push({ x: hx - 46, y: h - 190 })
        g.sfx.tick()
      }
      for (const s of shots) s.y -= 640 * dt

      const worldY = (y: number) => y + scroll + h - 150 // track y → screen y

      // gates
      for (const gate of gates) {
        const sy = worldY(gate.y)
        if (!gate.used && sy > h - 190 && sy < h - 110) {
          gate.used = true
          const side = hx < w / 2 ? gate.left : gate.right
          const before = army
          army = side.apply(army)
          g.sfx[army >= before ? 'coin' : 'hit']()
          g.toast(`${side.label} → army of ${army}!`)
          g.burst(hx, h - 150, army >= before ? '#4ade80' : '#f87171', 18, 220)
        }
      }
      // zombies march down toward the army
      for (const z of zombies) {
        const sy = worldY(z.y)
        if (sy > -40 && sy < h) z.y += 46 * dt
        // shot collisions
        for (const s of shots) {
          if (Math.abs(s.x - z.x) < 20 && Math.abs(s.y - worldY(z.y)) < 22 && z.hp > 0) {
            z.hp--; s.y = -999
            if (z.hp <= 0) { g.addScore(15); g.burst(z.x, sy, '#84cc16', 10, 180); g.sfx.pop() }
          }
        }
        // reach the army: each zombie eats one clone
        if (z.hp > 0 && sy > h - 175 && Math.abs(z.x - hx) < 90) {
          z.hp = 0
          army--
          g.shake(6); g.sfx.hit()
          g.burst(z.x, sy, '#f87171', 12, 200)
          if (army <= 0) return g.gameOver(false, { Gates: gates.filter(x => x.used).length })
        }
      }
      // boss
      if (boss) {
        const sy = worldY(boss.y)
        if (sy > 60) {
          boss.y -= SPEED * dt / 2 // boss holds position ≈ mid-screen
          for (const s of shots) {
            if (Math.abs(s.x - w / 2) < 70 && Math.abs(s.y - sy) < 60) {
              s.y = -999
              boss.hp--
              if (boss.hp % 10 === 0) g.burst(w / 2, sy, '#f97316', 10, 200)
              if (boss.hp <= 0) {
                won = true
                g.addScore(500 + army * 10)
                g.burst(w / 2, sy, '#fde047', 40, 320)
                g.sfx.win()
                return g.gameOver(true, { Army: army, 'Boss HP': boss.max })
              }
            }
          }
          if (sy > h - 210) { army = 0; return g.gameOver(false, { 'Boss HP left': boss.hp }) }
        }
      }
      shots = shots.filter(s => s.y > -60)
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      const worldY = (y: number) => y + scroll + h - 150
      // track
      c.fillStyle = 'rgba(0,0,0,.3)'
      c.fillRect(30, 0, w - 60, h)
      c.strokeStyle = g.world.accent; c.lineWidth = 3
      c.beginPath(); c.moveTo(30, 0); c.lineTo(30, h); c.moveTo(w - 30, 0); c.lineTo(w - 30, h); c.stroke()
      // gates
      for (const gate of gates) {
        const sy = worldY(gate.y)
        if (sy < -80 || sy > h + 40) continue
        const drawSide = (x0: number, label: string) => {
          const good = label.startsWith('+') || label.startsWith('×')
          c.fillStyle = gate.used ? 'rgba(255,255,255,.06)' : good ? 'rgba(74,222,128,.25)' : 'rgba(248,113,113,.25)'
          rr(c, x0, sy - 40, (w - 60) / 2 - 8, 80, 12); c.fill()
          c.strokeStyle = good ? '#4ade80' : '#f87171'; c.lineWidth = 2
          rr(c, x0, sy - 40, (w - 60) / 2 - 8, 80, 12); c.stroke()
          txt(c, label, x0 + (w - 60) / 4 - 4, sy, 34, gate.used ? 'rgba(255,255,255,.25)' : '#fff')
        }
        drawSide(34, gate.left.label)
        drawSide(w / 2 + 4, gate.right.label)
      }
      // zombies
      for (const z of zombies) {
        if (z.hp <= 0) continue
        const sy = worldY(z.y)
        if (sy < -30 || sy > h + 30) continue
        const wob = Math.sin(g.frame * 0.2 + z.x) * 2
        c.fillStyle = '#65a30d'
        rr(c, z.x - 11, sy - 16 + wob, 22, 30, 8); c.fill()
        c.fillStyle = '#84cc16'
        c.beginPath(); c.arc(z.x, sy - 22 + wob, 9, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#1e293b'
        c.fillRect(z.x - 4, sy - 25 + wob, 2.5, 2.5); c.fillRect(z.x + 2, sy - 25 + wob, 2.5, 2.5)
      }
      // boss
      if (boss && boss.hp > 0) {
        const sy = worldY(boss.y)
        if (sy > -80 && sy < h + 60) {
          glow(c, w / 2, sy, 100, '#f97316', 0.3)
          c.fillStyle = '#4d7c0f'
          rr(c, w / 2 - 60, sy - 50, 120, 100, 20); c.fill()
          c.fillStyle = '#84cc16'
          c.beginPath(); c.arc(w / 2, sy - 58, 30, 0, Math.PI * 2); c.fill()
          c.fillStyle = '#1e293b'
          c.fillRect(w / 2 - 14, sy - 64, 8, 8); c.fillRect(w / 2 + 6, sy - 64, 8, 8)
          // hp bar
          c.fillStyle = 'rgba(0,0,0,.5)'; rr(c, w / 2 - 70, sy - 100, 140, 12, 6); c.fill()
          c.fillStyle = '#f87171'; rr(c, w / 2 - 70, sy - 100, 140 * (boss.hp / boss.max), 12, 6); c.fill()
          txt(c, 'BOSS', w / 2, sy - 116, 16, '#fca5a5')
        }
      }
      // shots
      c.fillStyle = '#fde047'
      for (const s of shots) rr(c, s.x - 2, s.y - 7, 4, 14, 2), c.fill()
      // the army: clones of YOU
      const pos = armyPositions()
      for (let i = pos.length - 1; i >= 0; i--) g.hero(pos[i].x, pos[i].y, i === 0 ? 46 : 34, g.frame + i * 3)
      if (g.sk) g.sidekick(hx - 52, h - 176, 28)
      // army counter
      glow(c, hx, h - 210, 40, g.world.glow, 0.3)
      txt(c, `${army}`, hx, h - 214, 30, '#fff')
    },
  }
}
