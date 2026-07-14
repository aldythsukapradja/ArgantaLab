// WS3 — brain anatomy. The Cognitive Cortex mirrors the reactor's 7-layer spine
// (Command Core → Think → Know → Orchestrate → Act → Experience → Sense) laid
// onto a real, wrinkled, two-hemisphere brain seen from above. Regions run
// front→back (prefrontal THINK → memory KNOW → motor DO → occipital), Command
// Core is the fixed deep-central hub (thalamic relay to everything), and the
// left/right split keeps the analytic/creative read. Cross-validated with the
// reactor layers (model/layers.ts) and the 46-scene cinematic (Act IV triad,
// Act V spine trace). Deterministic geometry so the cortex is stable.

import type { OntologyType } from './ontology'

export type RegionId = 'command' | 'think' | 'know' | 'orchestrate' | 'act' | 'experience' | 'sense'
export type Triad = 'think' | 'know' | 'do'
export type Hemisphere = 'left' | 'right' | 'mid'

export interface Region {
  id: RegionId
  label: string
  verb: string           // reactor micro-verb
  triad: Triad
  color: string
  /** anterior→posterior band on the cortical sheet (u: 0 = occipital back, 1 = frontal pole) */
  u0: number
  u1: number
  anchor: [number, number, number]  // representative centroid (for camera + hub wiring)
}

// The 7 spine regions — reactor colours (Experience nudged to emerald so all 7
// read distinctly). Order = the reactor spine order = the Act V trace order.
// Contiguous anterior→posterior bands, widths roughly proportional to how many
// notes land in each region (Know dominates the vault, so it owns the mid band).
export const REGIONS: Region[] = [
  { id: 'command', label: 'Command Core', verb: 'govern', triad: 'think', color: '#70e7ff', u0: 0.44, u1: 0.56, anchor: [0, -0.5, 0.4] },
  { id: 'think', label: 'Think', verb: 'decide', triad: 'think', color: '#4bd4ff', u0: 0.80, u1: 1.0, anchor: [0, 1.3, 6.0] },
  { id: 'know', label: 'Know', verb: 'remember', triad: 'know', color: '#9a72ff', u0: 0.14, u1: 0.54, anchor: [0, 1.4, -1.4] },
  { id: 'orchestrate', label: 'Orchestrate', verb: 'coordinate', triad: 'do', color: '#22d3c8', u0: 0.70, u1: 0.80, anchor: [0, 1.7, 4.4] },
  { id: 'act', label: 'Act', verb: 'execute', triad: 'do', color: '#ffb347', u0: 0.54, u1: 0.70, anchor: [0, 1.7, 2.4] },
  { id: 'experience', label: 'Experience', verb: 'serve', triad: 'do', color: '#4ade80', u0: 0.0, u1: 0.14, anchor: [0, 1.0, -5.6] },
  { id: 'sense', label: 'Sense', verb: 'learn', triad: 'know', color: '#4be5bd', u0: 0.0, u1: 1.0, anchor: [0, 0.4, 0] },
]

export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]))

export const TRIAD_LABEL: Record<Triad, string> = { think: 'THINK', know: 'KNOW', do: 'DO' }
export const TRIAD_COLOR: Record<Triad, string> = { think: '#8b7cf6', know: '#38bdf8', do: '#f5a24b' }
export const TRIAD_HINT: Record<Triad, string> = {
  think: 'Command · reasoning · decision',
  know: 'Vault · evidence · telemetry',
  do: 'Orchestrate · act · experience',
}
export const HEMISPHERE_LABEL: Record<Hemisphere, string> = { left: 'Analytic', right: 'Creative', mid: 'Executive' }

