// agent/dialogue.ts — the turn machine (L5).
//
// A small EXPLICIT state machine, not free-form memory. It owns three things the
// layers below deliberately do not:
//
//   focus    what "it", "there" and "the logs" refer to
//   ladder   the breadcrumb the drill-down walks (Indonesia › Kutei › Badak)
//   pending  the one question the agent is waiting on an answer to
//
// `respond()` is pure: same turn + same text → same result. The caller applies
// the returned commands to the bus and stores the returned turn. That is what
// makes multi-turn transcripts testable in plain Node, and it is the same entry
// point the Cloudflare worker tier will call once it replaces the grammar.

import type { AgentPlan, AnswerCard, GazIndexed, Scope } from './types.ts';
import type { GazIndex } from './gazetteer.ts';
import { ancestryOf } from './gazetteer.ts';
import type { Candidate } from './resolve.ts';
import { resolve } from './resolve.ts';
import type { Intent } from './grammar.ts';
import { parse } from './grammar.ts';
import {
  ambiguityCard, buildPlan, comparisonCard, correctionCard, drillDownChips, readableKind, unresolvedCard,
} from './plan.ts';

export type Pending =
  | { kind: 'disambiguate'; candidates: Candidate[]; forIntent: Intent; query: string }
  | { kind: 'confirm-correction'; node: GazIndexed; from: string; forIntent: Intent }
  | { kind: 'drill-down'; parent: GazIndexed; childKind: string; options: GazIndexed[] };

export interface TurnRecord {
  text: string;
  cardKind: AnswerCard['kind'];
  nodeId: string | null;
  capabilityId: string | null;
}

export interface Turn {
  focus: GazIndexed | null;
  ladder: GazIndexed[];
  pending: Pending | null;
  history: TurnRecord[];
}

export interface TurnResult {
  turn: Turn;
  card: AnswerCard;
  /** Commands for the bus. Empty on a question, an absence or a failure — the
   *  agent must never navigate while it is still unsure what was asked. */
  commands: AgentPlan['commands'];
  plan: AgentPlan | null;
}

export function newTurn(): Turn {
  return { focus: null, ladder: [], pending: null, history: [] };
}

// ── small parsers for answering the agent's own questions ────────────────────

const YES = new Set(['y', 'yes', 'yeah', 'yep', 'yup', 'correct', 'right', 'ok', 'okay', 'sure', 'confirm', 'that one', 'do it']);
const NO = new Set(['n', 'no', 'nope', 'wrong', 'nah', 'cancel', 'never mind', 'nevermind']);
const ORDINALS: Record<string, number> = {
  first: 0, '1': 0, '1st': 0, second: 1, '2': 1, '2nd': 1, third: 2, '3': 2, '3rd': 2,
  fourth: 3, '4': 3, '4th': 3, fifth: 4, '5': 4, '5th': 4,
};

const clean = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();

/**
 * Match a reply against a list the agent just offered.
 *
 * Substring matching is restricted to SHORT replies. Without that guard,
 * "compare volve and badak" typed while a field list was on screen matched
 * VOLVE by substring and silently became "open Volve" — the pending offer ate a
 * completely different question. A rung is answered with a name, not a sentence.
 */
const MAX_OFFER_REPLY_WORDS = 4;

function pickFromOffer(text: string, options: GazIndexed[]): GazIndexed | null {
  const t = clean(text);
  if (!t) return null;
  if (t in ORDINALS) return options[ORDINALS[t]] ?? null;
  const exact = options.find((o) => clean(o.name) === t || clean(o.displayName) === t);
  if (exact) return exact;
  if (t.split(' ').length > MAX_OFFER_REPLY_WORDS) return null;
  const partial = options.filter((o) => clean(o.name).includes(t) || t.includes(clean(o.name)));
  return partial.length === 1 ? partial[0] : null;
}

// ── ladder ───────────────────────────────────────────────────────────────────

/** Rebuild the breadcrumb around a new focus. Ancestors come from the graph, so
 *  the ladder can never claim a containment the data does not assert. */
function ladderFor(index: GazIndex, node: GazIndexed): GazIndexed[] {
  return [...ancestryOf(index, node), node];
}

// ── the machine ──────────────────────────────────────────────────────────────

