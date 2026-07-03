// ============================================================
//  ARGANTALAB · KINWORLD  (PixiJS v8 — cozy Pallet-Town village)
//  A hand-authored top-down town built from the Kenney "Tiny Town" CC0 tileset
//  (16px tiles, /assets/tinytown/tilemap_packed.png). Grass is a tiling ground;
//  six themed cottages (roofs tinted per-world) ring a central Town Hall that
//  MATURES with progress (Class → Town → City → Kingdom). Befriended kin roam
//  their yards; our Buddy avatar (with mount) walks 4-directionally. The camera
//  FOLLOWS the avatar, but the scene opens zoomed-out so all six worlds are
//  visible, then eases in. Kin/avatar are crisp SVG→texture sprites.
// ============================================================

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useAppStore } from '@store/appStore'
import KinSprite from './KinSprite'
import MountSprite from './MountSprite'
import Buddy from '@components/avatar/Buddy'
import Joystick from '@components/ui/Joystick'
import { myMounts } from '@lib/mounts'
import type { KinInstance } from '@lib/nexus'

// ---- world palette (order matters — placed around the town) ----
const GATES = [
  { world: 'num', name: 'Numeria',  hex: 0xf59e0b, emoji: '☀️', col: 9,  row: 6 },
  { world: 'wrd', name: 'Wordveil', hex: 0x3b82f6, emoji: '📖', col: 33, row: 7 },
  { world: 'lif', name: 'Meadow',   hex: 0xec4899, emoji: '💗', col: 38, row: 18 },
  { world: 'wld', name: 'Lagoon',   hex: 0xf97316, emoji: '🌊', col: 31, row: 27 },
  { world: 'won', name: 'Skyfield', hex: 0x8b5cf6, emoji: '✨', col: 11, row: 26 },
  { world: 'log', name: 'Circuit',  hex: 0x22c55e, emoji: '🔌', col: 5,  row: 17 },
]
const STAGE_NAMES = ['Class', 'Town', 'City', 'Kingdom']

// ---- Kenney Tiny Town tile indices (12-col sheet; index = row*12 + col) ----
const T = 16, COLS = 44, ROWS = 34, BASEW = COLS * T, BASEH = ROWS * T
const SHEET_COLS = 12
const TILE = { GRASS: 0, PINE: 4, TREE: 16, BUSH: 28, FLOWER: 29, FENCE: 45, ROOF_L: 49, ROOF_R: 50, WALL: 73, DOOR: 74, CRATE: 83 }
const KEEP_C = 22, KEEP_R = 16 // town-hall anchor (tile coords)

