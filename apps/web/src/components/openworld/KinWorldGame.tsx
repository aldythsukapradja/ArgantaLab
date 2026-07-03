// ============================================================
//  ARGANTALAB · KINWORLD  (PixiJS v8 — the Arganta island)
//  An ISLAND in the ocean, rebuilt on the "Arganta Atlas" PixelLab art pack
//  (/assets/atlas: ground fills, props, buildings). Six BIOME DISTRICTS —
//  each with its own ground + landmark building — ring a central Town Hall
//  that MATURES with progress (Class → Town → City → Kingdom), connected by
//  one winding ring road + spurs, with a decorative river and a south port
//  that sails to KinQuest. Befriended kin guard the hall; our Buddy avatar
//  (with mount) walks 4-directionally; the camera opens wide then follows.
//  The Kenney Tiny Town sheet is kept ONLY as a per-asset fallback so a
//  missing Atlas PNG can never break the world.
// ============================================================

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useAppStore } from '@store/appStore'
import KinSprite from './KinSprite'
import Buddy from '@components/avatar/Buddy'
import Joystick from '@components/ui/Joystick'
import { myMounts } from '@lib/mounts'
import type { KinInstance } from '@lib/nexus'

// ---- the six biome districts (compass preserved from the old spoke map:
// Numeria NW · Wordveil NE · Meadow E · Lagoon SE · Skyfield SW · Circuit W).
// Each district = its own Atlas ground + landmark building + signature prop. ----
// Positions are ADAPTED TO THE PAINTED ISLAND (assets/painted/island.png): the
// hall sits on the painted central plaza and each gate sits at a painted
// path-end. If the painting is regenerated, re-eyeball these anchors.
const GATES = [
  { world: 'num', name: 'Numeria',  hex: 0xf59e0b, col: 11, row: 10, ground: 'dune',    landmark: 'landmark_numeria',  prop: 'tree_palm' },
  { world: 'wrd', name: 'Wordveil', hex: 0x3b82f6, col: 22, row: 6,  ground: 'grass',   landmark: 'landmark_wordveil', prop: 'tree' },
  { world: 'lif', name: 'Meadow',   hex: 0xec4899, col: 43, row: 20, ground: 'meadow',  landmark: 'landmark_meadow',   prop: 'tree_pink' },
  { world: 'wld', name: 'Lagoon',   hex: 0xf97316, col: 34, row: 30, ground: 'reef',    landmark: 'landmark_lagoon',   prop: 'coral' },
  { world: 'won', name: 'Skyfield', hex: 0x8b5cf6, col: 16, row: 30, ground: 'cloud',   landmark: 'landmark_sky',      prop: 'crystal' },
  { world: 'log', name: 'Circuit',  hex: 0x22c55e, col: 8,  row: 20, ground: 'circuit', landmark: 'landmark_circuit',  prop: 'pylon' },
]
const STAGE_NAMES = ['Class', 'Town', 'City', 'Kingdom']

