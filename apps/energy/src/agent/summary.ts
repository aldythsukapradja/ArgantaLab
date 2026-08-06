// agent/summary.ts — the closing line under an answer.
//
// A card is a good answer and a bad ending. It shows you eight facts and leaves
// you to work out which one mattered. This writes the sentence a colleague would
// say as they slid the page across the desk: what you're looking at, the one or
// two figures that carry the decision, and the caveat you'd resent finding later.
//
// THE CONSTRAINT that makes this safe: every numeral in the output must already
// appear on the card. That is not a convention here, it is enforced — the
// finished sentence is run through the SAME grounding guard that polices the
// language model's prose (guard.ts), and a summary that fails is discarded
// rather than shown. The writer of the summary gets no more trust than the LLM.

import type { AnswerCard, TurnTrace } from './types.ts';
import type { TurnFacts } from './dialogue.ts';
import { ungroundedNumbers } from './guard.ts';

/** Facts worth leading with, in the order a reader would want them. Anything
 *  not listed still qualifies — this only decides what gets promoted first.
 *
 *  Matched on WORD BOUNDARIES, which is not fussiness: substring matching made
 *  "Undiscovered oil (mean)" rank as high as a booked "Discovered" volume, and
 *  a screening-scale mean is not the number you lead a field review with. */
const HEADLINE_FACTS = [
  'stooip', 'stoiip', 'recoverable', 'reserves', 'cumulative', 'recovery factor',
  'discovered', 'status', 'operator', 'fields', 'wells', 'basins', 'producing',
  'water depth', 'area',
];

function rank(label: string): number {
  const key = label.toLowerCase();
  const i = HEADLINE_FACTS.findIndex((h) => new RegExp(`(^|[^a-z])${h}([^a-z]|$)`).test(key));
  return i === -1 ? HEADLINE_FACTS.length : i;
}

/** A fact carries a figure when its value actually contains one. Splitting on
 *  this stops "Country Norway" being announced as a number that matters. */
const isFigure = (value: string) => /\d/.test(value);

/** Lowercase a label for mid-sentence use WITHOUT flattening acronyms —
 *  "USGS region" must not become "usgs region". Only the leading word is
 *  touched, and only when it is not already an acronym. */