// ── ontology → region (which of the 7 spine regions a note belongs to) ──────
const REGION_OF: Record<OntologyType, RegionId> = {
  Founder: 'command', 'North Star': 'command', Office: 'command',
  Agent: 'think', Decision: 'think', Strategy: 'think',
  Document: 'know', 'Data Source': 'know', Database: 'know', Table: 'know', Repository: 'know',
  Architecture: 'orchestrate', API: 'orchestrate',
  Skill: 'act', Tool: 'act', Workflow: 'act', Task: 'act', Deployment: 'act',
  Product: 'experience', Surface: 'experience', Artifact: 'experience',
  Metric: 'sense', Signal: 'sense', Approval: 'sense',
}
// ── ontology → hemisphere (analytic / creative / midline) ───────────────────
const HEMISPHERE_OF: Record<OntologyType, Hemisphere> = {
  Database: 'left', Table: 'left', 'Data Source': 'left', API: 'left', Metric: 'left',
  Signal: 'left', Repository: 'left', Architecture: 'left', Tool: 'left', Deployment: 'left', Decision: 'left',
  Product: 'right', Surface: 'right', Document: 'right', Strategy: 'right', Artifact: 'right', Skill: 'right', Workflow: 'right',
  Founder: 'mid', 'North Star': 'mid', Office: 'mid', Agent: 'mid', Task: 'mid', Approval: 'mid',
}
export const regionOf = (t: OntologyType): RegionId => REGION_OF[t] ?? 'know'
export const hemisphereOf = (t: OntologyType): Hemisphere => HEMISPHERE_OF[t] ?? 'mid'
export const triadOf = (r: RegionId): Triad => (REGION_BY_ID.get(r)?.triad ?? 'know')

// ── cortical geometry ───────────────────────────────────────────────────────
// Camera looks down -Y with a slight tilt, so X = left/right, Z = front/back
// (+Z frontal), Y = dorsal height. Two wrinkled hemisphere lobes split by a
// longitudinal fissure at x≈0. The TISSUE is the brain body (dense, folded); the
// note-neurons are brighter points sitting on it, spread evenly across their
// region's zone — NOT biased to the lateral edge (that edge bias + a zero-
// thickness shell were what produced the "colored lines" and the bright rim).
export const BRAIN = {
  hemiGap: 1.25,   // half-width of the longitudinal fissure (clear central valley)
  width: 5.8,      // lateral half-extent of a hemisphere
  length: 7.8,     // half front-back extent (brain is only ~1.3× longer than wide)
  height: 3.6,     // dorsal dome height
  gyral: 0.95,     // fold amplitude (strong → visibly wrinkled)
}

function h(str: string): number {
  let x = 2166136261
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619) }
  return (x >>> 0) / 4294967295
}
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** Egg taper at anterior-posterior u (0=occipital, 1=frontal pole): 0 at the
 *  poles, ~1 at the widest point. Gives the lobe its rounded brain silhouette. */
function taperAt(u: number): number {
  return Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.86 + 0.09))), 0.72)
}

/** Multi-octave gyral fold displacement — the sulci/gyri that make it read as
 *  brain tissue rather than a smooth balloon. */
function gyral(u: number, v: number, side: number): number {
  return (Math.sin(u * 16 + v * 8 + side * 2) * 0.5
    + Math.sin(v * 23 - u * 6) * 0.3
    + Math.sin(u * 37 + v * 30) * 0.2) * BRAIN.gyral
}

/** A point on the wrinkled dorsal cortical surface of one hemisphere.
 *  u = 0 occipital (back) → 1 frontal (front). v = 0 medial (fissure) → 1
 *  lateral (outer). Rounded dome (bulges at the crown), strong gyri. */
export function corticalSurface(side: -1 | 1, u: number, v: number): [number, number, number] {
  const wf = taperAt(u)
  const z = (u - 0.45) * 2 * BRAIN.length
  const lat = v * BRAIN.width * (0.42 + 0.58 * wf)
  const x = side * (BRAIN.hemiGap * 0.55 + lat)
  const dome = Math.cos(Math.min(1.45, v * 1.35)) * Math.cos((u - 0.45) * 1.5)
  const g = gyral(u, v, side)
  const y = BRAIN.height * (0.22 + 0.64 * Math.max(0, dome) * wf) + g
  return [x + g * 0.3 * side, y, z + g * 0.26]
}

