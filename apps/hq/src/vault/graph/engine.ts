// HQ Vault graph v3 — PIXI v8 (WebGL) renderer + camera + interaction.
//
// Framework-agnostic: React hands it plain node/edge data + colour numbers and
// wires the toolbar/inspector through callbacks. The engine owns the WebGL stage,
// the d3-force worker (via SimClient), the camera, hit-testing, and Obsidian-style
// zoom-faded labels. Nodes are Sprites of one shared circle texture (tinted per
// node → cheap into the thousands); edges are a batched Graphics; labels live in a
// screen-space layer so they stay a constant pixel size like Obsidian's.

import * as PIXI from 'pixi.js'
import { SimClient } from './simClient'
import { DEFAULT_PARAMS, type SimParams } from './protocol'

export interface EngineNode { id: string; title: string; r: number; color: number; deg: number }
export interface EngineEdge { a: number; b: number; suggested?: boolean }
export type LabelMode = 'off' | 'auto' | 'always'

export interface EngineColors {
  edge: number; suggested: number; accent: number
  label: string; labelHalo: string
}
export interface EngineCallbacks {
  onHover?: (id: string | null, sx: number, sy: number) => void
  onSelect?: (id: string | null) => void
  onOpen?: (id: string) => void
  onZoom?: (pct: number) => void
}

const FADE_START = 0.75   // camera scale where labels begin to appear
const FADE_FULL = 1.45    // …and reach full opacity
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

interface Cam { x: number; y: number; k: number; tk: number }

export class GraphEngine {
  private app = new PIXI.Application()
  private container: HTMLElement
  private colors: EngineColors
  private cb: EngineCallbacks

  private world = new PIXI.Container()
  private edgeG = new PIXI.Graphics()
  private nodeLayer = new PIXI.Container()
  private ringG = new PIXI.Graphics()          // hover / selection rings (world space)
  private labelLayer = new PIXI.Container()      // screen space
  private circleTex!: PIXI.Texture

  private nodes: EngineNode[] = []
  private edges: EngineEdge[] = []
  private sprites: PIXI.Sprite[] = []
  private labels: (PIXI.Text | null)[] = []
  private idIndex = new Map<string, number>()
  private pos: Float32Array = new Float32Array(0) // latest positions from the worker (x,y interleaved)

  private sim: SimClient | null = null
  private cam: Cam = { x: 0, y: 0, k: 1, tk: 1 }
  private focus: Set<string> | null = null       // transient hover/select neighbourhood
  private groupSet: Set<string> | null = null    // persistent group-pill spotlight — dims, never removes nodes
  private hoverId: string | null = null
  private selectedId: string | null = null
  private labelMode: LabelMode = 'auto'
  private fade = { start: FADE_START, full: FADE_FULL }

  private dirty = true
  private idle = false
  private destroyed = false
  private simRunning = false
  private fitted = false          // auto-frame the layout once it first settles
  private userMovedCam = false    // …unless the user has already taken the camera
  private camAnim: { x0: number; y0: number; k0: number; x1: number; y1: number; k1: number; t0: number; dur: number } | null = null
  private lastTap = { id: '', t: 0 }
  private panVel = { x: 0, y: 0 }
  private drag: { index: number } | null = null
  private ready = false

  constructor(container: HTMLElement, colors: EngineColors, cb: EngineCallbacks = {}) {
    this.container = container
    this.colors = colors
    this.cb = cb
  }

