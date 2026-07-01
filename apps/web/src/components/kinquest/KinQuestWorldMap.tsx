// ============================================================
//  ARGANTALAB · KINQUEST · WORLD MAP  (PixiJS v8)
//  Overview map showing 8 KinQuest regions on a lush pixel-art canvas.
//  Ground biomes drawn as PixiJS Graphics; trees + rocks are Kenney
//  roguelike sprites (roguelikeSheet_transparent.png, 16×16, 1px gap).
//  Regions are clickable; locked ones are dimmed with 🔒 overlay.
//
//  TILE ATLAS NOTES (roguelike sheet, 57 cols × 31 rows, stride=17):
//    fr(col, row) → {x: col*17, y: row*17, w:16, h:16}
//    Trees verified at: pine=fr(4,4), oak=fr(5,4), small=fr(6,4)
//    Rocks: fr(7,5), fr(8,5)
//    Flowers: fr(3,5), fr(4,5), fr(5,5)
//    Grass tufts: fr(0,5), fr(1,5), fr(2,5)
// ============================================================

import { useEffect, useRef } from 'react'

const BASE  = import.meta.env.BASE_URL
const SHEET = `${BASE}assets/roguelike/sheet.png`

const T = 16, S = 17   // tile size, spritesheet stride

// Spritesheet frame helper
const fr = (c: number, r: number) => ({ x: c * S, y: r * S, w: T, h: T })

// All decoration sprite candidates from roguelike sheet
const DECO = {
  TREE_PINE_A:  fr(4, 4),   // tall conical pine
  TREE_PINE_B:  fr(3, 4),   // pine variant
  TREE_OAK_A:   fr(5, 4),   // round oak
  TREE_OAK_B:   fr(6, 4),   // round oak variant
  TREE_SMALL:   fr(7, 4),   // small tree / shrub
  ROCK_A:       fr(7, 5),   // rock
  ROCK_B:       fr(8, 5),   // rock variant
  FLOWER_R:     fr(3, 5),   // red flower
  FLOWER_B:     fr(4, 5),   // blue flower
  FLOWER_Y:     fr(5, 5),   // yellow flower
  GRASS_A:      fr(0, 5),   // grass tuft
  GRASS_B:      fr(1, 5),   // grass tuft 2
}

// Region definitions (canvas coord space: 400×720)
interface Region {
  id: string
  name: string
  icon: string
  fill: number      // hex fill
  edge: number      // hex border
  cx: number; cy: number
  w: number; h: number
  unlocked: boolean
  trees: Array<[keyof typeof DECO, number, number]>  // sprite, rel-x, rel-y
}