/** Deterministic cortical position for a note in a region + hemisphere. Spread
 *  EVENLY across the region's zone (both hemispheres, medial→lateral, its
 *  anterior-posterior band with soft overlap), sitting just above the wrinkled
 *  surface with light organic jitter. No lateral-edge bias → no lines. */
export function regionPoint(id: string, region: RegionId, hemi: Hemisphere): [number, number, number] {
  const r = REGION_BY_ID.get(region)!
  const a = h(id), b = h(id + '~1'), c = h(id + '~2'), d = h(id + '~3'), e = h(id + '~4')
  if (region === 'command') {
    // deep-central hub: a loose cluster around the thalamic anchor, below the cortex
    return [(a - 0.5) * 2.0, -0.5 + (b - 0.5) * 1.5, 0.4 + (c - 0.5) * 2.2]
  }
  const side: -1 | 1 = hemi === 'right' ? 1 : hemi === 'left' ? -1 : (a < 0.5 ? -1 : 1)
  const bandLo = Math.max(0, r.u0 - 0.06), bandHi = Math.min(1, r.u1 + 0.06)
  const u = bandLo + (bandHi - bandLo) * b
  // even medial→lateral spread (sense wraps the outer surface); capped short of
  // the very edge so nothing piles on the silhouette
  const v = region === 'sense' ? 0.66 + c * 0.26 : 0.06 + c * 0.84
  const p = corticalSurface(side, u, v)
  return [p[0] + (d - 0.5) * 0.85, p[1] + 0.22 + (e - 0.5) * 0.6, p[2] + (a - 0.5) * 0.85]
}

/** Which region owns a given (u, v) cortical coord — for colouring the tissue. */
function regionForUV(u: number, v: number): RegionId {
  if (v > 0.82) return 'sense'
  for (const r of REGIONS) { if (r.id === 'sense' || r.id === 'command') continue; if (u >= r.u0 && u < r.u1) return r.id }
  return u >= 0.58 ? 'think' : 'experience'
}

/** Camera-target centroid for a region (used by the gentle lean). */
export function regionCentroid(region: RegionId): [number, number, number] {
  if (region === 'command') return [0, -0.2, 0.4]
  const r = REGION_BY_ID.get(region)!
  const um = (r.u0 + r.u1) / 2
  return [0, BRAIN.height * 0.35, (um - 0.45) * 2 * BRAIN.length]
}

/** Dense wrinkled cortical tissue — the brain BODY. Points cover both
 *  hemisphere surfaces with real thickness (a cortical ribbon, so the lateral
 *  edge is soft, not a bright silhouette line), a rim/pole fade, and a region
 *  index + a per-point dim factor the scene multiplies into brightness. */
export function corticalTissue(count: number): { positions: Float32Array; region: Uint8Array; fade: Float32Array } {
  const positions = new Float32Array(count * 3)
  const region = new Uint8Array(count)
  const fade = new Float32Array(count)
  const idx: Record<RegionId, number> = { command: 0, think: 1, know: 2, orchestrate: 3, act: 4, experience: 5, sense: 6 }
  for (let i = 0; i < count; i++) {
    const s = 't' + i
    const side: -1 | 1 = h(s) < 0.5 ? -1 : 1
    const u = h(s + '~1'), v = h(s + '~2'), depth = h(s + '~3')
    const p = corticalSurface(side, u, v)
    // thickness: sink some points below the surface into a cortical ribbon
    positions[i * 3] = p[0] - depth * 0.18 * side
    positions[i * 3 + 1] = p[1] - depth * 0.9
    positions[i * 3 + 2] = p[2]
    region[i] = idx[regionForUV(u, v)]
    // fade toward the lateral edge + the poles so the silhouette softens
    const rim = 1 - smoothstep(0.74, 1.0, v)
    const pole = 0.4 + 0.6 * taperAt(u)
    fade[i] = rim * pole * (0.6 + 0.4 * (1 - depth))
  }
  return { positions, region, fade }
}

export const REGION_INDEX: RegionId[] = ['command', 'think', 'know', 'orchestrate', 'act', 'experience', 'sense']
