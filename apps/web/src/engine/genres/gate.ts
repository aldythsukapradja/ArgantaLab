// KEEP THE GATE — analog of Bloons TD (compact tower defense).
// Seeded winding path, three tower types, wave economy. Sidekick
// patrols the path as a free damage aura.

import type { GenreFactory } from '../core'
import { rr, glow, txt, shade } from '../draw'

export const hint = 'Tap a pad to build. Hold the gate through every wave!'

const CELL = 48
const COLS = 10, ROWS = 11

interface Tower { x: number; y: number; kind: 0 | 1 | 2; cd: number; level: number }
interface Foe { d: number; hp: number; max: number; speed: number; slow: number }
interface Shot { x: number; y: number; tx: number; ty: number; t: number; foe: Foe; dmg: number }

const TOWERS = [
  { name: 'Archer', emoji: '🏹', cost: 40, dmg: 6, range: 130, rate: 0.7 },
  { name: 'Cannon', emoji: '💥', cost: 70, dmg: 16, range: 110, rate: 1.5 },
  { name: 'Frost',  emoji: '❄️', cost: 55, dmg: 3, range: 120, rate: 1.0 },
]

export const make: GenreFactory = (g) => {
  const top = 60
  const w = COLS * CELL, h = ROWS * CELL + top + 80
  const wavesToWin = g.num('waves', 8)
  let gold = g.num('gold', 100)
  let lives = g.num('lives', 5)

  // ── seeded snake path down the board ──
  const path: { x: number; y: number }[] = []
  let px = 0, py = 1, dir = 1
  path.push({ x: px, y: py })
  while (py < ROWS - 1) {
    while ((dir > 0 && px < COLS - 1) || (dir < 0 && px > 0)) { px += dir; path.push({ x: px, y: py }) }
    const down = g.ri(1, 2)
    for (let i = 0; i < down && py < ROWS - 1; i++) { py++; path.push({ x: px, y: py }) }
    dir *= -1
  }
  const onPath = (x: number, y: number) => path.some(p => p.x === x && p.y === y)
  const pathXY = (d: number): { x: number; y: number; done: boolean } => {
    const i = Math.floor(d), f = d - i
    if (i >= path.length - 1) return { x: path[path.length - 1].x * CELL + CELL / 2, y: top + path[path.length - 1].y * CELL + CELL / 2, done: true }
    const a = path[i], b = path[i + 1]
    return { x: (a.x + (b.x - a.x) * f) * CELL + CELL / 2, y: top + (a.y + (b.y - a.y) * f) * CELL + CELL / 2, done: false }
  }

  // build pads = non-path cells adjacent to path
  const pads: { x: number; y: number }[] = []
  for (let y = 1; y < ROWS - 1; y++) for (let x = 0; x < COLS; x++) {
    if (onPath(x, y)) continue
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => onPath(x + dx, y + dy))) pads.push({ x, y })
  }

  let towers: Tower[] = []
  let foes: Foe[] = []
  let shots: Shot[] = []
  let wave = 0
  let waveT = 2.5
  let spawning = 0
  let spawnT = 0
  let picking: { x: number; y: number } | null = null
  // sidekick patrol
  let patrolD = 0

  function startWave() {
    wave++
    spawning = 4 + wave * 2
    spawnT = 0
    g.toast(`Wave ${wave} incoming! 🌊`)
    g.sfx.hit()
  }

  return {
    w, h,
    update(dt) {
      // wave pacing
      if (spawning <= 0 && foes.length === 0) {
        if (wave >= wavesToWin) return g.gameOver(true, { Lives: lives, Towers: towers.length })
        waveT -= dt
        if (waveT <= 0) { waveT = 3; startWave() }
      }
      if (spawning > 0) {
        spawnT -= dt
        if (spawnT <= 0) {
          spawnT = Math.max(0.35, 0.9 - wave * 0.05)
          spawning--
          const hp = 14 + wave * 8
          foes.push({ d: 0, hp, max: hp, speed: 1.6 + wave * 0.12, slow: 0 })
        }
      }
      // input: tap a pad → build menu; tap menu option → build
      if (g.p.justDown) {
        const gx = Math.floor(g.p.x / CELL), gy = Math.floor((g.p.y - top) / CELL)
        if (picking) {
          // menu row under the board
          const my = ROWS * CELL + top + 40
          if (Math.abs(g.p.y - my) < 36) {
            const idx = Math.floor((g.p.x - (w / 2 - 180)) / 120)
            if (idx >= 0 && idx < 3) {
              const t = TOWERS[idx]
              if (gold >= t.cost) {
                gold -= t.cost
                towers.push({ x: picking.x, y: picking.y, kind: idx as 0 | 1 | 2, cd: 0, level: 1 })
                g.sfx.coin()
                g.burst(picking.x * CELL + CELL / 2, top + picking.y * CELL + CELL / 2, g.world.accent, 12, 160)
              } else { g.toast(`Need ${t.cost - gold} more gold!`); g.sfx.hit() }
            }
          }
          picking = null
        } else if (pads.some(p => p.x === gx && p.y === gy) && !towers.some(t => t.x === gx && t.y === gy)) {
          picking = { x: gx, y: gy }
          g.sfx.tick()
        }
      }

      // towers fire
      for (const t of towers) {
        t.cd -= dt
        if (t.cd > 0) continue
        const def = TOWERS[t.kind]
        const tx = t.x * CELL + CELL / 2, ty = top + t.y * CELL + CELL / 2
        let best: Foe | null = null, bestD = -1
        for (const f of foes) {
          const p = pathXY(f.d)
          if (Math.hypot(p.x - tx, p.y - ty) <= def.range && f.d > bestD) { best = f; bestD = f.d }
        }
        if (best) {
          t.cd = def.rate
          const p = pathXY(best.d)
          shots.push({ x: tx, y: ty, tx: p.x, ty: p.y, t: 0, foe: best, dmg: def.dmg })
          if (t.kind === 2) best.slow = 1.6
          g.sfx.tick()
        }
      }
      // shots travel
      for (const s of shots) {
        s.t += dt * 6
        if (s.t >= 1) {
          s.foe.hp -= s.dmg
          const p = pathXY(s.foe.d)
          g.burst(p.x, p.y, g.world.accent, 5, 120)
        }
      }
      shots = shots.filter(s => s.t < 1)

      // sidekick patrol aura
      if (g.sk) {
        patrolD = (patrolD + dt * 2.4) % path.length
        const pp = pathXY(patrolD)
        for (const f of foes) {
          const p = pathXY(f.d)
          if (Math.hypot(p.x - pp.x, p.y - pp.y) < 54) f.hp -= 5 * dt
        }
      }

      // foes advance
      for (const f of foes) {
        f.slow = Math.max(0, f.slow - dt)
        f.d += f.speed * (f.slow > 0 ? 0.45 : 1) * dt
        const p = pathXY(f.d)
        if (p.done) {
          f.hp = 0
          lives--
          g.shake(10); g.sfx.boom()
          if (lives <= 0) return g.gameOver(false, { Wave: wave })
          g.toast(`The gate took a hit! ❤️×${lives}`)
        }
      }
      const dead = foes.filter(f => f.hp <= 0 && f.d < path.length)
      for (const f of dead) {
        if (f.max) { gold += 8 + Math.floor(wave / 2); g.addScore(20) }
      }
      foes = foes.filter(f => f.hp > 0)
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      // grass board
      c.fillStyle = 'rgba(0,0,0,.22)'
      c.fillRect(0, top, w, ROWS * CELL)
      // path
      for (const p of path) {
        c.fillStyle = shade(g.world.tile, 26)
        rr(c, p.x * CELL + 2, top + p.y * CELL + 2, CELL - 4, CELL - 4, 6); c.fill()
      }
      // gate at path end
      const end = path[path.length - 1]
      txt(c, '🏰', end.x * CELL + CELL / 2, top + end.y * CELL + CELL / 2, 40)
      // pads
      for (const p of pads) {
        if (towers.some(t => t.x === p.x && t.y === p.y)) continue
        c.strokeStyle = picking && picking.x === p.x && picking.y === p.y ? g.world.glow : 'rgba(255,255,255,.14)'
        c.setLineDash([4, 4])
        rr(c, p.x * CELL + 6, top + p.y * CELL + 6, CELL - 12, CELL - 12, 8); c.stroke()
        c.setLineDash([])
      }
      // towers
      for (const t of towers) {
        const def = TOWERS[t.kind]
        const tx = t.x * CELL + CELL / 2, ty = top + t.y * CELL + CELL / 2
        c.fillStyle = g.world.tile
        rr(c, tx - 18, ty - 18, 36, 36, 10); c.fill()
        txt(c, def.emoji, tx, ty, 22)
      }
      // shots
      for (const s of shots) {
        const x = s.x + (s.tx - s.x) * s.t, y = s.y + (s.ty - s.y) * s.t
        c.fillStyle = '#fde047'
        c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill()
      }
      // foes
      for (const f of foes) {
        const p = pathXY(f.d)
        const r = 13 + (f.max > 60 ? 4 : 0)
        c.fillStyle = f.slow > 0 ? '#7dd3fc' : '#f43f5e'
        c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#fff'
        c.beginPath(); c.arc(p.x - 4, p.y - 3, 3, 0, Math.PI * 2); c.arc(p.x + 4, p.y - 3, 3, 0, Math.PI * 2); c.fill()
        c.fillStyle = 'rgba(0,0,0,.5)'; rr(c, p.x - 14, p.y - r - 9, 28, 5, 2.5); c.fill()
        c.fillStyle = '#4ade80'; rr(c, p.x - 14, p.y - r - 9, 28 * Math.max(0, f.hp / f.max), 5, 2.5); c.fill()
      }
      // sidekick patrols
      if (g.sk) {
        const pp = pathXY(patrolD)
        glow(c, pp.x, pp.y, 54, g.sk.color, 0.22)
        g.sidekick(pp.x, pp.y, 26)
      }
      // hero commander at the gate
      g.hero(end.x * CELL + CELL / 2 - 40, top + end.y * CELL + CELL / 2, 44, g.frame)
      // HUD: gold/lives/wave + build menu
      txt(c, `🪙 ${gold}`, 14, top - 26, 17, '#fde047', 'left')
      txt(c, `❤️ ${lives}`, w / 2, top - 26, 17, '#fca5a5')
      txt(c, `Wave ${wave}/${wavesToWin}`, w - 14, top - 26, 15, 'rgba(255,255,255,.75)', 'right')
      const my = ROWS * CELL + top + 40
      if (picking) {
        TOWERS.forEach((t, i) => {
          const x = w / 2 - 180 + i * 120
          c.fillStyle = gold >= t.cost ? 'rgba(99,102,241,.8)' : 'rgba(255,255,255,.07)'
          rr(c, x, my - 32, 112, 64, 12); c.fill()
          txt(c, `${t.emoji} ${t.name}`, x + 56, my - 12, 14)
          txt(c, `🪙 ${t.cost}`, x + 56, my + 12, 13, gold >= t.cost ? '#fde047' : '#f87171')
        })
      } else {
        txt(c, spawning > 0 || foes.length ? 'Defend! Tap a pad to build more.' : `Next wave in ${Math.ceil(waveT)}…`, w / 2, my, 15, 'rgba(255,255,255,.6)')
      }
    },
  }
}
