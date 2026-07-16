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

// ── CONSTELLATION — a clustered knowledge graph in space: region centroids sit
// on a sphere, each note floats around its region's centroid, sized by degree.
// Deterministic (no worker) so it settles instantly; a true force sim is a
// later upgrade. ──
function constellation(model: KModel, out: Float32Array, p: FormParams) {
  // region centroids on a fibonacci sphere
  const cen: Record<RegionId, [number, number, number]> = {} as Record<RegionId, [number, number, number]>
  const CR = 10 * p.spread * p.separation
  ORDER.forEach((r, k) => {
    if (r === 'command') { cen[r] = [0, 0, 0]; return }
    const y = 1 - (k / (ORDER.length - 1)) * 2
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const th = GOLDEN * k
    cen[r] = [Math.cos(th) * rad * CR, y * CR * 0.7 * p.squash, Math.sin(th) * rad * CR]
  })
  model.nodes.forEach((n, i) => {
    const c = cen[n.region]
    // higher-degree nodes hug their centroid; leaves drift out
    const spreadR = (2.4 - Math.min(1.6, n.degree * 0.12)) * p.spread
    const a = h(n.id) * Math.PI * 2, b = Math.acos(2 * h(n.id + '~1') - 1), rr = spreadR * Math.cbrt(h(n.id + '~2'))
    out[i * 3] = c[0] + Math.sin(b) * Math.cos(a) * rr
    out[i * 3 + 1] = c[1] + Math.sin(b) * Math.sin(a) * rr * p.squash
    out[i * 3 + 2] = c[2] + Math.cos(b) * rr
  })
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
