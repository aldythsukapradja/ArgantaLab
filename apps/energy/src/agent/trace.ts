// agent/trace.ts — the reasoning trace, assembled from what actually happened.
//
// THE RULE: every step here corresponds to a real event the pipeline produced.
// Nothing is inferred, embellished, or padded to look like deliberation.
//
// This is deliberately NOT a chain of thought. The model's only job is to pick a
// tool; it never reasons about petroleum, so presenting a narrated monologue
// would be inventing something that did not occur — the same class of untruth as
// a fabricated number. What the pipeline genuinely produces is more interesting
// anyway: which of the five resolver rungs matched, how far off the spelling
// was, whether the capability's data probe passed, and exactly what moved in the
// app as a result.

import type { AnswerCard, TraceStep, TurnTrace } from './types.ts';
import type { TurnFacts } from './dialogue.ts';
import type { GazIndexed } from './gazetteer.ts';
import { CAPABILITY_BY_ID } from './capabilities.ts';

/** Plain-English name for a resolver rung. The internal ids are jargon. */
const STAGE_LABEL: Record<string, string> = {
  exact: 'exact name',
  alias: 'known alias',
  lexical: 'prefix / word match',
  fuzzy: 'spelling-corrected',
  phonetic: 'sounds-like',
};

const readableKind = (kind: string) => kind.replace('-', ' ');

/** How long a step took, when it is worth saying. Sub-millisecond work reports
 *  as "instant" rather than a padded number. */
function ms(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1) return 'instant';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export interface TraceInput {
  facts: TurnFacts;
  card: AnswerCard;
  capabilityId?: string | null;
  commands?: { op: string }[];
  node?: GazIndexed | null;
  /** @arganta/agent's loop trail — model + tool entries, only on the language tier. */
  trail?: Record<string, unknown>[];
  tier: 'lite' | 'core';
  elapsedMs: number;
  /** Set when the language tier was tried and did not produce a usable answer. */
  fellBack?: boolean;
}

/** Fold identical adjacent steps into one row carrying a count.
 *
 *  The loop legitimately calls the same model or the same tool more than once,
 *  and four identical rows tell the reader nothing four times. Folding them into
 *  "×3" keeps every occurrence visible — the count is the real count — while
 *  making the trace readable. Nothing is dropped: a step that happened three
 *  times says so. */
function fold(steps: TraceStep[]): TraceStep[] {
  const out: TraceStep[] = [];
  for (const step of steps) {
    const prev = out[out.length - 1];
    const same = prev && prev.kind === step.kind && prev.label === step.label
      && prev.value.replace(/\s+×\d+$/, '') === step.value && prev.ok === step.ok;
    if (same) {
      const n = (prev.repeat ?? 1) + 1;
      prev.repeat = n;
      prev.value = `${step.value} ×${n}`;
      // Latencies differ per run; the first one is no longer representative.
      if (step.kind === 'tool') prev.detail = prev.detail && step.detail && prev.detail !== step.detail
        ? `${prev.detail} · ${step.detail}` : prev.detail;
      continue;
    }
    out.push({ ...step });
  }
  return out;
}