const softLabel = (label: string) =>
  (/^[A-Z]{2,}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

/** Figure values are often a headline plus a manifest — "27 wells · logs,
 *  trajectory, pressure, drilling". The summary quotes the headline; the card
 *  right above it still carries the whole thing. */
const shortValue = (value: string) => value.split(' · ')[0].trim();

/** Values that say "we have nothing" — real on a card, useless in a sentence. */
const EMPTY = new Set(['', '—', '-', 'n/a', 'na', 'none', 'no', 'unknown']);

/** First sentence of a note. The notes are written to be read next to the
 *  figure; in a summary only the head of them earns its space. */
const firstSentence = (note: string) => {
  const cut = note.split(/(?<=[.;])\s/)[0] ?? note;
  return cut.replace(/[.;]\s*$/, '');
};

/** Counts the summary works out for itself are spelled, never digitised.
 *
 *  The grounding guard rejects any numeral not already on the card, and that
 *  rule is worth more than the convenience of an exception for "my own" numbers
 *  — an exception is exactly the crack a wrong figure slips through later. So
 *  derived counts become words and stay inside the rule. */
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const spell = (n: number) => (n >= 0 && n < WORD.length ? WORD[n] : 'more than a dozen');

/** Join with an Oxford-free "and" — reads as speech, not as a bullet list. */
function series(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export interface Summary {
  /** The sentence. Empty when nothing honest could be said. */
  text: string;
  /** Why it is empty, when it is — kept for tests and for the console, never
   *  shown as if it were an answer. */
  skipped?: 'ungrounded' | 'nothing-to-say';
}

export function summarise(card: AnswerCard, facts: TurnFacts, trace?: TurnTrace): Summary {
  const sentences: string[] = [];
  const subject = card.headline?.trim();

  // ── the caveat cards say their piece and stop ──────────────────────────────
  if (card.kind === 'absence') {
    const what = card.subhead || 'that';
    sentences.push(`Nothing to show — ${what.charAt(0).toLowerCase()}${what.slice(1)}.`);
    sentences.push('The catalogue is thin here rather than the question being wrong; the chips below are what it does hold.');
    return finish(sentences, card);
  }

  if (card.kind === 'clarify') {
    const r = facts.resolution;
    const n = r?.candidates?.length ?? 0;
    // A correction awaiting confirmation is the commonest clarify, and it is
    // the one where saying nothing is worst: the user needs to see the swap
    // being proposed before they agree to it.
    if (r?.status === 'corrected' && r.nodeName && facts.query) {
      sentences.push(`"${facts.query}" is not in the catalogue, but ${r.nodeName} is — ${spell(r.distance ?? 1)} character${(r.distance ?? 1) === 1 ? '' : 's'} apart.`);
      sentences.push('Confirm and I will open it; nothing has moved yet.');
    } else if (n > 1) {
      sentences.push(`That name is shared by ${spell(n)} places in the catalogue, so I have not picked one for you.`);
    } else {
      sentences.push('I need one more word before I can pick the right record.');
    }
    return finish(sentences, card);
  }

  if (card.kind === 'error') {
    sentences.push('That one did not go through. Nothing in the app was changed.');
    return finish(sentences, card);
  }

  // ── what you are looking at ────────────────────────────────────────────────
  const corrected = facts.resolution?.status === 'corrected'
    || (facts.resolution?.stage && ['fuzzy', 'phonetic'].includes(facts.resolution.stage));
  if (corrected && facts.query && subject) {
    sentences.push(`Read "${facts.query}" as ${subject}${card.subhead ? ` — ${card.subhead}` : ''}.`);
  } else if (subject) {
    sentences.push(card.subhead ? `${subject} — ${card.subhead}.` : `${subject}.`);
  }

  // ── the figures that carry the decision ────────────────────────────────────
  // A fact whose value is already in the headline or subhead adds nothing —
  // "Figures — Kutei Basin — 5 public-domain figures. Key figures — 5." is a
  // sentence that costs the reader time and returns none of it.
  const said = `${card.headline ?? ''} ${card.subhead ?? ''}`.toLowerCase();
  // Two different emptinesses, and conflating them produced a flat lie: on the
  // figures card the ONLY fact is the count, the subhead already says it, so
  // everything got filtered as redundant and the "no figures worth quoting"
  // fallback fired underneath five visible figures. `hasAnyFact` remembers that
  // the card was never empty -- it was already fully said.
  const stated = card.facts.filter((f) => f.value && !EMPTY.has(f.value.trim().toLowerCase()));
  const hasAnyFact = stated.length > 0;
  const usable = stated.filter((f) => !said.includes(shortValue(f.value).toLowerCase()));
  const ordered = [...usable].sort((a, b) => rank(a.label) - rank(b.label));
  const figures = ordered.filter((f) => isFigure(f.value)).slice(0, 3);
  const attributes = ordered.filter((f) => !isFigure(f.value)).slice(0, 2);

  if (figures.length) {
    sentences.push(`Key figures — ${series(figures.map((f) => `${softLabel(f.label)} ${shortValue(f.value)}`))}.`);
  }
  if (attributes.length) {
    sentences.push(`${series(attributes.map((f) => `${softLabel(f.label)} ${shortValue(f.value)}`))}.`
      .replace(/^[a-z]/, (c) => c.toUpperCase()));
  }
  // Only when the card genuinely holds nothing -- never when its facts were
  // dropped as already-said. A summary must not contradict the card above it.
  if (subject && !hasAnyFact) {
    sentences.push('The record exists but carries no figures worth quoting.');
  }

  // ── the caveat you would resent finding later ──────────────────────────────
  const shown = [...figures, ...attributes];
  const derived = shown.filter((f) => f.note && (!f.source || f.source === 'derived'));
  if (derived.length === 1) {
    sentences.push(`One of those is derived rather than measured — ${softLabel(derived[0].label)}: ${firstSentence(derived[0].note!)}.`);
  } else if (derived.length > 1) {
    sentences.push(`${spell(derived.length).replace(/^./, (c) => c.toUpperCase())} of those are derived rather than measured; the notes on the card say how.`);
  }

  // Provenance is counted from what the facts THEMSELVES cite, not from the
  // card's badge strip — the strip can lag, and "single source" is a claim
  // that has to be true of the numbers on screen, not of a decorative row.
  //
  // It is also advice about corroborating an ANALYSIS. A card quoting a single
  // count has no analysis to corroborate, and the caution there is just noise.
  const cited = new Set(shown.map((f) => f.source).filter((x): x is string => !!x && x !== 'derived'));
  if (cited.size === 1 && shown.length > 1) {
    sentences.push(`Everything quoted above rests on one source, ${[...cited][0]} — worth a second before it goes in a deck.`);
  }

  // ── what the app did about it ──────────────────────────────────────────────
  const applied = trace?.steps.find((s) => s.kind === 'action');
  if (applied?.detail) sentences.push(`${applied.detail.charAt(0).toUpperCase()}${applied.detail.slice(1)} to match.`);

  return finish(sentences, card);
}

/** The gate. A summary that smuggles in a number the card does not carry is
 *  thrown away whole — exactly as an ungrounded sentence from the model is. */
function finish(sentences: string[], card: AnswerCard): Summary {
  const text = sentences.filter(Boolean).join(' ').replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
  if (!text) return { text: '', skipped: 'nothing-to-say' };
  const bad = ungroundedNumbers(text, card);
  if (bad.length) {
    // eslint-disable-next-line no-console
    console.warn('[agent] discarded ungrounded summary', bad);
    return { text: '', skipped: 'ungrounded' };
  }
  return { text };
}