function svgTex(node: ReactElement): string {
  let s = renderToStaticMarkup(node)
  if (!s.includes('xmlns')) s = s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)
}
async function rasterize(url: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const img = new Image(); img.decoding = 'async'; img.src = url
  await img.decode().catch(() => {})
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d')?.drawImage(img, 0, 0, w, h)
  return c
}
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export default function KinWorldGame({ roster, stage, onEnterDungeon, onOpenHall, onEnterKinQuest }: {
  roster: KinInstance[]; stage: number; onEnterDungeon: (world: string) => void; onOpenHall: () => void; onEnterKinQuest: () => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const controls = useRef({ dx: 0, dy: 0 })
  const [near, setNear] = useState<{ world: string; name: string; hex: number } | null>(null)
  const nearRef = useRef(setNear); nearRef.current = setNear
  const cbRef = useRef({ onEnterDungeon, onOpenHall, onEnterKinQuest }); cbRef.current = { onEnterDungeon, onOpenHall, onEnterKinQuest }
  const outfit = useAppStore(s => s.resolvedOutfit())
  const [mountId, setMountId] = useState<string | undefined>(undefined)
  useEffect(() => { myMounts().then(m => setMountId(m.equipped ?? undefined)) }, [])

  const sig = roster.map(r => r.id).join(',')
  const textures = useMemo(() => {
    const t: Record<string, string> = {}
    const seen = new Set<string>()
    roster.slice(0, 12).forEach(r => { if (!seen.has(r.kin_key)) { seen.add(r.kin_key); t[r.kin_key] = svgTex(<KinSprite kin={r.kin_key} size={80} />) } })
    t['__avatar'] = svgTex(<Buddy mood="idle" size={96} outfit={outfit} />)
    if (mountId) t['__mount'] = svgTex(<MountSprite mount={mountId} size={104} />)
    return t
  }, [sig, mountId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let destroyed = false
    let app: any = null
    const parent = parentRef.current
    const guards = roster.slice(0, 12).map(r => r.kin_key)
    const hasMount = !!mountId
    const keys: Record<string, boolean> = {}
    const kd = (e: KeyboardEvent) => { if (/^Arrow|^[wasdWASD]$/.test(e.key)) { keys[e.key.toLowerCase()] = true; e.preventDefault() } }
    const ku = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false }

    ;(async () => {
      try {
        const PIXI: any = await import('pixi.js')
        if (destroyed || !parent) return
        app = new PIXI.Application()
        await app.init({ backgroundAlpha: 0, antialias: false, resizeTo: parent, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
        if (destroyed) { app.destroy(true); return }
        parent.appendChild(app.canvas)

        // ---- load the Kenney tilesheet & slice sub-textures (nearest = crisp pixels) ----
        const sheet = await PIXI.Assets.load(`${import.meta.env.BASE_URL}assets/tinytown/tilemap_packed.png`)
        if (destroyed) return
        sheet.source.scaleMode = 'nearest'
        const texCache: Record<number, any> = {}
        const tile = (idx: number) => {
          if (!texCache[idx]) {
            const c = idx % SHEET_COLS, r = Math.floor(idx / SHEET_COLS)
            texCache[idx] = new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(c * T, r * T, T, T) })
          }
          return texCache[idx]
        }

        const world = new PIXI.Container(); app.stage.addChild(world)
        const blocked = new Set<string>()
        const block = (c: number, r: number) => blocked.add(c + ',' + r)

        // ground — one tiling sprite of grass across the whole map
        const ground = new PIXI.TilingSprite({ texture: tile(TILE.GRASS), width: BASEW, height: BASEH })
        world.addChild(ground)

        // tap-to-walk: an invisible full-map layer UNDER the entities. Tapping the
        // map sets a walk target; tapping on/near a gate snaps to its porch so the
        // hero strolls right up to the entrance. (`doors` is filled in below; this
        // handler only runs on a later tap, so the reference is safe.)
        const tapLayer = new PIXI.Graphics()
        tapLayer.rect(0, 0, BASEW, BASEH).fill({ color: 0x000000, alpha: 0.001 })
        tapLayer.eventMode = 'static'
        tapLayer.on('pointertap', (e: any) => {
          const p = world.toLocal(e.global)
          let tx = p.x, ty = p.y
          let best = 1e9, bx = tx, by = ty
          for (const d of doors) { const dd = Math.hypot(d.x - tx, d.y - ty); if (dd < best) { best = dd; bx = d.x; by = d.y } }
          if (best < 2.4 * T) { tx = bx; ty = by }
          moveTarget = { x: clamp(tx, T + 4, BASEW - T - 4), y: clamp(ty, T + 4, BASEH - T - 4) }
          stuck = 0
        })
        world.addChild(tapLayer)

        // soft dirt trails from the town hall out to each cottage (drawn under entities)
        const paths = new PIXI.Graphics()
        const kcx = (KEEP_C + 1) * T, kcy = (KEEP_R + 1) * T
        GATES.forEach((g, i) => {
          const gx = (g.col + 1) * T, gy = (g.row + 1) * T
          const dx = gx - kcx, dy = gy - kcy, len = Math.hypot(dx, dy) || 1
          const ox = -dy / len, oy = dx / len, off = 40 * (i % 2 ? 1 : -1)
          const mx = (kcx + gx) / 2 + ox * off, my = (kcy + gy) / 2 + oy * off
          paths.moveTo(kcx, kcy).quadraticCurveTo(mx, my, gx, gy).stroke({ width: 16, color: 0xcdb488, alpha: 0.55, cap: 'round' })
        })
        world.addChild(paths)

        // entities layer (depth-sorted by baseline so the hero passes behind things above him)
        const ent = new PIXI.Container(); ent.sortableChildren = true; world.addChild(ent)
        const put = (idx: number, col: number, row: number, tint?: number, z?: number) => {
          const s = new PIXI.Sprite(tile(idx)); s.x = col * T; s.y = row * T
          if (tint !== undefined) s.tint = tint
          s.zIndex = z ?? (row + 1) * T; ent.addChild(s); return s
        }

        // deterministic RNG (shared by scatter + decor) and the animated scene state
        let seed = 1337; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
        const roamers: { s: any; hx: number; hy: number; ang: number; rad: number; spd: number; t: number }[] = []
        const sparkles: { s: any; vx: number; vy: number; t: number }[] = []
        const shimmers: any[] = []
        const butterflies: { s: any; t: number; cx: number; cy: number; rx: number; ry: number; sp: number }[] = []
        let hero: any = null, nearWorld: string | null = null, clock = 0, intro = 0
        let moveTarget: { x: number; y: number } | null = null, stuck = 0

        // border forest — frames the map and forms the walls of the world
        for (let c = 0; c < COLS; c++) { put(c % 2 ? TILE.TREE : TILE.PINE, c, 0); block(c, 0); put(c % 2 ? TILE.PINE : TILE.TREE, c, ROWS - 1); block(c, ROWS - 1) }
        for (let r = 1; r < ROWS - 1; r++) { put(r % 2 ? TILE.TREE : TILE.PINE, 0, r); block(0, r); put(r % 2 ? TILE.PINE : TILE.TREE, COLS - 1, r); block(COLS - 1, r) }

        // a 2×2 cottage: tinted roof over a wall with a door. Footprint is solid; the
        // tile just below the door is the "porch" you walk onto to enter.
        const cottage = (col: number, row: number, hex: number) => {
          put(TILE.ROOF_L, col, row, hex); put(TILE.ROOF_R, col + 1, row, hex)
          put(TILE.WALL, col, row + 1); put(TILE.DOOR, col + 1, row + 1)
          block(col, row); block(col + 1, row); block(col, row + 1); block(col + 1, row + 1)
        }

        // six world cottages + a signpost flag + label
        const doors: { world: string; name: string; hex: number; x: number; y: number }[] = []
        GATES.forEach(g => {
          cottage(g.col, g.row, g.hex)
          const px = (g.col + 1) * T, py = (g.row + 2) * T // porch centre (in front of the door)
          doors.push({ world: g.world, name: g.name, hex: g.hex, x: px, y: py })
          // little pennant on the roof
          const flag = new PIXI.Graphics()
          flag.rect(0, -18, 2, 18).fill(0x6b5b3a); flag.poly([2, -18, 14, -14, 2, -10]).fill(g.hex)
          flag.position.set((g.col + 1) * T, g.row * T); flag.zIndex = g.row * T - 2; ent.addChild(flag)
          label(PIXI, ent, g.name, (g.col + 1) * T, (g.row + 2) * T + 9, 12)
        })

        // ---- seaside PORT → sails to KinQuest (the flagship game) ----
        const portC = 20, portR = 29
        {
          const wx = portC * T, wy = (portR + 1) * T
          const water = new PIXI.Graphics()
          water.roundRect(wx - 3 * T, wy - 2, 6 * T, 3 * T, 10).fill(0x3f9fd0)
          water.roundRect(wx - 3 * T + 4, wy - 2 + 4, 6 * T - 8, 3 * T - 8, 8).fill(0x63c4ea)
          water.zIndex = wy - 40; ent.addChild(water)
          for (let dc = -3; dc <= 2; dc++) for (let dr = 0; dr <= 2; dr++) block(portC + dc, portR + 1 + dr)
          // dock planks (walkable) + posts
          put(TILE.FENCE, portC - 1, portR); put(TILE.FENCE, portC + 1, portR)
          // a little sailing boat in the water
          const boat = new PIXI.Graphics()
          const bx = portC * T, by = (portR + 1) * T + 10
          boat.moveTo(bx - 15, by).lineTo(bx + 15, by).lineTo(bx + 10, by + 9).lineTo(bx - 10, by + 9).closePath().fill(0x8b5a2b)
          boat.rect(bx - 1, by - 22, 2, 22).fill(0x6b4423)
          boat.moveTo(bx + 1, by - 22).lineTo(bx + 14, by - 8).lineTo(bx + 1, by - 8).closePath().fill(0xffd700)
          boat.zIndex = by + 4; ent.addChild(boat)
          // interaction porch on the dock front + a golden anchor sign
          doors.push({ world: '__kq__', name: 'KinQuest', hex: 0xf0a83a, x: portC * T, y: portR * T })
          const anchor = new PIXI.Text({ text: '⚓', style: { fontFamily: 'Arial', fontSize: 16 } })
          anchor.anchor.set(0.5); anchor.position.set(portC * T, (portR - 1) * T + 2); anchor.zIndex = 99990; ent.addChild(anchor)
          label(PIXI, ent, 'KinQuest', portC * T, (portR - 1) * T + 16, 12, 0xf0a83a)
        }

        // central Town Hall — grows with stage, built from the same tiles, gold roofs
        const GOLD = 0xf3c34e
        const kc = KEEP_C, kr = KEEP_R
        cottage(kc, kr, GOLD) // core (all stages)
        if (stage >= 1) { cottage(kc - 2, kr, GOLD); cottage(kc + 2, kr, GOLD) } // wings → Town
        if (stage >= 2) { // gate towers → City
          ;[kc - 1, kc + 2].forEach(tx => { put(TILE.WALL, tx, kr + 2); put(TILE.ROOF_L, tx, kr + 1, GOLD); block(tx, kr + 1); block(tx, kr + 2) })
        }
        if (stage >= 3) { // second storey + banners → Kingdom
          put(TILE.ROOF_L, kc, kr - 1, GOLD); put(TILE.ROOF_R, kc + 1, kr - 1, GOLD); block(kc, kr - 1); block(kc + 1, kr - 1)
        }
        // hall is tappable (opens the Town Hall sheet)
        const hallHit = new PIXI.Container(); hallHit.position.set((kc + 1) * T, (kr + 1) * T)
        hallHit.eventMode = 'static'; hallHit.cursor = 'pointer'
        hallHit.hitArea = new PIXI.Rectangle(-46, -46, 92, 92); hallHit.on('pointertap', () => cbRef.current.onOpenHall())
        hallHit.zIndex = 99998; ent.addChild(hallHit)
        // label sits ABOVE the castle (a banner) so it never covers the hero below
        label(PIXI, ent, STAGE_NAMES[stage] ?? 'Town Hall', (kc + 1) * T, (kr - 1) * T - 6, 14, GOLD)

        // ---- extra life around the kingdom: ponds, a little market, fences, lamps ----
        // two ponds in open ground (blocked, so you stroll around them) with a shimmer
        ;[[15, 25], [32, 11]].forEach(([pc, pr]) => {
          const x = pc * T, y = pr * T
          const g = new PIXI.Graphics()
          g.ellipse(x, y, 30, 19).fill(0x3f9fd0); g.ellipse(x, y, 24, 14).fill(0x63c4ea)
          g.zIndex = y - 60; ent.addChild(g)
          const sh = new PIXI.Graphics(); sh.ellipse(x - 8, y - 5, 12, 5).fill({ color: 0xffffff, alpha: 0.5 }); sh.zIndex = y - 59; ent.addChild(sh); shimmers.push(sh)
          for (let dc = -2; dc <= 2; dc++) for (let dr = -1; dr <= 1; dr++) block(pc + dc, pr + dr)
          // a ring of reeds/bushes softening the bank
          ;[[pc - 2, pr - 1], [pc + 2, pr + 1], [pc + 2, pr - 1]].forEach(([bc, br]) => put(TILE.BUSH, bc, br, undefined, y - 58))
        })
        // a small market square in front of the hall — crates + fence rails + lamps
        ;[[kc - 3, kr + 3], [kc + 4, kr + 3], [kc + 4, kr + 2]].forEach(([c, r]) => { put(TILE.CRATE, c, r); block(c, r) })
        ;[kc - 4, kc - 3, kc + 5, kc + 6].forEach(c => { put(TILE.FENCE, c, kr + 4); block(c, kr + 4) })
        ;[[kc - 2, kr + 5], [kc + 3, kr + 5]].forEach(([c, r]) => {
          const lp = new PIXI.Graphics()
          lp.circle(c * T + 8, r * T, 10).fill({ color: 0xffe6a0, alpha: 0.45 })
          lp.rect(c * T + 7, r * T, 2, 12).fill(0x5b4a32); lp.circle(c * T + 8, r * T, 3.5).fill(0xfff3c4)
          lp.zIndex = r * T + 14; ent.addChild(lp)
        })
        // butterflies drifting over the gardens
        const BFLY = [0xff9ec4, 0xffd36b, 0x8fd0ff, 0xc4a8ff]
        for (let i = 0; i < 5; i++) {
          const col = BFLY[i % BFLY.length], b = new PIXI.Graphics()
          b.ellipse(-3, 0, 3, 4).fill(col); b.ellipse(3, 0, 3, 4).fill(col); b.rect(-0.6, -3, 1.2, 6).fill(0x4a3a28)
          const cx = 4 * T + rnd() * (COLS - 8) * T, cy = 4 * T + rnd() * (ROWS - 8) * T
          b.position.set(cx, cy); b.zIndex = 99996; ent.addChild(b)
          butterflies.push({ s: b, t: rnd() * 6.28, cx, cy, rx: 40 + rnd() * 50, ry: 26 + rnd() * 34, sp: 0.02 + rnd() * 0.02 })
        }

        // lush greenery filling the open grass (deterministic). Interior trees are
        // DECORATIVE (walkable) so density never traps the hero; the hall plaza,
        // porches and the spawn stay clear.
        const kx0 = (KEEP_C + 1) * T, ky0 = (KEEP_R + 1) * T
        const spawnX = (KEEP_C + 1) * T, spawnY = (KEEP_R + 4) * T
        const clearOf = (x: number, y: number) => {
          if (Math.hypot(x - kx0, y - ky0) < 5.2 * T) return true
          if (Math.hypot(x - spawnX, y - spawnY) < 2.6 * T) return true
          for (const d of doors) if (Math.hypot(x - d.x, y - d.y) < 2.2 * T) return true
          return false
        }
        const taken = new Set<string>()
        for (let i = 0; i < 150; i++) {
          const c = 2 + Math.floor(rnd() * (COLS - 4)), r = 2 + Math.floor(rnd() * (ROWS - 4))
          const key = c + ',' + r
          if (blocked.has(key) || taken.has(key)) continue
          const x = c * T, y = r * T
          if (clearOf(x, y)) continue
          taken.add(key)
          const roll = rnd()
          put(roll < 0.64 ? (rnd() < 0.5 ? TILE.TREE : TILE.PINE) : roll < 0.84 ? TILE.BUSH : TILE.FLOWER, c, r)
        }

        // gate porch prompts (an "Enter" pill that pops when the hero is close)
        const prompts: Record<string, any> = {}
        doors.forEach(d => {
          const pr = new PIXI.Container(); pr.position.set(d.x, d.y - 30); pr.visible = false; pr.zIndex = 99999
          const pt = new PIXI.Text({ text: 'Enter →', style: { fontFamily: 'Arial, sans-serif', fontSize: 13, fontWeight: '700', fill: 0xffffff } }); pt.anchor.set(0.5)
          const pb = new PIXI.Graphics(); pb.roundRect(-pt.width / 2 - 8, -12, pt.width + 16, 24, 12).fill(d.hex)
          pr.addChild(pb); pr.addChild(pt); ent.addChild(pr); prompts[d.world] = pr
        })

        // drifting fireflies
        for (let i = 0; i < 14; i++) {
          const sp = new PIXI.Graphics(); sp.circle(0, 0, 2).fill({ color: 0xfff2b0, alpha: 0.9 })
          sp.position.set(Math.random() * BASEW, Math.random() * BASEH); sp.zIndex = 99997; ent.addChild(sp)
          sparkles.push({ s: sp, vx: (Math.random() - 0.5) * 0.3, vy: -0.15 - Math.random() * 0.25, t: Math.random() * 6 })
        }

        window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)

        const INTRO_MS = 2400
        app.ticker.add((tk: any) => {
          if (destroyed) return
          const dt = tk.deltaTime, ms = tk.deltaMS
          clock += dt; intro += ms

          // hero movement (4-directional, slow & elegant) with soft building collision
          if (hero) {
            // analog movement — keyboard gives ±1 per axis, joystick gives a vector
            let vx = 0, vy = 0
            if (keys['arrowleft'] || keys['a']) vx -= 1
            if (keys['arrowright'] || keys['d']) vx += 1
            if (keys['arrowup'] || keys['w']) vy -= 1
            if (keys['arrowdown'] || keys['s']) vy += 1
            if (controls.current.dx !== 0 || controls.current.dy !== 0) { vx = controls.current.dx; vy = controls.current.dy }
            const feetY = () => hero.y + 6
            const spd = 1.7 * dt
            const stepX = (nvx: number) => { const nx = clamp(hero.x + nvx * spd, T + 4, BASEW - T - 4); if (!blocked.has(Math.floor(nx / T) + ',' + Math.floor(feetY() / T))) { hero.x = nx; return true } return false }
            const stepY = (nvy: number) => { const ny = clamp(hero.y + nvy * spd, T + 4, BASEH - T - 4); if (!blocked.has(Math.floor(hero.x / T) + ',' + Math.floor((ny + 6) / T))) { hero.y = ny; return true } return false }
            const mag = Math.hypot(vx, vy)
            if (mag > 0.01) {
              // manual control (joystick / keys) cancels any tap-to-walk
              moveTarget = null
              const nvx = vx / Math.max(1, mag), nvy = vy / Math.max(1, mag)
              if (Math.abs(nvx) > 0.02) hero.scale.x = nvx < 0 ? -Math.abs(hero.scale.x) : Math.abs(hero.scale.x)
              stepX(nvx); stepY(nvy)
              hero.pivot.y = Math.sin(clock * 0.4) * 1.5
            } else if (moveTarget) {
              // tap-to-walk: greedy step toward the target, sidestepping obstacles
              const dx = moveTarget.x - hero.x, dy = moveTarget.y - hero.y
              const dist = Math.hypot(dx, dy)
              if (dist < 16) { moveTarget = null; hero.pivot.y = 0 }
              else {
                const nvx = dx / dist, nvy = dy / dist
                if (Math.abs(nvx) > 0.02) hero.scale.x = nvx < 0 ? -Math.abs(hero.scale.x) : Math.abs(hero.scale.x)
                const px0 = hero.x, py0 = hero.y
                const movedX = stepX(nvx), movedY = stepY(nvy)
                // if the diagonal is blocked, keep sliding along whichever axis is free
                if (!movedX && !movedY) { if (!stepX(Math.sign(nvx)) ) stepY(Math.sign(nvy)) }
                hero.pivot.y = Math.sin(clock * 0.4) * 1.5
                stuck = (Math.abs(hero.x - px0) < 0.05 && Math.abs(hero.y - py0) < 0.05) ? stuck + 1 : 0
                if (stuck > 40) { moveTarget = null; stuck = 0 }
              }
            } else {
              hero.pivot.y = 0
            }
            hero.zIndex = hero.y + 20

            // nearest porch → prompt
            let found: { world: string; name: string; hex: number } | null = null
            for (const d of doors) if (Math.hypot(d.x - hero.x, d.y - hero.y) < 40) { found = d; break }
            const fw = found ? found.world : null
            for (const k in prompts) prompts[k].visible = fw === k
            if (fw !== nearWorld) { nearWorld = fw; nearRef.current(found) }
          }

          // befriended kin patrol a slow ring around the kingdom, guarding it
          roamers.forEach(r => {
            r.ang += r.spd * dt; r.t += 0.04 * dt
            r.s.x = r.hx + Math.cos(r.ang) * r.rad; r.s.y = r.hy + Math.sin(r.ang) * r.rad * 0.7
            r.s.zIndex = r.s.y + 10; r.s.pivot.y = Math.abs(Math.sin(r.t)) * 2
          })
          sparkles.forEach(sp => {
            sp.s.x += sp.vx * dt; sp.s.y += sp.vy * dt; sp.t += 0.05 * dt
            sp.s.alpha = 0.3 + Math.abs(Math.sin(sp.t)) * 0.6
            if (sp.s.y < -8) { sp.s.y = BASEH + 8; sp.s.x = Math.random() * BASEW }
          })
          shimmers.forEach((sh, i) => { sh.alpha = 0.3 + Math.abs(Math.sin(clock * 0.04 + i)) * 0.3 })
          butterflies.forEach(b => {
            b.t += b.sp * dt
            b.s.x = b.cx + Math.cos(b.t) * b.rx; b.s.y = b.cy + Math.sin(b.t * 1.6) * b.ry
            b.s.scale.x = Math.cos(b.t * 6) * 0.6 + 0.7 // wing flutter
          })

          // ---- camera: opens on the whole town (all 6 visible), then eases to a
          // close follow of the hero ----
          const fitZ = Math.min(app.screen.width / BASEW, app.screen.height / BASEH)
          const followZ = clamp(fitZ * 1.85, fitZ, 4)
          const e = easeInOut(clamp((intro - 700) / (INTRO_MS - 700), 0, 1))
          const z = fitZ + (followZ - fitZ) * e
          const mapCX = BASEW / 2, mapCY = BASEH / 2
          const tx = hero ? mapCX + (hero.x - mapCX) * e : mapCX
          const ty = hero ? mapCY + (hero.y - mapCY) * e : mapCY
          world.scale.set(z)
          let px = app.screen.width / 2 - tx * z, py = app.screen.height / 2 - ty * z
          px = BASEW * z > app.screen.width ? clamp(px, app.screen.width - BASEW * z, 0) : (app.screen.width - BASEW * z) / 2
          py = BASEH * z > app.screen.height ? clamp(py, app.screen.height - BASEH * z, 0) : (app.screen.height - BASEH * z) / 2
          world.position.set(px, py)
        })

        // ---- rasterise SVG kin + hero into crisp sprites ----
        // Befriended kin gather AROUND the kingdom (not out at the dungeon gates),
        // ringing the Town Hall to guard it. Each keeps a small local wander.
        const kx = (KEEP_C + 1) * T, ky = (KEEP_R + 1) * T
        const n = Math.max(1, guards.length)
        for (let i = 0; i < guards.length; i++) {
          const key = guards[i]
          if (!textures[key]) continue
          const canvas = await rasterize(textures[key], 80, 80)
          if (destroyed) return
          const a = (i / n) * Math.PI * 2 - Math.PI / 2
          const ring = 96 + (i % 3) * 20
          const hx = kx + Math.cos(a) * ring, hy = ky + Math.sin(a) * ring * 0.82 + 14
          const s = new PIXI.Sprite(PIXI.Texture.from(canvas)); s.anchor.set(0.5, 0.9); s.scale.set(0.42)
          s.position.set(hx, hy); s.zIndex = hy + 10; ent.addChild(s)
          roamers.push({ s, hx, hy, ang: rnd() * 6.28, rad: 8 + rnd() * 10, spd: 0.02 * (i % 2 ? 1 : -1), t: rnd() * 6 })
        }
        const avC = await rasterize(textures['__avatar'], 96, 96)
        if (destroyed) return
        const heroC = new PIXI.Container(); heroC.position.set((KEEP_C + 1) * T, (KEEP_R + 4) * T)
        if (textures['__mount']) { const mC = await rasterize(textures['__mount'], 104, 104); if (destroyed) return; const ms = new PIXI.Sprite(PIXI.Texture.from(mC)); ms.anchor.set(0.5, 0.85); ms.position.set(0, 8); ms.scale.set(0.68); heroC.addChild(ms) }
        // when mounted, the rider-head is seated ON the saddle (mid-back): center
        // anchor, small scale, nudged up+right — mirrors AvatarSprite's 0.43/34%/53%
        // tuning (see ride_preview.png) so the overworld matches the shop/battle.
        const rs = new PIXI.Sprite(PIXI.Texture.from(avC)); rs.anchor.set(0.5, hasMount ? 0.5 : 0.9); rs.position.set(hasMount ? 2 : 0, hasMount ? -12 : 0); rs.scale.set(hasMount ? 0.30 : 0.52); heroC.addChild(rs)
        heroC.zIndex = heroC.y + 20; ent.addChild(heroC); hero = heroC
      } catch (err) { console.error('[kinworld] pixi init failed:', err) }
    })()

    return () => {
      destroyed = true; setNear(null)
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
      try { if (app) app.destroy(true, { children: true }) } catch { /* ignore */ }
    }
  }, [sig, mountId, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="kw-game">
      <div ref={parentRef} className="kw-canvas" />
      {near && (
        <button className="kw-enter" style={{ background: `#${near.hex.toString(16).padStart(6, '0')}` }}
          onClick={() => (near.world === '__kq__' ? cbRef.current.onEnterKinQuest() : cbRef.current.onEnterDungeon(near.world))}>
          {near.world === '__kq__' ? `⚓ Sail to ${near.name} →` : `Enter ${near.name} →`}
        </button>
      )}
      <Joystick className="kw-joy" onChange={(dx, dy) => { controls.current = { dx, dy } }} />
    </div>
  )
}

// crisp Pixi text label with a soft white pill behind it
function label(PIXI: any, layer: any, text: string, x: number, y: number, size: number, accent?: number) {
  const t = new PIXI.Text({ text, style: { fontFamily: 'Arial, sans-serif', fontSize: size, fontWeight: '700', fill: accent ?? 0x2b2440 } })
  t.anchor.set(0.5); t.position.set(x, y); t.zIndex = 99990
  const bg = new PIXI.Graphics(); bg.roundRect(x - t.width / 2 - 6, y - t.height / 2 - 2, t.width + 12, t.height + 4, 7).fill({ color: 0xfffdf6, alpha: 0.92 })
  bg.zIndex = 99989; layer.addChild(bg); layer.addChild(t)
}
