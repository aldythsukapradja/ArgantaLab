// ============================================================
//  ARGANTALAB · KINWORLD GAME  (PixiJS v8 — light, crisp kingdom hub)
//  A bright top-down kingdom rendered with PixiJS (WebGL, ~200KB, lazy-loaded),
//  replacing the heavy Phaser build. The central keep MATURES with progress
//  (Class → Town → City → Kingdom); befriended kin guard it; six themed gates
//  linked by winding paths. The hero (Buddy + mount) walks slowly, 4-directional.
//  SVG sprites are rasterised to crisp textures; labels use real Pixi Text.
// ============================================================

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useAppStore } from '@store/appStore'
import KinSprite from './KinSprite'
import MountSprite from './MountSprite'
import Buddy from '@components/avatar/Buddy'
import { myMounts } from '@lib/mounts'
import type { KinInstance } from '@lib/nexus'

const GATES = [
  { world: 'num', name: 'Numeria Dunes',   hex: 0xf59e0b, emoji: '☀️' },
  { world: 'wrd', name: 'Wordveil Grove',  hex: 0x3b82f6, emoji: '📖' },
  { world: 'lif', name: 'Mood Meadow',     hex: 0xec4899, emoji: '💗' },
  { world: 'wld', name: 'World Lagoon',    hex: 0xf97316, emoji: '🌊' },
  { world: 'won', name: 'Wonder Skyfield', hex: 0x8b5cf6, emoji: '✨' },
  { world: 'log', name: 'Circuit Wastes',  hex: 0x22c55e, emoji: '🔌' },
]
const STAGE_NAMES = ['Class', 'Town', 'City', 'Kingdom']

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

