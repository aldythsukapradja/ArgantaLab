// KIN SNAKE — analog of Snake / slither.io.
// Grid snake with a hero-head (your avatar IS the snake), sidekick
// magnet perk pulls food, speed rises as you grow.

import type { GenreFactory } from '../core'
import { rr, glow, shade } from '../draw'

export const hint = 'Swipe or use arrow keys to steer. Eat to grow!'

const CELL = 24

export const make: GenreFactory = (g) => {
  const cols = 20, rows = 26
  const w = cols * CELL, h = rows * CELL + 60 // top HUD band
  const top = 60
  const walls = g.bool('walls', false)
  const growth = g.num('growth', 2)
  let tickRate = 0.16 - g.num('speed', 2) * 0.018
  let acc = 0
  let dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 }
  let body = [{ x: 5, y: 12 }, { x: 4, y: 12 }, { x: 3, y: 12 }]
  let grow = 0
  let food = { x: 12, y: 12 }
  let magnetCd = 0

  const eq = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y

  function placeFood() {
    do { food = { x: g.ri(0, cols - 1), y: g.ri(0, rows - 1) } }
    while (body.some(b => eq(b, food)))
  }
  placeFood()

  function setDir(x: number, y: number) {
    if (x === -dir.x && y === -dir.y) return
    nextDir = { x, y }
  }

  return {
    w, h,
    update(dt) {
      // input: keys or swipe
      const a = g.axis()
      if (a.x || a.y) setDir(Math.abs(a.x) >= Math.abs(a.y) ? Math.sign(a.x) : 0, Math.abs(a.y) > Math.abs(a.x) ? Math.sign(a.y) : 0)
      if (g.p.justUp) {
        const { dx, dy } = g.p
        if (Math.hypot(dx, dy) > 24) setDir(Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0, Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0)
      }

      // sidekick magnet: nudge food one cell toward the head every few seconds
      magnetCd -= dt
      if (g.sk?.power === 'magnet' && magnetCd <= 0) {
        magnetCd = 3
        const hd = body[0]
        const nx = food.x + Math.sign(hd.x - food.x), ny = food.y + Math.sign(hd.y - food.y)
        if (!body.some(b => b.x === nx && b.y === ny)) { food = { x: nx, y: ny }; g.burst(food.x * CELL + CELL / 2, top + food.y * CELL + CELL / 2, g.sk.color, 5, 60) }
      }

      acc += dt
      if (acc < tickRate) return
      acc = 0
      dir = nextDir
      const head = { x: body[0].x + dir.x, y: body[0].y + dir.y }
      if (walls) {
        if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) { g.shake(); return g.gameOver(false, { Length: body.length }) }
      } else {
        head.x = (head.x + cols) % cols; head.y = (head.y + rows) % rows
      }
      if (body.some(b => eq(b, head))) { g.shake(); return g.gameOver(false, { Length: body.length }) }
      body.unshift(head)
      if (eq(head, food)) {
        g.addScore(10)
        g.sfx.coin()
        g.burst(food.x * CELL + CELL / 2, top + food.y * CELL + CELL / 2, g.world.accent, 14)
        grow += growth
        tickRate = Math.max(0.07, tickRate * 0.99)
        placeFood()
      }
      if (grow > 0) grow--; else body.pop()
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      // board
      c.fillStyle = 'rgba(0,0,0,.25)'
      c.fillRect(0, top, w, rows * CELL)
      c.strokeStyle = 'rgba(255,255,255,.04)'
      for (let i = 1; i < cols; i++) { c.beginPath(); c.moveTo(i * CELL, top); c.lineTo(i * CELL, top + rows * CELL); c.stroke() }
      if (walls) { c.strokeStyle = g.world.accent; c.lineWidth = 3; c.strokeRect(1, top + 1, w - 2, rows * CELL - 2); c.lineWidth = 1 }
      // food
      const fx = food.x * CELL + CELL / 2, fy = top + food.y * CELL + CELL / 2
      glow(c, fx, fy, CELL, g.world.glow, 0.5)
      c.fillStyle = g.world.accent
      c.beginPath(); c.arc(fx, fy, CELL * 0.36, 0, Math.PI * 2); c.fill()
      // body (costume gradient tail)
      for (let i = body.length - 1; i >= 1; i--) {
        const seg = body[i]
        const t = i / body.length
        c.fillStyle = shade(g.look.a, -Math.floor(t * 70))
        rr(c, seg.x * CELL + 2, top + seg.y * CELL + 2, CELL - 4, CELL - 4, 7); c.fill()
      }
      // head = your hero
      const hd = body[0]
      g.hero(hd.x * CELL + CELL / 2, top + hd.y * CELL + CELL / 2 + 4, CELL * 1.5, g.frame, dir.x >= 0 ? 1 : -1)
      // sidekick floats near the food it magnetizes
      if (g.sk) g.sidekick(fx + CELL, fy - CELL, CELL * 0.9)
    },
  }
}
