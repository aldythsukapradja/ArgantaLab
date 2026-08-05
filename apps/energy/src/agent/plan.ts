// agent/plan.ts — intent + entity → AgentPlan (L1).
//
// The planner is where a parsed utterance becomes commands the bus can execute
// and a card the chat can render. It is the join point of the two tiers: the
// deterministic grammar and the Cloudflare worker both hand this layer the same
// shape, so the worker cannot do anything the deterministic tier cannot.
//
// It never touches data directly. Everything it says comes from a Capability's
// `card`, which in turn reads only measured availability.

import type { AgentCommand, AgentPlan, AnswerCard, GazIndexed } from './types.ts';
import type { Candidate } from './resolve.ts';
import type { Intent } from './grammar.ts';
import { CAPABILITIES, CAPABILITY_BY_ID, type CapCtx, type Capability, absenceCard, capabilitiesFor, defaultCapability } from './capabilities.ts';
import { childrenOfKind } from './gazetteer.ts';

export interface PlanContext extends CapCtx {}

// ── choosing the capability ──────────────────────────────────────────────────

export type Choice =
  | { kind: 'run'; capability: Capability }
  /** The capability was named and applies to this kind, but its data is absent. */
  | { kind: 'absent'; capability: Capability }
  /** The capability was named but does not apply to this kind of thing at all. */
  | { kind: 'wrong-kind'; capability: Capability; fallback: Capability | null };

/**
 * Pick the capability to run.
 *
 * The grammar deliberately does not decide this — several capabilities share the
 * word "overview", and which one is meant depends entirely on what the entity
 * turned out to be. Intersecting here is what lets one phrase serve every kind.
 */
export function chooseCapability(node: GazIndexed, intent: Intent, ctx: PlanContext): Choice {
  const applicable = CAPABILITIES.filter((c) => c.kinds.includes(node.kind));
  const usable = capabilitiesFor(node, ctx);

  if (intent.capabilityIds.length) {
    const named = intent.capabilityIds.map((id) => CAPABILITY_BY_ID.get(id)).filter(Boolean) as Capability[];
    const namedUsable = named.filter((c) => usable.includes(c));
    if (namedUsable.length) {
      return { kind: 'run', capability: pickBest(namedUsable, intent) };
    }
    const namedApplicable = named.filter((c) => applicable.includes(c));
    if (namedApplicable.length) {
      // Named, applies to this kind, but the data is not there — the honest path.
      return { kind: 'absent', capability: pickBest(namedApplicable, intent) };
    }
    // Named something real, but not for this kind of thing ("logs for a country").
    return { kind: 'wrong-kind', capability: named[0], fallback: defaultCapability(node, ctx) };
  }

  // No capability named — the verb decides.
  const byShape = (shape: Capability['shape']) => usable.find((c) => c.shape === shape) ?? null;
  const map = usable.find((c) => c.id === 'map.fly');
  const chosen = (() => {
    switch (intent.verb) {
      // "where is X" is a map question. "show me X" is not — it asks for the
      // richest thing available, and the brief's own plan flies the map anyway.
      case 'locate': return map ?? byShape('brief');
      case 'show': return byShape('brief') ?? map;
      case 'list': return byShape('list') ?? byShape('brief');
      case 'help': return usable.find((c) => c.id === 'data.availability') ?? byShape('menu');
      case 'explain':
      case 'brief':
      default: return byShape('brief') ?? usable[0];
    }
  })();
  const capability = chosen ?? usable[0] ?? null;
  return capability ? { kind: 'run', capability } : { kind: 'wrong-kind', capability: CAPABILITIES[0], fallback: null };
}

/** Among several capabilities matching the same phrase, prefer the one whose
 *  shape suits the verb, then the heavier one. */
function pickBest(candidates: Capability[], intent: Intent): Capability {
  const wanted = intent.verb === 'list' ? 'list' : intent.verb === 'brief' ? 'brief' : null;
  const preferred = wanted ? candidates.filter((c) => c.shape === wanted) : [];
  const pool = preferred.length ? preferred : candidates;
  return pool.slice().sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
}

