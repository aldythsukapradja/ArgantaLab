// ============================================================
//  CORE — the G runtime every genre module receives.
//  Owns the canvas, loop, unified input (keys + pointer + swipe),
//  seeded rng, world palette, hero/sidekick looks, particles,
//  screenshake, sfx and score. The DOM shell (shell.ts) owns
//  menus/overlays; genres only ever talk to G.
// ============================================================

import type { GameSpec, ParamValue, SidekickSpec } from './types'
import { worldDef, type WorldDef } from './worlds'
import { Sfx } from './sfx'
import { Bridge } from './bridge'
import { drawHero, drawSidekick, heroLook, ENGINE_PALETTES, type HeroLook } from './draw'

export interface GenreGame {
  w: number
  h: number
  update(dt: number): void
  draw(): void
  /** Sim genres persist progress; arcade genres omit these. */
  serialize?(): unknown
  restore?(d: unknown): void
}
export type GenreFactory = (g: G) => GenreGame

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number }

export class G {
  ctx!: CanvasRenderingContext2D
  canvas!: HTMLCanvasElement
  w = 480; h = 720
  spec: GameSpec
  world: WorldDef
  look: HeroLook
  sk: SidekickSpec | null
  sfx = new Sfx()
  bridge: Bridge
  score = 0
  frame = 0
  state: 'title' | 'play' | 'pause' | 'over' = 'title'

  // input
  keys = new Set<string>()
  keysHit = new Set<string>()           // pressed this frame
  p = { x: 0, y: 0, down: false, justDown: false, justUp: false, startX: 0, startY: 0, dx: 0, dy: 0, vx: 0, vy: 0 }
  private lastP = { x: 0, y: 0, t: 0 }

  // shell hooks (installed by shell.ts)
  onGameOver: (score: number, win: boolean, stats?: Record<string, string | number>) => void = () => {}
  onScore: (score: number) => void = () => {}
  onToast: (text: string) => void = () => {}

  private parts: Particle[] = []
  private shakeT = 0; private shakeAmp = 0
  private rngState: number

  constructor(spec: GameSpec, gameId: string) {
    this.spec = spec
    this.world = worldDef(spec.world)
    this.look = heroLook(spec.hero, ENGINE_PALETTES)
    this.sk = spec.sidekick
    this.bridge = new Bridge(gameId, spec.services.login ? spec.hero.name : 'Anonymous')
    this.rngState = 1234567 + (spec.layout + 1) * 999331
  }

  attach(canvas: HTMLCanvasElement, w: number, h: number) {
    this.canvas = canvas; this.w = w; this.h = h
    canvas.width = w; canvas.height = h
    this.ctx = canvas.getContext('2d')!
    this.bindInput()
  }

  // ── params ──
  num(key: string, def = 0): number { const v = this.spec.params[key]; return typeof v === 'number' ? v : def }
  str(key: string, def = ''): string { const v = this.spec.params[key]; return typeof v === 'string' ? v : def }
  bool(key: string, def = false): boolean { const v = this.spec.params[key]; return typeof v === 'boolean' ? v : def }
  param(key: string): ParamValue | undefined { return this.spec.params[key] }

  // ── seeded rng (deterministic per layout) ──
  rng(): number {
    this.rngState = (this.rngState * 48271) % 2147483647
    return this.rngState / 2147483647
  }
  ri(min: number, max: number): number { return min + Math.floor(this.rng() * (max - min + 1)) }
  pickOf<T>(arr: T[]): T { return arr[Math.floor(this.rng() * arr.length)] }

