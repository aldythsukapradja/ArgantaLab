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

// ── Provenance ──────────────────────────────────────────────────────────
// Every node the inspector lists carries one of these. Never upgrade a node
// to 'live' without a real measured feed behind it.
//   live        — backed by a real-time measured signal
//   partial     — a real system exists and is reachable, not fully wired/metered
//   simulated   — presented for the story (e.g. cinema narration), not measured
//   placeholder — proposed architecture; no concrete system built yet
export type Provenance = 'live' | 'partial' | 'simulated' | 'placeholder'

export interface ReactorNode {
  name: string
  provenance: Provenance
}

export interface ReactorLayerSpec {
  id: string
  label: string
  /** One-word role verb shown in the inspector (govern/decide/…). */
  micro: string
  /** One-sentence purpose, from the architecture note. */
  purpose: string
  /** The concrete systems/concepts this layer contains, each provenance-tagged. */
  nodes: ReactorNode[]
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

/** Compact node-list builder: `n(['Vault HQ','partial'], ['Timeline','placeholder'])`. */
function n(...entries: [string, Provenance][]): ReactorNode[] {
  return entries.map(([name, provenance]) => ({ name, provenance }))
}

// Revised seven-layer model (docs/…-Arganta-Reactor-Layers.md):
//   Command Core → Think → Know → Orchestrate → Act → Experience → Sense.
// Platform is NOT a ring here — it becomes the Shared Spine (a central axis).
// Cluster grouping feeds the story: THINK={Command Core,Think}, KNOW={Know},
// DO={Orchestrate,Act,Experience}, FEEDBACK={Sense}. Command Core stays fixed,
// bright and central (authority, not activity). IDs are stable node keys.
//
// Node provenance is conservative by design: 'partial' only where a concrete
// system genuinely exists in this repo today (Vault, the five products,
// Supabase, GitHub/Skills/MCP tool access); 'simulated' for the cinema
// narration itself; everything else is 'placeholder' — proposed architecture,
// not yet a wired system. Nothing here is marked 'live'.
export const DEFAULT_LAYERS: ReactorLayerSpec[] = [
  { id: 'command-core', label: 'Command Core', micro: 'govern',
    purpose: 'The center of authority — founder intent, North Star, governance and approval rights.',
    nodes: n(['Founder Intent', 'placeholder'], ['North Star', 'placeholder'], ['Governance', 'placeholder'],
      ['Approval Gates', 'placeholder'], ['Autonomy Policy', 'placeholder'], ['Consent Rules', 'placeholder'],
      ['Strategic Priorities', 'placeholder']),
    cluster: 'core', kind: 'core',
    radius: 0.5, thickness: 0.05, zRest: 0.6, zExploded: 0, color: '#70e7ff',
    material: 'glow', wireframe: false, spin: 0.0, hud: 'COMMAND CORE · govern', visible: true },
  { id: 'think', label: 'Think', micro: 'decide',
    purpose: 'The reasoning and decision layer — analysis, planning, trade-offs, recommendations.',
    nodes: n(['CEO Lens', 'placeholder'], ['CTO Lens', 'placeholder'], ['CFO Lens', 'placeholder'],
      ['COO Lens', 'placeholder'], ['Product Reasoning', 'placeholder'], ['Scenario Engine', 'placeholder'],
      ['Prioritization Engine', 'placeholder'], ['Decision Synthesis', 'placeholder']),
    cluster: 'think', kind: 'disc',
    radius: 1.05, thickness: 0.06, zRest: 0.4, zExploded: 1.4, color: '#45e8ff',
    material: 'glass', wireframe: false, spin: 0.08, hud: 'THINK · decide', visible: true },
  { id: 'know', label: 'Know', micro: 'remember',
    purpose: 'The living operational memory of Arganta — evidence, provenance, and connected context.',
    nodes: n(['Vault HQ', 'partial'], ['Repository Memory', 'placeholder'], ['Product Ontology', 'placeholder'],
      ['Architecture Graph', 'placeholder'], ['Decision Records', 'placeholder'], ['Metrics Dictionary', 'placeholder'],
      ['Timeline', 'placeholder'], ['Evidence Store', 'placeholder'], ['Provenance Registry', 'placeholder']),
    cluster: 'know', kind: 'particles',
    radius: 1.5, thickness: 0.04, zRest: 0.2, zExploded: 2.7, color: '#9a72ff',
    material: 'glow', wireframe: false, spin: 0.04, hud: 'KNOW · remember', visible: true },
  { id: 'orchestrate', label: 'Orchestrate', micro: 'coordinate',
    purpose: 'Coordination and delegation — Jarvis and agents route, assemble context and escalate.',
    nodes: n(['Jarvis', 'simulated'], ['CEO Router', 'placeholder'], ['C-Level Agents', 'placeholder'],
      ['Product Agents', 'placeholder'], ['Builder Agents', 'placeholder'], ['Context Assembler', 'placeholder'],
      ['Delegation Engine', 'placeholder'], ['Approval Router', 'placeholder'], ['Fallback Manager', 'placeholder']),
    cluster: 'do', kind: 'ring',
    radius: 1.95, thickness: 0.03, zRest: 0.05, zExploded: -1.2, color: '#35d8ed',
    material: 'wire', wireframe: true, spin: -0.05, count: 12, hud: 'ORCHESTRATE · coordinate', visible: true },
  { id: 'act', label: 'Act', micro: 'execute',
    purpose: 'The execution capability — skills, tools and workflows agents invoke to do the work.',
    nodes: n(['Skills', 'partial'], ['MCP Tools', 'partial'], ['GitHub', 'partial'], ['Supabase Actions', 'partial'],
      ['Deployment', 'placeholder'], ['Artifact Builder', 'placeholder'], ['Media Builder', 'placeholder'],
      ['Calendar', 'placeholder'], ['Email', 'placeholder'], ['Automations', 'placeholder'],
      ['Deterministic Workflows', 'placeholder']),
    cluster: 'do', kind: 'coil',
    radius: 2.3, thickness: 0.05, zRest: -0.05, zExploded: -2.4, color: '#ffc46b',
    material: 'metal', wireframe: false, spin: -0.06, count: 12, hud: 'ACT · execute', visible: true },
  { id: 'experience', label: 'Experience', micro: 'serve',
    purpose: 'Where internal capability becomes visible value — products, apps, dashboards, journeys.',
    nodes: n(['ArgantaLab', 'partial'], ['KinetikCircle', 'partial'], ['LashiraBloom', 'partial'],
      ['Circle HQ', 'partial'], ['Landing', 'partial'], ['Narrative Studio', 'simulated'],
      ['Games', 'placeholder'], ['Utilities', 'placeholder'], ['Dashboards', 'placeholder']),
    cluster: 'do', kind: 'products',
    radius: 2.75, thickness: 0.05, zRest: -0.15, zExploded: 3.6, color: '#35d8ed',
    material: 'metal', wireframe: false, spin: 0.03, hud: 'EXPERIENCE · serve', visible: true },
  { id: 'sense', label: 'Sense', micro: 'learn',
    purpose: 'The continuous feedback and telemetry layer — the nerves of Arganta.',
    nodes: n(['Activation Events', 'placeholder'], ['Retention Events', 'placeholder'], ['Product Events', 'placeholder'],
      ['Operational Health', 'placeholder'], ['Guardrails', 'placeholder'], ['User Feedback', 'placeholder'],
      ['Business Metrics', 'placeholder'], ['Cost Signals', 'placeholder'], ['Quality Signals', 'placeholder'],
      ['External Signals', 'placeholder']),
    cluster: 'signal', kind: 'signal',
    radius: 3.35, thickness: 0.02, zRest: 0.45, zExploded: 4.4, color: '#4be5bd',
    material: 'wire', wireframe: true, spin: 0.01, count: 28, hud: 'SENSE · learn', visible: true },
]

// Shared Spine — NOT an eighth layer. A cross-cutting foundation rendered as
// a structural axis (see cores/CoreR3F.tsx SharedSpine) and listed separately
// in the inspector, per the architecture note.
export const SHARED_SPINE_NODES: ReactorNode[] = n(
  ['Supabase', 'partial'], ['Identity', 'partial'], ['Authentication', 'partial'], ['Permissions', 'placeholder'],
  ['Consent', 'placeholder'], ['Storage', 'partial'], ['Realtime', 'placeholder'], ['Circle SDK', 'placeholder'],
  ['Model Gateway', 'placeholder'], ['API Gateway', 'placeholder'], ['Vercel', 'partial'],
  ['Monitoring', 'placeholder'], ['Security', 'placeholder'], ['Logs', 'placeholder'],
)

/** A deep clone for editable Builder state (never mutate DEFAULT_LAYERS). */
export function cloneLayers(layers: ReactorLayerSpec[] = DEFAULT_LAYERS): ReactorLayerSpec[] {
  return layers.map(l => ({ ...l, nodes: l.nodes.map(node => ({ ...node })) }))
}
