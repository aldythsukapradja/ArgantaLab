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

// ── volumetric hemisphere fill ──────────────────────────────────────────────
// Earlier versions placed every point on the dorsal cortical SHELL (a 2D
// surface). Seen from directly above, a shell's lateral edge is nearly tangent
// to the camera, so points pile up per screen-pixel there and trace a bright
// silhouette rim front-to-back — the "long lines" artifact. Filling the
// hemisphere as a solid EGG-SHAPED VOLUME (real depth in Y, real spread in X)
// removes that edge entirely and naturally spreads dense regions out instead
// of clumping them into a thin band.

/** Ellipsoid taper at anterior-posterior position u (0=occipital, 1=frontal):
 *  0 at the poles, 1 at the widest point (~u=0.55). Shared by every point so
 *  the lobe reads as one consistent egg shape. */
function taperAt(u: number): number {
  return Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.86 + 0.09))), 0.72)
}

/** A point INSIDE the hemisphere volume at anterior-posterior `u` and
 *  medial→lateral fill `latT` (0 = at the fissure, 1 = outer rim), filling the
 *  full dorsal-ventral depth rather than sitting on the outer shell. */
function volumePoint(side: -1 | 1, u: number, latT: number, seedY: number, wobbleSeed: number): [number, number, number] {
  const wf = taperAt(u)
  const z = (u - 0.44) * 2 * BRAIN.length
  const maxLat = BRAIN.width * (0.35 + 0.65 * wf)
  const lat = latT * maxLat
  const x = side * (BRAIN.hemiGap + lat)
  // depth fill: the lobe is tallest mid-length, thinner near the poles, and
  // tapers as you move laterally (an egg cross-section, not a flat disc)
  const maxY = BRAIN.height * (0.5 + 0.5 * wf) * (1 - (lat / (maxLat + 0.001)) * 0.35)
  const y = (seedY - 0.5) * 2 * maxY - 0.15
  // gentle gyral wobble for organic texture — small, never enough to re-create a shell
  const wobble = (Math.sin(u * 23 + latT * 14 + wobbleSeed * 6.28) * 0.5
    + Math.sin(latT * 31 - u * 11 + wobbleSeed * 3.1) * 0.5) * BRAIN.gyral * 0.3
  return [x + wobble * 0.3 * side, y + wobble, z + wobble * 0.25]
}

/** Deterministic volumetric position for a note in a region + hemisphere.
 *  Fills the region's full anterior-posterior band (with a soft overlap into
 *  neighbours) AND the full medial→lateral and dorsal-ventral extent — a real
 *  cloud through the lobe, never a thin sheet or a line. */
export function regionPoint(id: string, region: RegionId, hemi: Hemisphere): [number, number, number] {
  const r = REGION_BY_ID.get(region)!
  const a = h(id), b = h(id + '~1'), c = h(id + '~2'), d = h(id + '~3'), e = h(id + '~4')
  if (region === 'command') {
    // deep-central hub: a loose cluster around the thalamic anchor, below the cortex
    return [(a - 0.5) * 1.8, -0.4 + (b - 0.5) * 1.4, 0.4 + (c - 0.5) * 2.0]
  }
  const side: -1 | 1 = hemi === 'right' ? 1 : hemi === 'left' ? -1 : (a < 0.5 ? -1 : 1)
  const bandLo = Math.max(0, r.u0 - 0.05), bandHi = Math.min(1, r.u1 + 0.05)
  const u = bandLo + (bandHi - bandLo) * b
  // sense hugs the outer rim (sensory cortex wraps the lateral surface); the
  // rest fill medial→lateral with a mild outward bias so the cortex still
  // reads denser near the surface without recreating a hard shell edge.
  const latT = region === 'sense' ? 0.72 + c * 0.28 : Math.sqrt(c) * 0.92 + 0.04
  return volumePoint(side, u, latT, d, e)
}

/** Which region owns a given (u, latT) coord — for colouring the tissue. */
function regionForUV(u: number, latT: number): RegionId {
  if (latT > 0.86) return 'sense'
  for (const r of REGIONS) { if (r.id === 'sense' || r.id === 'command') continue; if (u >= r.u0 && u < r.u1) return r.id }
  return u >= 0.58 ? 'think' : 'experience'
}

/** Dense cortical VOLUME tissue: thousands of points filling the two
 *  wrinkled hemisphere lobes (not their surface), coloured by region. This is
 *  what makes it read as a solid brain body instead of a hollow shell.
 *  Returns interleaved xyz + a region index per point. */
export function corticalTissue(count: number): { positions: Float32Array; region: Uint8Array } {
  const positions = new Float32Array(count * 3)
  const region = new Uint8Array(count)
  const idx: Record<RegionId, number> = { command: 0, think: 1, know: 2, orchestrate: 3, act: 4, experience: 5, sense: 6 }
  for (let i = 0; i < count; i++) {
    const s = 't' + i
    const side: -1 | 1 = h(s) < 0.5 ? -1 : 1
    const u = h(s + '~1'), c = h(s + '~2'), d = h(s + '~3'), e = h(s + '~4')
    const latT = Math.sqrt(c)
    const p = volumePoint(side, u, latT, d, e)
    positions[i * 3] = p[0]; positions[i * 3 + 1] = p[1]; positions[i * 3 + 2] = p[2]
    region[i] = idx[regionForUV(u, latT)]
  }
  return { positions, region }
}

export const REGION_INDEX: RegionId[] = ['command', 'think', 'know', 'orchestrate', 'act', 'experience', 'sense']