  async init() {
    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: this.container,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      preference: 'webgl',
    })
    // React StrictMode (and fast unmounts) can destroy us mid-init: bail + clean up.
    if (this.destroyed) { try { this.app.destroy(true, { children: true, texture: true }) } catch { /* noop */ } return }
    this.container.appendChild(this.app.canvas)

    const g = new PIXI.Graphics().circle(0, 0, 64).fill(0xffffff)
    this.circleTex = this.app.renderer.generateTexture(g)
    g.destroy()

    this.world.addChild(this.edgeG, this.ringG, this.nodeLayer)
    this.app.stage.addChild(this.world, this.labelLayer)

    // background pan/zoom
    this.app.stage.eventMode = 'static'
    this.app.stage.hitArea = this.app.screen
    this.app.stage.on('pointerdown', this.onBgDown)
    this.app.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('pointermove', this.onWinMove)
    window.addEventListener('pointerup', this.onWinUp)

    const cx = this.app.screen.width / 2, cy = this.app.screen.height / 2
    this.cam = { x: cx, y: cy, k: 1, tk: 1 }

    this.app.ticker.add(this.frame)
    this.ready = true
  }

  // ---- data ----
  setData(nodes: EngineNode[], edges: EngineEdge[], targets: Float32Array, params?: Partial<SimParams>) {
    if (!this.ready) return
    this.fitted = false          // re-frame once this new layout settles
    this.fitTargetSmoothed = null
    // preserve prior positions of surviving nodes for a stable feel
    const prev = new Map<string, [number, number]>()
    this.nodes.forEach((n, i) => { if (this.pos.length) prev.set(n.id, [this.pos[i * 2], this.pos[i * 2 + 1]]) })

    this.clearSprites()
    this.nodes = nodes
    this.edges = edges
    this.idIndex = new Map(nodes.map((n, i) => [n.id, i]))
    this.pos = new Float32Array(nodes.length * 2)
    this.sprites = new Array(nodes.length)
    this.labels = new Array(nodes.length).fill(null)

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const sp = new PIXI.Sprite(this.circleTex)
      sp.anchor.set(0.5)
      sp.width = sp.height = n.r * 2
      sp.tint = n.color
      sp.eventMode = 'static'
      sp.cursor = 'pointer'
      sp.on('pointerover', () => this.onNodeOver(i))
      sp.on('pointerout', () => this.onNodeOut(i))
      sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this.onNodeDown(i, e))
      sp.on('pointertap', () => this.onNodeTap(i))
      this.nodeLayer.addChild(sp)
      this.sprites[i] = sp
      // Seed at prior position if the node survived; otherwise scatter it on a
      // golden-angle spiral AROUND its cluster centroid so the group doesn't
      // start as one overlapping dot and violently explode apart on first tick.
      const prior = prev.get(n.id)
      if (prior) { this.pos[i * 2] = prior[0]; this.pos[i * 2 + 1] = prior[1] }
      else {
        const a = i * 2.399963            // golden angle
        const rr = 30 + Math.sqrt(i) * 12
        this.pos[i * 2] = targets[i * 2] + Math.cos(a) * rr
        this.pos[i * 2 + 1] = targets[i * 2 + 1] + Math.sin(a) * rr
      }
    }

    const p: SimParams = { ...DEFAULT_PARAMS, ...params }
    const links = edges.filter(e => !e.suggested).map(e => ({ source: nodes[e.a].id, target: nodes[e.b].id }))
    const seed = new Float32Array(this.pos)          // seed worker with current/served positions
    this.sim?.destroy()
    this.sim = new SimClient(this.onSimTick, this.onSimEnd)
    this.simRunning = true
    // targets buffer is consumed (transferred) by the worker
    this.sim.init(nodes.map((n, i) => ({ id: n.id, r: n.r, x: seed[i * 2], y: seed[i * 2 + 1] })), links, p, targets)
    this.fit()          // frame the seed immediately; autoFrame keeps it framed as it blooms
    this.wake()
  }

  private clearSprites() {
    for (const s of this.sprites) s?.destroy()
    for (const l of this.labels) l?.destroy()
    this.sprites = []; this.labels = []
    this.nodeLayer.removeChildren()
    this.labelLayer.removeChildren()
  }

  // ---- worker callbacks ----
  private onSimTick = (positions: Float32Array, alpha: number) => {
    if (positions.length === this.pos.length) this.pos = positions
    this.simRunning = alpha > 0.02
    this.dirty = true
    this.wake()
  }
  private onSimEnd = () => {
    this.simRunning = false
    if (!this.fitted && !this.userMovedCam) { this.fitted = true; this.fit(80, true) }
  }

  // ---- public controls ----
  setFocus(set: Set<string> | null) { this.focus = set; this.dirty = true; this.wake() }
  /** Group-pill spotlight: dim everything outside `ids` WITHOUT removing nodes
   *  from the graph or the simulation — no sim rebuild, no re-scatter, so
   *  clicking pills back-to-back never restarts the entrance animation. */
  setGroupHighlight(ids: Set<string> | null) { this.groupSet = ids; this.dirty = true; this.wake() }
  setSelected(id: string | null) { this.selectedId = id; this.dirty = true; this.wake() }
  setLabelMode(m: LabelMode) { this.labelMode = m; this.dirty = true; this.wake() }
  setLabelThreshold(start: number, full: number) { this.fade = { start, full }; this.dirty = true; this.wake() }
  setParams(p: Partial<SimParams>) { this.sim?.setParams(p); this.wake() }
  setColors(c: EngineColors) { this.colors = c; this.dirty = true; this.wake() }

  regroup(targets: Float32Array, cluster: number) {
    this.sim?.setTargets(targets, cluster)
    this.wake()
  }

  recolor(colorFor: (id: string) => number) {
    if (!this.ready) return
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].color = colorFor(this.nodes[i].id)
      if (this.sprites[i]) this.sprites[i].tint = this.nodes[i].color
    }
    this.dirty = true; this.wake()
  }

  zoomBy(factor: number) {
    if (!this.ready) return
    const cx = this.app.screen.width / 2, cy = this.app.screen.height / 2
    this.zoomAt(cx, cy, factor)
  }
  get zoomPct() { return Math.round(this.cam.k * 100) }

  /** The camera {k,x,y} that frames the whole graph with breathing room. */
  private computeFitTarget(padding = 120): { k: number; x: number; y: number } | null {
    if (!this.nodes.length) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < this.nodes.length; i++) {
      const x = this.pos[i * 2], y = this.pos[i * 2 + 1], r = this.nodes[i].r
      minX = Math.min(minX, x - r); minY = Math.min(minY, y - r)
      maxX = Math.max(maxX, x + r); maxY = Math.max(maxY, y + r)
    }
    const w = this.app.screen.width, h = this.app.screen.height
    // cap max zoom at 1.1 so a small graph is never blown up into a tight close-up
    const k = Math.max(0.2, Math.min(1.1, Math.min((w - padding) / (maxX - minX || 1), (h - padding) / (maxY - minY || 1))))
    return { k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k }
  }

  fit(padding = 120, animate = false) {
    if (!this.ready) return
    const t = this.computeFitTarget(padding)
    if (!t) return
    if (animate) {
      this.camAnim = { x0: this.cam.x, y0: this.cam.y, k0: this.cam.k, x1: t.x, y1: t.y, k1: t.k, t0: performance.now(), dur: 1100 }
    } else {
      this.cam.k = this.cam.tk = t.k; this.cam.x = t.x; this.cam.y = t.y
      this.cb.onZoom?.(this.zoomPct)
    }
    this.dirty = true; this.wake()
  }

  /** Gently lerp the camera toward the fit target each frame — used while the sim
   *  blooms so the whole graph stays framed (never a too-tight close-up) and the
   *  reveal reads as a slow, elegant pull-back.
   *
   *  Double-smoothed: the raw fit target is noisy frame-to-frame (node bounds
   *  jump around while collision/repulsion resolve), and lerping the camera
   *  straight at that noisy target is what made the reveal look staggered/jerky.
   *  So the target itself is low-pass filtered first (`fitTargetSmoothed`),
   *  THEN the camera eases toward the smoothed target — a critically-damped
   *  two-stage filter, the standard fix for a jittery "chase" camera. */
  private fitTargetSmoothed: { k: number; x: number; y: number } | null = null
  private autoFrame() {
    if (this.userMovedCam || this.camAnim) return
    const t = this.computeFitTarget()
    if (!t) return
    if (!this.fitTargetSmoothed) this.fitTargetSmoothed = { ...t }
    else {
      const ts = 0.035
      this.fitTargetSmoothed.k += (t.k - this.fitTargetSmoothed.k) * ts
      this.fitTargetSmoothed.x += (t.x - this.fitTargetSmoothed.x) * ts
      this.fitTargetSmoothed.y += (t.y - this.fitTargetSmoothed.y) * ts
    }
    const s = 0.07
    const st = this.fitTargetSmoothed
    this.cam.k = this.cam.tk = this.cam.k + (st.k - this.cam.k) * s
    this.cam.x += (st.x - this.cam.x) * s
    this.cam.y += (st.y - this.cam.y) * s
    this.cb.onZoom?.(this.zoomPct)
    this.dirty = true
  }

  // ---- interaction: nodes ----
  private onNodeOver(i: number) {
    this.hoverId = this.nodes[i].id
    const s = this.worldToScreen(this.pos[i * 2], this.pos[i * 2 + 1])
    this.cb.onHover?.(this.hoverId, s.x, s.y)
    this.dirty = true; this.wake()
  }
  private onNodeOut(i: number) {
    if (this.hoverId === this.nodes[i].id) { this.hoverId = null; this.cb.onHover?.(null, 0, 0) }
    this.dirty = true; this.wake()
  }
  private onNodeDown(i: number, e: PIXI.FederatedPointerEvent) {
    e.stopPropagation()
    this.drag = { index: i }
    const w = this.screenToWorld(e.global.x, e.global.y)
    this.sim?.drag(i, w.x, w.y, true)
  }
  private onNodeTap(i: number) {
    const id = this.nodes[i].id
    const now = performance.now()
    if (this.lastTap.id === id && now - this.lastTap.t < 320) { this.cb.onOpen?.(id); this.lastTap = { id: '', t: 0 }; return }
    this.lastTap = { id, t: now }
    this.selectedId = id
    this.cb.onSelect?.(id)
    this.dirty = true; this.wake()
  }

  // ---- interaction: background pan / zoom ----
  private panning: { sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null
  private onBgDown = (e: PIXI.FederatedPointerEvent) => {
    if (e.target !== this.app.stage) return
    this.panning = { sx: e.global.x, sy: e.global.y, ox: this.cam.x, oy: this.cam.y, moved: false }
    this.panVel = { x: 0, y: 0 }
    this.camAnim = null            // user takes over → cancel any auto-fit tween
  }
  private onWinMove = (ev: PointerEvent) => {
    if (this.drag && this.sim) {
      const w = this.screenToWorld(ev.clientX - this.rect().left, ev.clientY - this.rect().top)
      this.sim.drag(this.drag.index, w.x, w.y, true)
      return
    }
    if (this.panning) {
      const dx = ev.clientX - this.rect().left - this.panning.sx
      const dy = ev.clientY - this.rect().top - this.panning.sy
      if (Math.abs(dx) + Math.abs(dy) > 2) this.panning.moved = true
      const nx = this.panning.ox + dx, ny = this.panning.oy + dy
      this.panVel = { x: nx - this.cam.x, y: ny - this.cam.y }
      this.cam.x = nx; this.cam.y = ny
      this.userMovedCam = true
      this.dirty = true; this.wake()
    }
  }
  private onWinUp = () => {
    if (this.drag && this.sim) { this.sim.drag(this.drag.index, 0, 0, false); this.drag = null }
    if (this.panning) {
      const wasClick = !this.panning.moved
      this.panning = null
      if (wasClick) { this.selectedId = null; this.cb.onSelect?.(null); this.dirty = true }
      this.wake()
    }
  }
  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const factor = Math.exp(-e.deltaY * 0.0016)
    this.zoomAt(e.offsetX, e.offsetY, factor)
  }
  private zoomAt(sx: number, sy: number, factor: number) {
    this.userMovedCam = true
    this.camAnim = null            // user takes over → cancel any auto-fit tween
    const w = this.screenToWorld(sx, sy)
    this.cam.tk = Math.max(0.15, Math.min(4, this.cam.tk * factor))
    this.cam.k = this.cam.tk                      // apply immediately; ticker keeps it in sync
    this.cam.x = sx - w.x * this.cam.k
    this.cam.y = sy - w.y * this.cam.k
    this.dirty = true; this.wake()
    this.cb.onZoom?.(this.zoomPct)
  }

  // ---- coords ----
  private rectCache: DOMRect | null = null
  private rect() { return (this.rectCache ??= this.app.canvas.getBoundingClientRect()) }
  private worldToScreen(wx: number, wy: number) { return { x: wx * this.cam.k + this.cam.x, y: wy * this.cam.k + this.cam.y } }
  private screenToWorld(sx: number, sy: number) { return { x: (sx - this.cam.x) / this.cam.k, y: (sy - this.cam.y) / this.cam.k } }

  // ---- render loop ----
  private frame = () => {
    // eased camera tween (auto-fit framing)
    if (this.camAnim) {
      const a = this.camAnim
      const t = Math.min(1, (performance.now() - a.t0) / a.dur)
      const e = 1 - Math.pow(1 - t, 3)     // easeOutCubic
      this.cam.k = this.cam.tk = a.k0 + (a.k1 - a.k0) * e
      this.cam.x = a.x0 + (a.x1 - a.x0) * e
      this.cam.y = a.y0 + (a.y1 - a.y0) * e
      this.cb.onZoom?.(this.zoomPct)
      if (t >= 1) this.camAnim = null
      this.dirty = true
    }
    // keep the whole graph framed while it blooms (elegant slow pull-back)
    if (this.simRunning) this.autoFrame()
    // camera momentum when idle-panning released
    if (!this.panning && !this.drag && (Math.abs(this.panVel.x) > 0.05 || Math.abs(this.panVel.y) > 0.05)) {
      this.cam.x += this.panVel.x; this.cam.y += this.panVel.y
      this.panVel.x *= 0.88; this.panVel.y *= 0.88
      this.dirty = true
    }

    if (!this.dirty && !this.simRunning) {
      // fully settled → stop the ticker to release the CPU
      this.app.ticker.stop(); this.idle = true
      return
    }
    this.rectCache = null
    this.draw()
    this.dirty = false
  }

  private wake() {
    if (!this.ready) return
    if (this.idle || !this.app.ticker.started) { this.idle = false; this.app.ticker.start() }
  }

  private draw() {
    const k = this.cam.k
    this.world.position.set(this.cam.x, this.cam.y)
    this.world.scale.set(k)

    // nodes — group spotlight dims first (it's the primary lens when active),
    // hover/select focus dims on top of whatever the group left visible
    for (let i = 0; i < this.sprites.length; i++) {
      const sp = this.sprites[i]; if (!sp) continue
      sp.position.set(this.pos[i * 2], this.pos[i * 2 + 1])
      const id = this.nodes[i].id
      const inGroup = !this.groupSet || this.groupSet.has(id)
      const inFocus = !this.focus || this.focus.has(id)
      sp.alpha = !inGroup ? 0.14 : !inFocus ? 0.16 : 1
    }

    this.drawEdges()
    this.drawRings()
    this.drawLabels(k)
  }

  private drawEdges() {
    const g = this.edgeG; g.clear()
    const f = this.focus
    const gs = this.groupSet
    const inGroup = (id: string) => !gs || gs.has(id)
    // real links — split into dim / normal / focus passes to keep stroke calls low.
    // group spotlight is checked first: an edge leaving the highlighted group is
    // always dim, regardless of hover/select focus.
    const normal: number[] = [], dim: number[] = [], hot: number[] = []
    for (const e of this.edges) {
      if (e.suggested) continue
      const aId = this.nodes[e.a].id, bId = this.nodes[e.b].id
      if (!(inGroup(aId) && inGroup(bId))) { dim.push(e.a, e.b); continue }
      const inF = f ? (f.has(aId) && f.has(bId)) : false
      ;(f ? (inF ? hot : dim) : normal).push(e.a, e.b)
    }
    const stroke = (idx: number[], color: number, alpha: number, width: number) => {
      if (!idx.length) return
      for (let j = 0; j < idx.length; j += 2) {
        const a = idx[j], b = idx[j + 1]
        g.moveTo(this.pos[a * 2], this.pos[a * 2 + 1]).lineTo(this.pos[b * 2], this.pos[b * 2 + 1])
      }
      g.stroke({ color, alpha, width: width / this.cam.k })
    }
    stroke(normal, this.colors.edge, 0.5, 1.1)
    stroke(dim, this.colors.edge, 0.05, 1)
    stroke(hot, this.colors.accent, 0.85, 1.3)

    // suggested links (dotted look via thin low-alpha accent)
    const sug: number[] = []
    for (const e of this.edges) if (e.suggested) {
      const aId = this.nodes[e.a].id, bId = this.nodes[e.b].id
      if (!(inGroup(aId) && inGroup(bId))) continue
      if (f && !(f.has(aId) && f.has(bId))) continue
      sug.push(e.a, e.b)
    }
    stroke(sug, this.colors.accent, f ? 0.6 : 0.22, 1)
  }

  private drawRings() {
    const g = this.ringG; g.clear()
    const ring = (id: string | null, color: number, pad: number, width: number, alpha: number) => {
      if (!id) return
      const i = this.idIndex.get(id); if (i == null) return
      g.circle(this.pos[i * 2], this.pos[i * 2 + 1], this.nodes[i].r + pad)
      g.stroke({ color, width: width / this.cam.k, alpha })
    }
    ring(this.selectedId, this.colors.accent, 3.5, 2, 1)
    if (this.hoverId && this.hoverId !== this.selectedId) ring(this.hoverId, this.colors.accent, 3, 1.6, 0.7)
  }

  private drawLabels(k: number) {
    const globalA = this.labelMode === 'off' ? 0
      : this.labelMode === 'always' ? 1
      : smoothstep(this.fade.start, this.fade.full, k)
    if (globalA === 0 && !this.focus && !this.selectedId && !this.hoverId) {
      this.labelLayer.visible = false
      return
    }
    this.labelLayer.visible = true
    const W = this.app.screen.width, H = this.app.screen.height
    for (let i = 0; i < this.nodes.length; i++) {
      const id = this.nodes[i].id
      const focused = id === this.hoverId || id === this.selectedId || (this.focus?.has(id) ?? false)
      const groupDim = this.groupSet && !this.groupSet.has(id)
      const focusDim = this.focus && !this.focus.has(id)
      const a = focused ? 1 : groupDim ? Math.min(globalA, 0.05) : focusDim ? Math.min(globalA, 0.08) : globalA
      let lab = this.labels[i]
      if (a <= 0.01) { if (lab) lab.visible = false; continue }
      const s = this.worldToScreen(this.pos[i * 2], this.pos[i * 2 + 1])
      if (s.x < -60 || s.x > W + 60 || s.y < -20 || s.y > H + 30) { if (lab) lab.visible = false; continue }
      if (!lab) { lab = this.makeLabel(this.nodes[i].title); this.labels[i] = lab; this.labelLayer.addChild(lab) }
      lab.visible = true
      lab.alpha = a
      lab.position.set(s.x, s.y + this.nodes[i].r * k + 9)
    }
  }

  private makeLabel(title: string): PIXI.Text {
    const text = title.length > 26 ? title.slice(0, 25) + '…' : title
    const t = new PIXI.Text({
      text,
      style: {
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: 11,
        fill: this.colors.label,
        stroke: { color: this.colors.labelHalo, width: 3 },
        align: 'center',
      },
      resolution: Math.min(2, window.devicePixelRatio || 1) * 1.5,
    })
    t.anchor.set(0.5, 0)
    return t
  }

  destroy() {
    this.destroyed = true
    this.sim?.destroy()
    if (!this.ready) return   // init() will self-clean via the destroyed flag
    this.app.canvas.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('pointermove', this.onWinMove)
    window.removeEventListener('pointerup', this.onWinUp)
    this.app.destroy(true, { children: true, texture: true })
  }
}