export function buildTrace(input: TraceInput): TurnTrace {
  const { facts, card, capabilityId, commands = [], node, trail = [], tier, elapsedMs } = input;
  const steps: TraceStep[] = [];

  // ── 1 · how the utterance was read ────────────────────────────────────────
  steps.push({
    kind: 'parse',
    label: 'Read as',
    value: facts.usesFocus ? `${facts.verb} · about the current subject` : facts.verb,
    detail: facts.usesFocus ? 'no entity named' : (facts.query ? `"${facts.query}"` : undefined),
  });

  // ── 2 · the model call, when there genuinely was one ──────────────────────
  for (const entry of trail) {
    if (entry.type !== 'model') continue;
    const provider = typeof entry.provider === 'string' ? entry.provider : 'unknown';
    const model = typeof entry.model === 'string' ? entry.model : '';
    const cost = typeof entry.costUsd === 'number' && entry.costUsd > 0 ? `$${entry.costUsd.toFixed(4)}` : undefined;
    steps.push({
      kind: 'model',
      label: 'Tool chosen by',
      value: model ? `${provider} · ${model}` : provider,
      detail: cost,
    });
  }

  // ── 3 · which entity, and how it was settled ──────────────────────────────
  const r = facts.resolution;
  if (r) {
    if (r.status === 'none') {
      steps.push({ kind: 'resolve', label: 'Resolved', value: 'no match in the catalogue', ok: false });
    } else if (r.status === 'ambiguous') {
      steps.push({
        kind: 'resolve',
        label: 'Resolved',
        value: `${r.candidates?.length ?? 0} entities share that name`,
        detail: r.candidates?.slice(0, 3).join(' · '),
        ok: false,
      });
    } else if (r.nodeName) {
      const stage = r.stage ? (STAGE_LABEL[r.stage] ?? r.stage) : undefined;
      const parts = [stage, typeof r.distance === 'number' && r.distance > 0 ? `${r.distance} character${r.distance === 1 ? '' : 's'} off` : null]
        .filter(Boolean).join(' · ');
      steps.push({
        kind: 'resolve',
        label: 'Resolved',
        value: `${r.nodeName}${r.nodeKind ? ` (${readableKind(r.nodeKind)})` : ''}`,
        detail: parts || undefined,
        ok: true,
      });
    }
  } else if (facts.usesFocus) {
    steps.push({ kind: 'resolve', label: 'Subject', value: 'carried over from the previous turn' });
  }

  // ── 4 · capability + whether its data probe passed ────────────────────────
  if (capabilityId) {
    const capability = CAPABILITY_BY_ID.get(capabilityId);
    const refused = card.kind === 'absence';
    steps.push({
      kind: 'capability',
      label: refused ? 'Refused' : 'Capability',
      value: capability?.label ?? capabilityId,
      detail: refused ? 'data probe failed — nothing to show' : capabilityId,
      ok: !refused,
    });
  }

  // ── 5 · what the catalogue actually holds ─────────────────────────────────
  if (node && !['error', 'clarify'].includes(card.kind)) {
    const present = Object.entries(node.has ?? {})
      .filter(([, v]) => (typeof v === 'number' ? v > 0 : v === true))
      .map(([k]) => k);
    if (present.length) {
      steps.push({
        kind: 'data',
        label: 'Data on record',
        value: `${present.length} attribute${present.length === 1 ? '' : 's'}`,
        detail: present.slice(0, 6).join(' · ') + (present.length > 6 ? ' …' : ''),
      });
    }
  }

  // ── 6 · real tool executions inside the loop ──────────────────────────────
  for (const entry of trail) {
    if (entry.type !== 'tool') continue;
    const name = typeof entry.name === 'string' ? entry.name : 'tool';
    const latency = typeof entry.latencyMs === 'number' ? ms(entry.latencyMs) : '';
    const blocked = entry.blocked ? String(entry.blocked) : null;
    steps.push({
      kind: 'tool',
      label: blocked ? 'Tool blocked' : 'Tool ran',
      value: name,
      detail: blocked ?? latency,
      ok: !blocked && entry.ok !== false,
    });
  }

  // ── 7 · what actually moved in the app ────────────────────────────────────
  if (commands.length) {
    const label: Record<string, string> = { scope: 'set scope', view: 'opened surface', map: 'flew the map', clear: 'cleared scope' };
    steps.push({
      kind: 'action',
      label: 'Applied',
      value: `${commands.length} action${commands.length === 1 ? '' : 's'}`,
      detail: commands.map((c) => label[c.op] ?? c.op).join(' · '),
    });
  } else if (['absence', 'clarify', 'error'].includes(card.kind)) {
    // Saying nothing moved is itself a meaningful, deliberate outcome.
    steps.push({ kind: 'note', label: 'Applied', value: 'nothing — the app was left where it was', ok: true });
  }

  if (input.fellBack) {
    steps.push({
      kind: 'note',
      label: 'Fell back',
      value: 'answered by the deterministic tier',
      detail: 'the language tier returned no usable tool call',
    });
  }

  return { steps: fold(steps), tier, ms: elapsedMs };
}
