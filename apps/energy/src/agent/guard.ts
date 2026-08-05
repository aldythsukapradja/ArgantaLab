// agent/guard.ts — the grounding guard (W5).
//
// The Worker's system prompt FORBIDS the model from stating petroleum facts; it
// may only call a tool or ask a one-line question. This is the enforcement, on
// the client, after the fact — because a prompt is a request and a check is a
// guarantee.
//
// The rule: any number in the model's prose must already appear in the card the
// tool produced, or in what the user themselves typed. A number from nowhere is
// a hallucination, and in this domain a hallucinated STOIIP is a real
// consequence, so the prose is DISCARDED rather than cleaned up. The card is
// always shown regardless — it was built by deterministic code from local files.

import type { AnswerCard } from './types.ts';

/** Numbers, with thousands separators and decimals, as written. */
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

const normalise = (raw: string): string => raw.replace(/,/g, '').replace(/\.0+$/, '');

/** Every number that legitimately appears in a card, in normalised form. */
export function cardNumbers(card: AnswerCard | null): Set<string> {
  const out = new Set<string>();
  if (!card) return out;
  const text = JSON.stringify(card);
  for (const match of text.match(NUMBER) ?? []) out.add(normalise(match));
  return out;
}

/**
 * Numbers in `text` that are grounded in neither the card nor the user's own
 * words. Small integers (0–12) are allowed through: they are overwhelmingly
 * counts, list positions and ordinals the model is entitled to say ("the first
 * three"), and treating them as claims produces constant false positives.
 */
export function ungroundedNumbers(text: string, card: AnswerCard | null, userText = ''): string[] {
  const allowed = cardNumbers(card);
  for (const match of userText.match(NUMBER) ?? []) allowed.add(normalise(match));

  const out: string[] = [];
  for (const match of text.match(NUMBER) ?? []) {
    const value = normalise(match);
    if (allowed.has(value)) continue;
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 12) continue;
    out.push(match);
  }
  return out;
}

export interface GuardResult {
  /** Prose safe to show. Empty when the model's text was discarded. */
  text: string;
  /** What tripped the guard, for the console and the run log. */
  violations: string[];
  discarded: boolean;
}

/**
 * Gate the model's prose. On any violation the whole utterance is dropped —
 * partial redaction would leave a sentence that reads as authoritative while
 * missing the very number that made it wrong.
 */
export function enforceGrounding(text: string, card: AnswerCard | null, userText = ''): GuardResult {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { text: '', violations: [], discarded: false };

  const violations = ungroundedNumbers(trimmed, card, userText);
  if (violations.length) {
    return { text: '', violations, discarded: true };
  }
  return { text: trimmed, violations: [], discarded: false };
}

/** A one-line, number-free summary of a card — what the MODEL is allowed to see
 *  as a tool result. It never receives the card's figures, so it has nothing to
 *  restate and nothing to get wrong. */
export function toolSummary(card: AnswerCard): string {
  const kind = card.kind === 'absence' ? 'no data'
    : card.kind === 'clarify' ? 'needs clarification'
      : card.kind === 'error' ? 'not found'
        : 'shown to the user';
  return `${card.headline} — ${kind}. The card is already rendered; do not restate it.`;
}