const REGIONS: Region[] = [
  {
    id: 'cove', name: 'Seedling Cove', icon: '🌱',
    fill: 0x3da840, edge: 0x236b27, cx: 200, cy: 68, w: 130, h: 84,
    unlocked: true,
    trees: [['TREE_OAK_A',-46,-24],['TREE_OAK_B',42,-18],['TREE_SMALL',-38,18],['FLOWER_R',38,22],['FLOWER_B',-10,28]],
  },
  {
    id: 'num', name: 'Numeria', icon: '🔢',
    fill: 0xd4a83c, edge: 0x9a7424, cx: 86, cy: 218, w: 118, h: 88,
    unlocked: true,
    trees: [['ROCK_A',-42,-28],['ROCK_B',40,-22],['FLOWER_Y',-30,24],['GRASS_A',34,26]],
  },
  {
    id: 'wrd', name: 'Wordveil', icon: '📖',
    fill: 0x2a7c34, edge: 0x184c1e, cx: 314, cy: 218, w: 118, h: 88,
    unlocked: false,
    trees: [['TREE_PINE_A',-42,-26],['TREE_PINE_B',38,-20],['TREE_OAK_A',-26,24],['TREE_SMALL',36,28]],
  },
  {
    id: 'lif', name: 'Life Meadow', icon: '🌸',
    fill: 0xd46090, edge: 0x8c2c52, cx: 86, cy: 382, w: 118, h: 88,
    unlocked: false,
    trees: [['FLOWER_R',-42,-24],['FLOWER_B',36,-20],['FLOWER_Y',-28,24],['GRASS_A',38,26],['TREE_SMALL',-10,-28]],
  },
  {
    id: 'won', name: 'Wonder Sky', icon: '🌟',
    fill: 0x6840a8, edge: 0x3c1e70, cx: 314, cy: 382, w: 118, h: 88,
    unlocked: false,
    trees: [['ROCK_A',-40,-24],['FLOWER_B',36,-22],['GRASS_B',-28,26],['ROCK_B',38,24]],
  },
  {
    id: 'wld', name: 'World Lagoon', icon: '🌍',
    fill: 0x1868b8, edge: 0x0c3e72, cx: 86, cy: 536, w: 118, h: 88,
    unlocked: false,
    trees: [['GRASS_A',-40,-24],['GRASS_B',38,-20],['ROCK_A',-26,28],['FLOWER_B',38,24]],
  },
  {
    id: 'log', name: 'Logic Circuit', icon: '⚡',
    fill: 0x1a7838, edge: 0x0f4a22, cx: 314, cy: 536, w: 118, h: 88,
    unlocked: false,
    trees: [['ROCK_A',-40,-24],['ROCK_B',36,-22],['GRASS_A',-30,26],['TREE_SMALL',36,24]],
  },
  {
    id: 'apex', name: 'The Apex', icon: '⭐',
    fill: 0xa83060, edge: 0x6c1030, cx: 200, cy: 648, w: 130, h: 84,
    unlocked: false,
    trees: [['ROCK_A',-48,-24],['ROCK_B',44,-20],['ROCK_A',-36,22],['ROCK_B',38,22]],
  },
]

// Path connections [from, to]
const PATHS: [string, string][] = [
  ['cove','num'], ['cove','wrd'],
  ['num','lif'],  ['wrd','won'],
  ['lif','wld'],  ['won','log'],
  ['wld','apex'], ['log','apex'],
  ['num','wrd'], ['lif','won'], ['wld','log'],
]

// Background forest scatter (world canvas 400×720)
const BG_TREES = Array.from({ length: 140 }, (_, i) => ({
  x: (i * 53 + 13) % 400,
  y: (i * 79 + 41) % 720,
  s: 1.2 + (i % 4) * 0.15,
  kind: (i % 4) as 0|1|2|3,
}))

const TREE_KINDS: Array<keyof typeof DECO> = ['TREE_PINE_A','TREE_PINE_B','TREE_OAK_A','TREE_OAK_B']

