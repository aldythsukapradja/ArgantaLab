// BUBBLE BURST — analog of Bubble Witch / Puzzle Bobble.
// Hex-ish grid bubble shooter: aim, bounce off walls, match 3+ to pop,
// orphans fall. Sidekick 'scout' shows the full bounce line.

import type { GenreFactory } from '../core'
import { glow, txt, shade } from '../draw'

export const hint = 'Drag to aim, release to shoot. Match 3 of a color!'

const R = 22 // bubble radius
const COLS = 10

export const make: GenreFactory = (g) => {
  const w = COLS * R * 2 + R, h = 720
  const colorsN = g.num('colors', 4)
  const startRows = g.num('rows', 4)
  const ceilingDrops = g.bool('drop', true)
  const PAL = ['#f43f5e', '#3b82f6', '#facc15', '#22c55e', '#a855f7', '#fb923c'].slice(0, colorsN)

  // grid[row][col] = color index or -1; odd rows offset by R
  let grid: number[][] = []
  for (let r = 0; r < startRows; r++) grid.push(Array.from({ length: COLS - (r % 2) }, () => g.ri(0, PAL.length - 1)))
  let ceil = 0 // extra y offset as ceiling drops
  let dropT = 18
  let cur = g.ri(0, PAL.length - 1), next = g.ri(0, PAL.length - 1)
  let flying: { x: number; y: number; vx: number; vy: number; col: number } | null = null
  let aiming = false
  let aimX = 0, aimY = -1
  let shotsLeft = 999
  const shooterY = h - 90

  const cellXY = (r: number, cc: number) => ({ x: R + cc * R * 2 + (r % 2) * R + R / 2 * 0, y: 70 + ceil + r * (R * 1.72) })
  const colorAt = (r: number, cc: number) => (grid[r] && grid[r][cc] !== undefined ? grid[r][cc] : -1)

  function neighbors(r: number, cc: number): [number, number][] {
    const odd = r % 2
    return ([[r, cc - 1], [r, cc + 1], [r - 1, cc - 1 + odd], [r - 1, cc + odd], [r + 1, cc - 1 + odd], [r + 1, cc + odd]] as [number, number][])
      .filter(([rr2, c2]) => rr2 >= 0 && rr2 < grid.length && c2 >= 0 && c2 < COLS - (rr2 % 2))
  }
  function flood(r: number, cc: number, match: boolean): [number, number][] {
    const want = colorAt(r, cc)
    const seen = new Set<string>(), out: [number, number][] = []
    const stack: [number, number][] = [[r, cc]]
    while (stack.length) {
      const [rr2, c2] = stack.pop()!
      const k = `${rr2},${c2}`
      if (seen.has(k)) continue
      seen.add(k)
      const col = colorAt(rr2, c2)
      if (col < 0) continue
      if (match && col !== want) continue
      out.push([rr2, c2])
      for (const nb of neighbors(rr2, c2)) stack.push(nb)
    }
    return out
  }

  function settle(x: number, y: number, col: number) {
    // find nearest empty cell
    let best: { r: number; c: number; d: number } | null = null
    for (let r = 0; r < grid.length + 1; r++) {
      if (r === grid.length) grid.push(Array.from({ length: COLS - (r % 2) }, () => -1))
      for (let cc = 0; cc < COLS - (r % 2); cc++) {
        if (colorAt(r, cc) >= 0) continue
        const p = cellXY(r, cc)
        const d = Math.hypot(p.x - x, p.y - y)
        if (!best || d < best.d) best = { r, c: cc, d }
      }
    }
    // trim trailing empty row we may have added
    while (grid.length && grid[grid.length - 1].every(v => v < 0) && best && best.r < grid.length - 1) grid.pop()
    if (!best) return
    grid[best.r][best.c] = col
    const group = flood(best.r, best.c, true)
    if (group.length >= 3) {
      for (const [r, cc] of group) {
        const p = cellXY(r, cc)
        g.burst(p.x, p.y, PAL[colorAt(r, cc)] ?? g.world.accent, 10, 180)
        grid[r][cc] = -1
      }
      g.addScore(group.length * 10)
      g.sfx.pop()
      // orphans fall: anything not connected to row 0
      const anchored = new Set<string>()
      for (let cc = 0; cc < COLS; cc++) if (colorAt(0, cc) >= 0) for (const [r2, c2] of flood(0, cc, false)) anchored.add(`${r2},${c2}`)
      let dropped = 0
      for (let r = 0; r < grid.length; r++) for (let cc = 0; cc < COLS - (r % 2); cc++) {
        if (colorAt(r, cc) >= 0 && !anchored.has(`${r},${cc}`)) {
          const p = cellXY(r, cc)
          g.burst(p.x, p.y, PAL[grid[r][cc]], 8, 220, 500)
          grid[r][cc] = -1; dropped++
        }
      }
      if (dropped) { g.addScore(dropped * 20); g.sfx.coin(); if (dropped >= 4) g.toast(`${dropped} bubbles dropped! 💥`) }
    } else {
      g.sfx.tick()
    }
    // win/lose checks
    if (grid.every(row => row.every(v => v < 0))) return g.gameOver(true, {})
    const lowest = Math.max(...grid.map((row, r) => row.some(v => v >= 0) ? cellXY(r, 0).y : 0))
    if (lowest > shooterY - 70) return g.gameOver(false, {})
  }

  return {
    w, h,
    update(dt) {
      if (ceilingDrops) {
        dropT -= dt
        if (dropT <= 0) { dropT = 18; ceil += R * 1.2; g.toast('The ceiling creeps down… ⬇️'); g.sfx.hit() }
      }
      // aim
      if (g.p.down) {
        aiming = true
        const dx = g.p.x - w / 2, dy = g.p.y - shooterY
        const len = Math.hypot(dx, dy) || 1
        // aim opposite drag if dragging below shooter, else straight at pointer above
        aimX = dx / len; aimY = dy / len
        if (aimY > -0.12) { aimY = -0.12; aimX = Math.sign(aimX || 1) * Math.sqrt(1 - aimY * aimY) }
      }
      if (g.p.justUp && aiming && !flying) {
        aiming = false
        flying = { x: w / 2, y: shooterY, vx: aimX * 780, vy: aimY * 780, col: cur }
        cur = next; next = g.ri(0, PAL.length - 1)
        g.sfx.zap()
      }
      if (flying) {
        flying.x += flying.vx * dt; flying.y += flying.vy * dt
        if (flying.x < R) { flying.x = R; flying.vx *= -1 }
        if (flying.x > w - R) { flying.x = w - R; flying.vx *= -1 }
        let hit = flying.y < 70 + ceil
        if (!hit) {
          outer: for (let r = 0; r < grid.length; r++) for (let cc = 0; cc < COLS - (r % 2); cc++) {
            if (colorAt(r, cc) < 0) continue
            const p = cellXY(r, cc)
            if (Math.hypot(p.x - flying.x, p.y - flying.y) < R * 1.8) { hit = true; break outer }
          }
        }
        if (hit) { settle(flying.x, flying.y, flying.col); flying = null }
      }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      // ceiling
      c.fillStyle = g.world.tile
      c.fillRect(0, 0, w, 50 + ceil)
      c.fillStyle = shade(g.world.tile, 26)
      c.fillRect(0, 42 + ceil, w, 8)
      // grid bubbles
      for (let r = 0; r < grid.length; r++) for (let cc = 0; cc < COLS - (r % 2); cc++) {
        const col = colorAt(r, cc)
        if (col < 0) continue
        const p = cellXY(r, cc)
        drawBubble(c, p.x, p.y, PAL[col])
      }
      // aim line (sidekick scout = full bounce prediction)
      if (aiming && !flying) {
        c.save(); c.setLineDash([5, 8]); c.strokeStyle = g.sk?.power === 'scout' ? g.sk.color : 'rgba(255,255,255,.5)'; c.lineWidth = 2.5
        let x = w / 2, y = shooterY, vx = aimX, vy = aimY
        const segs = g.sk?.power === 'scout' ? 3 : 1
        c.beginPath(); c.moveTo(x, y)
        for (let i = 0; i < segs; i++) {
          let t = 9999
          if (vx > 0) t = Math.min(t, (w - R - x) / vx)
          if (vx < 0) t = Math.min(t, (R - x) / vx)
          const tCeil = (70 + ceil - y) / vy
          const bounce = t < tCeil
          const tt = Math.min(t, tCeil)
          x += vx * tt; y += vy * tt
          c.lineTo(x, y)
          if (!bounce) break
          vx *= -1
        }
        c.stroke(); c.restore()
      }
      // shooter: hero holding the next bubble
      g.hero(w / 2 - 46, shooterY + 8, 56, g.frame)
      if (g.sk) g.sidekick(w / 2 + 60, shooterY + 4, 30)
      if (!flying) drawBubble(c, w / 2, shooterY, PAL[cur])
      drawBubble(c, w / 2 + 110, shooterY + 24, PAL[next], 0.62)
      txt(c, 'next', w / 2 + 110, shooterY + 52, 11, 'rgba(255,255,255,.5)')
      if (flying) drawBubble(c, flying.x, flying.y, PAL[flying.col])

      function drawBubble(cc: CanvasRenderingContext2D, x: number, y: number, color: string, scale = 1) {
        const r = R * scale
        glow(cc, x, y, r * 1.5, color, 0.18)
        cc.fillStyle = color
        cc.beginPath(); cc.arc(x, y, r - 1.5, 0, Math.PI * 2); cc.fill()
        cc.fillStyle = 'rgba(255,255,255,.35)'
        cc.beginPath(); cc.arc(x - r * 0.3, y - r * 0.34, r * 0.3, 0, Math.PI * 2); cc.fill()
      }
    },
  }
}