// ── building the plan ────────────────────────────────────────────────────────

/** The drill-down rung offered after an answer: what comes next below `node`. */
export function drillDownChips(node: GazIndexed, ctx: PlanContext): { childKind: string; options: GazIndexed[] } | null {
  const LADDER: Record<string, string[]> = {
    region: ['country'],
    country: ['basin'],
    basin: ['field', 'assessment-unit'],
    'petroleum-system': ['assessment-unit'],
    'assessment-unit': ['field'],
    field: ['well'],
  };
  for (const childKind of LADDER[node.kind] ?? []) {
    const options = childrenOfKind(ctx.index, node.id, childKind as never);
    if (options.length) return { childKind, options };
  }
  return null;
}

export function buildPlan(node: GazIndexed, intent: Intent, ctx: PlanContext): AgentPlan {
  const choice = chooseCapability(node, intent, ctx);

  if (choice.kind === 'absent') {
    // No commands: refusing to navigate is the point. Routing to an empty viewer
    // and letting the user work out that it is empty is the failure mode this
    // whole layer exists to prevent.
    return { commands: [], card: absenceCard(choice.capability, node, ctx), capabilityId: choice.capability.id };
  }

  if (choice.kind === 'wrong-kind') {
    const fallback = choice.fallback;
    const card: AnswerCard = {
      kind: 'clarify',
      headline: `${choice.capability.label} does not apply to ${node.name}`,
      subhead: `${node.name} is a ${readableKind(node.kind)}`,
      facts: [],
      chips: capabilitiesFor(node, ctx).slice(0, 6).map((c) => ({ label: c.label, query: `${c.phrases[0]} for ${node.name}` })),
      provenance: node.sources,
      body: `I can ask for ${choice.capability.label.toLowerCase()} on a ${choice.capability.kinds.map(readableKind).join(' or ')}, not on a ${readableKind(node.kind)}.`,
    };
    // No commands, even though a sensible fallback exists. Answering "logs do
    // not apply to a country" and then navigating somewhere else is disorienting;
    // a card that asks a question must leave the app where the user left it.
    void fallback;
    return { commands: [], card, capabilityId: choice.capability.id };
  }

  const { capability } = choice;
  const commands: AgentCommand[] = capability.plan(node, ctx);
  const card = capability.card(node, ctx);

  // Offer the next rung when the answer did not already list it. This is the
  // "if I ask basin it will ask which field" behaviour — offered, never forced.
  // Only a BRIEF invites narrowing: someone who asked for figures wants figures,
  // and tacking "Which field?" onto that answer is noise, not helpfulness.
  if (!card.chips.length && capability.shape === 'brief') {
    const next = drillDownChips(node, ctx);
    if (next) {
      card.chips = next.options.slice(0, 8).map((child) => ({ label: child.name, query: child.name }));
      card.body = `${card.body ? `${card.body} ` : ''}Which ${readableKind(next.childKind)}?`;
    }
  }

  return { commands, card, capabilityId: capability.id };
}

export function readableKind(kind: string): string {
  return kind === 'assessment-unit' ? 'assessment unit'
    : kind === 'petroleum-system' ? 'petroleum system'
      : kind === 'basin-cycle' ? 'basin cycle'
        : kind;
}

// ── cards for the paths where there is no entity to plan against ─────────────

/** Nothing matched. Offers the nearest things rather than a shrug. */
export function unresolvedCard(query: string, suggestions: Candidate[]): AnswerCard {
  return {
    kind: 'error',
    headline: `I don't have anything called "${query.trim()}"`,
    facts: [],
    chips: suggestions.slice(0, 5).map((c) => ({ label: c.node.displayName, query: c.node.name, hint: readableKind(c.node.kind) })),
    provenance: ['ArgantaEnergy catalogue'],
    body: suggestions.length
      ? 'Closest matches in the catalogue:'
      : 'Try a basin ("Kutei Basin"), a country ("Indonesia"), a field ("Volve") or a well.',
  };
}