export default function KinQuestWorldMap({
  onSelect,
  currentRegion,
  unlockedIds,
}: {
  onSelect: (id: string) => void
  currentRegion?: string
  unlockedIds?: string[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep onSelect in a ref so the pixi scene isn't torn down + rebuilt every
  // time the parent re-renders (which would flicker and race the async init).
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    let app: any, destroyed = false
    const dead = () => destroyed || !app || !app.stage
    const killApp = () => { try { app?.destroy(true, { children: true }) } catch { /* already gone */ } }

    ;(async () => {
      try {
        const PIXI = await import('pixi.js')
        if (destroyed || !ref.current) return

        const W = ref.current.offsetWidth || 390
        const H = ref.current.offsetHeight || 600

        app = new PIXI.Application()
        await app.init({
          width: W, height: H,
          backgroundColor: 0x0e2010,
          antialias: false,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        })
        if (destroyed || !ref.current) { killApp(); return }
        ref.current.appendChild(app.canvas as HTMLCanvasElement)

        // -- Load spritesheet (trees / decorations) --
        let source: any = null
        try {
          source = await PIXI.Assets.load(SHEET)
          if (source?.source) source.source.scaleMode = 'nearest'
          else if (source?.baseTexture) source.baseTexture.scaleMode = PIXI.SCALE_MODES?.NEAREST ?? 0
        } catch { /* decorations are optional */ }
        // the cleanup may have fired while we awaited the sheet — bail safely
        if (dead()) { killApp(); return }

      const tex = (f: ReturnType<typeof fr>) => {
        if (!source) return null
        try { return new PIXI.Texture({ source, frame: new PIXI.Rectangle(f.x, f.y, f.w, f.h) }) }
        catch { return null }
      }

      // -- World canvas (400×720 design space, scaled to fit) --
      const WW = 400, WH = 720
      const fit = Math.min((W / WW), (H / WH)) * 0.96
      const world = new PIXI.Container()
      world.scale.set(fit)
      world.x = (W - WW * fit) / 2
      world.y = (H - WH * fit) / 2
      app.stage.addChild(world)

      // == LAYER 0: Background ==
      const bgGfx = new PIXI.Graphics()
      bgGfx.rect(0, 0, WW, WH).fill(0x1a3a1a)
      world.addChild(bgGfx)

      // Vignette border
      const vig = new PIXI.Graphics()
      vig.roundRect(0, 0, WW, WH, 16)
        .stroke({ color: 0x0a1e0a, width: 12, alpha: 0.85 })
      world.addChild(vig)

      // == LAYER 1: Background tree scatter ==
      if (source) {
        const bgTreeCont = new PIXI.Container()
        bgTreeCont.sortableChildren = true
        for (const bt of BG_TREES) {
          const inside = REGIONS.some(r =>
            Math.abs(bt.x - r.cx) < r.w / 2 + 22 && Math.abs(bt.y - r.cy) < r.h / 2 + 22
          )
          if (inside) continue
          const k = TREE_KINDS[bt.kind]
          const t = tex(DECO[k])
          if (!t) continue
          const spr = new PIXI.Sprite(t)
          spr.scale.set(bt.s * 1.8)
          spr.anchor.set(0.5, 1)
          spr.x = bt.x; spr.y = bt.y
          spr.zIndex = bt.y
          bgTreeCont.addChild(spr)
        }
        world.addChild(bgTreeCont)
      }

      // == LAYER 2: Paths ==
      const pathGfx = new PIXI.Graphics()
      const rMap = Object.fromEntries(REGIONS.map(r => [r.id, r]))
      for (const [a, b] of PATHS) {
        const ra = rMap[a], rb = rMap[b]
        // Shadow
        pathGfx.moveTo(ra.cx, ra.cy).lineTo(rb.cx, rb.cy)
          .stroke({ color: 0x0a1a0a, width: 10, alpha: 0.5 })
        // Dirt path outer
        pathGfx.moveTo(ra.cx, ra.cy).lineTo(rb.cx, rb.cy)
          .stroke({ color: 0x8a6030, width: 8, alpha: 0.85 })
        // Dirt path highlight
        pathGfx.moveTo(ra.cx, ra.cy).lineTo(rb.cx, rb.cy)
          .stroke({ color: 0xc49050, width: 4, alpha: 0.6 })
      }
      world.addChild(pathGfx)

      // == LAYER 3: Regions ==
      const regCont = new PIXI.Container()
      world.addChild(regCont)

      for (const reg of REGIONS) {
        const unlocked = reg.unlocked || unlockedIds?.includes(reg.id) || false
        const isCurrent = reg.id === currentRegion

        const zone = new PIXI.Container()
        zone.x = reg.cx - reg.w / 2
        zone.y = reg.cy - reg.h / 2
        regCont.addChild(zone)

        // Drop shadow
        const shad = new PIXI.Graphics()
        shad.roundRect(4, 5, reg.w, reg.h, 14).fill({ color: 0x000000, alpha: 0.4 })
        zone.addChild(shad)

        // Terrain body
        const body = new PIXI.Graphics()
        body.roundRect(0, 0, reg.w, reg.h, 12)
          .fill({ color: reg.fill, alpha: unlocked ? 1.0 : 0.42 })
          .stroke({ color: reg.edge, width: 2.5 })
        zone.addChild(body)

        // Pulsing gold outline for current region
        if (isCurrent) {
          const glowRing = new PIXI.Graphics()
          glowRing.roundRect(-5, -5, reg.w + 10, reg.h + 10, 17)
            .stroke({ color: 0xffe048, width: 3.5, alpha: 0.9 })
          zone.addChildAt(glowRing, 0)
          // Animate the ring (torn down with the app on cleanup)
          let t2 = 0
          app.ticker.add(() => {
            if (glowRing.destroyed) return
            t2 += 0.05
            glowRing.alpha = 0.6 + Math.sin(t2) * 0.4
          })
        }

        // Lock dimmer
        if (!unlocked) {
          const dim = new PIXI.Graphics()
          dim.roundRect(0, 0, reg.w, reg.h, 12).fill({ color: 0x000000, alpha: 0.4 })
          zone.addChild(dim)
        }

        // Region sprite decorations
        if (source) {
          for (const [kind, dx, dy] of reg.trees) {
            const t = tex(DECO[kind])
            if (!t) continue
            const spr = new PIXI.Sprite(t)
            spr.scale.set(unlocked ? 1.8 : 1.4)
            spr.anchor.set(0.5, 1)
            spr.x = reg.w / 2 + dx
            spr.y = reg.h / 2 + dy + T * 1.8
            spr.alpha = unlocked ? 0.9 : 0.4
            zone.addChild(spr)
          }
        }

        // Icon circle
        const iconCircle = new PIXI.Graphics()
        const icR = 16
        iconCircle.circle(reg.w / 2, 22, icR)
          .fill({ color: unlocked ? reg.edge : 0x333333, alpha: 0.85 })
          .stroke({ color: unlocked ? 0xffffff : 0x555555, width: 1.5 })
        zone.addChild(iconCircle)

        const iconTxt = new PIXI.Text({ text: reg.icon, style: {
          fontFamily: 'system-ui', fontSize: 14,
          align: 'center',
        }})
        iconTxt.anchor.set(0.5)
        iconTxt.x = reg.w / 2; iconTxt.y = 22
        zone.addChild(iconTxt)

        // Region name
        const label = new PIXI.Text({
          text: (unlocked ? '' : '🔒 ') + reg.name,
          style: {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 10,
            fontWeight: 'bold',
            fill: unlocked ? 0xffffff : 0x888888,
            dropShadow: { color: 0x000000, distance: 1, blur: 2, alpha: 0.9, angle: Math.PI/4 },
            wordWrap: true, wordWrapWidth: reg.w - 12,
            align: 'center',
          }
        })
        label.anchor.set(0.5, 0)
        label.x = reg.w / 2
        label.y = reg.h / 2 + 2
        zone.addChild(label)

        // Click interaction
        if (unlocked) {
          zone.eventMode = 'static'
          zone.cursor = 'pointer'
          let pressed = false
          zone.on('pointerdown', () => { pressed = true; body.tint = 0xddddff })
          zone.on('pointerup', () => { if (pressed) { pressed = false; body.tint = 0xffffff; onSelectRef.current(reg.id) } })
          zone.on('pointerupoutside', () => { pressed = false; body.tint = 0xffffff })
          zone.on('pointerout', () => { body.tint = 0xffffff })
        }
      }

      // == LAYER 4: Map title ==
      const titleTxt = new PIXI.Text({ text: '✦  KinQuest World  ✦', style: {
        fontFamily: 'system-ui, Georgia, serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: 0xffd060,
        letterSpacing: 1,
        dropShadow: { color: 0x000000, distance: 2, blur: 4, alpha: 1, angle: Math.PI/4 },
      }})
      titleTxt.anchor.set(0.5, 0)
      titleTxt.x = WW / 2; titleTxt.y = 6
      world.addChild(titleTxt)
      } catch (e) {
        // A late throw (usually a StrictMode double-mount racing the async
        // init) must never take down the app — degrade to no map, log once.
        console.warn('[KinQuestWorldMap] scene init skipped:', e)
        killApp()
      }
    })()

    return () => { destroyed = true; killApp() }
  }, [currentRegion, unlockedIds])

  return (
    <div
      ref={ref}
      style={{ width: '100%', height: '100%', minHeight: 440, borderRadius: 16, overflow: 'hidden' }}
    />
  )
}
