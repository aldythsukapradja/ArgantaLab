// agent/types.ts — the shared vocabulary of the ArgantaEnergy agent.
//
// This file is deliberately dependency-free (no React, no zustand, no
// `import.meta.env`) so plain `node scripts/test-*.mjs` can import it directly
// under Node's native type stripping — the same discipline as dataqc/types.ts.
//
// Layering (see docs/arganta-energy/AGENT-DETERMINISTIC-CONCEPT-AND-BUILD-PLAN.md):
//   L0 bus (Scope/ViewIntent/MapIntent)  ← this file
//   L1 planner · L2 capabilities · L3 resolver · L4 grammar · L5 dialogue
// The Cloudflare Worker (phase 2) replaces L4 ONLY; everything typed here is
// identical in the deterministic and the language-model tier.

// ── Gazetteer ────────────────────────────────────────────────────────────────

/** Every kind of thing the agent can talk about. Ordered coarse → fine within
 *  each axis; `ambiguityRank` in resolve.ts uses this order for tie-breaks. */
export type GazKind =
  | 'region'
  | 'country'
  | 'basin'              // user-facing word for a USGS province (decision #2)
  | 'province'           // the USGS container itself, kept addressable
  | 'petroleum-system'
  | 'assessment-unit'
  | 'basin-cycle'
  | 'play'
  | 'field'
  | 'reservoir'
  | 'well'
  | 'wellbore'
  | 'company'
  | 'formation';

export const GAZ_KINDS: GazKind[] = [
  'region', 'country', 'basin', 'province', 'petroleum-system', 'assessment-unit',
  'basin-cycle', 'play', 'field', 'reservoir', 'well', 'wellbore', 'company', 'formation',
];

/** How a parent/child edge was established. Never hidden — the UI shows it, and
 *  a derived edge is never presented with the authority of a sourced one. */
export type LinkConfidence =
  | 'authoritative'   // the source publishes the link (AU → TPS → province)
  | 'spatial'         // point-in-polygon against USGS screening geometry
  | 'membership'      // inferred from member field country tags (country ⇄ basin)
  | 'inferred';       // last-resort rule; always surfaced to the user

export interface GazEdge {
  kind: GazKind;
  id: string;
  confidence: LinkConfidence;
  /** Evidence count behind a derived edge (e.g. 20 member fields). */
  weight?: number;
}

export interface GazFly {
  lon: number;
  lat: number;
  zoom: number;
}

/** What DATA exists for a node. Populated by the build from real file contents;
 *  never a guess. L2 capability probes read this and nothing else, which is what
 *  keeps "I have no logs for Badak" true rather than optimistic.
 *  A key that is absent means "not assessed" — it never means zero. */
export type GazAvailability = Record<string, number | boolean>;

export interface GazNode {
  /** Canonical agent id: `gaz:<kind>:<key>`. Stable across gazetteer rebuilds. */
  id: string;
  kind: GazKind;
  /** The bare name as published by the source. */
  name: string;
  /** Disambiguated for display: "Kutei Basin (Indonesia)". Omitted when it
   *  equals `name` — the loader fills it in. */
  displayName?: string;
  /** Other spellings, native ids and cross-source twins, verbatim. */
  aliases: string[];
  parents: GazEdge[];
  /** Child counts by kind — powers "17 fields" without loading them. */
  children?: { kind: GazKind; count: number }[];
  fly: GazFly | null;
  bbox?: [number, number, number, number] | null;
  /** Provenance chips: USGS · GOGET · Sodir · NSTA · ANP · Volve · Arganta. */
  sources: string[];
  /** Real data availability — see GazAvailability. */
  has: GazAvailability;
  /** Screening metrics; a missing key means "not assessed", never zero. */
  metrics?: Record<string, number | null>;
  /** Ids of the same real-world thing under another taxonomy (G4). Viking Graben
   *  is both a basin and an assessment unit; both nodes exist and point at each
   *  other, so the resolver can answer with one and offer the other. */
  sameAs?: string[];
  /** Source-record ids this node was fused from, for drill-through. */
  nativeIds?: string[];
}

/** Match keys, trigrams and phonetic codes are NOT shipped — they are derived at
 *  load by resolve.ts from `name` + `aliases`. Shipping ~14k × 10 trigrams would
 *  triple the payload to store something a pure function reproduces in <100 ms. */
export interface GazIndexed extends GazNode {
  displayName: string;
  /** Keys derived from the NAME (incl. its suffix-stripped forms). Stronger
   *  evidence than an alias key — see nameKeysFor in gazetteer.ts. */
  nameKeys: string[];
  /** nameKeys followed by alias keys. */
  normKeys: string[];
  trigrams: string[];
  phonetic: string;
  /** Capability ids whose probe returned true (computed at load from `has`). */
  capabilities: string[];
}

export interface Gazetteer {
  version: string;
  generatedAt: string;
  method: string;
  counts: Record<string, number>;
  nodes: GazNode[];
}

