// ============================================================
//  ARGANTALAB · KINQUEST · OVERWORLD  (PixiJS v8 — walkable maps)
//  Two hand-authored maps built from the Kenney "Tiny Town" CC0 tileset:
//    · town  — Seedling Town: Kin Center, Market, Gym, Lab, houses, NPCs
//    · route — Verdant Path: a wild route north of town with deep tall grass,
//              two challenger kids (route trainers), and the sealed north gate.
//  v2 graphics pass: layered dirt paths, two-tone tall grass with blades,
//  building drop-shadows + windows, pond ripples, sun patches, an inner
//  forest rim for depth, grass-rustle particles and the classic "!" pop
//  before a wild encounter. Engine (movement / camera / collision /
//  tap-to-walk / joystick) carries over from the proven KinWorld town.
// ============================================================

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useAppStore } from '@store/appStore'
import Buddy from '@components/avatar/Buddy'
import Joystick from '@components/ui/Joystick'
import { myMounts } from '@lib/mounts'
import { ELEMENT_META } from '@/data/kinquest'
import type { Element } from '@/data/openworld'

// ---- tile geometry (Tiny Town: 12-col sheet, index = row*12 + col) ----
const T = 16
const SHEET_COLS = 12
const TILE = { GRASS: 0, PINE: 4, TREE: 16, BUSH: 28, FLOWER: 29, FENCE: 45, ROOF_L: 49, ROOF_R: 50, WALL: 73, DOOR: 74, CRATE: 83 }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const hex2int = (h: string) => parseInt(h.replace('#', ''), 16)

// ---- interaction targets ----
export type ActionKind = 'building' | 'npc' | 'trainer' | 'exit'
export interface ActionTarget { id: string; label: string; kind: ActionKind }

// ---- route trainers (exported — the shell builds their battles) ----
export interface TrainerDef {
  id: string; name: string; emoji: string; color: number
  team: [string, number][]        // [render key, level]
  rewardItem: string; diamonds: number
  intro: string; beaten: string
}
export const TRAINERS: Record<string, TrainerDef> = {
  trainer_milo: {
    id: 'trainer_milo', name: 'Bug Kid Milo', emoji: '🧢', color: 0x4dabf7,
    team: [['addbug', 5], ['sumseal', 6]], rewardItem: 'potion', diamonds: 15,
    intro: 'My bugs never lose! Battle me!', beaten: 'Wow… train my bugs harder, I guess.',
  },
  trainer_vera: {
    id: 'trainer_vera', name: 'Scout Vera', emoji: '🎒', color: 0xf59e0b,
    team: [['dividove', 6], ['multimoth', 7]], rewardItem: 'berry', diamonds: 20,
    intro: 'I scouted every patch of this route. Prove you belong here!', beaten: 'You really do belong here. Route mastered!',
  },
}

// ---- map blueprints ----
interface BDef { id: string; col: number; row: number; roof: number; emoji: string; label: string }
interface NDef { id: string; col: number; row: number; color: number; emoji: string }
interface GRect { c: number; r: number; w: number; h: number }
interface ExitDef { id: string; rect: GRect; label: string }
interface TDefPos { id: string; col: number; row: number }
interface MapDef {
  cols: number; rows: number
  spawn: { c: number; r: number }
  buildings: BDef[]; npcs: NDef[]; grass: GRect[]
  exits: ExitDef[]; trainers: TDefPos[]
  ponds: { c: number; r: number }[]
  gapNorth?: [number, number]      // open cols in the top border (a way out)
  gapSouth?: [number, number]
}

