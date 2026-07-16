// Knowledge Canvas — the FORM ENGINE. The brain is no longer "the scene"; it is
// one layout preset among several. A form is a pure, deterministic function
// (nodes + params) → a Float32Array of target positions. The scene keeps a live
// FIELD buffer and lerps every node from where it is toward the active form's
// target, so switching forms MORPHS the whole graph in 3D — that transition is
// the wow moment. All forms are seeded off the same per-node hash so they are
// stable across reloads.

import type { KModel } from './model'
import { REGIONS, type RegionId } from './brain'
import type { FormId } from './design'

export interface FormParams {
  spread: number
  squash: number
  separation: number
}

const ORDER: RegionId[] = ['command', 'think', 'know', 'orchestrate', 'act', 'experience', 'sense']
const REGION_IX: Record<RegionId, number> = ORDER.reduce((m, r, i) => { m[r] = i; return m }, {} as Record<RegionId, number>)
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

function h(str: string): number {
  let x = 2166136261
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619) }
  return (x >>> 0) / 4294967295
}

// Per-node ordinal within its region (stable order) — several forms need "the
// k-th node of this region" to place nodes around a ring / along an arm.
function regionOrdinals(model: KModel): { ord: Int32Array; total: Record<RegionId, number> } {
  const total: Record<RegionId, number> = { command: 0, think: 0, know: 0, orchestrate: 0, act: 0, experience: 0, sense: 0 }
  const ord = new Int32Array(model.nodes.length)
  model.nodes.forEach((n, i) => { ord[i] = total[n.region]; total[n.region]++ })
  return { ord, total }
}

// ── SPHERE — a clean fibonacci sphere, coloured by region. Architectural. ──
function sphere(model: KModel, out: Float32Array, p: FormParams) {
  const N = model.nodes.length
  const R = 9 * p.spread
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / Math.max(1, N - 1)) * 2
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const th = GOLDEN * i
    out[i * 3] = Math.cos(th) * rad * R
    out[i * 3 + 1] = y * R * p.squash
    out[i * 3 + 2] = Math.sin(th) * rad * R
  }
}

// ── ATOM — Command Core is the nucleus; each region is an orbital shell whose
// radius grows with region index; nodes ride a tilted ring on that shell. ──
function atom(model: KModel, out: Float32Array, p: FormParams) {
  const { ord, total } = regionOrdinals(model)
  model.nodes.forEach((n, i) => {
    const ri = REGION_IX[n.region]
    if (n.region === 'command') {
      const a = h(n.id), b = h(n.id + '~1'), c = h(n.id + '~2')
      out[i * 3] = (a - 0.5) * 2.2 * p.spread
      out[i * 3 + 1] = (b - 0.5) * 2.2 * p.spread * p.squash
      out[i * 3 + 2] = (c - 0.5) * 2.2 * p.spread
      return
    }
    const shell = (2.6 + ri * 2.4 * p.separation) * p.spread
    const count = Math.max(1, total[n.region])
    const ang = (ord[i] / count) * Math.PI * 2 + ri * 0.7
    // each region's ring is tilted on a different axis so shells don't overlap
    const tilt = (ri / ORDER.length) * Math.PI
    const x = Math.cos(ang) * shell
    const z = Math.sin(ang) * shell
    const jitter = (h(n.id + '~j') - 0.5) * 0.9
    out[i * 3] = x * Math.cos(tilt) + jitter
    out[i * 3 + 1] = (Math.sin(ang) * shell * Math.sin(tilt) * 0.5 + jitter) * p.squash
    out[i * 3 + 2] = z * Math.cos(tilt * 0.6) + jitter
  })
}