/** Two or more real entities answer to that name. Asked, never guessed. */
export function ambiguityCard(query: string, candidates: Candidate[]): AnswerCard {
  return {
    kind: 'clarify',
    headline: `"${query.trim()}" matches ${candidates.length} things`,
    facts: candidates.map((c) => ({
      label: c.node.displayName,
      value: readableKind(c.node.kind),
      source: c.node.sources[0],
    })),
    chips: candidates.map((c) => ({ label: c.node.displayName, query: c.node.name, hint: readableKind(c.node.kind) })),
    provenance: [...new Set(candidates.flatMap((c) => c.node.sources))],
    body: 'Which one did you mean?',
  };
}

/** A correction too large to apply silently. */
export function correctionCard(from: string, node: GazIndexed, alternates: GazIndexed[]): AnswerCard {
  return {
    kind: 'clarify',
    headline: `Did you mean ${node.displayName}?`,
    subhead: `You typed "${from}"`,
    facts: [],
    chips: [
      { label: `Yes — ${node.name}`, query: node.name },
      ...alternates.slice(0, 3).map((a) => ({ label: a.displayName, query: a.name, hint: readableKind(a.kind) })),
    ],
    provenance: node.sources,
  };
}

/** Two entities, side by side. Comparison is a first-class verb because
 *  screening is comparative by nature. */
export function comparisonCard(a: GazIndexed, b: GazIndexed): AnswerCard {
  const count = (n: GazIndexed, key: string) => {
    const value = n.has[key];
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    return '—';
  };
  const metric = (n: GazIndexed, key: string, unit: string) => (n.metrics?.[key] != null
    ? `${Math.round(n.metrics[key] as number)} ${unit}` : '—');

  // Rows are chosen by what the two entities ACTUALLY carry. Comparing two
  // fields on "assessment units" printed a row of dashes — technically true,
  // and useless. A row only appears when at least one side can fill it.
  const CANDIDATES: { label: string; get: (n: GazIndexed) => string; source?: string }[] = [
    { label: 'Known fields', get: (n) => count(n, 'fields'), source: 'GOGET ∩ USGS' },
    { label: 'Petroleum systems', get: (n) => count(n, 'petroleumSystems'), source: 'USGS' },
    { label: 'Assessment units', get: (n) => count(n, 'assessmentUnits'), source: 'USGS' },
    { label: 'Basin cycles', get: (n) => count(n, 'cycles'), source: 'Arganta KB' },
    { label: 'Undiscovered (mean)', get: (n) => metric(n, 'boeMean_mmboe', 'MMBOE'), source: 'USGS DDS-69' },
    { label: 'Production data', get: (n) => count(n, 'production'), source: 'GOGET / Volve' },
    { label: 'Reserves data', get: (n) => count(n, 'reserves'), source: 'GOGET' },
    { label: 'Wells', get: (n) => count(n, 'wells'), source: 'Volve' },
    { label: 'Well bundle', get: (n) => count(n, 'bundle') },
    { label: 'Well logs', get: (n) => count(n, 'logs'), source: 'Volve' },
  ];

  const facts = CANDIDATES
    .map((row) => ({ ...row, left: row.get(a), right: row.get(b) }))
    .filter((row) => row.left !== '—' || row.right !== '—')
    .map((row) => ({ label: row.label, value: `${row.left}  ·  ${row.right}`, source: row.source }));

  return {
    kind: 'brief',
    headline: `${a.name}  vs  ${b.name}`,
    subhead: a.kind === b.kind ? `Two ${readableKind(a.kind)}s` : `${readableKind(a.kind)} vs ${readableKind(b.kind)}`,
    facts: facts.length ? facts : [{ label: 'Comparable data', value: 'none', note: 'These two share no measured attribute.' }],
    chips: [
      { label: a.name, query: a.name },
      { label: b.name, query: b.name },
    ],
    provenance: [...new Set([...a.sources, ...b.sources])],
    body: a.kind !== b.kind ? 'Different tiers — only the rows both can fill are a fair comparison.' : undefined,
  };
}
