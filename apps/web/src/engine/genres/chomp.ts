// CHOMP MAZE — analog of Pac-Man.
// Procedural symmetric maze, dots + power pellets, ghosts with
// chase/scatter/frightened moods. Sidekick 'scout' shows a ghost's target.

import type { GenreFactory } from '../core'
import { glow, shade } from '../draw'

export const hint = 'Swipe or use arrows. Eat every dot — pellets make ghosts munchable!'

const CELL = 26
const COLS = 17, ROWS = 21

type Cell = 0 | 1 | 2 | 3 // 0 wall, 1 dot, 2 empty, 3 pellet

export const make: GenreFactory = (g) => {
  const top = 60
  const w = COLS * CELL, h = ROWS * CELL + top
  const ghostCount = g.num('ghosts', 3)
  const ghostSpeed = 2.2 + g.num('ghostSpeed', 3) * 0.5
  const tunnels = g.bool('tunnels', true)

  // ── maze gen: random half, mirrored for symmetry ──
  const maze: Cell[][] = []
  for (let y = 0; y < ROWS; y++) {
    maze.push(new Array(COLS).fill(0) as Cell[])
  }
  const carve = (x: number, y: number) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) { maze[y][x] = 1; maze[y][COLS - 1 - x] = 1 } }
  // ring corridors + random spurs (seeded → layout variants)
  for (let y = 1; y < ROWS - 1; y++) { carve(1, y); carve(Math.floor(COLS / 2), y) }
  for (let x = 1; x <= Math.floor(COLS / 2); x++) { carve(x, 1); carve(x, ROWS - 2); carve(x, Math.floor(ROWS / 2)) }
  for (let i = 0; i < 26; i++) {
    const x = g.ri(1, Math.floor(COLS / 2)), y = g.ri(1, ROWS - 2)
    carve(x, y); carve(x, y + 1); carve(x + (g.rng() < 0.5 ? 1 : 0), y)
  }
  if (tunnels) { const ty = Math.floor(ROWS / 2); maze[ty][0] = 1; maze[ty][COLS - 1] = 1 }
  // pellets in the four quadrant corners
  const pel = [[1, 1], [COLS - 2, 1], [1, ROWS - 2], [COLS - 2, ROWS - 2]]
  for (const [x, y] of pel) if (maze[y][x] === 1) maze[y][x] = 3
  let dots = maze.flat().filter(v => v === 1 || v === 3).length

  // ── actors ──
  const heroStart = { x: Math.floor(COLS / 2), y: ROWS - 2 }
  if (maze[heroStart.y][heroStart.x] === 0) maze[heroStart.y][heroStart.x] = 1
  const hero = { x: heroStart.x, y: heroStart.y, px: heroStart.x, py: heroStart.y, dir: { x: 0, y: 0 }, want: { x: 0, y: 0 }, t: 0 }
  const GHOST_COLORS = ['#ef4444', '#f472b6', '#38bdf8', '#fb923c']
  interface Ghost { x: number; y: number; px: number; py: number; dir: { x: number; y: number }; t: number; color: string; dead: boolean }
  const ghosts: Ghost[] = []
  for (let i = 0; i < ghostCount; i++) {
    const gx = Math.floor(COLS / 2) + (i % 2 === 0 ? -1 : 1) * Math.floor(i / 2)
    const gy = Math.floor(ROWS / 2)
    if (maze[gy][gx] === 0) maze[gy][gx] = 2
    ghosts.push({ x: gx, y: gy, px: gx, py: gy, dir: { x: 1, y: 0 }, t: 0, color: GHOST_COLORS[i % 4], dead: false })
  }
  let lives = 3
  let fright = 0
  let moveSpeed = 5.2 // hero cells/sec

  const open = (x: number, y: number) => {
    if (tunnels && (x < 0 || x >= COLS) && y === Math.floor(ROWS / 2)) return true
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && maze[y][x] !== 0
  }
  const wrap = (v: { x: number; y: number }) => { v.x = (v.x + COLS) % COLS; v.y = (v.y + ROWS) % ROWS }

  function stepActor(a: { x: number; y: number; px: number; py: number; dir: { x: number; y: number }; t: number }, speed: number, choose: () => void, dt: number) {
    a.t += speed * dt
    while (a.t >= 1) {
      a.t -= 1
      a.px = a.x; a.py = a.y
      choose()
      if (open(a.x + a.dir.x, a.y + a.dir.y)) { a.x += a.dir.x; a.y += a.dir.y; wrap(a) }
    }
  }

  function reset(afterHit: boolean) {
    hero.x = hero.px = heroStart.x; hero.y = hero.py = heroStart.y; hero.dir = { x: 0, y: 0 }; hero.want = { x: 0, y: 0 }
    for (const gh of ghosts) { gh.x = gh.px = Math.floor(COLS / 2); gh.y = gh.py = Math.floor(ROWS / 2); gh.dead = false }
    if (afterHit) g.toast(`${lives} ${lives === 1 ? 'life' : 'lives'} left!`)
  }

  return {
    w, h,
    update(dt) {
      const a = g.axis()
      if (a.x || a.y) hero.want = Math.abs(a.x) >= Math.abs(a.y) ? { x: Math.sign(a.x), y: 0 } : { x: 0, y: Math.sign(a.y) }
      if (g.p.down && Math.hypot(g.p.dx, g.p.dy) > 26) {
        const { dx, dy } = g.p
        hero.want = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }
      }
      fright = Math.max(0, fright - dt)

      stepActor(hero, moveSpeed, () => {
        if (open(hero.x + hero.want.x, hero.y + hero.want.y)) hero.dir = { ...hero.want }
      }, dt)

      // eat
      const cell = maze[hero.y][hero.x]
      if (cell === 1 || cell === 3) {
        maze[hero.y][hero.x] = 2; dots--
        g.addScore(cell === 3 ? 50 : 10)
        if (cell === 3) { fright = 7; g.sfx.zap(); g.toast('Ghosts are scared! 😱') } else g.sfx.tick()
        if (dots <= 0) return g.gameOver(true, { Lives: lives })
      }

      // ghosts
      for (const gh of ghosts) {
        if (gh.dead) continue
        const sp = fright > 0 ? ghostSpeed * 0.55 : ghostSpeed
        stepActor(gh, sp, () => {
          const opts = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
            .filter(d => open(gh.x + d.x, gh.y + d.y) && !(d.x === -gh.dir.x && d.y === -gh.dir.y))
          if (!opts.length) { gh.dir = { x: -gh.dir.x, y: -gh.dir.y }; return }
          // chase (or flee when frightened), with wobble
          const target = fright > 0 ? { x: gh.x * 2 - hero.x, y: gh.y * 2 - hero.y } : { x: hero.x, y: hero.y }
          opts.sort((d1, d2) =>
            Math.hypot(gh.x + d1.x - target.x, gh.y + d1.y - target.y) - Math.hypot(gh.x + d2.x - target.x, gh.y + d2.y - target.y))
          gh.dir = Math.random() < 0.75 ? opts[0] : opts[Math.floor(Math.random() * opts.length)]
        }, dt)
        // collide
        if (Math.hypot(gh.x + (gh.dir.x * gh.t) - (hero.x + hero.dir.x * hero.t), gh.y + gh.dir.y * gh.t - (hero.y + hero.dir.y * hero.t)) < 0.7) {
          if (fright > 0) {
            gh.dead = true; g.addScore(200); g.sfx.coin()
            g.burst(gh.x * CELL + CELL / 2, top + gh.y * CELL + CELL / 2, gh.color, 16)
            setTimeout(() => { gh.dead = false; gh.x = gh.px = Math.floor(COLS / 2); gh.y = gh.py = Math.floor(ROWS / 2) }, 4000)
          } else {
            lives--; g.shake(8); g.sfx.hit()
            if (lives <= 0) return g.gameOver(false, { 'Dots left': dots })
            reset(true)
          }
        }
      }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, top, w, ROWS * CELL)
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const v = maze[y][x]
        const px = x * CELL, py = top + y * CELL
        if (v === 0) {
          c.fillStyle = g.world.tile
          c.fillRect(px + 1, py + 1, CELL - 2, CELL - 2)
          c.fillStyle = shade(g.world.tile, 24)
          c.fillRect(px + 1, py + 1, CELL - 2, 4)
        } else if (v === 1) {
          c.fillStyle = g.world.glow
          c.beginPath(); c.arc(px + CELL / 2, py + CELL / 2, 2.6, 0, Math.PI * 2); c.fill()
        } else if (v === 3) {
          glow(c, px + CELL / 2, py + CELL / 2, CELL * 0.8, g.world.accent, 0.5)
          c.fillStyle = g.world.accent
          c.beginPath(); c.arc(px + CELL / 2, py + CELL / 2, 6 + Math.sin(g.frame * 0.15) * 1.6, 0, Math.PI * 2); c.fill()
        }
      }
      // lives
      for (let i = 0; i < lives; i++) { c.fillStyle = '#f43f5e'; c.beginPath(); c.arc(w - 20 - i * 22, top - 24, 7, 0, Math.PI * 2); c.fill() }
      // ghosts
      for (const gh of ghosts) {
        if (gh.dead) continue
        const gx = (gh.px + (gh.x - gh.px) * gh.t) * CELL + CELL / 2
        const gy = top + (gh.py + (gh.y - gh.py) * gh.t) * CELL + CELL / 2
        const col = fright > 0 ? (fright < 2 && Math.floor(g.frame / 8) % 2 ? '#e2e8f0' : '#4f46e5') : gh.color
        c.fillStyle = col
        c.beginPath(); c.arc(gx, gy - 2, CELL * 0.4, Math.PI, 0); c.lineTo(gx + CELL * 0.4, gy + CELL * 0.34)
        for (let i = 3; i >= 0; i--) c.lineTo(gx - CELL * 0.4 + i * CELL * 0.27, gy + CELL * 0.34 - (i % 2 ? 5 : 0))
        c.closePath(); c.fill()
        c.fillStyle = '#fff'
        c.beginPath(); c.arc(gx - 5, gy - 5, 4, 0, Math.PI * 2); c.arc(gx + 5, gy - 5, 4, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#1e293b'
        c.beginPath(); c.arc(gx - 5 + gh.dir.x * 2, gy - 5 + gh.dir.y * 2, 2, 0, Math.PI * 2); c.arc(gx + 5 + gh.dir.x * 2, gy - 5 + gh.dir.y * 2, 2, 0, Math.PI * 2); c.fill()
        // sidekick scout: dotted line from first ghost to its target
        if (g.sk?.power === 'scout' && gh === ghosts[0] && fright <= 0) {
          c.save(); c.setLineDash([4, 6]); c.strokeStyle = g.sk.color; c.globalAlpha = 0.5
          c.beginPath(); c.moveTo(gx, gy)
          c.lineTo(hero.x * CELL + CELL / 2, top + hero.y * CELL + CELL / 2); c.stroke(); c.restore()
        }
      }
      // hero
      const hx = (hero.px + (hero.x - hero.px) * hero.t) * CELL + CELL / 2
      const hy = top + (hero.py + (hero.y - hero.py) * hero.t) * CELL + CELL / 2
      g.hero(hx, hy + 3, CELL * 1.35, g.frame, hero.dir.x >= 0 ? 1 : -1)
      if (g.sk) g.sidekick(24, top - 26, 22)
    },
  }
}