// ── GALAXY — a spiral disc, one arm per region, Command at the bright core. ──
function galaxy(model: KModel, out: Float32Array, p: FormParams) {
  const { ord, total } = regionOrdinals(model)
  const arms = ORDER.length
  model.nodes.forEach((n, i) => {
    const ri = REGION_IX[n.region]
    if (n.region === 'command') {
      const a = h(n.id), b = h(n.id + '~1'), c = h(n.id + '~2')
      out[i * 3] = (a - 0.5) * 2.4 * p.spread
      out[i * 3 + 1] = (b - 0.5) * 1.2 * p.spread * p.squash
      out[i * 3 + 2] = (c - 0.5) * 2.4 * p.spread
      return
    }
    const count = Math.max(1, total[n.region])
    const t = ord[i] / count                       // 0 core → 1 rim
    const radius = (1.5 + t * 12 * p.separation) * p.spread
    const armAngle = (ri / arms) * Math.PI * 2
    const twist = t * 2.4                           // spiral tightness
    const jig = (h(n.id + '~g') - 0.5) * 0.6
    const ang = armAngle + twist + jig
    out[i * 3] = Math.cos(ang) * radius
    out[i * 3 + 1] = (h(n.id + '~y') - 0.5) * 1.6 * p.spread * p.squash   // thin disc
    out[i * 3 + 2] = Math.sin(ang) * radius
  })
}

// ── CONSTELLATION — a true 3D force-directed knowledge graph (Obsidian in
// space). Region centroids seed the initial positions so clusters separate,
// then a deterministic synchronous relaxation (repulsion + edge springs + a
// gentle per-region cohesion + centering) resolves the real link structure.
// ~319 nodes is cheap to relax on the main thread at form-switch, and seeding
// keeps it stable/reproducible — no worker, settles instantly. ──
function constellation(model: KModel, out: Float32Array, p: FormParams) {
  const N = model.nodes.length
  const cen: Record<RegionId, [number, number, number]> = {} as Record<RegionId, [number, number, number]>
  const CR = 10 * p.separation
  ORDER.forEach((r, k) => {
    if (r === 'command') { cen[r] = [0, 0, 0]; return }
    const y = 1 - (k / (ORDER.length - 1)) * 2
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const th = GOLDEN * k
    cen[r] = [Math.cos(th) * rad * CR, y * CR * 0.7, Math.sin(th) * rad * CR]
  })
  // seed near each node's region centroid with a deterministic jitter
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N)
  const region: RegionId[] = new Array(N)
  model.nodes.forEach((n, i) => {
    const c = cen[n.region]; region[i] = n.region
    px[i] = c[0] + (h(n.id) - 0.5) * 4
    py[i] = c[1] + (h(n.id + '~1') - 0.5) * 4
    pz[i] = c[2] + (h(n.id + '~2') - 0.5) * 4
  })
  // edge index list
  const ea: number[] = [], eb: number[] = []
  for (const e of model.edges) {
    const a = model.index.get(e.a), b = model.index.get(e.b)
    if (a != null && b != null) { ea.push(a); eb.push(b) }
  }
  // Degree per node so the many-edged Command hub doesn't drag its whole
  // neighbourhood into one crushed point (springs are divided by a node's
  // degree, and repulsion scales up with it — classic hub stabilisation).
  const deg = new Float32Array(N)
  for (let k = 0; k < ea.length; k++) { deg[ea[k]]++; deg[eb[k]]++ }
  const ITER = 120, REP = 26, SPRING = 0.05, IDEAL = 7, COH = 0.004, CENTER = 0.006, MAXSTEP = 3
  const dx = new Float32Array(N), dy = new Float32Array(N), dz = new Float32Array(N)
  for (let it = 0; it < ITER; it++) {
    dx.fill(0); dy.fill(0); dz.fill(0)
    const cool = (1 - it / ITER) * 0.85
    // repulsion (all pairs — fine for a few hundred nodes); hubs push harder
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let vx = px[i] - px[j], vy = py[i] - py[j], vz = pz[i] - pz[j]
        let d2 = vx * vx + vy * vy + vz * vz
        if (d2 < 0.25) { vx += h('r' + i + '_' + j) - 0.5; vy += h('s' + i + '_' + j) - 0.5; vz += h('t' + i + '_' + j) - 0.5; d2 = 0.25 }
        const f = REP * (1 + deg[i] * 0.05 + deg[j] * 0.05) / d2, inv = 1 / Math.sqrt(d2)
        vx *= inv * f; vy *= inv * f; vz *= inv * f
        dx[i] += vx; dy[i] += vy; dz[i] += vz; dx[j] -= vx; dy[j] -= vy; dz[j] -= vz
      }
    }
    // edge springs toward the ideal length — normalised by degree so a hub's
    // many springs don't sum into a collapse
    for (let k = 0; k < ea.length; k++) {
      const i = ea[k], j = eb[k]
      const vx = px[j] - px[i], vy = py[j] - py[i], vz = pz[j] - pz[i]
      const d = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1
      const f = (d - IDEAL) * SPRING
      const ux = vx / d * f, uy = vy / d * f, uz = vz / d * f
      const wi = 1 / (1 + deg[i] * 0.5), wj = 1 / (1 + deg[j] * 0.5)
      dx[i] += ux * wi; dy[i] += uy * wi; dz[i] += uz * wi
      dx[j] -= ux * wj; dy[j] -= uy * wj; dz[j] -= uz * wj
    }
    // per-region cohesion + weak centering, then a CLAMPED step so nothing
    // ever explodes (the wild ±700 flings) or crushes to a point
    for (let i = 0; i < N; i++) {
      const c = cen[region[i]]
      dx[i] += (c[0] - px[i]) * COH - px[i] * CENTER
      dy[i] += (c[1] - py[i]) * COH - py[i] * CENTER
      dz[i] += (c[2] - pz[i]) * COH - pz[i] * CENTER
      let sx = dx[i] * cool, sy = dy[i] * cool, sz = dz[i] * cool
      const sm = Math.sqrt(sx * sx + sy * sy + sz * sz)
      if (sm > MAXSTEP) { const s = MAXSTEP / sm; sx *= s; sy *= s; sz *= s }
      px[i] += sx; py[i] += sy; pz[i] += sz
    }
  }
  // recenter + normalise to a fixed radius so the graph ALWAYS fills the view
  // the same way, whatever the forces settled to (no off-screen / tiny blobs)
  let cx = 0, cy = 0, cz = 0
  for (let i = 0; i < N; i++) { cx += px[i]; cy += py[i]; cz += pz[i] }
  cx /= N; cy /= N; cz /= N
  let maxr = 0.001
  for (let i = 0; i < N; i++) { const r = Math.hypot(px[i] - cx, py[i] - cy, pz[i] - cz); if (r > maxr) maxr = r }
  const norm = (13 * p.spread) / maxr
  for (let i = 0; i < N; i++) {
    out[i * 3] = (px[i] - cx) * norm
    out[i * 3 + 1] = (py[i] - cy) * norm * p.squash
    out[i * 3 + 2] = (pz[i] - cz) * norm
  }
}