export default function KinWorldGame({ roster, stage, onEnterDungeon, onOpenHall }: {
  roster: KinInstance[]; stage: number; onEnterDungeon: (world: string) => void; onOpenHall: () => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const controls = useRef({ dx: 0, dy: 0 })
  const [near, setNear] = useState<{ world: string; name: string } | null>(null)
  const nearRef = useRef(setNear); nearRef.current = setNear
  const cbRef = useRef({ onEnterDungeon, onOpenHall }); cbRef.current = { onEnterDungeon, onOpenHall }
  const outfit = useAppStore(s => s.resolvedOutfit())
  const [mountId, setMountId] = useState<string | undefined>(undefined)
  useEffect(() => { myMounts().then(m => setMountId(m.equipped ?? undefined)) }, [])

  const sig = roster.map(r => r.id).join(',')
  const textures = useMemo(() => {
    const t: Record<string, string> = {}
    const seen = new Set<string>()
    roster.slice(0, 16).forEach(r => { if (!seen.has(r.kin_key)) { seen.add(r.kin_key); t[r.kin_key] = svgTex(<KinSprite kin={r.kin_key} size={80} />) } })
    t['__avatar'] = svgTex(<Buddy mood="idle" size={96} outfit={outfit} />)
    if (mountId) t['__mount'] = svgTex(<MountSprite mount={mountId} size={104} />)
    return t
  }, [sig, mountId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let destroyed = false
    let app: any = null
    const parent = parentRef.current
    const guards = roster.slice(0, 16).map(r => r.kin_key)
    const hasMount = !!mountId
    const keys: Record<string, boolean> = {}
    const kd = (e: KeyboardEvent) => { if (/^Arrow|^[wasdWASD]$/.test(e.key)) { keys[e.key.toLowerCase()] = true; e.preventDefault() } }
    const ku = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false }

    ;(async () => {
      try {
        const PIXI: any = await import('pixi.js')
        if (destroyed || !parent) return
        app = new PIXI.Application()
        await app.init({ backgroundAlpha: 0, antialias: true, resizeTo: parent, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
        if (destroyed) { app.destroy(true); return }
        parent.appendChild(app.canvas)

        const W = 1040, H = 820, CX = W / 2, CY = H / 2 - 10
        const gatePos = GATES.map((g, i) => { const a = (-90 + i * 60) * Math.PI / 180; return { ...g, x: CX + Math.cos(a) * 350, y: CY + Math.sin(a) * 300 } })
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
        const world = new PIXI.Container(); app.stage.addChild(world)

        // grass — drawn directly; the big base rect extends WAY beyond the world so
        // that after contain-fit + centring, the letterbox margins are grass (not blue)
        const grass = new PIXI.Graphics()
        grass.rect(-1600, -1600, W + 3200, H + 3200).fill(0x7ec850)
        for (let y = 0; y < H; y += 34) for (let x = 0; x < W; x += 40) {
          grass.ellipse(x + 9, y + 9, 9, 7).fill(0xa9dc80); grass.ellipse(x + 29, y + 24, 9, 7).fill(0xa9dc80)
        }
        world.addChild(grass)

        // ponds + winding paths
        const dec = new PIXI.Graphics()
        ;[[150, 150], [W - 160, H - 150]].forEach(([x, y]) => { dec.ellipse(x, y, 84, 56).fill(0x4fb8d6); dec.ellipse(x, y, 76, 48).fill(0x6fd0e8) })
        world.addChild(dec)
        const paths = new PIXI.Graphics()
        gatePos.forEach((g, i) => {
          const dx = g.x - CX, dy = g.y - CY, len = Math.hypot(dx, dy) || 1, ox = -dy / len, oy = dx / len, off = 78 * (i % 2 ? 1 : -1)
          const mx = (CX + g.x) / 2 + ox * off, my = (CY + g.y) / 2 + oy * off
          paths.moveTo(CX, CY + 16).quadraticCurveTo(mx, my, g.x, g.y).stroke({ width: 34, color: 0xe0c48f, cap: 'round' })
        })
        gatePos.forEach((g, i) => {
          const dx = g.x - CX, dy = g.y - CY, len = Math.hypot(dx, dy) || 1, ox = -dy / len, oy = dx / len, off = 78 * (i % 2 ? 1 : -1)
          const mx = (CX + g.x) / 2 + ox * off, my = (CY + g.y) / 2 + oy * off
          paths.moveTo(CX, CY + 16).quadraticCurveTo(mx, my, g.x, g.y).stroke({ width: 15, color: 0xf2e2bc, cap: 'round' })
        })
        world.addChild(paths)

        // a few trees
        const trees = new PIXI.Graphics()
        ;[[90, 320], [W - 96, 300], [130, H - 280], [W - 130, H - 320], [CX - 300, 110], [CX + 300, 110]].forEach(([x, y]) => {
          trees.ellipse(x, y + 26, 19, 6).fill({ color: 0x000000, alpha: 0.12 })
          trees.rect(x - 4, y + 6, 8, 22).fill(0x7a5230)
          trees.circle(x, y - 4, 22).fill(0x3f8f3a); trees.circle(x - 16, y + 6, 16).fill(0x3f8f3a); trees.circle(x + 16, y + 6, 16).fill(0x3f8f3a)
          trees.circle(x - 7, y - 10, 10).fill(0x5ec257)
        })
        world.addChild(trees)

        // the maturing keep
        const keep = new PIXI.Graphics(); drawKeep(keep, CX, CY, stage); world.addChild(keep)
        const keepHit = new PIXI.Container(); keepHit.position.set(CX, CY - 16); keepHit.eventMode = 'static'; keepHit.cursor = 'pointer'
        keepHit.hitArea = new PIXI.Rectangle(-85, -85, 170, 170); keepHit.on('pointertap', () => cbRef.current.onOpenHall()); world.addChild(keepHit)
        addLabel(PIXI, world, STAGE_NAMES[stage] ?? 'Town Hall', CX, CY + 78, 19)

        // animated scene state — declared up-front so the ticker runs immediately
        const roamers: { s: any; ang: number; rad: number; spd: number; t: number }[] = []
        const sparkles: { s: any; vx: number; vy: number; t: number }[] = []
        const flags: any[] = [], shimmers: any[] = []
        const gatePrompts: Record<string, any> = {}
        let hero: any = null, nearWorld: string | null = null, clock = 0

        // pond shimmers (animated highlights)
        ;[[150, 150], [W - 160, H - 150]].forEach(([x, y]) => {
          const sh = new PIXI.Graphics(); sh.ellipse(x - 20, y - 14, 34, 14).fill({ color: 0xffffff, alpha: 0.5 })
          world.addChild(sh); shimmers.push(sh)
        })

        // arched, glowing gates with a waving flag + an "Enter" prompt
        gatePos.forEach(g => {
          const c = new PIXI.Container(); c.position.set(g.x, g.y); c.eventMode = 'static'; c.cursor = 'pointer'
          c.hitArea = new PIXI.Rectangle(-30, -34, 60, 64); c.on('pointertap', () => cbRef.current.onEnterDungeon(g.world))
          const gr = new PIXI.Graphics()
          gr.circle(0, -2, 40).fill({ color: g.hex, alpha: 0.22 })
          gr.moveTo(-25, 30); gr.lineTo(-25, -4); gr.arc(0, -4, 25, Math.PI, Math.PI * 2); gr.lineTo(25, 30); gr.closePath(); gr.fill(g.hex).stroke({ width: 3, color: 0xffffff })
          gr.moveTo(-15, 30); gr.lineTo(-15, -2); gr.arc(0, -2, 15, Math.PI, Math.PI * 2); gr.lineTo(15, 30); gr.closePath(); gr.fill(0x231f38)
          c.addChild(gr)
          const em = new PIXI.Text({ text: g.emoji, style: { fontSize: 20 } }); em.anchor.set(0.5); em.position.set(0, 8); c.addChild(em)
          const flag = new PIXI.Graphics(); flag.rect(0, -48, 3, 22).fill(0x6b5b3a); flag.poly([3, -48, 18, -44, 3, -38]).fill(g.hex)
          flag.position.set(20, 0); c.addChild(flag); flags.push(flag)
          world.addChild(c)
          addLabel(PIXI, world, g.name, g.x, g.y + 42, 16)
          const pr = new PIXI.Container(); pr.position.set(g.x, g.y - 58); pr.visible = false
          const pt = new PIXI.Text({ text: 'Enter →', style: { fontFamily: 'Arial, sans-serif', fontSize: 15, fontWeight: '700', fill: 0xffffff } }); pt.anchor.set(0.5)
          const pb = new PIXI.Graphics(); pb.roundRect(-pt.width / 2 - 9, -13, pt.width + 18, 26, 13).fill(g.hex)
          pr.addChild(pb); pr.addChild(pt); world.addChild(pr); gatePrompts[g.world] = pr
        })

        // drifting sparkles / fireflies
        for (let i = 0; i < 16; i++) {
          const sp = new PIXI.Graphics(); sp.circle(0, 0, 2.5).fill({ color: 0xfff6c0, alpha: 0.9 })
          sp.position.set(Math.random() * W, Math.random() * H); world.addChild(sp)
          sparkles.push({ s: sp, vx: (Math.random() - 0.5) * 0.4, vy: -0.2 - Math.random() * 0.3, t: Math.random() * 6 })
        }

        window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)

        app.ticker.add((tk: any) => {
          if (destroyed) return
          const dt = tk.deltaTime; clock += dt
          // CONTAIN-fit so every gate is fully visible; the over-sized grass fills
          // the margins so there's no blue letterbox. Centre the keep.
          const z = Math.min(app.screen.width / W, app.screen.height / H) || 1
          world.scale.set(z); world.position.set(app.screen.width / 2 - CX * z, app.screen.height / 2 - CY * z)
          // ambient life
          shimmers.forEach((sh, i) => { sh.alpha = 0.35 + Math.sin(clock * 0.03 + i) * 0.22 })
          flags.forEach((f, i) => { f.skew.x = Math.sin(clock * 0.06 + i) * 0.28 })
          sparkles.forEach(sp => {
            sp.s.x += sp.vx * dt; sp.s.y += sp.vy * dt; sp.t += 0.05 * dt
            sp.s.alpha = 0.35 + Math.abs(Math.sin(sp.t)) * 0.6
            if (sp.s.y < -12) { sp.s.y = H + 12; sp.s.x = Math.random() * W }
            if (sp.s.x < -12) sp.s.x = W + 12; else if (sp.s.x > W + 12) sp.s.x = -12
          })
          // kin slowly roam around the keep
          roamers.forEach(r => { r.ang += r.spd * dt; r.t += 0.05 * dt; r.s.x = CX + Math.cos(r.ang) * r.rad; r.s.y = CY + Math.sin(r.ang) * r.rad * 0.8 + 8 - Math.abs(Math.sin(r.t)) * 4 })
          // 4-directional slow movement
          if (hero) {
            let vx = 0, vy = 0
            if (keys['arrowleft'] || keys['a']) vx = -1
            else if (keys['arrowright'] || keys['d']) vx = 1
            else if (keys['arrowup'] || keys['w']) vy = -1
            else if (keys['arrowdown'] || keys['s']) vy = 1
            if (controls.current.dx) { vx = controls.current.dx; vy = 0 }
            else if (controls.current.dy) { vy = controls.current.dy; vx = 0 }
            const spd = 1.7 * dt
            hero.x = clamp(hero.x + vx * spd, 40, W - 40); hero.y = clamp(hero.y + vy * spd, 40, H - 40)
            let found: { world: string; name: string } | null = null
            for (const g of gatePos) if (Math.hypot(g.x - hero.x, g.y - hero.y) < 82) { found = { world: g.world, name: g.name }; break }
            const fw = found ? found.world : null
            for (const key in gatePrompts) gatePrompts[key].visible = fw === key
            if (fw !== nearWorld) { nearWorld = fw; nearRef.current(found) }
          }
        })

        // rasterise SVG → crisp textures for the guard kin + the hero
        for (let i = 0; i < guards.length; i++) {
          const key = guards[i]
          if (!textures[key]) continue
          const canvas = await rasterize(textures[key], 80, 80)
          if (destroyed) return
          const ang = (-90 + (i / Math.max(1, guards.length)) * 360) * Math.PI / 180
          const rad = 150 + (i % 2) * 28
          const s = new PIXI.Sprite(PIXI.Texture.from(canvas)); s.anchor.set(0.5); s.scale.set(0.6)
          s.position.set(CX + Math.cos(ang) * rad, CY + Math.sin(ang) * rad * 0.8 + 8)
          world.addChild(s); roamers.push({ s, ang, rad, spd: 0.0018 * (i % 2 ? 1 : -1), t: Math.random() * 6 })
        }
        const avC = await rasterize(textures['__avatar'], 96, 96)
        if (destroyed) return
        const heroC = new PIXI.Container(); heroC.position.set(CX, CY + 198)
        if (textures['__mount']) { const mC = await rasterize(textures['__mount'], 104, 104); if (destroyed) return; const ms = new PIXI.Sprite(PIXI.Texture.from(mC)); ms.anchor.set(0.5); ms.position.set(0, 10); ms.scale.set(0.74); heroC.addChild(ms) }
        const rs = new PIXI.Sprite(PIXI.Texture.from(avC)); rs.anchor.set(0.5); rs.position.set(0, hasMount ? -18 : 0); rs.scale.set(hasMount ? 0.46 : 0.6); heroC.addChild(rs)
        world.addChild(heroC); hero = heroC
      } catch (err) { console.error('[kinworld] pixi init failed:', err) }
    })()

    return () => {
      destroyed = true; setNear(null)
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
      try { if (app) app.destroy(true, { children: true }) } catch { /* ignore */ }
    }
  }, [sig, mountId, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  const press = (dx: number, dy: number) => () => { controls.current = { dx, dy } }
  const release = () => { controls.current = { dx: 0, dy: 0 } }

  return (
    <div className="kw-game">
      <div ref={parentRef} className="kw-canvas" />
      {near && (
        <button className="kw-enter" style={{ background: `#${GATES.find(g => g.world === near.world)?.hex.toString(16).padStart(6, '0')}` }}
          onClick={() => cbRef.current.onEnterDungeon(near.world)}>
          Enter {near.name} →
        </button>
      )}
      <div className="kw-dpad">
        <button className="dp dp-u" onPointerDown={press(0, -1)} onPointerUp={release} onPointerLeave={release} aria-label="Up">▲</button>
        <button className="dp dp-l" onPointerDown={press(-1, 0)} onPointerUp={release} onPointerLeave={release} aria-label="Left">◀</button>
        <button className="dp dp-r" onPointerDown={press(1, 0)} onPointerUp={release} onPointerLeave={release} aria-label="Right">▶</button>
        <button className="dp dp-d" onPointerDown={press(0, 1)} onPointerUp={release} onPointerLeave={release} aria-label="Down">▼</button>
      </div>
    </div>
  )
}

// crisp Pixi text label with a soft white pill behind it
function addLabel(PIXI: any, world: any, text: string, x: number, y: number, size: number) {
  const t = new PIXI.Text({ text, style: { fontFamily: 'Arial, sans-serif', fontSize: size, fontWeight: '700', fill: 0x1f2937 } })
  t.anchor.set(0.5); t.position.set(x, y)
  const bg = new PIXI.Graphics(); bg.roundRect(x - t.width / 2 - 7, y - t.height / 2 - 3, t.width + 14, t.height + 6, 8).fill({ color: 0xffffff, alpha: 0.9 })
  world.addChild(bg); world.addChild(t)
}

// the maturing central building, drawn onto a Pixi Graphics
function drawKeep(g: any, cx: number, cy: number, st: number) {
  g.ellipse(cx, cy + 56, 85, 15).fill({ color: 0x000000, alpha: 0.16 })
  if (st >= 3) {
    const ox = cx - 92, oy = cy - 96
    const tower = (tx: number) => {
      g.rect(tx, oy + 44, 36, 104).fill(0xe7e3d6); g.rect(tx, oy + 44, 36, 6).fill(0xf4f1e6)
      g.poly([tx - 5, oy + 38, tx + 18, oy + 8, tx + 41, oy + 38]).fill(0x4f86d8)
      g.rect(tx + 17, oy - 6, 2, 15).fill(0x8a5a2b); g.rect(tx + 19, oy - 6, 13, 8).fill(0xf0c040)
      g.rect(tx + 13, oy + 64, 10, 15).fill(0xbfe6ff)
    }
    tower(ox + 4); tower(ox + 144)
    g.rect(ox + 46, oy + 58, 92, 90).fill(0xeeeade); g.rect(ox + 46, oy + 58, 92, 6).fill(0xf7f4ea)
    for (let i = 0; i < 6; i++) g.rect(ox + 46 + i * 16, oy + 50, 10, 9).fill(0xeeeade)
    g.poly([ox + 74, oy + 32, ox + 92, oy + 4, ox + 110, oy + 32]).fill(0xe24b4a)
    g.rect(ox + 91, oy - 8, 2, 14).fill(0x8a5a2b); g.rect(ox + 93, oy - 8, 14, 8).fill(0xf0c040)
    g.rect(ox + 80, oy + 112, 24, 36).fill(0x7a5230); g.rect(ox + 84, oy + 120, 16, 28).fill(0x5a3c20)
    g.rect(ox + 60, oy + 78, 12, 16).fill(0xbfe6ff); g.rect(ox + 112, oy + 78, 12, 16).fill(0xbfe6ff)
  } else if (st === 2) {
    const tw = (tx: number, h: number, c: number) => {
      g.rect(tx - 16, cy + 44 - h, 32, h).fill(0xe7e3d6)
      g.poly([tx - 18, cy + 44 - h, tx, cy + 44 - h - 22, tx + 18, cy + 44 - h]).fill(c)
      for (let r = 0; r < Math.floor(h / 26); r++) { g.rect(tx - 8, cy + 28 - r * 24, 6, 10).fill(0xbfe6ff); g.rect(tx + 4, cy + 28 - r * 24, 6, 10).fill(0xbfe6ff) }
    }
    tw(cx - 46, 96, 0x4f86d8); tw(cx + 46, 84, 0xc0533a); tw(cx, 124, 0x6f5bd0)
  } else if (st === 1) {
    const house = (hx: number, hy: number, roof: number) => {
      g.rect(hx - 22, hy - 2, 44, 40).fill(0xf3ead0); g.poly([hx - 26, hy - 2, hx, hy - 26, hx + 26, hy - 2]).fill(roof)
      g.rect(hx - 7, hy + 18, 14, 20).fill(0x7a5230); g.rect(hx - 16, hy + 4, 10, 10).fill(0xbfe6ff); g.rect(hx + 6, hy + 4, 10, 10).fill(0xbfe6ff)
    }
    house(cx - 42, cy + 10, 0xc0533a); house(cx + 42, cy + 10, 0x4f86d8); house(cx, cy - 16, 0x6fae54)
  } else {
    g.rect(cx - 44, cy - 6, 88, 54).fill(0xf3ead0); g.rect(cx - 44, cy - 6, 88, 5).fill(0xfff7e6)
    g.poly([cx - 52, cy - 6, cx, cy - 40, cx + 52, cy - 6]).fill(0xc0533a)
    g.rect(cx - 8, cy - 58, 16, 22).fill(0xe7e3d6); g.poly([cx - 12, cy - 56, cx, cy - 72, cx + 12, cy - 56]).fill(0xc0533a)
    g.rect(cx - 1, cy - 84, 2, 12).fill(0x8a5a2b); g.rect(cx + 1, cy - 84, 12, 7).fill(0x4f86d8)
    g.rect(cx - 9, cy + 24, 18, 24).fill(0x7a5230); g.rect(cx - 6, cy + 28, 12, 20).fill(0x5a3c20)
    g.rect(cx - 34, cy + 8, 14, 14).fill(0xbfe6ff); g.rect(cx + 20, cy + 8, 14, 14).fill(0xbfe6ff)
  }
}