const MAPS: Record<string, MapDef> = {
  town: {
    cols: 40, rows: 28, spawn: { c: 20, r: 15 },
    buildings: [
      { id: 'lab',    col: 18, row: 3,  roof: 0x8b5cf6, emoji: '🔬', label: "Prof's Lab" },
      { id: 'center', col: 6,  row: 9,  roof: 0xe4405f, emoji: '➕', label: 'Kin Center' },
      { id: 'market', col: 30, row: 9,  roof: 0x3b82f6, emoji: '🛒', label: 'Market' },
      { id: 'house1', col: 6,  row: 18, roof: 0x6b8e23, emoji: '🏠', label: 'House' },
      { id: 'house2', col: 31, row: 18, roof: 0xa0522d, emoji: '🏠', label: 'House' },
      { id: 'gym',    col: 18, row: 20, roof: 0xf3c34e, emoji: '🏛', label: 'Gym' },
    ],
    npcs: [
      { id: 'npc_guide', col: 23, row: 13, color: 0x4dabf7, emoji: '🧒' },
      { id: 'npc_elder', col: 16, row: 22, color: 0xb197fc, emoji: '🧓' },
    ],
    grass: [ { c: 10, r: 5, w: 5, h: 3 }, { c: 25, r: 14, w: 5, h: 3 }, { c: 13, r: 24, w: 6, h: 2 } ],
    exits: [ { id: 'exit_route', rect: { c: 24, r: 0, w: 4, h: 2 }, label: 'Verdant Path' } ],
    trainers: [],
    ponds: [{ c: 34, r: 23 }],
    gapNorth: [24, 27],
  },
  route: {
    cols: 26, rows: 44, spawn: { c: 13, r: 40 },
    buildings: [],
    npcs: [],
    grass: [
      { c: 4,  r: 32, w: 8, h: 4 },
      { c: 14, r: 26, w: 8, h: 5 },
      { c: 4,  r: 18, w: 9, h: 5 },
      { c: 13, r: 10, w: 8, h: 4 },
      { c: 5,  r: 5,  w: 6, h: 3 },
    ],
    exits: [
      { id: 'exit_town', rect: { c: 11, r: 42, w: 4, h: 2 }, label: 'Seedling Town' },
      { id: 'gate_north', rect: { c: 11, r: 0, w: 4, h: 2 }, label: 'North Gate' },
    ],
    trainers: [
      { id: 'trainer_milo', col: 18, row: 30 },
      { id: 'trainer_vera', col: 7,  row: 13 },
    ],
    ponds: [{ c: 20, r: 20 }],
    gapNorth: [11, 14],
    gapSouth: [11, 14],
  },
}

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
  map, spawn, paused, gymElement, gymSealed, trainersBeaten, onAction, onEncounter,
}: {
  map: string
  spawn?: { c: number; r: number }
  paused: boolean
  gymElement: Element
  gymSealed: boolean
  trainersBeaten: string[]
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

  // Equipped mount + a ride on/off toggle (shared pref with KinWorld via
  // localStorage 'arg_riding'). Toggling applies in-place — no scene rebuild.
  // NOTE: the mount PNG is loaded DIRECTLY as a Pixi texture — never via
  // svgTex(MountSprite): an SVG rasterized through a data-URL <img> silently
  // drops its external <image href> (browser security), painting nothing.
  const [mountId, setMountId] = useState<string | undefined>(undefined)
  useEffect(() => { myMounts().then(m => setMountId(m.equipped ?? undefined)) }, [])
  const [riding, setRiding] = useState(() => localStorage.getItem('arg_riding') !== '0')
  const rideRef = useRef(riding); rideRef.current = riding
  const applyRideRef = useRef<((r: boolean) => void) | null>(null)
  const mountUrl = mountId ? `/assets/mounts/${mountId.replace(/^mount:/, '')}.png` : null

  useEffect(() => {
    let destroyed = false
    let app: any = null
    const parent = parentRef.current
    const M = MAPS[map] ?? MAPS.town
    const COLS = M.cols, ROWS = M.rows, BASEW = COLS * T, BASEH = ROWS * T
    const SPAWN = spawn ?? M.spawn
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

        // deterministic RNG for all decor
        let seed = map === 'route' ? 77003 : 20260702
        const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

        // Map v2: PixelLab-PAINTED terrain (one seamless artwork per map) replaces
        // ground/paths/tall-grass/border visuals when present. Gameplay data
        // (collision, encounter tiles, doors) is unchanged either way.
        let paintedBg: any = null
        try { paintedBg = await PIXI.Assets.load(`/assets/painted/kq_${map === 'route' ? 'route' : 'town'}.png`); paintedBg.source.scaleMode = 'nearest' } catch { /* composited fallback */ }
        if (destroyed || !app.stage) return

        // ── LAYER 0 · ground ──
        if (paintedBg) {
          const bg = new PIXI.Sprite(paintedBg); bg.width = BASEW; bg.height = BASEH
          world.addChild(bg)
        } else {
          const ground = new PIXI.TilingSprite({ texture: tile(TILE.GRASS), width: BASEW, height: BASEH })
          world.addChild(ground)
          const mood = new PIXI.Graphics()
          for (let i = 0; i < 8; i++) {
            const x = rnd() * BASEW, y = rnd() * BASEH, rr = 60 + rnd() * 90
            mood.ellipse(x, y, rr, rr * 0.7).fill({ color: i % 2 ? 0xfff8c0 : 0x1c4a20, alpha: i % 2 ? 0.06 : 0.07 })
          }
          world.addChild(mood)
        }

        // tap-to-walk layer (under entities)
        let moveTarget: { x: number; y: number } | null = null, stuck = 0
        const tapLayer = new PIXI.Graphics()
        tapLayer.rect(0, 0, BASEW, BASEH).fill({ color: 0x000000, alpha: 0.001 })
        tapLayer.eventMode = 'static'
        world.addChild(tapLayer)

        // ── LAYER 1 · dirt paths (painted bg already includes them) ──
        const doors = M.buildings.map(b => ({ ...b, px: (b.col + 1) * T, py: (b.row + 2) * T }))
        if (!paintedBg) {
          const paths = new PIXI.Graphics()
          const cx = SPAWN.c === M.spawn.c ? M.spawn.c * T : M.spawn.c * T
          const cy = M.spawn.r * T
          const drawPath = (pts: [number, number][]) => {
            for (const [w, col, al] of [[17, 0x8a6a3c, 0.55], [12, 0xd9b97e, 0.9], [5, 0xecd9a8, 0.55]] as [number, number, number][]) {
              paths.moveTo(pts[0][0], pts[0][1])
              for (let i = 1; i < pts.length; i++) paths.lineTo(pts[i][0], pts[i][1])
              paths.stroke({ width: w, color: col, alpha: al, cap: 'round', join: 'round' })
            }
          }
          if (map === 'town') {
            drawPath([[4 * T, cy], [(COLS - 4) * T, cy]])
            drawPath([[cx, 4 * T], [cx, (ROWS - 3) * T]])
            for (const d of doors) drawPath([[d.px, d.py], [d.px, cy < d.py ? d.py - 2 * T : d.py + 2 * T], [cx, cy]])
            // path up to the north exit
            drawPath([[26 * T, cy - 8 * T], [26 * T, 1 * T]])
          } else {
            // a winding route path south → north
            drawPath([[13 * T, (ROWS - 2) * T], [13 * T, 36 * T], [9 * T, 30 * T], [13 * T, 24 * T], [17 * T, 17 * T], [13 * T, 8 * T], [13 * T, 1 * T]])
          }
          // speckle stones
          for (let i = 0; i < 26; i++) {
            const x = rnd() * BASEW, y = rnd() * BASEH
            paths.circle(x, y, 1 + rnd() * 1.4).fill({ color: 0xcbb37e, alpha: 0.35 })
          }
          world.addChild(paths)
        }

        // ── LAYER 2 · tall grass — the clumps are drawn EVEN on the painted bg:
        // encounters trigger on these blueprint tiles, so kids must see exactly
        // where the wild grass is (the painting's own grass is decorative) ──
        const grassG = new PIXI.Graphics()
        for (const p of M.grass) {
          for (let dc = 0; dc < p.w; dc++) for (let dr = 0; dr < p.h; dr++) {
            const c = p.c + dc, r = p.r + dr, x = c * T, y = r * T
            grass.add(c + ',' + r)
            grassG.roundRect(x + 0.5, y + 0.5, T - 1, T - 1, 3).fill({ color: 0x2e8b3e, alpha: 0.92 })
            grassG.roundRect(x + 2, y + 2, T - 4, T - 4, 3).fill({ color: 0x257434, alpha: 0.5 })
            for (let b = 0; b < 3; b++) {
              const bx = x + 3 + b * 5 + (rnd() - 0.5) * 2
              const tall = 6 + rnd() * 3
              grassG.moveTo(bx, y + T - 2).lineTo(bx - 2, y + T - 2 - tall).lineTo(bx + 0.5, y + T - 4).closePath()
                .fill({ color: b % 2 ? 0x1e6b2d : 0x3fae52, alpha: 0.95 })
            }
          }
        }
        world.addChild(grassG)

        // ── entities (depth-sorted) ──
        const ent = new PIXI.Container(); ent.sortableChildren = true; world.addChild(ent)
        const put = (idx: number, col: number, row: number, tint?: number, z?: number) => {
          const s = new PIXI.Sprite(tile(idx)); s.x = col * T; s.y = row * T
          if (tint !== undefined) s.tint = tint
          s.zIndex = z ?? (row + 1) * T; ent.addChild(s); return s
        }

        const shimmers: any[] = []
        const ripples: { g: any; t: number; cx: number; cy: number }[] = []
        const butterflies: { s: any; t: number; cx: number; cy: number; rx: number; ry: number; sp: number }[] = []
        const rustles: { g: any; vx: number; vy: number; life: number }[] = []
        let hero: any = null, lastTile = '', clock = 0, lastNearId: string | null = null
        let encounterLock = false, lastExit = ''

        // ── border forest: BLOCKING always; tree visuals only without painted bg
        // (the painting includes its own forest edge) ──
        const inGapN = (c: number) => M.gapNorth && c >= M.gapNorth[0] && c <= M.gapNorth[1]
        const inGapS = (c: number) => M.gapSouth && c >= M.gapSouth[0] && c <= M.gapSouth[1]
        for (let c = 0; c < COLS; c++) {
          if (!inGapN(c)) { if (!paintedBg) put(c % 2 ? TILE.TREE : TILE.PINE, c, 0); block(c, 0) }
          if (!inGapS(c)) { if (!paintedBg) put(c % 2 ? TILE.PINE : TILE.TREE, c, ROWS - 1); block(c, ROWS - 1) }
        }
        for (let r = 1; r < ROWS - 1; r++) {
          if (!paintedBg) { put(r % 2 ? TILE.TREE : TILE.PINE, 0, r); put(r % 2 ? TILE.PINE : TILE.TREE, COLS - 1, r) }
          block(0, r); block(COLS - 1, r)
        }
        // inner rim (decorative depth, walk-through bushes)
        if (!paintedBg) for (let c = 2; c < COLS - 2; c += 2) {
          if (!inGapN(c) && rnd() < 0.7) put(rnd() < 0.5 ? TILE.PINE : TILE.BUSH, c, 1)
          if (!inGapS(c) && rnd() < 0.7) put(rnd() < 0.5 ? TILE.TREE : TILE.BUSH, c, ROWS - 2)
        }

        // ── buildings: shadow + tinted roof + wall/door + window + sign ──
        const targets: { id: string; label: string; kind: ActionKind; x: number; y: number }[] = []
        for (const b of doors) {
          const bx = (b.col + 1) * T, byTop = b.row * T
          const shadow = new PIXI.Graphics()
          shadow.ellipse(bx, (b.row + 2) * T + 4, 22, 6).fill({ color: 0x000000, alpha: 0.18 })
          shadow.zIndex = (b.row + 2) * T - 1; ent.addChild(shadow)
          put(TILE.ROOF_L, b.col, b.row, b.roof); put(TILE.ROOF_R, b.col + 1, b.row, b.roof)
          put(TILE.WALL, b.col, b.row + 1); put(TILE.DOOR, b.col + 1, b.row + 1)
          block(b.col, b.row); block(b.col + 1, b.row); block(b.col, b.row + 1); block(b.col + 1, b.row + 1)
          // window on the wall tile
          const win = new PIXI.Graphics()
          win.roundRect(b.col * T + 4, (b.row + 1) * T + 4, 8, 7, 1.5).fill(0x9fd8ef).stroke({ color: 0x5b4a32, width: 1 })
          win.rect(b.col * T + 7.5, (b.row + 1) * T + 4, 1, 7).fill(0x5b4a32)
          win.zIndex = (b.row + 2) * T + 1; ent.addChild(win)
          targets.push({ id: b.id, label: b.label, kind: 'building', x: b.px, y: b.py })
          const mk = new PIXI.Text({ text: b.emoji, style: { fontFamily: 'Arial', fontSize: 15 } })
          mk.anchor.set(0.5); mk.position.set(bx, byTop - 11); mk.zIndex = 99990; ent.addChild(mk)
          label(PIXI, ent, b.label, bx, (b.row + 2) * T + 10, 11, b.id === 'gym' ? hex2int(ELEMENT_META[gymElement].color) : undefined)
        }
        if (map === 'town') {
          const g = M.buildings.find(x => x.id === 'gym')!
          const crest = new PIXI.Text({ text: gymSealed ? '✅' : ELEMENT_META[gymElement].icon, style: { fontFamily: 'Arial', fontSize: 13, fill: hex2int(ELEMENT_META[gymElement].color), fontWeight: '700' } })
          crest.anchor.set(0.5); crest.position.set((g.col + 1) * T, g.row * T - 26); crest.zIndex = 99991; ent.addChild(crest)
        }

        // ── ponds: blocking always; the solid pond disc only when unpainted
        // (the painting has its own pond — keep the animated ripples on top) ──
        for (const p of M.ponds) {
          const x = p.c * T, y = p.r * T
          if (!paintedBg) {
            const g = new PIXI.Graphics()
            g.ellipse(x, y + 3, 30, 18).fill({ color: 0x1c5a80, alpha: 0.35 })
            g.ellipse(x, y, 28, 17).fill(0x3f9fd0); g.ellipse(x, y, 22, 12).fill(0x63c4ea)
            g.ellipse(x - 6, y - 4, 8, 3.5).fill({ color: 0xffffff, alpha: 0.4 })
            g.zIndex = y - 60; ent.addChild(g)
          }
          for (let dc = -2; dc <= 2; dc++) for (let dr = -1; dr <= 1; dr++) block(p.c + dc, p.r + dr)
          for (let i = 0; i < 2; i++) {
            const rg = new PIXI.Graphics(); rg.zIndex = y - 58; ent.addChild(rg)
            ripples.push({ g: rg, t: i * 0.5, cx: x + (i ? 8 : -6), cy: y + (i ? 3 : -2) })
          }
          const sh = new PIXI.Graphics(); sh.ellipse(x - 8, y - 5, 10, 4).fill({ color: 0xffffff, alpha: 0.45 }); sh.zIndex = y - 57; ent.addChild(sh); shimmers.push(sh)
        }

        // ── NPCs + route trainers ──
        // Pixel-art people (PixelLab, /assets/kinquest/npcs) — the old primitive
        // "rectangle + emoji" people stay as a graceful fallback if a PNG is missing.
        const NPC_ART: Record<string, string> = {
          npc_guide: '/assets/kinquest/npcs/pip.png', npc_elder: '/assets/kinquest/npcs/rowan.png',
          trainer_milo: '/assets/kinquest/npcs/milo.png', trainer_vera: '/assets/kinquest/npcs/vera.png',
        }
        const npcTex: Record<string, any> = {}
        await Promise.all(Object.entries(NPC_ART).map(async ([id, url]) => {
          try { const t = await PIXI.Assets.load(url); t.source.scaleMode = 'nearest'; npcTex[id] = t } catch { /* fallback below */ }
        }))
        if (destroyed) return
        const npcSprites: { s: any; baseY: number; ph: number }[] = []
        const placePerson = (id: string, col: number, row: number, color: number, emoji: string, kind: ActionKind, beaten = false) => {
          const x = col * T + T / 2, y = row * T + T
          const c = new PIXI.Container(); c.position.set(x, y); c.zIndex = y + 6
          const shadow = new PIXI.Graphics()
          shadow.ellipse(0, 1, 7, 2.6).fill({ color: 0x000000, alpha: 0.2 })
          c.addChild(shadow)
          const tex = npcTex[id]
          if (tex) {
            const sp = new PIXI.Sprite(tex); sp.anchor.set(0.5, 1); sp.position.set(0, 2)
            sp.scale.set(32 / tex.height)
            if (beaten) sp.tint = 0x9aa0a6
            c.addChild(sp)
          } else {
            const body = new PIXI.Graphics()
            body.roundRect(-5, -12, 10, 12, 4).fill(beaten ? 0x9aa0a6 : color)
            body.circle(0, -14, 5).fill(0xf6c89a)
            c.addChild(body)
            const mk = new PIXI.Text({ text: emoji, style: { fontFamily: 'Arial', fontSize: 13 } }); mk.anchor.set(0.5); mk.position.set(0, -26); c.addChild(mk)
          }
          ent.addChild(c)
          block(col, row)
          targets.push({ id, label: kind === 'trainer' ? 'Challenge' : 'Talk', kind, x, y: y + T })
          npcSprites.push({ s: c, baseY: y, ph: rnd() * 6.28 })
        }
        for (const n of M.npcs) placePerson(n.id, n.col, n.row, n.color, n.emoji, 'npc')
        for (const tp of M.trainers) {
          const td = TRAINERS[tp.id]
          if (td) placePerson(td.id, tp.col, tp.row, td.color, trainersBeaten.includes(td.id) ? '🤝' : td.emoji, 'trainer', trainersBeaten.includes(td.id))
        }

        // ── exit gates: signposts + fence posts framing the gaps ──
        for (const ex of M.exits) {
          const gx = (ex.rect.c + ex.rect.w / 2) * T, gy = (ex.rect.r + ex.rect.h / 2) * T
          if (ex.id !== 'gate_north') {
            const sign = new PIXI.Graphics()
            sign.rect(gx - 1.5 + T, gy + 6, 3, 10).fill(0x6b5b3a)
            sign.roundRect(gx - 13 + T, gy - 2, 26, 10, 2).fill(0xd9b97e).stroke({ color: 0x6b5b3a, width: 1 })
            sign.zIndex = gy + 20; ent.addChild(sign)
            label(PIXI, ent, ex.id === 'exit_route' ? '🌿 Verdant Path ↑' : '🏘 Seedling Town ↓', gx + T, gy + (ex.rect.r === 0 ? 30 : -14), 10)
          } else {
            // the sealed gate: a fence wall with a lock sign — walking near it talks
            for (let c = ex.rect.c; c < ex.rect.c + ex.rect.w; c++) { put(TILE.FENCE, c, 1); block(c, 1) }
            label(PIXI, ent, gymSealed ? '✨ Wordveil — soon!' : '🔒 Beat the Gym first', gx + T, 2 * T + 10, 10, 0xb45309)
          }
        }

        // ── scattered decor (light — the maps breathe now) ──
        const clearOf = (x: number, y: number) => {
          if (Math.hypot(x - SPAWN.c * T, y - SPAWN.r * T) < 2.4 * T) return true
          for (const t of targets) if (Math.hypot(x - t.x, y - t.y) < 2 * T) return true
          return false
        }
        const taken = new Set<string>()
        // painted maps carry their own decoration — skip the Kenney scatter
        const budget = paintedBg ? 0 : map === 'route' ? 40 : 45
        for (let i = 0; i < budget; i++) {
          const c = 2 + Math.floor(rnd() * (COLS - 4)), r = 2 + Math.floor(rnd() * (ROWS - 4))
          const key = c + ',' + r
          if (blocked.has(key) || grass.has(key) || taken.has(key)) continue
          const x = c * T, y = r * T
          if (clearOf(x, y)) continue
          taken.add(key)
          const roll = rnd()
          put(roll < 0.42 ? (rnd() < 0.5 ? TILE.TREE : TILE.PINE) : roll < 0.72 ? TILE.FLOWER : TILE.BUSH, c, r)
        }

        // context-action prompt bubbles
        const prompts: Record<string, any> = {}
        for (const t of targets) {
          const pr = new PIXI.Container(); pr.position.set(t.x, t.y - 34); pr.visible = false; pr.zIndex = 99999
          const pt = new PIXI.Text({ text: t.kind === 'npc' ? '💬' : t.kind === 'trainer' ? '⚔' : '⤵', style: { fontFamily: 'Arial', fontSize: 13, fontWeight: '700', fill: 0xffffff } }); pt.anchor.set(0.5)
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

        // "!" pop shown over the hero just before an encounter
        const alert = new PIXI.Container(); alert.visible = false; alert.zIndex = 999999
        const ab = new PIXI.Graphics(); ab.roundRect(-8, -26, 16, 20, 4).fill(0xffffff).stroke({ color: 0x2b2440, width: 1.5 })
        const at = new PIXI.Text({ text: '!', style: { fontFamily: 'Arial', fontSize: 15, fontWeight: '900', fill: 0xd53f3f } })
        at.anchor.set(0.5); at.position.set(0, -16)
        alert.addChild(ab); alert.addChild(at); ent.addChild(alert)

        // soft vignette so the map doesn't end abruptly
        const vig = new PIXI.Graphics()
        vig.rect(0, 0, BASEW, 10).fill({ color: 0x0a1e0a, alpha: 0.22 })
        vig.rect(0, BASEH - 10, BASEW, 10).fill({ color: 0x0a1e0a, alpha: 0.22 })
        vig.rect(0, 0, 10, BASEH).fill({ color: 0x0a1e0a, alpha: 0.18 })
        vig.rect(BASEW - 10, 0, 10, BASEH).fill({ color: 0x0a1e0a, alpha: 0.18 })
        vig.zIndex = 999990; ent.addChild(vig)

        // tap-to-walk wiring (needs targets — registered after they exist)
        tapLayer.on('pointertap', (e: any) => {
          if (pausedRef.current) return
          const p = world.toLocal(e.global)
          let tx = p.x, ty = p.y
          let best = 1e9, bx2 = tx, by2 = ty
          for (const t of targets) { const dd = Math.hypot(t.x - tx, t.y - ty); if (dd < best) { best = dd; bx2 = t.x; by2 = t.y } }
          if (best < 2.4 * T) { tx = bx2; ty = by2 }
          moveTarget = { x: clamp(tx, T + 4, BASEW - T - 4), y: clamp(ty, T + 4, BASEH - T - 4) }
          stuck = 0
        })

        window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)

        app.ticker.add((tk: any) => {
          if (destroyed) return
          const dt = tk.deltaTime
          clock += dt

          if (hero && !pausedRef.current && !encounterLock) {
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
            let moving = false
            if (mag > 0.01) {
              moveTarget = null
              const nvx = vx / Math.max(1, mag), nvy = vy / Math.max(1, mag)
              if (Math.abs(nvx) > 0.02) hero.scale.x = nvx < 0 ? -Math.abs(hero.scale.x) : Math.abs(hero.scale.x)
              const mx = stepX(nvx), my = stepY(nvy); moving = mx || my
              hero.pivot.y = Math.sin(clock * 0.4) * 1.5
            } else if (moveTarget) {
              const dx = moveTarget.x - hero.x, dy = moveTarget.y - hero.y
              const dist = Math.hypot(dx, dy)
              if (dist < 16) { moveTarget = null; hero.pivot.y = 0 }
              else {
                const nvx = dx / dist, nvy = dy / dist
                if (Math.abs(nvx) > 0.02) hero.scale.x = nvx < 0 ? -Math.abs(hero.scale.x) : Math.abs(hero.scale.x)
                const px0 = hero.x, py0 = hero.y
                const mx = stepX(nvx), my = stepY(nvy)
                if (!mx && !my) { if (!stepX(Math.sign(nvx))) stepY(Math.sign(nvy)) }
                moving = true
                hero.pivot.y = Math.sin(clock * 0.4) * 1.5
                stuck = (Math.abs(hero.x - px0) < 0.05 && Math.abs(hero.y - py0) < 0.05) ? stuck + 1 : 0
                if (stuck > 40) { moveTarget = null; stuck = 0 }
              }
            } else {
              hero.pivot.y = 0
            }
            hero.zIndex = hero.y + 20

            // nearest interactable → context prompt (only push to React on CHANGE)
            let found: ActionTarget | null = null
            for (const t of targets) if (Math.hypot(t.x - hero.x, t.y - hero.y) < 34) { found = { id: t.id, label: t.label, kind: t.kind }; break }
            const fid = found ? found.id : null
            for (const k in prompts) prompts[k].visible = fid === k
            if (fid !== lastNearId) { lastNearId = fid; nearRef.current(found) }

            // exit zones (fire once per entry)
            const tc = Math.floor(hero.x / T), tr = Math.floor(feetY() / T)
            let onExit = ''
            for (const ex of M.exits) {
              if (tc >= ex.rect.c && tc < ex.rect.c + ex.rect.w && tr >= ex.rect.r && tr < ex.rect.r + ex.rect.h) { onExit = ex.id; break }
            }
            if (onExit !== lastExit) {
              lastExit = onExit
              if (onExit) cbRef.current.onAction({ id: onExit, label: onExit, kind: 'exit' })
            }

            // tall grass: rustle particles + encounter roll on each NEW grass tile
            const key = tc + ',' + tr
            if (key !== lastTile) {
              lastTile = key
              if (moving && grass.has(key)) {
                for (let i = 0; i < 5; i++) {
                  const g = new PIXI.Graphics()
                  g.roundRect(-1.5, -3, 3, 6, 1).fill({ color: i % 2 ? 0x3fae52 : 0x1e6b2d, alpha: 0.9 })
                  g.position.set(hero.x + (Math.random() - 0.5) * 12, hero.y + 4)
                  g.zIndex = hero.y + 19; ent.addChild(g)
                  rustles.push({ g, vx: (Math.random() - 0.5) * 0.9, vy: -0.8 - Math.random() * 0.8, life: 1 })
                }
                if (Math.random() < 0.13) {
                  encounterLock = true
                  alert.visible = true
                  alert.position.set(hero.x, hero.y - 34)
                  setTimeout(() => {
                    if (destroyed) return
                    alert.visible = false
                    encounterLock = false
                    cbRef.current.onEncounter()
                  }, 480)
                }
              }
            }
          }

          npcSprites.forEach(n => { n.s.pivot.y = Math.sin(clock * 0.08 + n.ph) * 1.2 })
          shimmers.forEach((sh, i) => { sh.alpha = 0.3 + Math.abs(Math.sin(clock * 0.04 + i)) * 0.3 })
          ripples.forEach(rp => {
            rp.t += 0.012 * dt
            const ph = rp.t % 1
            rp.g.clear()
            rp.g.ellipse(rp.cx, rp.cy, 4 + ph * 14, (4 + ph * 14) * 0.55).stroke({ color: 0xffffff, width: 1, alpha: 0.4 * (1 - ph) })
          })
          butterflies.forEach(b => {
            b.t += b.sp * dt
            b.s.x = b.cx + Math.cos(b.t) * b.rx; b.s.y = b.cy + Math.sin(b.t * 1.6) * b.ry
            b.s.scale.x = Math.cos(b.t * 6) * 0.6 + 0.7
          })
          for (let i = rustles.length - 1; i >= 0; i--) {
            const rp = rustles[i]
            rp.g.x += rp.vx * dt; rp.g.y += rp.vy * dt; rp.life -= 0.04 * dt
            rp.g.alpha = Math.max(0, rp.life); rp.g.rotation += 0.1 * dt
            if (rp.life <= 0) { rp.g.destroy(); rustles.splice(i, 1) }
          }

          // camera: comfy chunky-pixel follow, clamped to map bounds.
          // ~26 tiles visible across (13.5 → 20 → 26 across two rounds of user
          // feedback); low min zoom so the whole town breathes on any screen.
          const z = clamp(app.screen.width / (26 * T), 0.9, 2.4)
          world.scale.set(z)
          const tx2 = hero ? hero.x : BASEW / 2, ty2 = hero ? hero.y : BASEH / 2
          let px = app.screen.width / 2 - tx2 * z, py = app.screen.height / 2 - ty2 * z
          px = BASEW * z > app.screen.width ? clamp(px, app.screen.width - BASEW * z, 0) : (app.screen.width - BASEW * z) / 2
          py = BASEH * z > app.screen.height ? clamp(py, app.screen.height - BASEH * z, 0) : (app.screen.height - BASEH * z) / 2
          world.position.set(px, py)
        })

        // rasterise the avatar (+ equipped mount) — hero sized to match the
        // 32px pixel-art NPCs (the old 0.52 scale towered over them).
        const avC = await rasterize(avatarTex, 96, 96)
        if (destroyed || !app.stage) return
        const heroC = new PIXI.Container(); heroC.position.set(SPAWN.c * T, SPAWN.r * T)
        const heroShadow = new PIXI.Graphics(); heroShadow.ellipse(0, 6, 9, 3).fill({ color: 0x000000, alpha: 0.22 }); heroC.addChild(heroShadow)
        let mountSp: any = null
        if (mountUrl) {
          try {
            const mTex = await PIXI.Assets.load(mountUrl)
            if (destroyed || !app.stage) return
            mTex.source.scaleMode = 'nearest'
            mountSp = new PIXI.Sprite(mTex)
            // 128px source → ~48px in-world, crisp pixels
            mountSp.anchor.set(0.5, 0.9); mountSp.position.set(0, 4); mountSp.scale.set(0.38)
            heroC.addChild(mountSp)
          } catch { /* on-foot if the PNG is missing */ }
        }
        const rs = new PIXI.Sprite(PIXI.Texture.from(avC)); heroC.addChild(rs)
        // Ride on/off applies in place (no scene rebuild): seated = small head on
        // the saddle (mirrors AvatarSprite's tuning); on foot = NPC-scale walker.
        const applyRide = (r: boolean) => {
          const mounted = r && !!mountSp
          if (mountSp) mountSp.visible = mounted
          if (mounted) { rs.anchor.set(0.5, 0.5); rs.position.set(1, -22); rs.scale.set(0.26) }
          else { rs.anchor.set(0.5, 0.9); rs.position.set(0, 0); rs.scale.set(0.38) }
        }
        applyRideRef.current = applyRide
        applyRide(rideRef.current)
        heroC.zIndex = heroC.y + 20; ent.addChild(heroC); hero = heroC
      } catch (err) { console.error('[kinquest-town] pixi init failed:', err) }
    })()

    return () => {
      destroyed = true; setNear(null)
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
      try { if (app) app.destroy(true, { children: true }) } catch { /* ignore */ }
    }
  }, [avatarTex, mountUrl, map, gymSealed, trainersBeaten.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="kqt">
      <div ref={parentRef} className="kqt-canvas" />
      {near && near.kind !== 'exit' && (
        <button className="kqt-action" onClick={() => cbRef.current.onAction(near)}>
          {near.kind === 'npc' ? '💬 Talk' : near.kind === 'trainer' ? '⚔ Challenge' : `⤵ Enter ${near.label}`}
        </button>
      )}
      {mountId && !paused && (
        <button
          className="kqt-ride"
          onClick={() => setRiding(v => { const n = !v; localStorage.setItem('arg_riding', n ? '1' : '0'); applyRideRef.current?.(n); return n })}
        >
          {riding ? '🚶 Walk' : '🐎 Ride'}
        </button>
      )}
      {!paused && <Joystick className="kqt-joy" onChange={(dx, dy) => { controls.current = { dx, dy } }} />}
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
