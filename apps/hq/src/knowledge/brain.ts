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
export const REGIONS: Region[] = [
  { id: 'command', label: 'Command Core', verb: 'govern', triad: 'think', color: '#70e7ff', u0: 0.42, u1: 0.58, anchor: [0, -0.6, 0.4] },
  { id: 'think', label: 'Think', verb: 'decide', triad: 'think', color: '#45e8ff', u0: 0.74, u1: 1.0, anchor: [0, 1.4, 5.2] },
  { id: 'know', label: 'Know', verb: 'remember', triad: 'know', color: '#9a72ff', u0: 0.30, u1: 0.46, anchor: [0, 0.9, -1.4] },
  { id: 'orchestrate', label: 'Orchestrate', verb: 'coordinate', triad: 'do', color: '#35d8ed', u0: 0.58, u1: 0.66, anchor: [0, 1.6, 1.9] },
  { id: 'act', label: 'Act', verb: 'execute', triad: 'do', color: '#ffc46b', u0: 0.46, u1: 0.58, anchor: [0, 1.7, 0.4] },
  { id: 'experience', label: 'Experience', verb: 'serve', triad: 'do', color: '#4ade80', u0: 0.0, u1: 0.30, anchor: [0, 1.0, -5.2] },
  { id: 'sense', label: 'Sense', verb: 'learn', triad: 'know', color: '#4be5bd', u0: 0.0, u1: 1.0, anchor: [0, 0.2, 0] },
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
// (+Z frontal), Y = dorsal height. Each hemisphere is a domed, wrinkled,
// egg-shaped sheet; the two are split by a longitudinal fissure at x≈0.
export const BRAIN = {
  hemiGap: 1.0,    // half-width of the longitudinal fissure (clear central valley)
  width: 4.3,      // lateral half-extent of a hemisphere
  length: 7.4,     // half front-back extent
  height: 3.0,     // dorsal dome height
  gyral: 0.5,      // fold amplitude
}

function h(str: string): number {
  let x = 2166136261
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619) }
  return (x >>> 0) / 4294967295
}

/** A point on the wrinkled dorsal cortical sheet of one hemisphere.
 *  u: 0 = occipital (back) → 1 = frontal pole (front). v: 0 = medial (fissure)
 *  → 1 = lateral (outer edge). Returns a brain-surface position with gyri. */
export function corticalPoint(side: -1 | 1, u: number, v: number): [number, number, number] {
  // egg taper: widest ~u=0.55, frontal pole rounded, occipital narrower
  const wf = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.86 + 0.09))), 0.72)
  const z = (u - 0.44) * 2 * BRAIN.length
  const x = side * (BRAIN.hemiGap + v * BRAIN.width * (0.35 + 0.65 * wf))
  // dorsal dome — highest along the medial ridge, falling to lateral + poles
  let y = BRAIN.height * (0.34 * Math.cos(v * 1.5) + 0.5 * wf) - 0.2
  // gyral folds (sulci/gyri) displaced mostly on the surface normal (≈ up)
  const fold = (Math.sin(u * 23 + v * 14) * 0.5 + Math.sin(v * 31 - u * 11) * 0.5) * BRAIN.gyral
  y += fold
  return [x + fold * 0.28 * side, y, z + fold * 0.24]
}

/** Deterministic cortical position for a note in a region + hemisphere. */
export function regionPoint(id: string, region: RegionId, hemi: Hemisphere): [number, number, number] {
  const r = REGION_BY_ID.get(region)!
  const a = h(id), b = h(id + '~1'), c = h(id + '~2')
  if (region === 'command') {
    // deep-central hub: a tight cluster around the thalamic anchor, below the cortex
    return [(a - 0.5) * 1.4, -0.4 + (b - 0.5) * 1.2, 0.4 + (c - 0.5) * 1.6]
  }
  const side: -1 | 1 = hemi === 'right' ? 1 : hemi === 'left' ? -1 : (a < 0.5 ? -1 : 1)
  const u = r.u0 + (r.u1 - r.u0) * b
  // sense hugs the lateral rim; others spread medially→laterally
  const v = region === 'sense' ? 0.82 + c * 0.18 : 0.12 + c * 0.74
  return corticalPoint(side, u, v)
}

/** Which region owns a given (u,v) cortical coord — for colouring the tissue. */
function regionForUV(u: number, v: number): RegionId {
  if (v > 0.88) return 'sense'
  for (const r of REGIONS) { if (r.id === 'sense' || r.id === 'command') continue; if (u >= r.u0 && u < r.u1) return r.id }
  return u >= 0.58 ? 'think' : 'experience'
}

/** Dense cortical-surface tissue: thousands of neuron somas covering the two
 *  wrinkled hemispheres, coloured by region. This is what makes it read as a
 *  brain. Returns interleaved xyz + a region index per point. */
export function corticalTissue(count: number): { positions: Float32Array; region: Uint8Array } {
  const positions = new Float32Array(count * 3)
  const region = new Uint8Array(count)
  const idx: Record<RegionId, number> = { command: 0, think: 1, know: 2, orchestrate: 3, act: 4, experience: 5, sense: 6 }
  for (let i = 0; i < count; i++) {
    const s = 't' + i
    const side: -1 | 1 = h(s) < 0.5 ? -1 : 1
    const u = h(s + '~1'), v = h(s + '~2')
    const p = corticalPoint(side, u, v)
    positions[i * 3] = p[0]; positions[i * 3 + 1] = p[1]; positions[i * 3 + 2] = p[2]
    region[i] = idx[regionForUV(u, v)]
  }
  return { positions, region }
}

export const REGION_INDEX: RegionId[] = ['command', 'think', 'know', 'orchestrate', 'act', 'experience', 'sense']
