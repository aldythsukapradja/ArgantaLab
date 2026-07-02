// ============================================================
//  ARGANTALAB · KINQUEST · SEEDLING TOWN  (PixiJS v8 — walkable overworld)
//  A Pokémon-style starter town built from the Kenney "Tiny Town" CC0 tileset
//  (16px tiles, /assets/tinytown/tilemap_packed.png). You walk an avatar
//  4-directionally around town: enter the Kin Center to heal, the Market to
//  shop, houses to talk, and the Gym to battle the Keeper. Wading into TALL
//  GRASS can trigger a wild-kin encounter. Camera follows the hero.
//
//  Engine (movement / camera / collision / tile-slicing) is adapted from the
//  proven KinWorldGame. Interactions are surfaced to React via refs so the
//  Pixi scene builds ONCE and never rebuilds on a callback change.
// ============================================================

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useAppStore } from '@store/appStore'
import Buddy from '@components/avatar/Buddy'
import { ELEMENT_META } from '@/data/kinquest'
import type { Element } from '@/data/openworld'

// ---- tile geometry (Tiny Town: 12-col sheet, index = row*12 + col) ----
const T = 16, COLS = 40, ROWS = 28, BASEW = COLS * T, BASEH = ROWS * T
const SHEET_COLS = 12
const TILE = { GRASS: 0, PINE: 4, TREE: 16, BUSH: 28, FLOWER: 29, FENCE: 45, ROOF_L: 49, ROOF_R: 50, WALL: 73, DOOR: 74, CRATE: 83 }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const hex2int = (h: string) => parseInt(h.replace('#', ''), 16)

// ---- town blueprint (positions in tile coords; roofs 2 wide) ----
export type ActionId = 'center' | 'market' | 'gym' | 'lab' | 'house1' | 'house2' | 'npc_guide' | 'npc_elder'
export interface ActionTarget { id: ActionId; label: string; kind: 'building' | 'npc' }

interface BDef { id: ActionId; col: number; row: number; roof: number; emoji: string; label: string }
const BUILDINGS: BDef[] = [
  { id: 'lab',     col: 18, row: 3,  roof: 0x8b5cf6, emoji: '🔬', label: "Prof's Lab" },
  { id: 'center',  col: 6,  row: 9,  roof: 0xef4444, emoji: '➕', label: 'Kin Center' },
  { id: 'market',  col: 30, row: 9,  roof: 0x3b82f6, emoji: '🛒', label: 'Market' },
  { id: 'house1',  col: 6,  row: 18, roof: 0x6b8e23, emoji: '🏠', label: 'House' },
  { id: 'house2',  col: 31, row: 18, roof: 0xa0522d, emoji: '🏠', label: 'House' },
  { id: 'gym',     col: 18, row: 20, roof: 0xf3c34e, emoji: '🏛', label: 'Gym' },
]
const GRASS_PATCHES = [
  { c: 9, r: 5, w: 5, h: 3 },
  { c: 24, r: 13, w: 6, h: 4 },
  { c: 14, r: 24, w: 6, h: 3 },
]
interface NDef { id: ActionId; col: number; row: number; color: number; emoji: string; label: string }
const NPCS: NDef[] = [
  { id: 'npc_guide', col: 20, row: 13, color: 0x4dabf7, emoji: '🧒', label: 'Talk' },
  { id: 'npc_elder', col: 16, row: 22, color: 0xb197fc, emoji: '🧓', label: 'Talk' },
]
const SPAWN_C = 20, SPAWN_R = 15

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

