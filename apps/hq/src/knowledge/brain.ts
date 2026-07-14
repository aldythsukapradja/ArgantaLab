// WS3 — brain anatomy. Maps the 24-type ontology onto a two-hemisphere cortex
// seen from above, and the THINK · KNOW · DO cognition axis (from the Master
// Plan) onto the anterior→posterior gradient. Left hemisphere = analytic, right
// = creative, midline = identity/executive. Deterministic positions so the
// cortex is stable across sessions.
//
//   THINK — founder intent, command, reasoning, routing        (frontal, +Z)
//   KNOW  — vault, evidence, telemetry, metrics, provenance     (temporal, mid)
//   DO    — architecture, agents, tools, artifacts, execution   (motor, -Z)

import type { OntologyType } from './ontology'

export type Cognition = 'think' | 'know' | 'do'
export type Hemisphere = 'left' | 'right' | 'mid'

// Harmonised with the reactor triad + the product/ontology palettes.
export const COGNITION_COLOR: Record<Cognition, string> = {
  think: '#8b7cf6', // iris — intent / reasoning
  know: '#38bdf8',  // sky — memory / evidence
  do: '#f5a24b',    // amber — execution
}
export const COGNITION_LABEL: Record<Cognition, string> = {
  think: 'THINK', know: 'KNOW', do: 'DO',
}
export const COGNITION_HINT: Record<Cognition, string> = {
  think: 'Intent · command · reasoning · routing',
  know: 'Vault · evidence · telemetry · metrics · provenance',
  do: 'Architecture · agents · tools · artifacts · execution',
}

export const HEMISPHERE_LABEL: Record<Hemisphere, string> = {
  left: 'Analytic', right: 'Creative', mid: 'Executive',
}

// ── ontology → cognition (THINK/KNOW/DO) ──────────────────────────────────
const COGNITION_OF: Record<OntologyType, Cognition> = {
  Founder: 'think', 'North Star': 'think', Strategy: 'think', Decision: 'think',
  Office: 'think', Agent: 'think',
  Document: 'know', 'Data Source': 'know', Database: 'know', Table: 'know',
  Metric: 'know', Signal: 'know', Repository: 'know',
  Architecture: 'do', Skill: 'do', Tool: 'do', Workflow: 'do', Task: 'do',
  Artifact: 'do', Approval: 'do', Deployment: 'do', API: 'do',
  Product: 'do', Surface: 'do',
}

// ── ontology → hemisphere (analytic / creative / midline) ─────────────────
const HEMISPHERE_OF: Record<OntologyType, Hemisphere> = {
  // analytic — logic, data, structure
  Database: 'left', Table: 'left', 'Data Source': 'left', API: 'left',
  Metric: 'left', Signal: 'left', Repository: 'left', Architecture: 'left',
  Tool: 'left', Deployment: 'left', Decision: 'left',
  // creative — products, surfaces, narrative, design
  Product: 'right', Surface: 'right', Document: 'right', Strategy: 'right',
  Artifact: 'right', Skill: 'right', Workflow: 'right',
  // midline — identity / executive control
  Founder: 'mid', 'North Star': 'mid', Office: 'mid', Agent: 'mid',
  Task: 'mid', Approval: 'mid',
}

export const cognitionOf = (t: OntologyType): Cognition => COGNITION_OF[t] ?? 'know'
export const hemisphereOf = (t: OntologyType): Hemisphere => HEMISPHERE_OF[t] ?? 'mid'

// ── geometry ──────────────────────────────────────────────────────────────
// Camera looks straight down -Y, so X = left/right, Z = front/back, Y = up.
export const BRAIN = {
  hemiOffset: 4.6,   // X centre of each hemisphere (gap between = fissure)
  hemiWidth: 4.1,    // half-width of a hemisphere lobe
  length: 9.2,       // half front-back extent
  height: 3.1,       // half dorsal-ventral (dome) extent
  fissure: 0.9,      // min gap kept clear at the midline
}