export function respond(index: GazIndex, turn: Turn, text: string, scope: Scope): TurnResult {
  const ctx = { index, scope };
  const intent = parse(text);

  // ── 1 · are we waiting on an answer? ───────────────────────────────────────
  // Only a BARE reply can answer a pending question. "compare volve and badak"
  // typed while a field list is on screen is a new question that happens to
  // contain an offered name — letting the rung claim it silently turned a
  // comparison into "open Volve". If the utterance names a capability or a
  // second entity, it is a fresh query, full stop.
  const isBareReply = intent.verb === 'brief' && !intent.capabilityIds.length && !intent.secondEntityQuery;
  if (turn.pending && isBareReply) {
    const answered = answerPending(index, turn, text, ctx);
    if (answered) return answered;
    // Not an answer after all — fall through and treat it as a fresh query
    // rather than nagging.
  }

  // A stray "yes" with nothing pending must not be resolved as an entity. It
  // matched a GOGET field called "Yeso, West" — an answer so confidently wrong
  // it would undermine every correct one.
  const bare = clean(text);
  if (!turn.pending && (YES.has(bare) || NO.has(bare))) {
    const card: AnswerCard = {
      kind: 'clarify',
      headline: 'Nothing to confirm',
      facts: [],
      chips: [],
      provenance: ['ArgantaEnergy catalogue'],
      body: 'I had not asked you anything. Name a basin, country, field or well.',
    };
    return {
      turn: { ...turn, history: [...turn.history, { text, cardKind: card.kind, nodeId: null, capabilityId: null }].slice(-24) },
      card,
      commands: [],
      plan: null,
    };
  }

  return runIntent(index, turn, intent, text, scope);
}

/**
 * Execute an already-parsed intent.
 *
 * Split out from `respond` so the Cloudflare worker tier can enter here: a tool
 * call from the model is converted to an Intent by toolCallToIntent() and then
 * runs through EXACTLY this path. That is the structural guarantee that the
 * language tier can never do anything the deterministic tier cannot — there is
 * only one implementation of "do the thing".
 */
export function runIntent(index: GazIndex, turn: Turn, intent: Intent, text: string, scope: Scope): TurnResult {
  const ctx = { index, scope };
  const record = (next: Turn, card: AnswerCard, nodeId: string | null, capabilityId: string | null): Turn => ({
    ...next,
    history: [...turn.history, { text, cardKind: card.kind, nodeId, capabilityId }].slice(-24),
  });

  // ── 2 · comparison is its own path ────────────────────────────────────────
  if (intent.verb === 'compare' && intent.secondEntityQuery) {
    const left = intent.usesFocus ? turn.focus : pick(index, intent.entityQuery, scope);
    const right = pick(index, intent.secondEntityQuery, scope);
    if (!left || !right) {
      const missing = !left ? (intent.entityQuery || 'the first item') : intent.secondEntityQuery;
      const card = unresolvedCard(missing, right && !left ? [] : []);
      return { turn: record({ ...turn, pending: null }, card, null, null), card, commands: [], plan: null };
    }
    const card = comparisonCard(left, right);
    const next: Turn = { ...turn, focus: left, ladder: ladderFor(index, left), pending: null };
    return { turn: record(next, card, left.id, null), card, commands: [], plan: null };
  }

  // ── 3 · which entity? ─────────────────────────────────────────────────────
  if (intent.usesFocus) {
    if (!turn.focus) {
      const card: AnswerCard = {
        kind: 'clarify',
        headline: 'Which one?',
        facts: [],
        chips: [],
        provenance: ['ArgantaEnergy catalogue'],
        body: 'You referred to something we have not talked about yet. Name a basin, country, field or well.',
      };
      return { turn: record({ ...turn, pending: null }, card, null, null), card, commands: [], plan: null };
    }
    return runOn(index, turn, turn.focus, intent, ctx, record);
  }

  const resolution = resolve(index, intent.entityQuery, { scope });

  if (resolution.status === 'none') {
    const card = unresolvedCard(intent.entityQuery, resolution.suggestions);
    return { turn: record({ ...turn, pending: null }, card, null, null), card, commands: [], plan: null };
  }

  if (resolution.status === 'ambiguous') {
    const card = ambiguityCard(intent.entityQuery, resolution.candidates);
    const next: Turn = {
      ...turn,
      pending: { kind: 'disambiguate', candidates: resolution.candidates, forIntent: intent, query: intent.entityQuery },
    };
    return { turn: record(next, card, null, null), card, commands: [], plan: null };
  }

  if (resolution.status === 'corrected' && !resolution.autoApply) {
    // Too far from what was typed to act on. Getting the wrong basin quietly is
    // worse than one extra click.
    const card = correctionCard(resolution.from, resolution.node, resolution.alternates);
    const next: Turn = {
      ...turn,
      pending: { kind: 'confirm-correction', node: resolution.node, from: resolution.from, forIntent: intent },
    };
    return { turn: record(next, card, null, null), card, commands: [], plan: null };
  }

  const interpretation = resolution.status === 'corrected'
    ? { from: resolution.from, to: resolution.node.name, reason: `interpreted as ${resolution.node.displayName}` }
    : undefined;
  return runOn(index, turn, resolution.node, intent, ctx, record, interpretation);
}

