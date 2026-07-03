// MIND ARENA — analog of chess.com. Real, full-rules chess powered by
// js-chess-engine (minimax + alpha-beta, 5 levels). You play white in
// your costume colors; the sidekick delivers hints. Games persist to
// save slots mid-match.

import { Game, aiMove, type BoardConfig } from 'js-chess-engine'
import type { GenreFactory } from '../core'
import { rr, glow, txt, shade } from '../draw'

export const hint = 'Tap a piece, then tap where to go. Checkmate the machine!'

const GLYPH: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}
const VALUE: Record<string, number> = { p: 10, n: 30, b: 32, r: 50, q: 90, k: 0 }
const FILES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export const make: GenreFactory = (g) => {
  const CELL = 56
  const w = CELL * 8 + 32, h = 720
  const bx = 16, by = 130
  const level = g.num('ai', 1)
  const hintsOn = g.bool('hints', true)

  let game = new Game()
  let state: BoardConfig = game.exportJson()
  let sel: string | null = null
  let legal: string[] = []
  let thinking = false
  let lastMove: { from: string; to: string } | null = null
  let hintMove: { from: string; to: string } | null = null
  let hintsLeft = 3
  let msg = 'Your move — you are White.'
  let ended = false

  const sq = (file: number, rank: number) => `${FILES[file]}${rank + 1}`
  const sqXY = (s: string) => {
    const file = FILES.indexOf(s[0]), rank = Number(s[1]) - 1
    return { x: bx + file * CELL, y: by + (7 - rank) * CELL }
  }

  function refresh() { state = game.exportJson() }

  function checkEnd(): boolean {
    if (!state.isFinished) {
      if (state.check) msg = state.turn === 'white' ? 'You are in CHECK! ⚠️' : 'The machine is in check!'
      return false
    }
    ended = true
    const iWon = state.checkMate && state.turn === 'black'
    const draw = !state.checkMate
    if (iWon) g.addScore(500 + level * 250)
    setTimeout(() => g.gameOver(iWon, { Result: draw ? 'Draw' : iWon ? 'Checkmate — you win!' : 'Checkmate', Brain: `Level ${level + 1}` }), 800)
    return true
  }

  function aiTurn() {
    thinking = true
    msg = 'The machine is thinking… 🤖'
    setTimeout(() => {
      try {
        const mv = game.aiMove(level)
        const [[from, to]] = Object.entries(mv)
        lastMove = { from, to }
        refresh()
        g.sfx.tick()
        const cap = captured(to)
        if (cap) { g.addScore(VALUE[cap.toLowerCase()]); g.sfx.hit(); shakeAt(to) }
        if (!checkEnd() && !state.check) msg = 'Your move.'
      } catch { /* finished */ }
      thinking = false
    }, 350 + level * 250)
  }

  // track piece count to detect captures
  let prevPieces = Object.keys(state.pieces).length
  function captured(to: string): string | null {
    const now = Object.keys(state.pieces).length
    const was = prevPieces
    prevPieces = now
    return now < was ? (state.pieces[to] ?? 'p') : null
  }
  function shakeAt(s: string) {
    const p = sqXY(s)
    g.burst(p.x + CELL / 2, p.y + CELL / 2, g.world.accent, 12, 180)
  }

  return {
    w, h,
    serialize() { return { board: game.exportJson(), hintsLeft } },
    restore(d: unknown) {
      const s = d as { board: BoardConfig; hintsLeft: number }
      if (!s?.board) return
      game = new Game(s.board)
      hintsLeft = s.hintsLeft ?? 3
      refresh()
      prevPieces = Object.keys(state.pieces).length
      msg = state.turn === 'white' ? 'Welcome back — your move.' : 'The machine was mid-think…'
      if (state.turn === 'black') aiTurn()
    },
    update(_dt) {
      if (ended || thinking || state.turn !== 'white') return
      if (!g.p.justDown) return
      // hint button
      if (hintsOn && g.sk && g.p.y > h - 90 && Math.abs(g.p.x - w / 2) < 110) {
        if (hintsLeft > 0) {
          hintsLeft--
          const mv = aiMove(game.exportJson(), Math.min(2, level))
          const [[from, to]] = Object.entries(mv)
          hintMove = { from, to }
          msg = `${g.sk.name} whispers: try ${from} → ${to} ${g.sk.emoji}`
          g.sfx.pop()
        } else { msg = 'No hints left — trust yourself! 💪'; g.sfx.hit() }
        return
      }
      const file = Math.floor((g.p.x - bx) / CELL), rankRow = Math.floor((g.p.y - by) / CELL)
      if (file < 0 || file > 7 || rankRow < 0 || rankRow > 7) return
      const s = sq(file, 7 - rankRow)
      if (sel && legal.includes(s)) {
        try {
          prevPieces = Object.keys(state.pieces).length
          game.move(sel, s)
          lastMove = { from: sel, to: s }
          hintMove = null
          refresh()
          g.sfx.pop()
          const cap = captured(s)
          if (cap) { g.addScore(VALUE[cap.toLowerCase()] ?? 10); g.sfx.coin(); shakeAt(s) }
          sel = null; legal = []
          if (!checkEnd()) aiTurn()
        } catch { sel = null; legal = [] }
        return
      }
      // select own piece
      const piece = state.pieces[s]
      if (piece && piece === piece.toUpperCase()) {
        sel = s
        const mv = game.moves(s)
        legal = Array.isArray(mv) ? mv : []
        g.sfx.tick()
      } else { sel = null; legal = [] }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      txt(c, `MIND ARENA — Brain Level ${level + 1}`, w / 2, 80, 18, '#fff')
      // you vs machine chips
      g.hero(50, 105, 44, g.frame)
      txt(c, '🤖', w - 50, 100, 34)
      // board
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
        const s = sq(f, 7 - r)
        const x = bx + f * CELL, y = by + r * CELL
        const light = (f + r) % 2 === 0
        c.fillStyle = light ? shade(g.world.tile, 46) : g.world.tile
        c.fillRect(x, y, CELL, CELL)
        if (lastMove && (lastMove.from === s || lastMove.to === s)) {
          c.fillStyle = 'rgba(253,224,71,.22)'; c.fillRect(x, y, CELL, CELL)
        }
        if (hintMove && (hintMove.from === s || hintMove.to === s)) {
          c.strokeStyle = g.sk?.color ?? '#4ade80'; c.lineWidth = 3
          c.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4)
        }
        if (sel === s) { c.fillStyle = 'rgba(74,222,128,.3)'; c.fillRect(x, y, CELL, CELL) }
        if (legal.includes(s)) {
          c.fillStyle = state.pieces[s] ? 'rgba(248,113,113,.5)' : 'rgba(74,222,128,.45)'
          c.beginPath(); c.arc(x + CELL / 2, y + CELL / 2, state.pieces[s] ? CELL * 0.42 : 9, 0, Math.PI * 2)
          if (state.pieces[s]) { c.lineWidth = 4; c.strokeStyle = 'rgba(248,113,113,.6)'; c.stroke() } else c.fill()
        }
      }
      // coordinates
      for (let f = 0; f < 8; f++) txt(c, FILES[f], bx + f * CELL + CELL / 2, by + 8 * CELL + 14, 11, 'rgba(255,255,255,.4)')
      for (let r = 0; r < 8; r++) txt(c, String(8 - r), bx - 8, by + r * CELL + CELL / 2, 11, 'rgba(255,255,255,.4)')
      // pieces — white in your costume color, black in shadow
      for (const [s, p] of Object.entries(state.pieces)) {
        const { x, y } = sqXY(s)
        const white = p === p.toUpperCase()
        c.font = `${CELL * 0.72}px 'Segoe UI Symbol', serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        if (white) {
          c.fillStyle = g.look.a
          c.fillText(GLYPH[p.toLowerCase()], x + CELL / 2, y + CELL / 2 + 2) // filled glyph tinted
          c.fillStyle = '#fff'
          c.fillText(GLYPH[p], x + CELL / 2, y + CELL / 2)
        } else {
          c.fillStyle = '#0f172a'
          c.fillText(GLYPH[p.toLowerCase()], x + CELL / 2, y + CELL / 2)
        }
      }
      // status + hint button
      txt(c, msg, w / 2, by + 8 * CELL + 44, 15, thinking ? g.world.glow : '#fff')
      if (hintsOn && g.sk) {
        c.fillStyle = hintsLeft > 0 ? 'rgba(99,102,241,.8)' : 'rgba(255,255,255,.07)'
        rr(c, w / 2 - 110, h - 88, 220, 48, 16); c.fill()
        txt(c, `${g.sk.emoji} Hint (${hintsLeft} left)`, w / 2, h - 64, 15, hintsLeft > 0 ? '#fff' : 'rgba(255,255,255,.4)')
        if (thinking) glow(c, w - 50, 100, 30, g.world.glow, 0.4)
      }
    },
  }
}
