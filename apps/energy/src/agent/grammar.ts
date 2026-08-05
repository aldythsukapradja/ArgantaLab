// agent/grammar.ts — the deterministic intent parser (L4).
//
// THIS IS THE ONLY LAYER THE CLOUDFLARE WORKER REPLACES. Everything below it
// (resolver, capabilities, planner, bus) is identical in both tiers, which is
// what makes the language upgrade cheap and the fallback safe: if the worker is
// down, unpaid or rate-limited, this file still answers.
//
// A query is `[verb] [capability phrase] [entity]`, any part optional:
//
//   "show me kutei basin"          verb=show                    entity=kutei basin
//   "kutei basin"                  (bare entity → brief)        entity=kutei basin
//   "give me insight about indonesia"   phrase=insight          entity=indonesia
//   "list fields in kutei basin"   phrase=list fields           entity=kutei basin
//   "show me the logs"             phrase=logs                  entity=<focus>
//   "compare volve and ekofisk"    verb=compare  entity=volve   second=ekofisk
//
// The capability registry IS the lexicon: every `Capability.phrases` entry is a
// trigger, so adding a capability adds language for free and the two can never
// drift. The parser does NOT decide which capability runs — several share the
// word "overview" — it returns the candidate set and the planner intersects it
// with what the resolved entity actually supports.

import { CAPABILITIES } from './capabilities.ts';
import { fold } from './gazetteer.ts';

export type Verb = 'show' | 'brief' | 'list' | 'compare' | 'locate' | 'explain' | 'help';

export interface Intent {
  verb: Verb;
  /** Capabilities whose phrase matched. Empty means "no capability named". */
  capabilityIds: string[];
  /** Text the resolver should turn into an entity. Empty means "use the focus". */
  entityQuery: string;
  /** Second entity, for comparisons. */
  secondEntityQuery?: string;
  /** True when the query referred to the current subject rather than naming one. */
  usesFocus: boolean;
  matchedPhrase?: string;
  confidence: number;
  /** The whole utterance, folded but with nothing cut out.
   *
   *  The parser has no catalogue, so it cannot know that a word it is about to
   *  treat as a capability phrase is really part of a name. "Khuff Formation"
   *  lost its kind word to the `formation` phrase and the bare "Khuff" then
   *  matched a FIELD of that name — an exact catalogue entry beaten by a guess.
   *  Keeping the original lets the resolver, which does have the catalogue,
   *  check for an exact name before trusting the cut. */
  fullQuery: string;
}

// ── lexicon ──────────────────────────────────────────────────────────────────

/** Verb → the phrases that mean it, longest first at match time. */
const VERBS: [Verb, string[]][] = [
  ['compare', ['compare with', 'compare to', 'compare', 'versus', ' vs ', 'benchmark against', 'against']],
  ['locate', ['where is', 'where are', 'locate', 'find me', 'find']],
  ['brief', ['give me insight about', 'give me insight on', 'give me insight', 'tell me about',
    'what do you have on', 'what do you know about', 'what can you tell me about',
    'insight about', 'insight on', 'brief me on', 'summarise', 'summarize', 'insight', 'brief', 'about']],
  ['list', ['how many', 'list all', 'list', 'which', 'what are', 'show all']],
  ['help', ['what can you do', 'what can you show', 'help me', 'help']],
  ['explain', ['explain', 'why is', 'why', 'what is']],
  ['show', ['take me to', 'show me the', 'show me', 'display', 'open', 'go to', 'fly to', 'zoom to', 'show', 'map']],
];

/** Words that carry no entity signal once the verb and phrase are removed. */
const FILLER = new Set([
  'me', 'the', 'a', 'an', 'my', 'our', 'please', 'some', 'any', 'all',
  'for', 'of', 'in', 'on', 'at', 'from', 'about', 'with', 'to', 'and',
  'is', 'are', 'was', 'were', 'do', 'does', 'you', 'have', 'has', 'got',
  'data', 'info', 'information', 'give', 'get', 'want', 'need', 'look', 'see',
  // Interrogatives left over once the verb and capability phrase are removed.
  // Without these, "what about that basin" keeps "what" and stops looking like
  // the anaphoric reference it plainly is.
  'what', 'which', 'how', 'who', 'when', 'can', 'could', 'would', 'should', 'tell',
]);

/** Anaphora — "it", "that basin", "there". Bind to the dialogue's current focus. */
const FOCUS_WORDS = new Set([
  'it', 'its', 'this', 'that', 'there', 'them', 'these', 'those', 'here',
  'this one', 'that one',
]);
const FOCUS_NOUNS = new Set([
  'basin', 'field', 'country', 'well', 'wellbore', 'province', 'region',
  'formation', 'company', 'area', 'one', 'place', 'asset',
]);

/** phrase → capability ids, longest phrase first so "list fields" beats "fields". */
const PHRASE_INDEX: { phrase: string; words: number; ids: string[] }[] = (() => {
  const map = new Map<string, string[]>();
  for (const capability of CAPABILITIES) {
    for (const phrase of capability.phrases) {
      const key = fold(phrase);
      if (!key) continue;
      const bucket = map.get(key);
      if (bucket) bucket.push(capability.id); else map.set(key, [capability.id]);
    }
  }
  return [...map.entries()]
    .map(([phrase, ids]) => ({ phrase, words: phrase.split(' ').length, ids }))
    .sort((a, b) => b.words - a.words || b.phrase.length - a.phrase.length);
})();

