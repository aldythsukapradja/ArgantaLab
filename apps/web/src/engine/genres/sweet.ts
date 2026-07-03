// SWEET CASCADE — analog of Candy Crush.
// Swap-adjacent match-3 with gravity cascades, limited moves, level
// goals and star ratings. Sidekick grants one free booster (its power
// flavors the booster: bomb = clear a 3x3, zap = clear a row, etc).

import type { GenreFactory } from '../core'
import { rr, glow, txt } from '../draw'

export const hint = 'Swap two candies to match 3+. Beat the goal before moves run out!'

const N = 8
const CELL = 54

const CANDY = [
  { color: '#f43f5e', shape: 'circle' }, { color: '#3b82f6', shape: 'square' },
  { color: '#facc15', shape: 'drop' },   { color: '#22c55e', shape: 'circle' },
  { color: '#a855f7', shape: 'square' }, { color: '#fb923c', shape: 'drop' },
]

export const make: GenreFactory = (g) => {
  const top = 130
  const w = N * CELL, h = top + N * CELL + 90
  const colorsN = g.num('colors', 5)
  const goalKind = g.str('goal', 'score')
  let movesLeft = g.num('moves', 24)
  const target = goalKind === 'score' ? movesLeft * 55 : 0

  // board[y][x] = candy index; jelly[y][x] for clear-goal
  const board: number[][] = []
  const jelly: boolean[][] = []
  const offs: number[][] = []   // fall animation offsets (in cells)
  for (let y = 0; y < N; y++) {
    board.push(Array.from({ length: N }, () => g.ri(0, colorsN - 1)))
    jelly.push(Array.from({ length: N }, () => goalKind === 'clear' && y >= N - 3))
    offs.push(new Array(N).fill(0))
  }
  // remove initial matches
  let guard = 0
  while (findMatches().length && guard++ < 60) for (const [x, y] of findMatches()) board[y][x] = g.ri(0, colorsN - 1)

  let sel: { x: number; y: number } | null = null
  let anim = 0            // global settle timer
  let cascade = 0
  let boosterReady = !!g.sk
  let ended = false

  function findMatches(): [number, number][] {
    const hits = new Set<string>()
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = board[y][x]
      if (v < 0) continue
      if (x < N - 2 && board[y][x + 1] === v && board[y][x + 2] === v) { hits.add(`${x},${y}`); hits.add(`${x + 1},${y}`); hits.add(`${x + 2},${y}`) }
      if (y < N - 2 && board[y + 1][x] === v && board[y + 2][x] === v) { hits.add(`${x},${y}`); hits.add(`${x},${y + 1}`); hits.add(`${x},${y + 2}`) }
    }
    return [...hits].map(s => s.split(',').map(Number) as [number, number])
  }

  function clearCells(cells: [number, number][]) {
    for (const [x, y] of cells) {
      if (board[y][x] < 0) continue
      g.burst(x * CELL + CELL / 2, top + y * CELL + CELL / 2, CANDY[board[y][x]].color, 8, 160)
      board[y][x] = -1
      if (jelly[y][x]) jelly[y][x] = false
    }
    g.addScore(cells.length * 10 * (1 + cascade))
    g.sfx.pop()
    if (cascade >= 2) g.toast(`Cascade x${cascade + 1}! 🍬`)
  }

  function applyGravity() {
    for (let x = 0; x < N; x++) {
      let write = N - 1
      for (let y = N - 1; y >= 0; y--) if (board[y][x] >= 0) {
        if (write !== y) { board[write][x] = board[y][x]; offs[write][x] = write - y; board[y][x] = -1 }
        write--
      }
      for (let y = write; y >= 0; y--) { board[y][x] = g.ri(0, colorsN - 1); offs[y][x] = write + 1 + (write - y) }
    }
    anim = 0.28
  }

  function endCheck() {
    if (ended) return
    const done = goalKind === 'score' ? g.score >= target : jelly.every(row => row.every(j => !j))
    if (done) { ended = true; g.gameOver(true, { Stars: '⭐'.repeat(movesLeft > 8 ? 3 : movesLeft > 3 ? 2 : 1), 'Moves left': movesLeft }); return }
    if (movesLeft <= 0) { ended = true; g.gameOver(false, goalKind === 'score' ? { Target: target } : { 'Jelly left': jelly.flat().filter(Boolean).length }) }
  }

  function trySwap(a: { x: number; y: number }, b: { x: number; y: number }) {
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return
    ;[board[a.y][a.x], board[b.y][b.x]] = [board[b.y][b.x], board[a.y][a.x]]
    const m = findMatches()
    if (!m.length) {
      ;[board[a.y][a.x], board[b.y][b.x]] = [board[b.y][b.x], board[a.y][a.x]]
      g.sfx.hit()
      return
    }
    movesLeft--
    cascade = 0
    clearCells(m); applyGravity()
  }

  function useBooster() {
    if (!boosterReady || !g.sk) return
    boosterReady = false
    const p = g.sk.power
    const cells: [number, number][] = []
    if (p === 'bomb' || p === 'boost' || p === 'shield' || p === 'heal') {
      const cx = g.ri(2, N - 3), cy = g.ri(2, N - 3)
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) cells.push([x, y])
      g.toast(`${g.sk.name} smashed a 3×3! ${g.sk.emoji}`)
    } else if (p === 'zap' || p === 'scout' || p === 'slow') {
      const row = g.ri(0, N - 1)
      for (let x = 0; x < N; x++) cells.push([x, row])
      g.toast(`${g.sk.name} cleared a row! ${g.sk.emoji}`)
    } else {
      // magnet/luck/double: clear all of one color
      const v = g.ri(0, colorsN - 1)
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (board[y][x] === v) cells.push([x, y])
      g.toast(`${g.sk.name} popped a whole color! ${g.sk.emoji}`)
    }
    cascade = 0
    clearCells(cells); applyGravity()
    g.sfx.win()
  }

  return {
    w, h,
    update(dt) {
      if (ended) return
      // settle animation → resolve cascades
      if (anim > 0) {
        anim -= dt
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) offs[y][x] = Math.max(0, offs[y][x] - dt * 14)
        if (anim <= 0) {
          const m = findMatches()
          if (m.length) { cascade++; clearCells(m); applyGravity() }
          else endCheck()
        }
        return
      }
      // booster button
      if (g.p.justDown && boosterReady && g.p.y > top + N * CELL + 8 && g.p.x > w / 2 - 110 && g.p.x < w / 2 + 110) { useBooster(); return }
      // select/swap: tap-tap or drag
      if (g.p.justDown && g.p.y > top && g.p.y < top + N * CELL) {
        const x = Math.floor(g.p.x / CELL), y = Math.floor((g.p.y - top) / CELL)
        if (x >= 0 && x < N && y >= 0 && y < N) {
          if (sel && Math.abs(sel.x - x) + Math.abs(sel.y - y) === 1) { trySwap(sel, { x, y }); sel = null }
          else sel = { x, y }
        }
      }
      if (g.p.down && sel && Math.hypot(g.p.dx, g.p.dy) > CELL * 0.6) {
        const dir = Math.abs(g.p.dx) >= Math.abs(g.p.dy) ? { x: Math.sign(g.p.dx), y: 0 } : { x: 0, y: Math.sign(g.p.dy) }
        const to = { x: sel.x + dir.x, y: sel.y + dir.y }
        if (to.x >= 0 && to.x < N && to.y >= 0 && to.y < N) { trySwap(sel, to); sel = null }
      }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      // header: goal + moves
      txt(c, goalKind === 'score' ? `GOAL  ${Math.min(g.score, target)} / ${target}` : `JELLY LEFT  ${jelly.flat().filter(Boolean).length}`, w / 2, 66, 20, '#fff')
      txt(c, `MOVES  ${movesLeft}`, w / 2, 96, 15, movesLeft <= 5 ? '#fca5a5' : 'rgba(255,255,255,.7)')
      // hero + sidekick cheer from header corners
      g.hero(44, 70, 52, g.frame)
      if (g.sk) g.sidekick(w - 44, 70, 30)
      // board
      c.fillStyle = 'rgba(0,0,0,.28)'
      rr(c, 0, top, w, N * CELL, 14); c.fill()
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = board[y][x]
        if (v < 0) continue
        const px = x * CELL + CELL / 2
        const py = top + (y - offs[y][x]) * CELL + CELL / 2
        if (jelly[y][x]) {
          c.fillStyle = 'rgba(147,197,253,.28)'
          rr(c, x * CELL + 2, top + y * CELL + 2, CELL - 4, CELL - 4, 10); c.fill()
        }
        const cd = CANDY[v]
        const selHere = sel && sel.x === x && sel.y === y
        const size = CELL * 0.36 * (selHere ? 1.14 + Math.sin(g.frame * 0.25) * 0.05 : 1)
        if (selHere) glow(c, px, py, CELL * 0.75, cd.color, 0.5)
        c.fillStyle = cd.color
        if (cd.shape === 'circle') { c.beginPath(); c.arc(px, py, size, 0, Math.PI * 2); c.fill() }
        else if (cd.shape === 'square') { rr(c, px - size, py - size, size * 2, size * 2, 7); c.fill() }
        else { c.beginPath(); c.moveTo(px, py - size * 1.2); c.quadraticCurveTo(px + size * 1.3, py + size * 0.6, px, py + size); c.quadraticCurveTo(px - size * 1.3, py + size * 0.6, px, py - size * 1.2); c.fill() }
        c.fillStyle = 'rgba(255,255,255,.4)'
        c.beginPath(); c.arc(px - size * 0.35, py - size * 0.4, size * 0.28, 0, Math.PI * 2); c.fill()
      }
      // booster button
      const by = top + N * CELL + 44
      if (g.sk) {
        c.fillStyle = boosterReady ? 'rgba(99,102,241,.85)' : 'rgba(255,255,255,.08)'
        rr(c, w / 2 - 110, by - 26, 220, 52, 16); c.fill()
        txt(c, boosterReady ? `${g.sk.emoji} ${g.sk.name}'s Booster!` : `${g.sk.emoji} booster used`, w / 2, by, 16, boosterReady ? '#fff' : 'rgba(255,255,255,.4)')
      }
    },
  }
}
