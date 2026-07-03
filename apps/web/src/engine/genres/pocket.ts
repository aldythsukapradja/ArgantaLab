// POCKET WORLD — analog of Toca Boca: no score, no fail state.
// Rooms full of tappable props that react with pops, wiggles and
// surprises; drag furniture stickers to redecorate; your sidekick pet
// follows you room to room. Decor layout persists via save slots.

import type { GenreFactory } from '../core'
import { rr, glow, txt, emoji, shade } from '../draw'

export const hint = 'Tap everything! Drag stickers to decorate. There’s no way to lose.'

const SETS: Record<string, { name: string; rooms: { name: string; base: string; props: string[] }[] }> = {
  home: {
    name: 'Cozy Home',
    rooms: [
      { name: 'Living Room', base: '🛋️', props: ['🪴', '📺', '🐠', '🕰️', '🧸'] },
      { name: 'Kitchen',     base: '🍳', props: ['🥞', '🫖', '🧁', '🍎', '🥛'] },
      { name: 'Bedroom',     base: '🛏️', props: ['🌙', '⭐', '🧸', '📚', '🎈'] },
      { name: 'Garden',      base: '🌳', props: ['🌻', '🦋', '🐞', '⛲', '🍄'] },
      { name: 'Attic',       base: '📦', props: ['🕷️', '🎻', '🗝️', '👻', '🖼️'] },
    ],
  },
  cafe: {
    name: 'Kitten Café',
    rooms: [
      { name: 'Counter',  base: '☕', props: ['🐱', '🍰', '🥐', '🫖', '🍪'] },
      { name: 'Seating',  base: '🪑', props: ['🐈', '🌷', '📖', '🧶', '🐾'] },
      { name: 'Kitchen',  base: '🍳', props: ['🥧', '🍮', '🍓', '🥯', '🐟'] },
      { name: 'Cat Room', base: '🧺', props: ['🐈‍⬛', '🐁', '🎀', '🪀', '😺'] },
      { name: 'Terrace',  base: '⛱️', props: ['🌺', '🍹', '🦜', '🌈', '☀️'] },
    ],
  },
  spa: {
    name: 'Sky Spa',
    rooms: [
      { name: 'Pool',    base: '🏊', props: ['🛁', '🫧', '🦆', '💦', '🩱'] },
      { name: 'Garden',  base: '🎋', props: ['🪷', '🦢', '🌸', '🍵', '🕊️'] },
      { name: 'Steam',   base: '♨️', props: ['🧖', '💨', '🪨', '🌿', '💆'] },
      { name: 'Lounge',  base: '🛋️', props: ['🥒', '🍉', '🧴', '🎐', '🪞'] },
      { name: 'Rooftop', base: '🌅', props: ['🔭', '☁️', '🎑', '🪁', '✨'] },
    ],
  },
}

interface Sticker { e: string; x: number; y: number; s: number }
interface PocketSave { room: number; stickers: Sticker[][]; visits: number }