// ── BRAIN — the original cortex layout. Uses each node's baked pos (regionPoint
// in model.ts), just scaled by spread/squash so the space control still works. ──
function brain(model: KModel, out: Float32Array, p: FormParams) {
  model.nodes.forEach((n, i) => {
    out[i * 3] = n.pos[0] * p.spread
    out[i * 3 + 1] = n.pos[1] * p.spread * p.squash
    out[i * 3 + 2] = n.pos[2] * p.spread
  })
}

const IMPL: Record<FormId, (m: KModel, out: Float32Array, p: FormParams) => void> = {
  brain, sphere, atom, galaxy, constellation,
}

/** Compute target positions for a form into `out` (allocated N*3). */
export function computePositions(form: FormId, model: KModel, params: FormParams, out: Float32Array) {
  ;(IMPL[form] || brain)(model, out, params)
}

// A module-level live position field the scene mutates each frame — the same
// singleton pattern the scene already uses for ACTIVE. Consumers (neurons,
// axons, ring, labels, command core) read FIELD.cur[i*3..] by node index.
export interface Field {
  cur: Float32Array
  tgt: Float32Array
  N: number
  progress: number   // 0 = just switched form, 1 = fully settled
  form: FormId
}
export const FIELD: Field = { cur: new Float32Array(0), tgt: new Float32Array(0), N: 0, progress: 1, form: 'brain' }

export { REGIONS }
