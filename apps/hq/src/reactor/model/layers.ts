// ─────────────────────────────────────────────────────────────────────────
// The reactor layer model — the spine.
//
// Seven independent, editable, swappable layers. Each is pure config: the
// renderer draws whatever these specs say, the Reactor Builder edits them
// live, and a GLB / Higgsfield node can replace any single layer 1:1 later.
//
// Layers live on a shared axis. At rest their `zRest` values are packed near
// zero so the whole thing reads as a flat, front-facing emblem. On expansion
// each slides to its `zExploded`, fanning apart into a genuine 3D accordion —
// the arc-reactor read. Nothing ever rotates edge-on.
// ─────────────────────────────────────────────────────────────────────────

/** THINK · KNOW · DO story clusters (core/signal are framing, not cognition). */
export type LayerCluster = 'core' | 'think' | 'know' | 'do' | 'signal'

/** How a layer is drawn. Each maps to a branch in <ReactorLayer>. */
export type LayerKind =
  | 'core'       // energy heart + radiating spokes + light
  | 'disc'       // solid/glass disc behind a ring
  | 'ring'       // a containment torus
  | 'coil'       // volumetric coil/blade modules around a ring
  | 'segments'   // segmented housing shells around a ring
  | 'particles'  // a memory particle shell (Vault field)
  | 'products'   // the five product nodes on a ring
  | 'signal'     // thin calibration ring + provenance ticks

export type LayerMaterial = 'metal' | 'glass' | 'wire' | 'glow'

export interface ReactorLayerSpec {
  id: string
  label: string
  /** One-word role verb shown in the inspector (govern/decide/…). */
  micro: string
  cluster: LayerCluster
  kind: LayerKind
  /** Ring/disc radius (world units). */
  radius: number
  /** Ring/segment thickness. */
  thickness: number
  /** Z when compressed (flat emblem) — packed near 0. */
  zRest: number
  /** Z when fully exploded along the axis. */
  zExploded: number
  color: string
  material: LayerMaterial
  /** Draw as wireframe ghost (holographic read). */
  wireframe: boolean
  /** Idle self-rotation about the view axis, rad/s (never edge-on). */
  spin: number
  /** Segment/coil count for the segmented kinds. */
  count?: number
  /** Floating HUD annotation (rendered in a later polish pass). */
  hud?: string
  /** Whether this layer is visible (Builder can hide layers). */
  visible: boolean
}

// Revised seven-layer model (docs/…-Arganta-Reactor-Layers.md):
//   Command Core → Think → Know → Orchestrate → Act → Experience → Sense.
// Platform is NOT a ring here — it becomes the Shared Spine (a central axis).
// Cluster grouping feeds the story: THINK={Command Core,Think}, KNOW={Know},
// DO={Orchestrate,Act,Experience}, FEEDBACK={Sense}. Command Core stays fixed,
// bright and central (authority, not activity). IDs are stable node keys.
export const DEFAULT_LAYERS: ReactorLayerSpec[] = [
  { id: 'command-core', label: 'Command Core', micro: 'govern', cluster: 'core', kind: 'core',
    radius: 0.5, thickness: 0.05, zRest: 0.6, zExploded: 0, color: '#70e7ff',
    material: 'glow', wireframe: false, spin: 0.0, hud: 'COMMAND CORE · govern', visible: true },
  { id: 'think', label: 'Think', micro: 'decide', cluster: 'think', kind: 'disc',
    radius: 1.05, thickness: 0.06, zRest: 0.4, zExploded: 1.4, color: '#45e8ff',
    material: 'glass', wireframe: false, spin: 0.08, hud: 'THINK · decide', visible: true },
  { id: 'know', label: 'Know', micro: 'remember', cluster: 'know', kind: 'particles',
    radius: 1.5, thickness: 0.04, zRest: 0.2, zExploded: 2.7, color: '#9a72ff',
    material: 'glow', wireframe: false, spin: 0.04, hud: 'KNOW · remember', visible: true },
  { id: 'orchestrate', label: 'Orchestrate', micro: 'coordinate', cluster: 'do', kind: 'ring',
    radius: 1.95, thickness: 0.03, zRest: 0.05, zExploded: -1.2, color: '#35d8ed',
    material: 'wire', wireframe: true, spin: -0.05, count: 12, hud: 'ORCHESTRATE · coordinate', visible: true },
  { id: 'act', label: 'Act', micro: 'execute', cluster: 'do', kind: 'coil',
    radius: 2.3, thickness: 0.05, zRest: -0.05, zExploded: -2.4, color: '#ffc46b',
    material: 'metal', wireframe: false, spin: -0.06, count: 12, hud: 'ACT · execute', visible: true },
  { id: 'experience', label: 'Experience', micro: 'serve', cluster: 'do', kind: 'products',
    radius: 2.75, thickness: 0.05, zRest: -0.15, zExploded: 3.6, color: '#35d8ed',
    material: 'metal', wireframe: false, spin: 0.03, hud: 'EXPERIENCE · serve', visible: true },
  { id: 'sense', label: 'Sense', micro: 'learn', cluster: 'signal', kind: 'signal',
    radius: 3.35, thickness: 0.02, zRest: 0.45, zExploded: 4.4, color: '#4be5bd',
    material: 'wire', wireframe: true, spin: 0.01, count: 28, hud: 'SENSE · learn', visible: true },
]

/** A deep clone for editable Builder state (never mutate DEFAULT_LAYERS). */
export function cloneLayers(layers: ReactorLayerSpec[] = DEFAULT_LAYERS): ReactorLayerSpec[] {
  return layers.map(l => ({ ...l }))
}