// deterministic hash → [0,1)
function h(str: string): number {
  let x = 2166136261
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619) }
  return (x >>> 0) / 4294967295
}

/** Place a node inside the cortex volume from its ontology region + id seed.
 *  Anterior-posterior band comes from cognition; hemisphere from the analytic/
 *  creative axis; gyral scatter + a dorsal dome give the brain its form. */
export function brainPosition(id: string, cognition: Cognition, hemi: Hemisphere): [number, number, number] {
  const a = h(id), b = h(id + '~1'), c = h(id + '~2'), d = h(id + '~3')

  // anterior→posterior band: THINK front (+Z), KNOW mid, DO back (−Z)
  const bandZ = cognition === 'think' ? 0.52 : cognition === 'know' ? 0.02 : -0.52
  const z = (bandZ + (b - 0.5) * 0.42) * BRAIN.length

  // taper the lobe toward the occipital (back) and frontal pole for a brain silhouette
  const zt = z / BRAIN.length
  const taper = 1 - 0.28 * Math.max(0, -zt) - 0.12 * Math.max(0, zt)

  // within-hemisphere lateral spread; midline nodes hug the centre + deep structures
  let x: number
  if (hemi === 'mid') {
    x = (a - 0.5) * BRAIN.fissure * 1.6
  } else {
    const side = hemi === 'left' ? -1 : 1
    const lateral = (0.28 + a * 0.72) * BRAIN.hemiWidth * taper
    x = side * (BRAIN.fissure * 0.5 + lateral)
  }

  // dorsal dome: higher toward the crown, plus gyral noise for a wrinkled surface
  const dome = Math.cos(zt * 1.2) * Math.cos((x / (BRAIN.hemiOffset + BRAIN.hemiWidth)) * 1.1)
  const gyri = Math.sin(a * 40 + b * 23) * 0.28 + Math.sin(z * 1.7 + x * 1.3) * 0.22
  const y = ((c - 0.5) * 0.9 + dome * 0.9 + gyri) * BRAIN.height

  // midline dip (longitudinal fissure) — pull surface down near x≈0
  const fis = hemi === 'mid' ? 0 : Math.max(0, 1 - Math.abs(x) / 2.2) * -0.8
  return [x, y + fis + (d - 0.5) * 0.3, z]
}

/** A dense field of decorative "synapse" points filling the cortex shell, so the
 *  brain reads as neural tissue behind the meaningful nodes. Returns interleaved
 *  xyz positions + a per-point cognition band (0 think / 1 know / 2 do). */
export function neuronCloud(count: number): { positions: Float32Array; bands: Uint8Array } {
  const positions = new Float32Array(count * 3)
  const bands = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const s = 'n' + i
    const a = h(s), b = h(s + '~1'), c = h(s + '~2'), d = h(s + '~3')
    const side = a < 0.48 ? -1 : a > 0.52 ? 1 : 0
    const zt = (b - 0.5) * 2                       // −1..1 front/back
    const taper = 1 - 0.28 * Math.max(0, -zt) - 0.12 * Math.max(0, zt)
    let x: number
    if (side === 0) x = (c - 0.5) * BRAIN.fissure * 1.4
    else {
      const lateral = (0.15 + c * 0.9) * BRAIN.hemiWidth * taper
      x = side * (BRAIN.fissure * 0.5 + lateral)
    }
    const z = zt * BRAIN.length
    const dome = Math.cos(zt * 1.2) * Math.cos((x / (BRAIN.hemiOffset + BRAIN.hemiWidth)) * 1.1)
    const gyri = Math.sin(a * 44 + b * 19) * 0.3
    const y = ((d - 0.5) * 0.8 + dome * 0.95 + gyri) * BRAIN.height
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    bands[i] = zt > 0.28 ? 0 : zt < -0.28 ? 2 : 1   // think / know / do
  }
  return { positions, bands }
}