  // ── input ──
  private toVirtual(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width * this.w, y: (e.clientY - r.top) / r.height * this.h }
  }
  private bindInput() {
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
      if (!this.keys.has(e.key)) this.keysHit.add(e.key)
      this.keys.add(e.key)
    })
    window.addEventListener('keyup', e => this.keys.delete(e.key))
    const down = (e: { clientX: number; clientY: number }) => {
      const v = this.toVirtual(e)
      Object.assign(this.p, { x: v.x, y: v.y, down: true, justDown: true, startX: v.x, startY: v.y, dx: 0, dy: 0, vx: 0, vy: 0 })
      this.lastP = { x: v.x, y: v.y, t: performance.now() }
    }
    const move = (e: { clientX: number; clientY: number }) => {
      const v = this.toVirtual(e)
      const now = performance.now(), dt = Math.max(1, now - this.lastP.t)
      if (this.p.down) {
        this.p.vx = (v.x - this.lastP.x) / dt * 1000
        this.p.vy = (v.y - this.lastP.y) / dt * 1000
        this.p.dx = v.x - this.p.startX; this.p.dy = v.y - this.p.startY
      }
      this.p.x = v.x; this.p.y = v.y
      this.lastP = { x: v.x, y: v.y, t: now }
    }
    const up = () => { if (this.p.down) { this.p.down = false; this.p.justUp = true } }
    this.canvas.addEventListener('mousedown', down)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    this.canvas.addEventListener('touchstart', e => { e.preventDefault(); down(e.touches[0]) }, { passive: false })
    this.canvas.addEventListener('touchmove', e => { e.preventDefault(); move(e.touches[0]) }, { passive: false })
    this.canvas.addEventListener('touchend', e => { e.preventDefault(); up() }, { passive: false })
  }
  key(k: string): boolean { return this.keys.has(k) }
  hit(k: string): boolean { return this.keysHit.has(k) }
  /** Directional intent: arrows/WASD merged. */
  axis(): { x: number; y: number } {
    let x = 0, y = 0
    if (this.key('ArrowLeft') || this.key('a')) x -= 1
    if (this.key('ArrowRight') || this.key('d')) x += 1
    if (this.key('ArrowUp') || this.key('w')) y -= 1
    if (this.key('ArrowDown') || this.key('s')) y += 1
    return { x, y }
  }
  endFrame() { this.p.justDown = false; this.p.justUp = false; this.keysHit.clear(); this.frame++ }

  // ── juice ──
  burst(x: number, y: number, color: string, n = 12, speed = 160, grav = 300, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8)
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.3, life: 0.7, max: 0.7, color, size: size * (0.6 + Math.random() * 0.8), grav })
    }
  }
  shake(amp = 6, dur = 0.25) { this.shakeAmp = amp; this.shakeT = dur }
  updateFx(dt: number) {
    this.shakeT = Math.max(0, this.shakeT - dt)
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.life -= dt }
    this.parts = this.parts.filter(p => p.life > 0)
  }
  drawFx() {
    const c = this.ctx
    for (const p of this.parts) {
      c.globalAlpha = Math.max(0, p.life / p.max)
      c.fillStyle = p.color
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    c.globalAlpha = 1
  }
  applyShake() {
    if (this.shakeT > 0) {
      const a = this.shakeAmp * (this.shakeT / 0.25)
      this.ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a)
    }
  }

  // ── shared sprites ──
  hero(x: number, y: number, size: number, frame = this.frame, facing = 1) { drawHero(this.ctx, x, y, size, this.look, frame, facing) }
  sidekick(x: number, y: number, size: number, frame = this.frame) { if (this.sk) drawSidekick(this.ctx, x, y, size, this.sk, frame) }
  bgGradient() {
    const g = this.ctx.createLinearGradient(0, 0, 0, this.h)
    g.addColorStop(0, this.world.bg1); g.addColorStop(1, this.world.bg2)
    this.ctx.fillStyle = g; this.ctx.fillRect(0, 0, this.w, this.h)
  }

  // ── scoring / flow ──
  addScore(n: number) { this.score += n; this.onScore(this.score) }
  toast(text: string) { this.onToast(text) }
  gameOver(win = false, stats?: Record<string, string | number>) {
    if (this.state === 'over') return
    this.state = 'over'
    if (win) this.sfx.win(); else this.sfx.lose()
    this.onGameOver(this.score, win, stats)
  }
}