export default function KinQuestTown({
  paused, gymElement, gymSealed, onAction, onEncounter,
}: {
  paused: boolean
  gymElement: Element
  gymSealed: boolean
  onAction: (t: ActionTarget) => void
  onEncounter: () => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const controls = useRef({ dx: 0, dy: 0 })
  const [near, setNear] = useState<ActionTarget | null>(null)
  const nearRef = useRef(setNear); nearRef.current = setNear
  const pausedRef = useRef(paused); pausedRef.current = paused
  const cbRef = useRef({ onAction, onEncounter }); cbRef.current = { onAction, onEncounter }
  const outfit = useAppStore(s => s.resolvedOutfit())

  const avatarTex = useMemo(() => svgTex(<Buddy mood="idle" size={96} outfit={outfit} />), [JSON.stringify(outfit)])

  useEffect(() => {
    let destroyed = false
    let app: any = null
    const parent = parentRef.current
    const keys: Record<string, boolean> = {}
    const kd = (e: KeyboardEvent) => { if (/^Arrow|^[wasdWASD]$/.test(e.key)) { keys[e.key.toLowerCase()] = true; e.preventDefault() } }
    const ku = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false }

    ;(async () => {
      try {
        const PIXI: any = await import('pixi.js')
        if (destroyed || !parent) return
        app = new PIXI.Application()
        await app.init({ backgroundAlpha: 0, antialias: false, resizeTo: parent, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
        if (destroyed || !app.stage) { try { app.destroy(true) } catch { /* gone */ } return }
        parent.appendChild(app.canvas)

        const sheet = await PIXI.Assets.load(`${import.meta.env.BASE_URL}assets/tinytown/tilemap_packed.png`)
        if (destroyed || !app.stage) { try { app.destroy(true) } catch { /* gone */ } return }
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
        const grass = new Set<string>()
        const block = (c: number, r: number) => blocked.add(c + ',' + r)

        // ground
        const ground = new PIXI.TilingSprite({ texture: tile(TILE.GRASS), width: BASEW, height: BASEH })
        world.addChild(ground)

        // dirt paths — a plaza cross + spurs to each building porch
        const doors = BUILDINGS.map(b => ({ ...b, px: (b.col + 1) * T, py: (b.row + 2) * T }))
        const paths = new PIXI.Graphics()
        const cx = SPAWN_C * T, cy = SPAWN_R * T
        paths.moveTo(4 * T, cy).lineTo((COLS - 4) * T, cy).stroke({ width: 15, color: 0xcdb488, alpha: 0.6, cap: 'round' })
        paths.moveTo(cx, 5 * T).lineTo(cx, (ROWS - 4) * T).stroke({ width: 15, color: 0xcdb488, alpha: 0.6, cap: 'round' })
        for (const d of doors) {
          paths.moveTo(d.px, d.py).lineTo(clamp(d.px, cx - 1, cx + 1) === d.px ? d.px : cx, d.py).lineTo(cx, cy)
            .stroke({ width: 11, color: 0xcdb488, alpha: 0.5, cap: 'round' })
        }
        world.addChild(paths)

        // tall-grass patches (walkable; darker green blades; trigger encounters)
        const grassG = new PIXI.Graphics()
        for (const p of GRASS_PATCHES) {
          for (let dc = 0; dc < p.w; dc++) for (let dr = 0; dr < p.h; dr++) {
            const c = p.c + dc, r = p.r + dr, x = c * T, y = r * T
            grass.add(c + ',' + r)
            grassG.rect(x, y, T, T).fill({ color: 0x2f8f3f, alpha: 0.85 })
            grassG.rect(x, y, T, T).fill({ color: 0x256f31, alpha: 0.25 })
            // little blades
            for (let b = 0; b < 3; b++) {
              const bx = x + 3 + b * 5
              grassG.moveTo(bx, y + T - 2).lineTo(bx - 1.5, y + T - 7).moveTo(bx, y + T - 2).lineTo(bx + 1.5, y + T - 7)
                .stroke({ width: 1, color: 0x1e5a28, alpha: 0.7 })
            }
          }
        }
        world.addChild(grassG)

        // entities layer (depth-sorted)
        const ent = new PIXI.Container(); ent.sortableChildren = true; world.addChild(ent)
        const put = (idx: number, col: number, row: number, tint?: number, z?: number) => {
          const s = new PIXI.Sprite(tile(idx)); s.x = col * T; s.y = row * T
          if (tint !== undefined) s.tint = tint
          s.zIndex = z ?? (row + 1) * T; ent.addChild(s); return s
        }

        let seed = 20260702; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
        const butterflies: { s: any; t: number; cx: number; cy: number; rx: number; ry: number; sp: number }[] = []
        const shimmers: any[] = []
        let hero: any = null, lastTile = '', clock = 0, lastNearId: string | null = null

        // border forest walls
        for (let c = 0; c < COLS; c++) { put(c % 2 ? TILE.TREE : TILE.PINE, c, 0); block(c, 0); put(c % 2 ? TILE.PINE : TILE.TREE, c, ROWS - 1); block(c, ROWS - 1) }
        for (let r = 1; r < ROWS - 1; r++) { put(r % 2 ? TILE.TREE : TILE.PINE, 0, r); block(0, r); put(r % 2 ? TILE.PINE : TILE.TREE, COLS - 1, r); block(COLS - 1, r) }

        // a building: tinted 2×2 roof over wall+door; footprint solid; porch below the door
        const targets: { id: ActionId; label: string; kind: 'building' | 'npc'; x: number; y: number }[] = []
        for (const b of doors) {
          put(TILE.ROOF_L, b.col, b.row, b.roof); put(TILE.ROOF_R, b.col + 1, b.row, b.roof)
          put(TILE.WALL, b.col, b.row + 1); put(TILE.DOOR, b.col + 1, b.row + 1)
          block(b.col, b.row); block(b.col + 1, b.row); block(b.col, b.row + 1); block(b.col + 1, b.row + 1)
          targets.push({ id: b.id, label: b.label, kind: 'building', x: b.px, y: b.py })
          // floating emoji marker above the roof
          const mk = new PIXI.Text({ text: b.emoji, style: { fontFamily: 'Arial', fontSize: 16 } })
          mk.anchor.set(0.5); mk.position.set((b.col + 1) * T, b.row * T - 12); mk.zIndex = 99990; ent.addChild(mk)
          label(PIXI, ent, b.label, (b.col + 1) * T, (b.row + 2) * T + 9, 11, b.id === 'gym' ? hex2int(ELEMENT_META[gymElement].color) : undefined)
        }
        // gym crest badge over the gym roof (shows sealed ✓ once beaten)
        {
          const g = BUILDINGS.find(x => x.id === 'gym')!
          const crest = new PIXI.Text({ text: gymSealed ? '✅' : ELEMENT_META[gymElement].icon, style: { fontFamily: 'Arial', fontSize: 13, fill: hex2int(ELEMENT_META[gymElement].color), fontWeight: '700' } })
          crest.anchor.set(0.5); crest.position.set((g.col + 1) * T, g.row * T - 26); crest.zIndex = 99991; ent.addChild(crest)
        }

        // a decorative pond (blocked)
        {
          const pc = 34, pr = 22, x = pc * T, y = pr * T
          const g = new PIXI.Graphics()
          g.ellipse(x, y, 28, 17).fill(0x3f9fd0); g.ellipse(x, y, 22, 12).fill(0x63c4ea)
          g.zIndex = y - 60; ent.addChild(g)
          const sh = new PIXI.Graphics(); sh.ellipse(x - 7, y - 4, 10, 4).fill({ color: 0xffffff, alpha: 0.5 }); sh.zIndex = y - 59; ent.addChild(sh); shimmers.push(sh)
          for (let dc = -2; dc <= 2; dc++) for (let dr = -1; dr <= 1; dr++) block(pc + dc, pr + dr)
        }

        // NPCs — a little body + head, with a floating emoji, gentle idle bob
        const npcSprites: { s: any; baseY: number; ph: number }[] = []
        for (const n of NPCS) {
          const x = n.col * T + T / 2, y = n.row * T + T
          const c = new PIXI.Container(); c.position.set(x, y); c.zIndex = y + 6
          const body = new PIXI.Graphics()
          body.roundRect(-5, -12, 10, 12, 4).fill(n.color)
          body.circle(0, -14, 5).fill(0xf6c89a) // head
          c.addChild(body)
          const mk = new PIXI.Text({ text: n.emoji, style: { fontFamily: 'Arial', fontSize: 13 } }); mk.anchor.set(0.5); mk.position.set(0, -26); c.addChild(mk)
          ent.addChild(c)
          block(n.col, n.row)
          targets.push({ id: n.id, label: n.label, kind: 'npc', x, y: y + T })
          npcSprites.push({ s: c, baseY: y, ph: rnd() * 6.28 })
        }

        // scattered greenery in open ground (walkable decor)
        const clearOf = (x: number, y: number) => {
          if (Math.hypot(x - SPAWN_C * T, y - SPAWN_R * T) < 2.4 * T) return true
          for (const t of targets) if (Math.hypot(x - t.x, y - t.y) < 2 * T) return true
          return false
        }
        const taken = new Set<string>()
        for (let i = 0; i < 120; i++) {
          const c = 2 + Math.floor(rnd() * (COLS - 4)), r = 2 + Math.floor(rnd() * (ROWS - 4))
          const key = c + ',' + r
          if (blocked.has(key) || grass.has(key) || taken.has(key)) continue
          const x = c * T, y = r * T
          if (clearOf(x, y)) continue
          taken.add(key)
          const roll = rnd()
          put(roll < 0.5 ? (rnd() < 0.5 ? TILE.TREE : TILE.PINE) : roll < 0.8 ? TILE.BUSH : TILE.FLOWER, c, r)
        }

        // context-action prompt bubbles above each target
        const prompts: Record<string, any> = {}
        for (const t of targets) {
          const pr = new PIXI.Container(); pr.position.set(t.x, t.y - 34); pr.visible = false; pr.zIndex = 99999
          const pt = new PIXI.Text({ text: t.kind === 'npc' ? '💬' : '⤵', style: { fontFamily: 'Arial', fontSize: 13, fontWeight: '700', fill: 0xffffff } }); pt.anchor.set(0.5)
          const pb = new PIXI.Graphics(); pb.roundRect(-14, -12, 28, 24, 12).fill(0x2b2440)
          pr.addChild(pb); pr.addChild(pt); ent.addChild(pr); prompts[t.id] = pr
        }

        // butterflies
        const BFLY = [0xff9ec4, 0xffd36b, 0x8fd0ff, 0xc4a8ff]
        for (let i = 0; i < 5; i++) {
          const col = BFLY[i % BFLY.length], b = new PIXI.Graphics()
          b.ellipse(-3, 0, 3, 4).fill(col); b.ellipse(3, 0, 3, 4).fill(col); b.rect(-0.6, -3, 1.2, 6).fill(0x4a3a28)
          const bx = 4 * T + rnd() * (COLS - 8) * T, by = 4 * T + rnd() * (ROWS - 8) * T
          b.position.set(bx, by); b.zIndex = 99996; ent.addChild(b)
          butterflies.push({ s: b, t: rnd() * 6.28, cx: bx, cy: by, rx: 34 + rnd() * 40, ry: 22 + rnd() * 28, sp: 0.02 + rnd() * 0.02 })
        }

        window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)

        app.ticker.add((tk: any) => {
          if (destroyed) return
          const dt = tk.deltaTime
          clock += dt

          if (hero && !pausedRef.current) {
            let vx = 0, vy = 0
            if (keys['arrowleft'] || keys['a']) vx = -1
            else if (keys['arrowright'] || keys['d']) vx = 1
            else if (keys['arrowup'] || keys['w']) vy = -1
            else if (keys['arrowdown'] || keys['s']) vy = 1
            if (controls.current.dx) { vx = controls.current.dx; vy = 0 }
            else if (controls.current.dy) { vy = controls.current.dy; vx = 0 }
            if (vx) hero.scale.x = vx < 0 ? -Math.abs(hero.scale.x) : Math.abs(hero.scale.x)
            const spd = 1.5 * dt
            const feetY = () => hero.y + 6
            const nx = clamp(hero.x + vx * spd, T + 4, BASEW - T - 4)
            if (!blocked.has(Math.floor(nx / T) + ',' + Math.floor(feetY() / T))) hero.x = nx
            const ny = clamp(hero.y + vy * spd, T + 4, BASEH - T - 4)
            if (!blocked.has(Math.floor(hero.x / T) + ',' + Math.floor((ny + 6) / T))) hero.y = ny
            hero.zIndex = hero.y + 20
            const bob = (vx || vy) ? Math.sin(clock * 0.4) * 1.5 : 0
            hero.pivot.y = bob

            // nearest interactable → context prompt (only push to React on CHANGE)
            let found: { id: ActionId; label: string; kind: 'building' | 'npc' } | null = null
            for (const t of targets) if (Math.hypot(t.x - hero.x, t.y - hero.y) < 34) { found = { id: t.id, label: t.label, kind: t.kind }; break }
            const fid = found ? found.id : null
            for (const k in prompts) prompts[k].visible = fid === k
            if (fid !== lastNearId) { lastNearId = fid; nearRef.current(found) }

            // tall-grass encounter check on entering a NEW grass tile
            const tc = Math.floor(hero.x / T), tr = Math.floor(feetY() / T), key = tc + ',' + tr
            if (key !== lastTile) {
              lastTile = key
              if ((vx || vy) && grass.has(key) && Math.random() < 0.14) {
                cbRef.current.onEncounter()
              }
            }
          }

          npcSprites.forEach(n => { n.s.pivot.y = Math.sin(clock * 0.08 + n.ph) * 1.2 })
          shimmers.forEach((sh, i) => { sh.alpha = 0.3 + Math.abs(Math.sin(clock * 0.04 + i)) * 0.3 })
          butterflies.forEach(b => {
            b.t += b.sp * dt
            b.s.x = b.cx + Math.cos(b.t) * b.rx; b.s.y = b.cy + Math.sin(b.t * 1.6) * b.ry
            b.s.scale.x = Math.cos(b.t * 6) * 0.6 + 0.7
          })

          // camera: fixed comfortable follow, clamped to map bounds
          const z = clamp(app.screen.width / (15 * T), 1.4, 4)
          world.scale.set(z)
          const tx = hero ? hero.x : BASEW / 2, ty = hero ? hero.y : BASEH / 2
          let px = app.screen.width / 2 - tx * z, py = app.screen.height / 2 - ty * z
          px = BASEW * z > app.screen.width ? clamp(px, app.screen.width - BASEW * z, 0) : (app.screen.width - BASEW * z) / 2
          py = BASEH * z > app.screen.height ? clamp(py, app.screen.height - BASEH * z, 0) : (app.screen.height - BASEH * z) / 2
          world.position.set(px, py)
        })

        // rasterise the avatar
        const avC = await rasterize(avatarTex, 96, 96)
        if (destroyed || !app.stage) return
        const heroC = new PIXI.Container(); heroC.position.set(SPAWN_C * T, SPAWN_R * T)
        const rs = new PIXI.Sprite(PIXI.Texture.from(avC)); rs.anchor.set(0.5, 0.9); rs.scale.set(0.52); heroC.addChild(rs)
        heroC.zIndex = heroC.y + 20; ent.addChild(heroC); hero = heroC
      } catch (err) { console.error('[kinquest-town] pixi init failed:', err) }
    })()

    return () => {
      destroyed = true; setNear(null)
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
      try { if (app) app.destroy(true, { children: true }) } catch { /* ignore */ }
    }
  }, [avatarTex]) // eslint-disable-line react-hooks/exhaustive-deps

  const press = (dx: number, dy: number) => () => { controls.current = { dx, dy } }
  const release = () => { controls.current = { dx: 0, dy: 0 } }

  return (
    <div className="kqt">
      <div ref={parentRef} className="kqt-canvas" />
      {near && (
        <button className="kqt-action" onClick={() => cbRef.current.onAction(near)}>
          {near.kind === 'npc' ? '💬 Talk' : `⤵ Enter ${near.label}`}
        </button>
      )}
      <div className="kw-dpad kqt-dpad">
        <button className="dp dp-u" onPointerDown={press(0, -1)} onPointerUp={release} onPointerLeave={release} aria-label="Up">▲</button>
        <button className="dp dp-l" onPointerDown={press(-1, 0)} onPointerUp={release} onPointerLeave={release} aria-label="Left">◀</button>
        <button className="dp dp-r" onPointerDown={press(1, 0)} onPointerUp={release} onPointerLeave={release} aria-label="Right">▶</button>
        <button className="dp dp-d" onPointerDown={press(0, 1)} onPointerUp={release} onPointerLeave={release} aria-label="Down">▼</button>
      </div>
    </div>
  )
}

// crisp Pixi text label with a soft pill behind it
function label(PIXI: any, layer: any, text: string, x: number, y: number, size: number, accent?: number) {
  const t = new PIXI.Text({ text, style: { fontFamily: 'Arial, sans-serif', fontSize: size, fontWeight: '700', fill: accent ?? 0x2b2440 } })
  t.anchor.set(0.5); t.position.set(x, y); t.zIndex = 99990
  const bg = new PIXI.Graphics(); bg.roundRect(x - t.width / 2 - 6, y - t.height / 2 - 2, t.width + 12, t.height + 4, 7).fill({ color: 0xfffdf6, alpha: 0.92 })
  bg.zIndex = 99989; layer.addChild(bg); layer.addChild(t)
}