// ── Scope (L0) ───────────────────────────────────────────────────────────────
// Realises GLOBAL-SCOPE-FILTER-SPINE §2: four groups, optional levels, ancestors
// auto-filled, contradictions surfaced rather than silently dropped.

export type ScopeGroup = 'where' | 'geology' | 'accum' | 'wells';

export type ScopeLevel =
  // A · WHERE — country and province are PARALLEL, not nested (provinces cross borders)
  | 'region' | 'country' | 'province' | 'block'
  // B · GEOLOGY — assessmentUnit is a real tier the Exploration scope bar already
  // filters on (country/province/assessment-unit), so it is addressable here too.
  | 'basin' | 'cycle' | 'petroleumSystem' | 'assessmentUnit' | 'play' | 'opportunity'
  // C · ACCUMULATION
  | 'field' | 'reservoir'
  // D · WELLS — its own axis; a well is not a child of a pool
  | 'well' | 'wellbore';

export const SCOPE_LEVELS: ScopeLevel[] = [
  'region', 'country', 'province', 'block',
  'basin', 'cycle', 'petroleumSystem', 'assessmentUnit', 'play', 'opportunity',
  'field', 'reservoir',
  'well', 'wellbore',
];

export const LEVEL_GROUP: Record<ScopeLevel, ScopeGroup> = {
  region: 'where', country: 'where', province: 'where', block: 'where',
  basin: 'geology', cycle: 'geology', petroleumSystem: 'geology', assessmentUnit: 'geology', play: 'geology', opportunity: 'geology',
  field: 'accum', reservoir: 'accum',
  well: 'wells', wellbore: 'wells',
};

/** Which gazetteer kind fills which scope level. `block`/`opportunity` have no
 *  data yet — they stay in the type so the UI can hide rather than special-case. */
export const LEVEL_KIND: Partial<Record<ScopeLevel, GazKind>> = {
  region: 'region', country: 'country', province: 'province',
  basin: 'basin', cycle: 'basin-cycle', petroleumSystem: 'petroleum-system', assessmentUnit: 'assessment-unit', play: 'play',
  field: 'field', reservoir: 'reservoir',
  well: 'well', wellbore: 'wellbore',
};

/** A pointer into the gazetteer. Carries enough to render a chip without a lookup. */
export interface Ref {
  id: string;
  kind: GazKind;
  name: string;
  source?: string;
}

export interface ScopeFacets {
  operator?: string;
  prmsClass?: string;
  status?: string;
  fuel?: string;
  yearFrom?: number;
  yearTo?: number;
  onshore?: boolean;
  dataAvailability?: 'breadth' | 'full';
}

export interface ScopeConflict {
  /** The level whose value contradicts something else already in scope. */
  level: ScopeLevel;
  against: ScopeLevel;
  message: string;
  /** Levels the user could drop to resolve it. Never resolved automatically. */
  relax: ScopeLevel[];
}

export interface Scope {
  where: { region?: Ref; country?: Ref; province?: Ref; block?: Ref };
  geology: { basin?: Ref; cycle?: Ref; petroleumSystem?: Ref; assessmentUnit?: Ref; play?: Ref; opportunity?: Ref };
  accum: { field?: Ref; reservoir?: Ref };
  wells: { well?: Ref; wellbore?: Ref };
  facets: ScopeFacets;
  /** Levels that were auto-filled from an ancestor rule rather than chosen.
   *  The Scope Bar renders these greyed (spine §3.1). */
  derived: Partial<Record<ScopeLevel, true>>;
  /** Surfaced, never silently dropped (spine §1 rule 3). */
  conflicts: ScopeConflict[];
}

export const EMPTY_SCOPE: Scope = Object.freeze({
  where: {}, geology: {}, accum: {}, wells: {},
  facets: {}, derived: {}, conflicts: [],
}) as Scope;

/** What a caller hands to `setScope` — a sparse set of levels, not a whole Scope. */
export type ScopePatch = Partial<Record<ScopeLevel, Ref | null>> & { facets?: ScopeFacets };

/** Injected once the gazetteer has loaded, so the store stays data-free and
 *  plain-Node testable. `installScopeBrain` in store.ts wires the real one. */
export interface ScopeBrain {
  /** Ancestors implied by choosing `ref` at `level`. Keys omitted when unknown. */
  ancestorsOf(level: ScopeLevel, ref: Ref): Partial<Record<ScopeLevel, Ref>>;
  /** Contradictions in a fully-merged scope. Pure; must not mutate. */
  conflictsIn(scope: Scope): ScopeConflict[];
}

// ── One-shot intents (L0) ────────────────────────────────────────────────────
// `seq` increments on every request so a repeat of an identical intent still
// re-fires subscriber effects. Intents are NOT consumed centrally — several
// shells read the same intent (CosmoShell takes `nav`, the vertical takes
// `sub`), and a central consume would race them. This generalises the
// `driveLegacyNonce` pattern already proven in FieldDevShell.