// ── helpers ──────────────────────────────────────────────────────────────────

/** Remove `needle` from `haystack` on whole-word boundaries. Returns null when
 *  it is not present as complete words — so "map" never matches "Mapia Rise". */
function cutPhrase(haystack: string, needle: string): string | null {
  const h = ` ${haystack} `;
  const n = ` ${needle.trim()} `;
  const at = h.indexOf(n);
  if (at < 0) return null;
  return `${h.slice(0, at)} ${h.slice(at + n.length)}`.replace(/\s+/g, ' ').trim();
}

function stripFiller(text: string): string {
  return text.split(' ').filter((w) => w && !FILLER.has(w)).join(' ').trim();
}

/** True when what is left of the query only referred back to the subject. */
function isFocusReference(text: string): boolean {
  const words = text.split(' ').filter(Boolean);
  if (!words.length) return false;
  return words.every((w) => FOCUS_WORDS.has(w) || FOCUS_NOUNS.has(w));
}

// ── the parser ───────────────────────────────────────────────────────────────

/**
 * Parse one utterance. Never throws; an unparseable query returns a single
 * `help` intent with whatever entity text survived, which is what lets the
 * fallback card be entity-specific rather than a shrug.
 */
export function parse(query: string): Intent {
  const original = fold(query);
  if (!original) {
    return { verb: 'help', capabilityIds: [], entityQuery: '', usesFocus: false, confidence: 0, fullQuery: '' };
  }

  let rest = original;
  let verb: Verb | null = null;
  let matchedPhrase: string | undefined;
  let capabilityIds: string[] = [];
  let confidence = 0.4;

  // 1 · comparison is structural, so it is detected before anything is removed.
  const comparison = splitComparison(rest);

  // 2 · capability phrase — longest match wins ("list fields" over "fields").
  for (const entry of PHRASE_INDEX) {
    const cut = cutPhrase(rest, entry.phrase);
    if (cut === null) continue;
    // A single filler-ish word is only a capability trigger when something else
    // remains; "map" alone is a verb, "map of kutei" names the capability.
    capabilityIds = entry.ids;
    matchedPhrase = entry.phrase;
    rest = cut;
    confidence = 0.75 + Math.min(entry.words, 3) * 0.05;
    break;
  }

  // 3 · verb — longest phrase first within each verb.
  for (const [candidate, phrases] of VERBS) {
    let hit = false;
    for (const phrase of phrases.slice().sort((a, b) => b.length - a.length)) {
      const cut = cutPhrase(rest, phrase.trim());
      if (cut === null) continue;
      rest = cut;
      hit = true;
      break;
    }
    if (hit) { verb = candidate; break; }
  }

  // 4 · what is left, minus filler, is the entity.
  const remainder = stripFiller(rest);
  const usesFocus = remainder === '' || isFocusReference(remainder);
  const entityQuery = usesFocus ? '' : remainder;

  // 5 · defaults. A bare entity is a brief — the single most common real query,
  // and it must work with no verb at all.
  if (!verb) verb = capabilityIds.length ? 'show' : 'brief';
  if (!capabilityIds.length && verb === 'brief') confidence = entityQuery ? 0.7 : 0.5;

  if (comparison) {
    return {
      verb: 'compare',
      capabilityIds: [],
      entityQuery: comparison[0],
      secondEntityQuery: comparison[1],
      usesFocus: comparison[0] === '',
      matchedPhrase,
      confidence: 0.8,
      fullQuery: original,
    };
  }

  return { verb, capabilityIds, entityQuery, usesFocus, matchedPhrase, confidence, fullQuery: original };
}

/** "compare volve and ekofisk" · "volve vs ekofisk" · "compare with kutei". */
function splitComparison(text: string): [string, string] | null {
  const CONNECTORS = [' vs ', ' versus ', ' against ', ' compared to ', ' compared with ', ' and '];
  let body = text;
  let explicit = false;
  for (const lead of ['compare with ', 'compare to ', 'compare ']) {
    if (body.startsWith(lead)) { body = body.slice(lead.length); explicit = true; break; }
  }
  for (const connector of CONNECTORS) {
    const at = body.indexOf(connector);
    if (at < 0) continue;
    const left = stripFiller(body.slice(0, at));
    const right = stripFiller(body.slice(at + connector.length));
    // "and" alone is far too common to treat as a comparison on its own.
    if (!right) continue;
    if (connector === ' and ' && !explicit) continue;
    return [left, right];
  }
  // "compare with kutei basin" — one side is the current subject.
  if (explicit && body.trim()) return ['', stripFiller(body)];
  return null;
}

/** Every phrase the deterministic tier understands. Used by the test to assert
 *  round-tripping, and by the chat surface for its "try asking…" hints. */
export function lexicon(): { phrase: string; capabilityIds: string[] }[] {
  return PHRASE_INDEX.map(({ phrase, ids }) => ({ phrase, capabilityIds: ids }));
}
