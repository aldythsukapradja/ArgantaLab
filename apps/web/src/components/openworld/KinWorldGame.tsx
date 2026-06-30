// ============================================================
//  ARGANTALAB · KINWORLD GAME  (Phaser 4 — playful kingdom hub)
//  A bright, sunny top-down kingdom rendered with Phaser, LAZY-LOADED so it only
//  ships on the KinWorld tab. The central building MATURES with progress
//  (Class → Town → City → Kingdom). Befriended kin stand guard around it; six
//  themed gate-portals are linked by winding paths; trees, flowers and ponds
//  fill the world. The hero is the player avatar riding their mount (the existing
//  SVG sprites rasterised to textures). World fits the viewport (no scroll).
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

// React SVG element → texture data URL. Standalone SVGs need an explicit xmlns
// or the browser won't decode them (the bug that left textures blank).
function svgTex(node: ReactElement): string {
  let s = renderToStaticMarkup(node)
  if (!s.includes('xmlns')) s = s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)
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
    let game: { destroy: (b: boolean) => void } | null = null
    let destroyed = false
    const guards = roster.slice(0, 16).map(r => r.kin_key)
    const hasMount = !!mountId

    ;(async () => {
      const Phaser: any = (await import('phaser')).default
      if (destroyed || !parentRef.current) return

      const W = 1040, H = 820, CX = W / 2, CY = H / 2 - 10
      const gatePos = GATES.map((g, i) => {
        const a = (-90 + i * 60) * Math.PI / 180
        return { ...g, x: CX + Math.cos(a) * 380, y: CY + Math.sin(a) * 300 }
      })
      const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

      const tree = (s: any, x: number, y: number) => {
        const g = s.add.graphics()
        g.fillStyle(0x000000, 0.12).fillEllipse(x, y + 26, 38, 12)
        g.fillStyle(0x7a5230).fillRect(x - 4, y + 6, 8, 22)
        g.fillStyle(0x3f8f3a).fillCircle(x, y - 4, 22).fillCircle(x - 16, y + 6, 16).fillCircle(x + 16, y + 6, 16)
        g.fillStyle(0x5ec257).fillCircle(x - 7, y - 10, 10).fillCircle(x + 9, y - 5, 9)
      }

      // central building MATURES with stage: 0 Class · 1 Town · 2 City · 3 Kingdom
      const drawBuilding = (s: any, cx: number, cy: number, st: number) => {
        const g = s.add.graphics()
        g.fillStyle(0x000000, 0.16).fillEllipse(cx, cy + 56, 170, 30)
        if (st >= 3) {
          const ox = cx - 92, oy = cy - 96
          const tower = (tx: number) => {
            g.fillStyle(0xe7e3d6).fillRect(tx, oy + 44, 36, 104); g.fillStyle(0xf4f1e6).fillRect(tx, oy + 44, 36, 6)
            g.fillStyle(0xd6d2c2).fillRect(tx, oy + 36, 9, 9).fillRect(tx + 14, oy + 36, 9, 9).fillRect(tx + 27, oy + 36, 9, 9)
            g.fillStyle(0x4f86d8); g.beginPath(); g.moveTo(tx - 5, oy + 38); g.lineTo(tx + 18, oy + 8); g.lineTo(tx + 41, oy + 38); g.closePath(); g.fillPath()
            g.fillStyle(0x8a5a2b).fillRect(tx + 17, oy - 6, 2, 15); g.fillStyle(0xf0c040).fillRect(tx + 19, oy - 6, 13, 8)
            g.fillStyle(0xbfe6ff).fillRect(tx + 13, oy + 64, 10, 15)
          }
          tower(ox + 4); tower(ox + 144)
          g.fillStyle(0xeeeade).fillRect(ox + 46, oy + 58, 92, 90); g.fillStyle(0xf7f4ea).fillRect(ox + 46, oy + 58, 92, 6)
          for (let i = 0; i < 6; i++) g.fillStyle(0xeeeade).fillRect(ox + 46 + i * 16, oy + 50, 10, 9)
          g.fillStyle(0xe24b4a); g.beginPath(); g.moveTo(ox + 74, oy + 32); g.lineTo(ox + 92, oy + 4); g.lineTo(ox + 110, oy + 32); g.closePath(); g.fillPath()
          g.fillStyle(0x8a5a2b).fillRect(ox + 91, oy - 8, 2, 14); g.fillStyle(0xf0c040).fillRect(ox + 93, oy - 8, 14, 8)
          g.fillStyle(0x7a5230).fillRect(ox + 80, oy + 112, 24, 36); g.fillStyle(0x5a3c20).fillRect(ox + 84, oy + 120, 16, 28); g.fillStyle(0x5a3c20).fillCircle(ox + 92, oy + 120, 8)
          g.fillStyle(0xbfe6ff).fillRect(ox + 60, oy + 78, 12, 16).fillRect(ox + 112, oy + 78, 12, 16)
        } else if (st === 2) {
          const tw = (tx: number, h: number, c: number) => {
            g.fillStyle(0xe7e3d6).fillRect(tx - 16, cy + 44 - h, 32, h)
            for (let i = 0; i < 3; i++) g.fillStyle(0xd6d2c2).fillRect(tx - 16 + i * 12, cy + 44 - h - 7, 8, 8)
            g.fillStyle(c); g.beginPath(); g.moveTo(tx - 18, cy + 44 - h); g.lineTo(tx, cy + 44 - h - 22); g.lineTo(tx + 18, cy + 44 - h); g.closePath(); g.fillPath()
            for (let r = 0; r < Math.floor(h / 26); r++) { g.fillStyle(0xbfe6ff).fillRect(tx - 8, cy + 28 - r * 24, 6, 10).fillRect(tx + 4, cy + 28 - r * 24, 6, 10) }
          }
          tw(cx - 46, 96, 0x4f86d8); tw(cx + 46, 84, 0xc0533a); tw(cx, 124, 0x6f5bd0)
        } else if (st === 1) {
          const house = (hx: number, hy: number, roof: number) => {
            g.fillStyle(0xf3ead0).fillRect(hx - 22, hy - 2, 44, 40); g.fillStyle(roof); g.beginPath(); g.moveTo(hx - 26, hy - 2); g.lineTo(hx, hy - 26); g.lineTo(hx + 26, hy - 2); g.closePath(); g.fillPath()
            g.fillStyle(0x7a5230).fillRect(hx - 7, hy + 18, 14, 20); g.fillStyle(0xbfe6ff).fillRect(hx - 16, hy + 4, 10, 10).fillRect(hx + 6, hy + 4, 10, 10)
          }
          house(cx - 42, cy + 10, 0xc0533a); house(cx + 42, cy + 10, 0x4f86d8); house(cx, cy - 16, 0x6fae54)
          g.fillStyle(0x8a5a2b).fillRect(cx - 1, cy - 58, 2, 12); g.fillStyle(0xf0c040).fillRect(cx + 1, cy - 58, 12, 7)
        } else {
          g.fillStyle(0xf3ead0).fillRect(cx - 44, cy - 6, 88, 54); g.fillStyle(0xfff7e6).fillRect(cx - 44, cy - 6, 88, 5)
          g.fillStyle(0xc0533a); g.beginPath(); g.moveTo(cx - 52, cy - 6); g.lineTo(cx, cy - 40); g.lineTo(cx + 52, cy - 6); g.closePath(); g.fillPath()
          g.fillStyle(0xe7e3d6).fillRect(cx - 8, cy - 58, 16, 22)
          g.fillStyle(0xc0533a); g.beginPath(); g.moveTo(cx - 12, cy - 56); g.lineTo(cx, cy - 72); g.lineTo(cx + 12, cy - 56); g.closePath(); g.fillPath()
          g.fillStyle(0xf0c040).fillCircle(cx, cy - 48, 3)
          g.fillStyle(0x8a5a2b).fillRect(cx - 1, cy - 84, 2, 12); g.fillStyle(0x4f86d8).fillRect(cx + 1, cy - 84, 12, 7)
          g.fillStyle(0x7a5230).fillRect(cx - 9, cy + 24, 18, 24); g.fillStyle(0x5a3c20).fillRect(cx - 6, cy + 28, 12, 20)
          g.fillStyle(0xbfe6ff).fillRect(cx - 34, cy + 8, 14, 14).fillRect(cx + 20, cy + 8, 14, 14)
        }
      }

      const drawGate = (s: any, g: any, labels: any[]) => {
        const gr = s.add.graphics()
        gr.fillStyle(0x000000, 0.14).fillEllipse(g.x, g.y + 30, 60, 16)
        gr.fillStyle(g.hex).fillRoundedRect(g.x - 29, g.y - 32, 58, 60, { tl: 27, tr: 27, bl: 7, br: 7 })
        gr.fillStyle(0x2a2740).fillRoundedRect(g.x - 18, g.y - 16, 36, 44, { tl: 17, tr: 17, bl: 5, br: 5 })
        gr.lineStyle(3, 0xffffff, 0.92).strokeRoundedRect(g.x - 29, g.y - 32, 58, 60, { tl: 27, tr: 27, bl: 7, br: 7 })
        gr.fillStyle(0x8a5a2b).fillRect(g.x + 25, g.y - 48, 3, 22)
        gr.fillStyle(g.hex).fillRect(g.x + 28, g.y - 48, 17, 11); gr.fillStyle(0xffffff, 0.25).fillRect(g.x + 28, g.y - 48, 17, 3)
        s.add.text(g.x, g.y - 2, g.emoji, { fontSize: '22px' }).setOrigin(0.5)
        const lab = s.add.text(g.x, g.y + 40, g.name, { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: '18px', color: '#1f2937', backgroundColor: '#ffffffee', padding: { x: 7, y: 3 } }).setOrigin(0.5).setResolution(2)
        labels.push(lab)
        s.add.zone(g.x, g.y, 58, 60).setInteractive({ useHandCursor: true }).on('pointerdown', () => cbRef.current.onEnterDungeon(g.world))
      }

      const scene = {
        preload(this: any) {
          Object.entries(textures).forEach(([k, url]) => this.load.image(k, url as string))
        },
        create(this: any) {
          this.labels = []
          const gg = this.make.graphics()
          gg.fillStyle(0x7ec850).fillRect(0, 0, 16, 16)
          gg.fillStyle(0x86d058).fillRect(0, 0, 8, 8).fillRect(8, 8, 8, 8)
          gg.fillStyle(0xa6e06f).fillRect(3, 3, 2, 2).fillRect(11, 10, 2, 2)
          gg.generateTexture('grass', 16, 16); gg.destroy()
          this.add.tileSprite(CX, CY, W, H, 'grass')

          const pond = this.add.graphics()
          ;[[150, 150], [W - 160, H - 150]].forEach(([x, y]) => {
            pond.fillStyle(0x4fb8d6).fillEllipse(x, y, 168, 112)
            pond.fillStyle(0x6fd0e8).fillEllipse(x, y, 152, 96)
            pond.fillStyle(0xbfeeff, 0.5).fillEllipse(x - 22, y - 16, 40, 18)
          })

          const pathG = this.add.graphics()
          gatePos.forEach((g, i) => {
            const dx = g.x - CX, dy = g.y - CY, len = Math.hypot(dx, dy) || 1
            const ox = -dy / len, oy = dx / len, off = 78 * (i % 2 ? 1 : -1)
            const curve = new Phaser.Curves.QuadraticBezier(
              new Phaser.Math.Vector2(CX, CY + 16),
              new Phaser.Math.Vector2((CX + g.x) / 2 + ox * off, (CY + g.y) / 2 + oy * off),
              new Phaser.Math.Vector2(g.x, g.y),
            )
            const pts = curve.getPoints(30)
            pts.forEach((p: any) => pathG.fillStyle(0xe0c48f, 1).fillCircle(p.x, p.y, 17))
            pts.forEach((p: any) => pathG.fillStyle(0xf2e2bc, 1).fillCircle(p.x, p.y, 8))
          })

          const hedge = this.add.graphics()
          const bump = (x2: number, y2: number) => { hedge.fillStyle(0x4f9e3c).fillCircle(x2, y2, 20); hedge.fillStyle(0x66bb4c).fillCircle(x2, y2 - 4, 15) }
          for (let x = 0; x <= W; x += 38) { bump(x, 12); bump(x, H - 12) }
          for (let y = 0; y <= H; y += 38) { bump(12, y); bump(W - 12, y) }

          const fl = this.add.graphics()
          for (let n = 0; n < 60; n++) {
            const x = 30 + Math.random() * (W - 60), y = 30 + Math.random() * (H - 60)
            if (Math.hypot(x - CX, y - CY) < 150) continue
            const col = [0xff7eb3, 0xffd86b, 0xffffff, 0xff9a4a, 0xb98bff][n % 5]
            fl.fillStyle(0x4f9e3c).fillRect(x - 0.5, y, 1, 6); fl.fillStyle(col).fillCircle(x, y, 3)
          }
          ;[[90, 320], [W - 96, 300], [130, H - 280], [W - 130, H - 320],
            [CX - 300, 110], [CX + 300, 110], [CX - 320, H - 120], [CX + 320, H - 120]].forEach(([x, y]) => tree(this, x, y))

          // the maturing central building + its tier label (tap → Town Hall)
          drawBuilding(this, CX, CY, stage)
          const tierLab = this.add.text(CX, CY + 78, STAGE_NAMES[stage] ?? 'Town Hall', { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: '19px', color: '#1f2937', backgroundColor: '#ffffffee', padding: { x: 9, y: 4 } }).setOrigin(0.5).setResolution(2).setDepth(9)
          this.labels.push(tierLab)
          this.add.zone(CX, CY - 16, 170, 170).setInteractive({ useHandCursor: true }).on('pointerdown', () => cbRef.current.onOpenHall())

          // kin guard ring, gentle bob
          guards.forEach((key, i) => {
            if (!this.textures.exists(key)) return
            const a = (-90 + (i / Math.max(1, guards.length)) * 360) * Math.PI / 180
            const gx = CX + Math.cos(a) * 168, gy = CY + Math.sin(a) * 132 + 8
            const img = this.add.image(gx, gy, key).setScale(0.6).setDepth(8)
            this.tweens.add({ targets: img, y: gy - 6, duration: 1100 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 800 })
          })

          gatePos.forEach(g => drawGate(this, g, this.labels))

          // hero riding the mount (mount below, rider on top), gentle idle bob
          const parts: any[] = []
          if (this.textures.exists('__mount')) parts.push(this.add.image(0, 10, '__mount').setScale(0.74))
          const rider = this.add.image(0, hasMount ? -18 : 0, '__avatar').setScale(hasMount ? 0.46 : 0.6)
          parts.push(rider)
          this.avatar = this.add.container(CX, CY + 198, parts).setDepth(10)
          this.tweens.add({ targets: rider, y: rider.y - 3, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

          this.cursors = this.input.keyboard.createCursorKeys()
          this.wasd = this.input.keyboard.addKeys('W,A,S,D')
          this.nearWorld = null

          const doFit = () => {
            const z = Math.max(0.2, Math.min(this.scale.width / W, this.scale.height / H))
            this.cameras.main.setZoom(z)
            this.cameras.main.centerOn(CX, CY)
            this.labels.forEach((t: any) => t.setScale(1 / z)) // keep labels a constant, readable size
          }
          doFit()
          this.scale.on('resize', doFit)
        },
        update(this: any, _t: number, delta: number) {
          if (!this.avatar) return
          // 4-directional only (no diagonal), slow + elegant
          let vx = 0, vy = 0
          const c = this.cursors, w = this.wasd
          if (c.left.isDown || w.A.isDown) vx = -1
          else if (c.right.isDown || w.D.isDown) vx = 1
          else if (c.up.isDown || w.W.isDown) vy = -1
          else if (c.down.isDown || w.S.isDown) vy = 1
          if (controls.current.dx) { vx = controls.current.dx; vy = 0 }
          else if (controls.current.dy) { vy = controls.current.dy; vx = 0 }

          const spd = 1.7 * (delta / 16)
          this.avatar.x = clamp(this.avatar.x + vx * spd, 40, W - 40)
          this.avatar.y = clamp(this.avatar.y + vy * spd, 40, H - 40)

          let found: { world: string; name: string } | null = null
          for (const g of gatePos) {
            if (Math.hypot(g.x - this.avatar.x, g.y - this.avatar.y) < 82) { found = { world: g.world, name: g.name }; break }
          }
          const fw = found ? found.world : null
          if (fw !== this.nearWorld) { this.nearWorld = fw; nearRef.current(found) }
        },
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parentRef.current,
        backgroundColor: '#bfe6f2',
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
        scene,
      })
    })()

    return () => { destroyed = true; setNear(null); if (game) game.destroy(true) }
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