export const make: GenreFactory = (g) => {
  const w = 480, h = 720
  const set = SETS[g.str('set', 'home')] ?? SETS.home
  const roomsN = Math.min(g.num('rooms', 3), set.rooms.length)
  const rooms = set.rooms.slice(0, roomsN)

  let room = 0
  let stickers: Sticker[][] = rooms.map(() => [])
  let visits = 0
  let dragging: Sticker | null = null
  let dragNew = ''
  interface Wiggle { x: number; y: number; e: string; t: number; s: number }
  let wiggles: Wiggle[] = []
  let heroX = w / 2, heroTarget = w / 2
  let skTrail: { x: number; y: number }[] = []

  const TRAY_Y = h - 70
  const trayProps = () => rooms[room].props

  return {
    w, h,
    serialize(): PocketSave { return { room, stickers, visits } },
    restore(d: unknown) {
      const s = d as PocketSave
      if (!s || !Array.isArray(s.stickers)) return
      room = Math.min(s.room ?? 0, roomsN - 1)
      stickers = rooms.map((_, i) => s.stickers[i] ?? [])
      visits = s.visits ?? 0
      g.toast('Your world is just how you left it! 🏠')
    },
    update(dt) {
      heroX += (heroTarget - heroX) * Math.min(1, dt * 5)
      for (const wg of wiggles) wg.t -= dt
      wiggles = wiggles.filter(wg => wg.t > 0)
      skTrail.unshift({ x: heroX - 46, y: h - 190 })
      if (skTrail.length > 12) skTrail.pop()

      // drag stickers
      if (g.p.justDown) {
        // tray: start dragging a new sticker
        if (g.p.y > TRAY_Y - 34) {
          const idx = Math.floor((g.p.x - (w / 2 - 190)) / 78)
          if (idx >= 0 && idx < trayProps().length) { dragNew = trayProps()[idx]; g.sfx.tick(); return }
        }
        // room arrows
        if (g.p.y < 120 && g.p.x < 70 && room > 0) { room--; visits++; g.sfx.pop(); return }
        if (g.p.y < 120 && g.p.x > w - 70 && room < roomsN - 1) { room++; visits++; g.sfx.pop(); return }
        // existing sticker: pick up (top-most)
        const rs = stickers[room]
        for (let i = rs.length - 1; i >= 0; i--) {
          if (Math.hypot(g.p.x - rs[i].x, g.p.y - rs[i].y) < 34) { dragging = rs[i]; g.sfx.tick(); return }
        }
        // otherwise: tap-react — wiggle a prop burst where tapped
        heroTarget = Math.max(60, Math.min(w - 60, g.p.x))
        const e = trayProps()[g.ri(0, trayProps().length - 1)]
        wiggles.push({ x: g.p.x, y: Math.min(g.p.y, h - 160), e, t: 1.2, s: 26 + g.rng() * 22 })
        g.burst(g.p.x, g.p.y, g.world.glow, 8, 130, 100)
        g.sfx.pop()
      }
      if (g.p.down && dragNew) { /* ghost follows pointer; drawn below */ }
      if (g.p.down && dragging) { dragging.x = g.p.x; dragging.y = Math.min(g.p.y, TRAY_Y - 60) }
      if (g.p.justUp) {
        if (dragNew && g.p.y < TRAY_Y - 40) {
          stickers[room].push({ e: dragNew, x: g.p.x, y: g.p.y, s: 40 + g.rng() * 20 })
          g.burst(g.p.x, g.p.y, g.world.accent, 10, 150)
          g.sfx.coin()
        }
        dragNew = ''; dragging = null
      }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      const rm = rooms[room]
      // room panel
      c.fillStyle = 'rgba(255,255,255,.06)'
      rr(c, 16, 130, w - 32, h - 320, 24); c.fill()
      c.fillStyle = shade(g.world.tile, 12)
      rr(c, 16, h - 260, w - 32, 70, 16); c.fill() // floor strip
      // room base emblem
      c.globalAlpha = 0.16
      emoji(c, rm.base, w / 2, h / 2 - 60, 200)
      c.globalAlpha = 1
      // header + arrows
      txt(c, `${set.name} — ${rm.name}`, w / 2, 90, 20, '#fff')
      txt(c, `${room + 1}/${roomsN}`, w / 2, 116, 12, 'rgba(255,255,255,.5)')
      if (room > 0) txt(c, '◀', 40, 96, 30, g.world.glow)
      if (room < roomsN - 1) txt(c, '▶', w - 40, 96, 30, g.world.glow)
      // placed stickers
      for (const s of stickers[room]) {
        if (s === dragging) glow(c, s.x, s.y, s.s, g.world.glow, 0.4)
        emoji(c, s.e, s.x, s.y, s.s)
      }
      // tap wiggles
      for (const wg of wiggles) {
        const wob = Math.sin((1.2 - wg.t) * 18) * 8 * wg.t
        c.save(); c.globalAlpha = Math.min(1, wg.t * 2)
        emoji(c, wg.e, wg.x + wob, wg.y - (1.2 - wg.t) * 30, wg.s)
        c.restore()
      }
      // hero strolls the floor; pet sidekick trails behind
      g.hero(heroX, h - 200, 64, g.frame)
      if (g.sk && skTrail.length > 6) g.sidekick(skTrail[6].x, skTrail[6].y, 30)
      // sticker tray
      c.fillStyle = 'rgba(5,8,25,.85)'
      rr(c, 8, TRAY_Y - 36, w - 16, 72, 18); c.fill()
      trayProps().forEach((e, i) => {
        const x = w / 2 - 190 + i * 78 + 39
        c.fillStyle = 'rgba(255,255,255,.07)'
        rr(c, x - 32, TRAY_Y - 28, 64, 56, 12); c.fill()
        emoji(c, e, x, TRAY_Y, 30)
      })
      txt(c, 'drag a sticker into the room ↑', w / 2, TRAY_Y + 46, 11, 'rgba(255,255,255,.4)')
      // drag ghost
      if (dragNew && g.p.down) { c.globalAlpha = 0.7; emoji(c, dragNew, g.p.x, g.p.y, 46); c.globalAlpha = 1 }
    },
  }
}
