// BLAST MAZE — analog of Bomberman / Dyna Blaster.
// Grid arena, soft blocks hide power-ups, bombs chain, critters roam.
// Clear all critters to win. Sidekick 'scout' reveals hidden power-ups.

import type { GenreFactory } from '../core'
import { rr, glow, txt, shade } from '../draw'

export const hint = 'Arrows/swipe to move, Space or tap Hero to drop a bomb!'

const CELL = 34
const COLS = 13, ROWS = 13

type Tile = 0 | 1 | 2 // 0 floor, 1 hard wall, 2 soft block

export const make: GenreFactory = (g) => {
  const top = 60
  const w = COLS * CELL, h = ROWS * CELL + top
  const enemyN = g.num('enemies', 3)
  let blastReach = g.num('blast', 2)
  const density = g.num('density', 65) / 100

  const map: Tile[][] = []
  for (let y = 0; y < ROWS; y++) {
    const row: Tile[] = []
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0)) row.push(1)
      else row.push(g.rng() < density ? 2 : 0)
    }
    map.push(row)
  }
  // clear spawn corner
  for (const [x, y] of [[1, 1], [2, 1], [1, 2]]) map[y][x] = 0
  // hidden power-ups under some soft blocks
  const powerUnder = new Map<string, 'blast' | 'bomb' | 'speed'>()
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++)
    if (map[y][x] === 2 && g.rng() < 0.18) powerUnder.set(`${x},${y}`, (['blast', 'bomb', 'speed'] as const)[g.ri(0, 2)])
  const powerShown = new Map<string, 'blast' | 'bomb' | 'speed'>()

  const hero = { x: 1, y: 1, px: 1, py: 1, t: 1, dir: { x: 0, y: 0 }, speed: 4.4 }
  let maxBombs = 1
  interface Bomb { x: number; y: number; t: number }
  interface Fire { x: number; y: number; t: number }
  interface Foe { x: number; y: number; px: number; py: number; t: number; dir: { x: number; y: number }; alive: boolean }
  let bombs: Bomb[] = []
  let fires: Fire[] = []
  const foes: Foe[] = []
  for (let i = 0; i < enemyN; i++) {
    let fx = 0, fy = 0
    do { fx = g.ri(4, COLS - 2); fy = g.ri(4, ROWS - 2) } while (map[fy][fx] !== 0)
    foes.push({ x: fx, y: fy, px: fx, py: fy, t: 0, dir: { x: 1, y: 0 }, alive: true })
  }

  const walkable = (x: number, y: number) =>
    x >= 0 && x < COLS && y >= 0 && y < ROWS && map[y][x] === 0 && !bombs.some(b => b.x === x && b.y === y)

  function explode(b: Bomb) {
    g.sfx.boom(); g.shake(9, 0.35)
    const cells: [number, number][] = [[b.x, b.y]]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 1; i <= blastReach; i++) {
        const x = b.x + dx * i, y = b.y + dy * i
        if (map[y]?.[x] === 1) break
        cells.push([x, y])
        if (map[y]?.[x] === 2) {
          map[y][x] = 0
          g.addScore(10)
          const pu = powerUnder.get(`${x},${y}`)
          if (pu) { powerShown.set(`${x},${y}`, pu); powerUnder.delete(`${x},${y}`) }
          break
        }
      }
    }
    for (const [x, y] of cells) {
      fires.push({ x, y, t: 0.5 })
      g.burst(x * CELL + CELL / 2, top + y * CELL + CELL / 2, '#fb923c', 8, 200)
      // chain other bombs
      const chained = bombs.find(ob => ob !== b && ob.x === x && ob.y === y && ob.t > 0.05)
      if (chained) chained.t = 0.05
    }
  }

  function stepGrid(a: { x: number; y: number; px: number; py: number; t: number; dir: { x: number; y: number } }, speed: number, choose: () => void, dt: number) {
    a.t += speed * dt
    while (a.t >= 1) {
      a.t -= 1; a.px = a.x; a.py = a.y
      choose()
      if (walkable(a.x + a.dir.x, a.y + a.dir.y)) { a.x += a.dir.x; a.y += a.dir.y } else a.t = 1
      if (a.t === 1) break
    }
  }

  let want = { x: 0, y: 0 }

  return {
    w, h,
    update(dt) {
      const a = g.axis()
      if (a.x || a.y) want = Math.abs(a.x) >= Math.abs(a.y) ? { x: Math.sign(a.x), y: 0 } : { x: 0, y: Math.sign(a.y) }
      else if (g.p.down && Math.hypot(g.p.dx, g.p.dy) > 30) {
        const { dx, dy } = g.p
        want = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }
      } else if (!g.p.down) want = { x: 0, y: 0 }

      // drop bomb: space, or tap on/near hero
      const hpx = hero.x * CELL + CELL / 2, hpy = top + hero.y * CELL + CELL / 2
      const tapOnHero = g.p.justDown && Math.hypot(g.p.x - hpx, g.p.y - hpy) < CELL * 1.4
      if ((g.hit(' ') || tapOnHero) && bombs.length < maxBombs && !bombs.some(b => b.x === hero.x && b.y === hero.y)) {
        bombs.push({ x: hero.x, y: hero.y, t: 2.2 })
        g.sfx.tick()
      }

      stepGrid(hero, hero.speed, () => { if (want.x || want.y) hero.dir = { ...want }; else hero.dir = { x: 0, y: 0 }; if (!hero.dir.x && !hero.dir.y) hero.t = 1 }, dt)
      // pick up power-ups
      const key = `${hero.x},${hero.y}`
      const pu = powerShown.get(key)
      if (pu) {
        powerShown.delete(key)
        g.sfx.coin(); g.addScore(50)
        if (pu === 'blast') { blastReach++; g.toast('🔥 Bigger blast!') }
        if (pu === 'bomb') { maxBombs++; g.toast('💣 Extra bomb!') }
        if (pu === 'speed') { hero.speed += 0.9; g.toast('👟 Speed up!') }
      }

      // bombs & fire
      for (const b of bombs) b.t -= dt
      const exploding = bombs.filter(b => b.t <= 0)
      bombs = bombs.filter(b => b.t > 0)
      for (const b of exploding) explode(b)
      for (const f of fires) f.t -= dt
      fires = fires.filter(f => f.t > 0)

      // fire kills
      const heroGX = hero.px + (hero.x - hero.px) * hero.t, heroGY = hero.py + (hero.y - hero.py) * hero.t
      if (fires.some(f => Math.hypot(f.x - heroGX, f.y - heroGY) < 0.6)) {
        return g.gameOver(false, { 'Critters left': foes.filter(f => f.alive).length })
      }
      for (const foe of foes) {
        if (!foe.alive) continue
        const gx = foe.px + (foe.x - foe.px) * foe.t, gy = foe.py + (foe.y - foe.py) * foe.t
        if (fires.some(f => Math.hypot(f.x - gx, f.y - gy) < 0.6)) {
          foe.alive = false
          g.addScore(100); g.sfx.coin()
          g.burst(gx * CELL + CELL / 2, top + gy * CELL + CELL / 2, g.world.accent, 16, 220)
          if (foes.every(f2 => !f2.alive)) return g.gameOver(true, { 'Blast reach': blastReach })
          continue
        }
        stepGrid(foe, 2.2, () => {
          const opts = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter(d => walkable(foe.x + d.x, foe.y + d.y))
          if (opts.length && (Math.random() < 0.35 || !walkable(foe.x + foe.dir.x, foe.y + foe.dir.y)))
            foe.dir = opts[Math.floor(Math.random() * opts.length)]
        }, dt)
        if (Math.hypot(gx - heroGX, gy - heroGY) < 0.6) return g.gameOver(false, {})
      }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const px = x * CELL, py = top + y * CELL
        if (map[y][x] === 1) {
          c.fillStyle = shade(g.world.tile, -20)
          rr(c, px + 1, py + 1, CELL - 2, CELL - 2, 4); c.fill()
          c.fillStyle = shade(g.world.tile, 10)
          rr(c, px + 1, py + 1, CELL - 2, 6, 3); c.fill()
        } else if (map[y][x] === 2) {
          c.fillStyle = g.world.tile
          rr(c, px + 3, py + 3, CELL - 6, CELL - 6, 6); c.fill()
          c.strokeStyle = shade(g.world.tile, 30)
          c.strokeRect(px + 8, py + 8, CELL - 16, CELL - 16)
          // sidekick scout reveals hidden power-ups
          if (g.sk?.power === 'scout' && powerUnder.has(`${x},${y}`)) {
            c.fillStyle = g.sk.color; c.globalAlpha = 0.5 + Math.sin(g.frame * 0.2) * 0.3
            c.beginPath(); c.arc(px + CELL / 2, py + CELL / 2, 4, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1
          }
        } else {
          c.fillStyle = 'rgba(0,0,0,.22)'
          c.fillRect(px + 1, py + 1, CELL - 2, CELL - 2)
        }
      }
      // shown power-ups
      for (const [k, pu] of powerShown) {
        const [x, y] = k.split(',').map(Number)
        const px = x * CELL + CELL / 2, py = top + y * CELL + CELL / 2
        glow(c, px, py, CELL, g.world.glow, 0.4)
        txt(c, pu === 'blast' ? '🔥' : pu === 'bomb' ? '💣' : '👟', px, py, 20)
      }
      // bombs
      for (const b of bombs) {
        const px = b.x * CELL + CELL / 2, py = top + b.y * CELL + CELL / 2
        const pulse = 1 + Math.sin(g.frame * (b.t < 0.7 ? 0.55 : 0.2)) * 0.12
        c.fillStyle = '#1e293b'
        c.beginPath(); c.arc(px, py, CELL * 0.36 * pulse, 0, Math.PI * 2); c.fill()
        c.strokeStyle = '#f97316'; c.lineWidth = 2
        c.beginPath(); c.moveTo(px + 4, py - CELL * 0.3); c.quadraticCurveTo(px + 12, py - CELL * 0.55, px + 8, py - CELL * 0.62); c.stroke()
        glow(c, px + 8, py - CELL * 0.62, 6, '#fde047', 0.9)
      }
      // fire
      for (const f of fires) {
        const px = f.x * CELL + CELL / 2, py = top + f.y * CELL + CELL / 2
        glow(c, px, py, CELL * 0.9, '#fb923c', f.t * 1.6)
        c.fillStyle = `rgba(253,224,71,${f.t * 1.4})`
        rr(c, f.x * CELL + 5, top + f.y * CELL + 5, CELL - 10, CELL - 10, 8); c.fill()
      }
      // foes
      for (const foe of foes) {
        if (!foe.alive) continue
        const gx = (foe.px + (foe.x - foe.px) * foe.t) * CELL + CELL / 2
        const gy = top + (foe.py + (foe.y - foe.py) * foe.t) * CELL + CELL / 2
        c.fillStyle = '#f43f5e'
        c.beginPath(); c.arc(gx, gy, CELL * 0.36, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#fff'
        c.beginPath(); c.arc(gx - 5, gy - 3, 4, 0, Math.PI * 2); c.arc(gx + 5, gy - 3, 4, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#1e293b'
        c.beginPath(); c.arc(gx - 5, gy - 3, 2, 0, Math.PI * 2); c.arc(gx + 5, gy - 3, 2, 0, Math.PI * 2); c.fill()
      }
      // hero
      const hx = (hero.px + (hero.x - hero.px) * hero.t) * CELL + CELL / 2
      const hy = top + (hero.py + (hero.y - hero.py) * hero.t) * CELL + CELL / 2
      g.hero(hx, hy, CELL * 1.3, g.frame, hero.dir.x >= 0 ? 1 : -1)
      if (g.sk) g.sidekick(30, top - 28, 24)
      txt(c, `💣×${maxBombs}  🔥${blastReach}`, w - 14, top - 28, 14, 'rgba(255,255,255,.7)', 'right')
    },
  }
}