// ---- map geometry: matches the painted island exactly (800×704) ----
const T = 16, COLS = 50, ROWS = 44, BASEW = COLS * T, BASEH = ROWS * T
const SHEET_COLS = 12 // Kenney fallback sheet (12-col; index = row*12 + col)
const TILE = { GRASS: 0, PINE: 4, TREE: 16, BUSH: 28, FLOWER: 29, FENCE: 45, ROOF_L: 49, ROOF_R: 50, WALL: 73, DOOR: 74, CRATE: 83 }
const KEEP_C = 24, KEEP_R = 19 // town-hall anchor — the painted plaza centre
// the island ellipse — everything outside it is ocean (and blocked)
const ISLE_RX = (COLS / 2 - 2.5) * T, ISLE_RY = (ROWS / 2 - 2.5) * T

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
  // Shared ride on/off pref (toggled from KinQuest's 🐎 button) — on foot when '0'.
  const ridingOn = typeof localStorage !== 'undefined' && localStorage.getItem('arg_riding') !== '0'
  const rideMount = ridingOn ? mountId : undefined
  // Mount PNG loads DIRECTLY as a Pixi texture — never via svgTex(MountSprite):
  // an SVG rasterized through a data-URL <img> drops its external <image href>
  // (browser security) and paints nothing.
  const mountUrl = rideMount ? `/assets/mounts/${rideMount.replace(/^mount:/, '')}.png` : null

  const sig = roster.map(r => r.id).join(',')
  const textures = useMemo(() => {
    const t: Record<string, string> = {}
    const seen = new Set<string>()
    roster.slice(0, 12).forEach(r => { if (!seen.has(r.kin_key)) { seen.add(r.kin_key); t[r.kin_key] = svgTex(<KinSprite kin={r.kin_key} size={80} />) } })
    t['__avatar'] = svgTex(<Buddy mood="idle" size={96} outfit={outfit} />)
    return t
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let destroyed = false
    let app: any = null
    const parent = parentRef.current
    const guards = roster.slice(0, 12).map(r => r.kin_key)
    const hasMount = !!rideMount
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

        // ---- art sources: the Arganta Atlas (PixelLab) is primary; the Kenney
        // sheet stays loaded purely as a per-asset fallback ----
        const sheet = await PIXI.Assets.load(`${import.meta.env.BASE_URL}assets/tinytown/tilemap_packed.png`).catch(() => null)
        if (destroyed) return
        if (sheet) sheet.source.scaleMode = 'nearest'
        const texCache: Record<number, any> = {}
        const tile = (idx: number) => {
          if (!sheet) return PIXI.Texture.WHITE
          if (!texCache[idx]) {
            const c = idx % SHEET_COLS, r = Math.floor(idx / SHEET_COLS)
            texCache[idx] = new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(c * T, r * T, T, T) })
          }
          return texCache[idx]
        }
        // Atlas loader — a missing PNG resolves to null and the placement code
        // falls back (Kenney tile / flat colour), so a failed generation can
        // never break the world.
        const atlas: Record<string, any> = {}
        await Promise.all([
          'grounds/water', 'grounds/grass', 'grounds/dune', 'grounds/meadow', 'grounds/cloud', 'grounds/circuit', 'grounds/reef',
          'props/tree', 'props/tree_palm', 'props/tree_pink', 'props/crystal', 'props/pylon', 'props/coral', 'props/rock', 'props/flowers', 'props/bush',
          'buildings/hall', 'buildings/house', 'buildings/port',
          'buildings/landmark_numeria', 'buildings/landmark_wordveil', 'buildings/landmark_meadow',
          'buildings/landmark_sky', 'buildings/landmark_lagoon', 'buildings/landmark_circuit',
        ].map(async p => {
          try { const t = await PIXI.Assets.load(`/assets/atlas/${p}.png`); t.source.scaleMode = 'nearest'; atlas[p] = t } catch { /* fallback */ }
        }))
        if (destroyed) return
        // Map v2: the PixelLab-PAINTED island (one seamless artwork) replaces the
        // whole composited terrain stack when present; missing → old pipeline.
        let paintedBg: any = null
        try { paintedBg = await PIXI.Assets.load('/assets/painted/island.png'); paintedBg.source.scaleMode = 'nearest' } catch { /* composited fallback */ }
        if (destroyed) return

        const world = new PIXI.Container(); app.stage.addChild(world)
        const blocked = new Set<string>()
        const block = (c: number, r: number) => blocked.add(c + ',' + r)
        const CX = BASEW / 2, CY = BASEH / 2
        // island membership matches the painted layout's WOBBLED blob (not a pure
        // ellipse) so collision follows the actual coastline
        const inIsland = (x: number, y: number, pad = 0) => {
          const a = Math.atan2(y - CY, x - CX)
          const w = 1 + 0.10 * (Math.sin(3 * a + 1.7) * 0.6 + Math.sin(7 * a + 3.4) * 0.4)
          return ((x - CX) / ((ISLE_RX + pad) * w)) ** 2 + ((y - CY) / ((ISLE_RY + pad) * w)) ** 2 <= 1
        }

        if (paintedBg) {
          // one seamless painted artwork — ocean, coast, biomes, roads, river all in
          const bg = new PIXI.Sprite(paintedBg); bg.width = BASEW; bg.height = BASEH
          world.addChild(bg)
        } else {
          // ---- composited fallback: ocean → beach rim → grass → district patches ----
          if (atlas['grounds/water']) world.addChild(new PIXI.TilingSprite({ texture: atlas['grounds/water'], width: BASEW, height: BASEH }))
          else { const g = new PIXI.Graphics(); g.rect(0, 0, BASEW, BASEH).fill(0x4fb3dd); world.addChild(g) }
          const beach = new PIXI.Graphics()
          beach.ellipse(CX, CY, ISLE_RX + 18, ISLE_RY + 18).fill(0xead9a8)
          beach.ellipse(CX, CY, ISLE_RX + 18, ISLE_RY + 18).stroke({ width: 5, color: 0xffffff, alpha: 0.35 })
          world.addChild(beach)
          if (atlas['grounds/grass']) {
            const gts = new PIXI.TilingSprite({ texture: atlas['grounds/grass'], width: BASEW, height: BASEH })
            const m = new PIXI.Graphics(); m.ellipse(CX, CY, ISLE_RX, ISLE_RY).fill(0xffffff)
            world.addChild(m); gts.mask = m; world.addChild(gts)
          } else { const g = new PIXI.Graphics(); g.ellipse(CX, CY, ISLE_RX, ISLE_RY).fill(0x74c06a); world.addChild(g) }
          GATES.forEach(g => {
            const gx = (g.col + 1) * T, gy = (g.row + 1) * T
            const tex = atlas[`grounds/${g.ground}`]
            if (g.ground === 'grass' || !tex) return
            const ts = new PIXI.TilingSprite({ texture: tex, width: BASEW, height: BASEH })
            const m = new PIXI.Graphics(); m.ellipse(gx, gy, 7.5 * T, 5.5 * T).fill(0xffffff)
            world.addChild(m); ts.mask = m; world.addChild(ts)
          })
        }
        // ocean/water collision — when painted, the EXACT water tiles were
        // derived from the painting's pixels at build time (island_blocked.json);
        // fallback uses the blob formula.
        let paintedBlocked = false
        if (paintedBg) {
          try {
            const bt: [number, number][] = await (await fetch('/assets/painted/island_blocked.json')).json()
            bt.forEach(([c, r]) => block(c, r))
            paintedBlocked = bt.length > 0
          } catch { /* fall through to formula */ }
          if (destroyed) return
        }
        if (!paintedBlocked) {
          for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
            if (!inIsland(c * T + T / 2, r * T + T / 2, 12)) block(c, r)
          }
        }

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

        // road/port/hall anchor points (used by buildings + doors regardless of
        // whether terrain is painted or composited)
        const porch = (g: { col: number; row: number }) => ({ x: (g.col + 1) * T, y: (g.row + 2) * T })
        const PORT = { x: 25 * T, y: 39 * T } // the painted south beach
        const hallP = { x: (KEEP_C + 1) * T, y: (KEEP_R + 2) * T }
        if (!paintedBg) {
          // ---- composited fallback: ring road + spurs + river + bridges ----
          const paths = new PIXI.Graphics()
          const ringPts = [porch(GATES[0]), porch(GATES[1]), porch(GATES[2]), porch(GATES[3]), PORT, porch(GATES[4]), porch(GATES[5])]
          for (let i = 0; i < ringPts.length; i++) {
            const a = ringPts[i], b = ringPts[(i + 1) % ringPts.length]
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
            paths.moveTo(a.x, a.y).quadraticCurveTo(mx + (mx - CX) * 0.22, my + (my - CY) * 0.22, b.x, b.y)
          }
          paths.stroke({ width: 15, color: 0xcdb488, alpha: 0.8, cap: 'round', join: 'round' })
          ;[porch(GATES[0]), porch(GATES[2]), PORT].forEach(p2 => {
            const mx = (hallP.x + p2.x) / 2, my = (hallP.y + p2.y) / 2
            paths.moveTo(hallP.x, hallP.y).quadraticCurveTo(mx + 18, my - 12, p2.x, p2.y)
          })
          paths.stroke({ width: 13, color: 0xcdb488, alpha: 0.7, cap: 'round' })
          world.addChild(paths)
          const riverPath = (g: any) => g.moveTo(34 * T, 2 * T)
            .quadraticCurveTo(33 * T, 11 * T, 32 * T, 16 * T)
            .quadraticCurveTo(31 * T, 22 * T, 32 * T, 28 * T)
            .quadraticCurveTo(33 * T, 34 * T, 31 * T, 42 * T)
          const river = new PIXI.Graphics()
          riverPath(river); river.stroke({ width: 13, color: 0x2f7ea6, alpha: 0.7, cap: 'round' })
          riverPath(river); river.stroke({ width: 8, color: 0x63c4ea, alpha: 0.9, cap: 'round' })
          world.addChild(river)
          const bridges = new PIXI.Graphics()
          ;[[33 * T, 9 * T], [32 * T, 21 * T], [32 * T, 33 * T]].forEach(([bx2, by2]) => {
            bridges.roundRect(bx2 - 15, by2 - 8, 30, 16, 3).fill(0x8b5a2b)
            bridges.rect(bx2 - 15, by2 - 2, 30, 1.5).fill(0x6b4423)
            bridges.rect(bx2 - 15, by2 + 3, 30, 1.5).fill(0x6b4423)
          })
          world.addChild(bridges)
        }

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
        const hotspots: { halo: any; ph: number }[] = []
        let hero: any = null, nearWorld: string | null = null, clock = 0, intro = 0
        let moveTarget: { x: number; y: number } | null = null, stuck = 0

        // ---- Atlas placement helpers (PNG primary, Kenney fallback) ----
        // Buildings anchor at their base-centre; footprint tiles are blocked and
        // the tile just below stays walkable as the "porch" you enter from.
        const placeB = (key: string, cxp: number, baseY: number, hPx: number, bw: number, bh: number, fbHex?: number) => {
          const t2 = atlas[key]
          if (t2) {
            const s = new PIXI.Sprite(t2); s.anchor.set(0.5, 1); s.position.set(cxp, baseY)
            s.scale.set(hPx / t2.height); s.zIndex = baseY; ent.addChild(s)
          } else {
            const c1 = Math.round(cxp / T) - 1, r1 = Math.round(baseY / T) - 2
            put(TILE.ROOF_L, c1, r1, fbHex); put(TILE.ROOF_R, c1 + 1, r1, fbHex)
            put(TILE.WALL, c1, r1 + 1); put(TILE.DOOR, c1 + 1, r1 + 1)
          }
          const c0 = Math.floor(cxp / T - bw / 2), r0 = Math.floor(baseY / T) - bh
          for (let dc = 0; dc < bw; dc++) for (let dr = 0; dr < bh; dr++) block(c0 + dc, r0 + dr)
        }
        const propAt = (key: string, x: number, y: number, hPx: number) => {
          const t2 = atlas[key]
          if (!t2) { put(TILE.TREE, Math.round(x / T), Math.round(y / T)); return }
          const s = new PIXI.Sprite(t2); s.anchor.set(0.5, 1); s.position.set(x, y)
          s.scale.set(hPx / t2.height); s.zIndex = y; ent.addChild(s)
        }

        // six district LANDMARKS (the doors into each learning dungeon)
        const doors: { world: string; name: string; hex: number; x: number; y: number }[] = []
        GATES.forEach(g => {
          const px = (g.col + 1) * T, py = (g.row + 2) * T // porch centre (below the base)
          placeB(`buildings/${g.landmark}`, px, py, 58, 3, 2, g.hex)
          doors.push({ world: g.world, name: g.name, hex: g.hex, x: px, y: py })
          label(PIXI, ent, g.name, px, py + 12, 12)
        })

        // ---- south-beach PORT → sails to KinQuest (the flagship game) ----
        {
          placeB('buildings/port', PORT.x, PORT.y, 46, 3, 2, 0xf0a83a)
          // a little sailing boat bobbing in the real ocean just off the beach
          const boat = new PIXI.Graphics()
          const bx = PORT.x, by = PORT.y + 40
          boat.moveTo(bx - 15, by).lineTo(bx + 15, by).lineTo(bx + 10, by + 9).lineTo(bx - 10, by + 9).closePath().fill(0x8b5a2b)
          boat.rect(bx - 1, by - 22, 2, 22).fill(0x6b4423)
          boat.moveTo(bx + 1, by - 22).lineTo(bx + 14, by - 8).lineTo(bx + 1, by - 8).closePath().fill(0xffd700)
          boat.zIndex = by + 4; ent.addChild(boat)
          // interaction porch on the dock front + a golden anchor sign
          doors.push({ world: '__kq__', name: 'KinQuest', hex: 0xf0a83a, x: PORT.x, y: PORT.y })
          const anchor = new PIXI.Text({ text: '⚓', style: { fontFamily: 'Arial', fontSize: 16 } })
          anchor.anchor.set(0.5); anchor.position.set(PORT.x, PORT.y - 3 * T); anchor.zIndex = 99990; ent.addChild(anchor)
          label(PIXI, ent, 'KinQuest', PORT.x, PORT.y - 3 * T + 14, 12, 0xf0a83a)
        }

        // central Town Hall — the Atlas hall, GROWING with stage (Class → Kingdom)
        const GOLD = 0xf3c34e
        const kc = KEEP_C, kr = KEEP_R
        placeB('buildings/hall', hallP.x, hallP.y, 62 + stage * 12, 4, 3, GOLD)
        // hall is tappable (opens the Town Hall sheet)
        const hallHit = new PIXI.Container(); hallHit.position.set((kc + 1) * T, (kr + 1) * T)
        hallHit.eventMode = 'static'; hallHit.cursor = 'pointer'
        hallHit.hitArea = new PIXI.Rectangle(-46, -46, 92, 92); hallHit.on('pointertap', () => cbRef.current.onOpenHall())
        hallHit.zIndex = 99998; ent.addChild(hallHit)
        // label sits ABOVE the hall (a banner) so it never covers the hero below
        label(PIXI, ent, STAGE_NAMES[stage] ?? 'Town Hall', (kc + 1) * T, (kr - 3) * T - 6, 14, GOLD)

        // ---- village life: cottages near the hall plaza + plaza lamps ----
        ;[[21, 15], [34, 15], [20, 26], [35, 26]].forEach(([hc2, hr2]) => placeB('buildings/house', (hc2 + 1) * T, (hr2 + 2) * T, 42, 2, 2, 0xb98f5a))
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

        // ---- CLUSTERED decoration: each district grows its signature props
        // around its landmark (deterministic; walkable so the hero never traps).
        // The hall plaza, porches and the spawn stay clear.
        const kx0 = (KEEP_C + 1) * T, ky0 = (KEEP_R + 1) * T
        const spawnX = (KEEP_C + 1) * T, spawnY = (KEEP_R + 4) * T
        const clearOf = (x: number, y: number) => {
          if (Math.hypot(x - kx0, y - ky0) < 5.2 * T) return true
          if (Math.hypot(x - spawnX, y - spawnY) < 2.6 * T) return true
          for (const d of doors) if (Math.hypot(x - d.x, y - d.y) < 2.2 * T) return true
          return false
        }
        const onLand = (x: number, y: number) => !blocked.has(Math.floor(x / T) + ',' + Math.floor(y / T))
        GATES.forEach(g => {
          const gx = (g.col + 1) * T, gy = (g.row + 1) * T
          for (let i = 0; i < 10; i++) {
            const x = gx + (rnd() - 0.5) * 12 * T, y = gy + (rnd() - 0.5) * 9 * T
            if (!inIsland(x, y, -8) || !onLand(x, y) || clearOf(x, y)) continue
            const roll = rnd()
            if (roll < 0.6) propAt(`props/${g.prop}`, x, y, 30)
            else propAt(roll < 0.78 ? 'props/flowers' : roll < 0.92 ? 'props/bush' : 'props/rock', x, y, 16)
          }
        })
        // light generic greenery across the open grass between districts
        // (skipped on the painted map — it carries its own trees/decor)
        if (!paintedBg) for (let i = 0; i < 22; i++) {
          const x = 3 * T + rnd() * (BASEW - 6 * T), y = 3 * T + rnd() * (ROWS * T - 6 * T)
          if (!inIsland(x, y, -12) || !onLand(x, y) || clearOf(x, y)) continue
          propAt(rnd() < 0.7 ? 'props/tree' : 'props/bush', x, y, rnd() < 0.7 ? 30 : 16)
        }

        // gate porch prompts (an "Enter" pill that pops when the hero is close)
        const prompts: Record<string, any> = {}
        doors.forEach(d => {
          const pr = new PIXI.Container(); pr.position.set(d.x, d.y - 30); pr.visible = false; pr.zIndex = 99999
          const pt = new PIXI.Text({ text: 'Enter →', style: { fontFamily: 'Arial, sans-serif', fontSize: 13, fontWeight: '700', fill: 0xffffff } }); pt.anchor.set(0.5)
          const pb = new PIXI.Graphics(); pb.roundRect(-pt.width / 2 - 8, -12, pt.width + 16, 24, 12).fill(d.hex)
          pr.addChild(pb); pr.addChild(pt); ent.addChild(pr); prompts[d.world] = pr
        })

        // ---- glowing HOTSPOT beacons: a bright pulsing dot marks every
        // destination so the interactive spots pop off the painted map ----
        doors.forEach(d => {
          const hs = new PIXI.Container(); hs.position.set(d.x, d.y - 2); hs.zIndex = 99994
          const halo = new PIXI.Graphics(); halo.circle(0, 0, 11).fill({ color: d.hex, alpha: 0.5 })
          const core = new PIXI.Graphics()
          core.circle(0, 0, 6).fill({ color: d.hex, alpha: 0.95 })
          core.circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.95 })
          hs.addChild(halo); hs.addChild(core); ent.addChild(hs)
          hotspots.push({ halo, ph: Math.random() * 6.28 })
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
          hotspots.forEach(h => { const p = Math.sin(clock * 0.11 + h.ph) * 0.5 + 0.5; h.halo.scale.set(1 + p * 1.1); h.halo.alpha = 0.55 - p * 0.4 })
          butterflies.forEach(b => {
            b.t += b.sp * dt
            b.s.x = b.cx + Math.cos(b.t) * b.rx; b.s.y = b.cy + Math.sin(b.t * 1.6) * b.ry
            b.s.scale.x = Math.cos(b.t * 6) * 0.6 + 0.7 // wing flutter
          })

          // ---- camera: opens on the whole town (all 6 visible), then eases to a
          // close follow of the hero ----
          const fitZ = Math.min(app.screen.width / BASEW, app.screen.height / BASEH)
          const followZ = clamp(fitZ * 2.0, fitZ, 4)
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
        if (mountUrl) {
          try {
            const mTex = await PIXI.Assets.load(mountUrl)
            if (destroyed) return
            mTex.source.scaleMode = 'nearest'
            const ms = new PIXI.Sprite(mTex); ms.anchor.set(0.5, 0.85); ms.position.set(0, 8); ms.scale.set(0.55); heroC.addChild(ms)
          } catch { /* on-foot if the PNG is missing */ }
        }
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
  }, [sig, rideMount, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="kw-game">
      <div ref={parentRef} className="kw-canvas" />
      {/* always-on shortcut straight into KinQuest */}
      <button className="kw-kq" onClick={() => cbRef.current.onEnterKinQuest()}>⚓ KinQuest →</button>
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