// ── running a capability against a settled entity ────────────────────────────

function runOn(
  index: GazIndex,
  turn: Turn,
  node: GazIndexed,
  intent: Intent,
  ctx: { index: GazIndex; scope: Scope },
  record: (next: Turn, card: AnswerCard, nodeId: string | null, capabilityId: string | null) => Turn,
  interpretation?: AgentPlan['interpretation'],
): TurnResult {
  const plan = buildPlan(node, intent, ctx);
  if (interpretation) plan.interpretation = interpretation;

  // A refusal or a clarification must not move the app. Only a real answer does.
  const navigates = plan.commands.length > 0;
  const next: Turn = {
    ...turn,
    focus: node,
    ladder: ladderFor(index, node),
    pending: null,
  };

  // If the answer offered a rung, remember what was offered so a bare reply
  // ("badak", "the second one") can be matched against it next turn.
  const rung = drillDownChips(node, ctx);
  if (rung && plan.card.chips.length) {
    next.pending = { kind: 'drill-down', parent: node, childKind: rung.childKind, options: rung.options };
  }

  return {
    turn: record(next, plan.card, node.id, plan.capabilityId ?? null),
    card: plan.card,
    commands: navigates ? plan.commands : [],
    plan,
  };
}

// ── answering the agent's own question ───────────────────────────────────────

function answerPending(
  index: GazIndex,
  turn: Turn,
  text: string,
  ctx: { index: GazIndex; scope: Scope },
): TurnResult | null {
  const pending = turn.pending!;
  const t = clean(text);
  const record = (next: Turn, card: AnswerCard, nodeId: string | null): Turn => ({
    ...next,
    history: [...turn.history, { text, cardKind: card.kind, nodeId, capabilityId: null }].slice(-24),
  });

  if (pending.kind === 'confirm-correction') {
    if (YES.has(t)) {
      return runOn(index, { ...turn, pending: null }, pending.node, pending.forIntent, ctx,
        (next, card, nodeId) => record(next, card, nodeId),
        { from: pending.from, to: pending.node.name, reason: 'confirmed' });
    }
    if (NO.has(t)) {
      const card: AnswerCard = {
        kind: 'clarify',
        headline: 'Understood — what did you mean?',
        facts: [],
        chips: [],
        provenance: ['ArgantaEnergy catalogue'],
        body: `I could not find "${pending.from}". Try the full name, or a country to browse from.`,
      };
      return { turn: record({ ...turn, pending: null }, card, null), card, commands: [], plan: null };
    }
    // The user named it outright instead of answering yes/no.
    const direct = pickFromOffer(text, [pending.node]);
    if (direct) {
      return runOn(index, { ...turn, pending: null }, direct, pending.forIntent, ctx,
        (next, card, nodeId) => record(next, card, nodeId));
    }
    return null;
  }

  if (pending.kind === 'disambiguate') {
    const chosen = pickFromOffer(text, pending.candidates.map((c) => c.node));
    if (!chosen) return null;
    return runOn(index, { ...turn, pending: null }, chosen, pending.forIntent, ctx,
      (next, card, nodeId) => record(next, card, nodeId));
  }

  // drill-down: a bare name or ordinal answers "Which field?". Anything else is
  // a new question, and the rung is simply abandoned.
  const chosen = pickFromOffer(text, pending.options);
  if (!chosen) return null;
  return runOn(index, { ...turn, pending: null }, chosen, parse(chosen.name), ctx,
    (next, card, nodeId) => record(next, card, nodeId));
}

// ── helpers ──────────────────────────────────────────────────────────────────

function pick(index: GazIndex, query: string, scope: Scope): GazIndexed | null {
  if (!query) return null;
  const r = resolve(index, query, { scope });
  return r.status === 'exact' || r.status === 'corrected' ? r.node : null;
}

/** Breadcrumb text for the chat header: "Indonesia › Kutei Basin › Badak". */
export function ladderLabel(turn: Turn, sep = ' › '): string {
  return turn.ladder.map((n) => n.name).join(sep);
}

/** What the agent is currently waiting for, in words. Empty when nothing. */
export function pendingLabel(turn: Turn): string {
  if (!turn.pending) return '';
  if (turn.pending.kind === 'confirm-correction') return `confirm: ${turn.pending.node.name}?`;
  if (turn.pending.kind === 'disambiguate') return `choose one of ${turn.pending.candidates.length}`;
  return `pick a ${readableKind(turn.pending.childKind)}`;
}
