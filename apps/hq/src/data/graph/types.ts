// The Command ontology — a typed node+edge graph. One vocabulary for the whole
// org cockpit. Nodes are DATA, not code: the UI renders from these lists, so
// adding/renaming/moving a node never requires a component rewrite.
// Provenance is mandatory: every metric carries a source badge. Nothing fake
// renders as real — grey (placeholder) means "we fly blind here", by design.

// ---------- NODES ----------
export type NodeKind =
  | 'northstar' | 'lever' | 'valueStage'
  | 'app' | 'tab' | 'subtab' | 'component'
  | 'event' | 'signal' | 'metric'
  | 'architecture' | 'scaleModel' | 'ledger'
  | 'ip' | 'risk' | 'office'

export type Lever = 'breadth' | 'depth' | 'frequency' | 'efficiency'
export type Role = 'driver' | 'guardrail' | 'diagnostic'
/** provenance — the honesty badge. simulated = deterministic model (Treasury). */
export type Source = 'live' | 'partial' | 'simulated' | 'placeholder'
/** blind = no telemetry (grey) */
export type Health = 'green' | 'amber' | 'red' | 'blind'
export type OfficeId = 'bridge' | 'operations' | 'technology' | 'treasury' | 'legal' | 'roster'

export interface MetricDef {
  key: string
  label: string
  target?: number
  direction: 'up' | 'down'          // down = guardrail, lower is better
  unit?: '%' | '$' | 'count' | 'ratio'
  source: Source                    // <-- honesty badge
}

export interface GraphNode {
  id: string                        // IMMUTABLE
  label: string                     // display, mutable
  kind: NodeKind
  parent: string | null             // pointer, not hardcoded nesting
  levers?: Lever[]
  role?: Role
  owner?: OfficeId                  // the ownership lens
  metric?: MetricDef
  emits?: string[]                  // event ids this surface emits
  status: Source                    // instrumentation truth for the NODE
  note?: string                     // one-line value statement ("words before numbers")
}

// ---------- EDGES ----------
export type EdgeKind =
  | 'CONTAINS' | 'EMITS' | 'DERIVES_FROM' | 'MEASURES' | 'SERVES'
  | 'FEEDS' | 'LADDERS_TO' | 'GUARDS' | 'CAUSES' | 'CONVERTS_TO'
  | 'RUNS_ON' | 'OWNS' | 'ISSUES' | 'CONSULTS' | 'COSTS' | 'HAS_VERDICT'

export interface GraphEdge {
  id: string
  kind: EdgeKind
  from: string
  to: string
  weight?: number
  lagDays?: number
  about?: string                    // node id a CONSULTS is about
  consultType?: 'input' | 'flag' | 'handoff'
  status?: 'open' | 'answered' | 'blocked'
  direction?: 'up' | 'down'
  note?: string
}

// ---------- AGENTS / VERDICTS ----------
export type VerdictKind =
  | 'INVEST' | 'POLISH' | 'FIX' | 'INSTRUMENT' | 'CUT'
  | 'DEEPEN' | 'PRUNE' | 'RETAIN' | 'INNOVATE'
  | 'MONETIZE' | 'FLAG' | 'HOLD'
  | 'IMPROVE' | 'REPLACE' | 'STRATEGY' | 'RESOLVE'

export interface Verdict {
  id: string
  kind: VerdictKind
  targetNode: string
  laddersTo: string                 // REQUIRED node id (lever/stage/coverage) — teeth
  by: OfficeId
  status: 'proposed' | 'active' | 'resolved' | 'rejected'
  rationale?: string
}

export interface AgentDef {
  id: OfficeId
  office: string                    // 'Operations', 'Technology', ...
  chief: string                     // 'COO', 'CTO', ...
  pairedHuman: string | null
  slice: string                     // its slice of the North Star (words before numbers)
  ownsKinds: NodeKind[]
  ownsLevers?: Lever[]
  ownsStages?: string[]
  issues: VerdictKind[]             // verdict rights
  sla: { key: string; label: string; target: number; source: Source }[]
  cost?: { tokenBudget?: number; salaryBand?: string; source: Source }
}