export interface ViewIntent {
  seq: number;
  /** CosmoShell nav id: cockpit · exploration · field-development · … */
  nav: string;
  /** Workflow tab id within the vertical, e.g. `basin-framework`. */
  sub?: string;
  /** Vertical dossier vs workspace. */
  mode?: 'knowledge' | 'workspace';
  /** Legacy (v1) tab id, for verticals that still expose one. */
  legacyTab?: string;
  /** A modal/overlay the target surface should open on arrival. */
  modal?: string;
}

export interface MapIntent {
  seq: number;
  lon: number;
  lat: number;
  zoom: number;
  /** Gazetteer node id to outline on arrival (province/AU polygon, field point). */
  highlight?: string;
  /** Human-readable name for the map's own place chip. */
  label?: string;
  /** Force a map mode when the intent needs one. */
  mode?: '2d' | '3d';
}

export type ViewRequest = Omit<ViewIntent, 'seq'>;
export type MapRequest = Omit<MapIntent, 'seq'>;

// ── Commands (L1) ────────────────────────────────────────────────────────────
// An AgentPlan is a list of these. Executing a plan is the ONLY way the agent
// changes the app — there is no direct DOM or shell access anywhere above L0.

export type AgentCommand =
  /** `reroot` releases older selections that contradict this one — a
   *  conversational turn states intent, it does not add a constraint. */
  | { op: 'scope'; patch: ScopePatch; autofill?: boolean; reroot?: boolean }
  | { op: 'view'; view: ViewRequest }
  | { op: 'map'; map: MapRequest }
  | { op: 'clear'; level?: ScopeLevel };

// ── Answer cards (L6) ────────────────────────────────────────────────────────

export interface CardFact {
  label: string;
  value: string;
  /** Source chip. Absent means the value is derived — say so in `note`. */
  source?: string;
  note?: string;
}

export interface CardChip {
  label: string;
  /** The query this chip re-enters as if the user had typed it. Keeps the chip
   *  path and the typed path on exactly one code path. */
  query: string;
  hint?: string;
  count?: number;
}

export interface AnswerCard {
  kind: 'brief' | 'list' | 'absence' | 'clarify' | 'error' | 'menu';
  headline: string;
  subhead?: string;
  facts: CardFact[];
  /** Follow-up affordances: the drill-down ladder, alternatives, corrections. */
  chips: CardChip[];
  /** Source badges shown as a provenance strip. No number renders without one. */
  provenance: string[];
  /** Prose. In the deterministic tier this is templated; in the worker tier the
   *  model may rephrase it, but never the facts. */
  body?: string;
  /** A real component to mount in the artifact pane, by registry key. */
  artifact?: { component: string; props: Record<string, unknown> };
}

export interface AgentPlan {
  commands: AgentCommand[];
  card: AnswerCard;
  /** Which capability produced this answer — the audit trail, and the tool name
   *  the worker tier will have called. */
  capabilityId?: string;
  /** Set when the plan came from a corrected or guessed reading of the query. */
  interpretation?: { from: string; to: string; reason: string };
}

// ── Reasoning trace ──────────────────────────────────────────────────────────
// What ACTUALLY happened on a turn, recorded as it happens.
//
// This is not a chain of thought and must never be dressed up as one. The model
// is asked to do exactly one thing — pick a tool — and everything else is
// deterministic code. So the trace reports facts the pipeline genuinely
// produced (which resolver stage matched, what the probe found, which commands
// ran), never an invented monologue. Where a step took no measurable time, it
// says so rather than pretending to deliberate.

export type TraceKind =
  | 'parse'      // the grammar's reading of the utterance
  | 'resolve'    // which entity, via which matching stage
  | 'capability' // what was chosen, and whether its data probe passed
  | 'data'       // what the catalogue actually holds for it
  | 'action'     // commands pushed onto the bus
  | 'model'      // a real LLM call (language tier only)
  | 'tool'       // a real tool execution inside the agent loop
  | 'note';      // an honest caveat (fell back, refused, degraded)

export interface TraceStep {
  kind: TraceKind;
  label: string;
  value: string;
  /** Secondary evidence — "phonetic · distance 1", "142 ms", "$0.0003". */
  detail?: string;
  /** Pass/fail where the step is a check. Undefined = not a check. */
  ok?: boolean;
  /** How many times this identical step actually occurred. Set only when >1 —
   *  adjacent repeats are folded for readability, never removed, and the count
   *  shown is the real count. */
  repeat?: number;
}

export interface TurnTrace {
  steps: TraceStep[];
  /** Which tier answered. */
  tier: 'lite' | 'core';
  /** Real wall-clock for the turn. Sub-millisecond work is reported honestly
   *  rather than padded to look like effort. */
  ms: number;
}
