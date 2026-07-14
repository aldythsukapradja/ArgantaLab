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

// Front (core) → back (platform), staggered so the exploded fan is legible.
// Radii ascend so the compressed pose reads as concentric rings (ref 3).
export const DEFAULT_LAYERS: ReactorLayerSpec[] = [
  { id: 'core', label: 'Core', cluster: 'core', kind: 'core',
    radius: 0.5, thickness: 0.05, zRest: 0.6, zExploded: 0, color: '#70e7ff',
    material: 'glow', wireframe: false, spin: 0.0, hud: 'REACTOR CORE', visible: true },
  { id: 'intelligence', label: 'Intelligence', cluster: 'think', kind: 'disc',
    radius: 1.2, thickness: 0.06, zRest: 0.4, zExploded: 1.3, color: '#45e8ff',
    material: 'glass', wireframe: false, spin: 0.08, hud: 'THINK · reasoning', visible: true },
  { id: 'knowledge', label: 'Knowledge', cluster: 'know', kind: 'particles',
    radius: 1.7, thickness: 0.04, zRest: 0.2, zExploded: 2.7, color: '#9a72ff',
    material: 'glow', wireframe: false, spin: 0.04, hud: 'KNOW · Vault memory', visible: true },
  { id: 'agents', label: 'Agents', cluster: 'do', kind: 'coil',
    radius: 2.0, thickness: 0.05, zRest: 0.0, zExploded: -1.3, color: '#ffc46b',
    material: 'metal', wireframe: false, spin: -0.06, count: 12, hud: 'DO · execution', visible: true },
  { id: 'products', label: 'Products', cluster: 'do', kind: 'products',
    radius: 2.7, thickness: 0.05, zRest: -0.1, zExploded: -2.5, color: '#35d8ed',
    material: 'metal', wireframe: false, spin: 0.03, hud: 'Five products', visible: true },
  { id: 'platform', label: 'Platform', cluster: 'do', kind: 'segments',
    radius: 3.1, thickness: 0.06, zRest: -0.3, zExploded: -3.8, color: '#647eaa',
    material: 'metal', wireframe: false, spin: -0.02, count: 12, hud: 'Platform', visible: true },
  { id: 'signal', label: 'Signal', cluster: 'signal', kind: 'signal',
    radius: 3.45, thickness: 0.02, zRest: 0.5, zExploded: 3.9, color: '#4be5bd',
    material: 'wire', wireframe: true, spin: 0.01, count: 24, hud: 'Provenance', visible: true },
]

/** A deep clone for editable Builder state (never mutate DEFAULT_LAYERS). */
export function cloneLayers(layers: ReactorLayerSpec[] = DEFAULT_LAYERS): ReactorLayerSpec[] {
  return layers.map(l => ({ ...l }))
}
