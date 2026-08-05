// agent/resolve.ts — entity resolution (L3). Pure and synchronous.
//
// Turns a fragment of user text into a gazetteer node, a ranked shortlist, or an
// honest "I don't know that one, did you mean…". Five stages, first non-empty
// wins, everything ranked by the same scorer so the ordering is explainable.
//
//   1 exact       a normKey matches verbatim              "kutei basin"
//   2 alias       a native id or alternate spelling       "3817", "North Sea Graben"
//   3 lexical     prefix / whole-word token overlap       "kutei bas", "sumatra basin south"
//   4 fuzzy       trigram Jaccard, then Damerau-Levenshtein
//   5 phonetic    heard-not-read spellings                "kutai" → Kutei Basin
//
// Stage 5 exists for a measured reason: "kutai", the common alternate
// transliteration, scores ZERO against the shipped search index today.
//
// CORRECTION IS NEVER SILENT ABOVE DISTANCE 1. A one-character slip applies with
// a reversible "interpreted as" note; anything further asks first. Getting the
// wrong basin quietly is worse than one extra click.

import type { GazIndexed, GazKind, Scope } from './types.ts';
import type { GazIndex } from './gazetteer.ts';
import { fold, phoneticKey, richness, trigrams } from './gazetteer.ts';
import { activeLevels, getLevel } from './scope.ts';

export type ResolveStage = 'exact' | 'alias' | 'lexical' | 'fuzzy' | 'phonetic';

export interface Candidate {
  node: GazIndexed;
  score: number;
  stage: ResolveStage;
  /** Edit distance to the matched key; 0 for exact. */
  distance: number;
  /** The key that matched — shown in "interpreted as" notes. */
  matched: string;
}

export type Resolution =
  | { status: 'exact'; node: GazIndexed; candidate: Candidate; alternates: GazIndexed[] }
  | { status: 'corrected'; node: GazIndexed; from: string; distance: number; autoApply: boolean; candidate: Candidate; alternates: GazIndexed[] }
  | { status: 'ambiguous'; candidates: Candidate[] }
  | { status: 'none'; suggestions: Candidate[] };

export interface ResolveOptions {
  /** Restrict to these kinds (the Exploration scope bar filters this way). */
  kinds?: GazKind[];
  /** Bias toward what is already in scope — "the F-15 well" means this field's. */
  scope?: Scope;
  /** Candidates to return for the ambiguous/none paths. */
  limit?: number;
}

// ── ranking inputs ───────────────────────────────────────────────────────────

/** Tie-break preference when two kinds match equally well. Containers lead:
 *  someone typing a bare name usually means the biggest thing with that name. */
const KIND_RANK: Record<GazKind, number> = {
  basin: 10,
  country: 9,
  field: 8,
  'assessment-unit': 7,
  'petroleum-system': 6,
  well: 6,
  region: 5,
  wellbore: 4,
  formation: 3,
  'basin-cycle': 3,
  province: 3,
  play: 3,
  reservoir: 2,
  company: 2,
};

/** Regulator records beat the global aggregator when they describe the same thing. */
function sourceRank(node: GazIndexed): number {
  const s = node.sources.join(' ');
  if (/Volve|Sodir|NSTA|North Sea regulators|Brazil ANP/i.test(s)) return 3;
  if (/USGS/i.test(s)) return 2;
  if (/GOGET/i.test(s)) return 1;
  return 0;
}

const STAGE_BASE: Record<ResolveStage, number> = {
  exact: 1000, alias: 900, lexical: 700, fuzzy: 480, phonetic: 300,
};

/** Ids already in scope, plus their ancestors — used for the proximity boost. */
function scopeIds(scope: Scope | undefined): Set<string> {
  if (!scope) return new Set();
  return new Set(activeLevels(scope).map((level) => getLevel(scope, level)!.id));
}

function scoreCandidate(
  node: GazIndexed,
  stage: ResolveStage,
  distance: number,
  index: GazIndex,
  inScope: Set<string>,
): number {
  let score = STAGE_BASE[stage] - distance * 40;
  score += (KIND_RANK[node.kind] ?? 0) * 6;
  score += sourceRank(node) * 4;
  // Data richness, hard-capped so a huge basin cannot out-rank an exact field.
  score += Math.min(richness(node), 60) * 0.25;
  // Proximity: already in scope, or a child/parent of something in scope.
  if (inScope.has(node.id)) score += 45;
  else if ((node.parents ?? []).some((p) => inScope.has(p.id))) score += 25;
  else if ([...inScope].some((id) => (index.childrenOf.get(node.id) ?? []).some((c) => c.id === id))) score += 15;
  return score;
}

// ── string distance ──────────────────────────────────────────────────────────

/** Damerau-Levenshtein, bounded. Returns `max + 1` once it cannot win, so long
 *  mismatched pairs cost almost nothing. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = new Array(b.length + 1);
  let prev: number[] = new Array(b.length + 1);
  let curr: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  let prevRow: number[] | null = null;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let best = curr[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      // transposition
      if (prevRow && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prevRow[j - 2] + 1);
      }
      curr[j] = value;
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    prevRow = prev;
    prev = curr;
    curr = prevRow === prev2 ? prev2 : new Array(b.length + 1);
  }
  return prev[b.length] > max ? max + 1 : prev[b.length];
}

// ── resolution ───────────────────────────────────────────────────────────────

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'in', 'at', 'on', 'for', 'and', 'me', 'my', 'is', 'to']);

function queryTokens(q: string): string[] {
  return fold(q).split(' ').filter((t) => t && !STOPWORDS.has(t));
}

/** Every candidate the ladder can produce, ranked. The single scoring path used
 *  by resolve(), suggest() and the disambiguation UI, so they cannot disagree. */
export function rank(index: GazIndex, query: string, options: ResolveOptions = {}): Candidate[] {
  const tokens = queryTokens(query);
  // Stopwords are dropped BEFORE the exact lookup, not just for token overlap —
  // otherwise "the kutei basin" misses the "kutei basin" key entirely and falls
  // through to a fuzzy scramble.
  const q = tokens.join(' ') || fold(query);
  if (!q) return [];
  const inScope = scopeIds(options.scope);
  const allowed = options.kinds ? new Set(options.kinds) : null;
  const ok = (node: GazIndexed) => !allowed || allowed.has(node.kind);

  const out = new Map<string, Candidate>();
  const offer = (node: GazIndexed, stage: ResolveStage, distance: number, matched: string) => {
    if (!ok(node)) return;
    const score = scoreCandidate(node, stage, distance, index, inScope);
    const existing = out.get(node.id);
    if (!existing || score > existing.score) out.set(node.id, { node, score, stage, distance, matched });
  };

  // ── 1/2 · exact key ───────────────────────────────────────────────────────
  for (const node of index.byKey.get(q) ?? []) {
    // A NAME key — including a suffix-stripped form like "south sumatra" — is a
    // full-strength hit. An alias key ("3817") is a certain but weaker statement.
    offer(node, node.nameKeys.includes(q) ? 'exact' : 'alias', 0, q);
  }
  if (out.size) return finish(out, options.limit);

  // ── 3 · lexical: type-ahead prefixes and whole-word token overlap ─────────
  //
  // Deliberately narrow. An earlier version accepted `q.startsWith(key)` for any
  // key, so the two-letter field "Ku" swallowed every query beginning "ku" —
  // "kutai" resolved, with full confidence, to a gas field in Mexico. A short key
  // is not evidence that the user meant it.
  for (const [key, nodes] of index.byKey) {
    if (key.length < 3) continue;
    let stage: ResolveStage | null = null;
    let distance = 0;
    if (key.startsWith(q) && q.length >= 3) {
      // Type-ahead direction: the user typed a prefix of a real name.
      stage = 'lexical';
      distance = key.length - q.length > 14 ? 2 : key.length - q.length > 5 ? 1 : 0;
    } else if (q.startsWith(key) && key.length >= 6) {
      // Reverse direction: only for keys long enough to be a real statement.
      stage = 'lexical';
      distance = 1;
    } else if (tokens.length >= 2) {
      const keyTokens = new Set(key.split(' '));
      const hits = tokens.filter((t) => keyTokens.has(t));
      // Need most of the query matched AND at least two real words, so a bare
      // "basin" or "field" cannot drag in half the catalogue.
      if (hits.length >= 2 && hits.length / tokens.length >= 0.6) {
        stage = 'lexical';
        // Penalise BOTH directions: query words the key lacks, and key words the
        // query never asked for. Without the second term "kutei basin" ties with
        // "Kutei Basin Deltaics" and the pair reads as a genuine ambiguity.
        distance = (tokens.length - hits.length) + Math.max(0, keyTokens.size - hits.length);
      }
    }
    if (!stage) continue;
    // Refine with a real string distance. Token overlap alone gives a mistyped
    // word ZERO weight, so "Sout Caspian Basin" tied with North, Middle and South
    // Caspian — three basins, one of which is obviously meant. Edit distance
    // separates them (1 vs 2) and the tie disappears.
    const exactish = editDistance(q, key, 4);
    if (exactish <= 4) distance = Math.min(distance, exactish);
    for (const node of nodes) offer(node, stage, distance, key);
  }
  if (out.size) return finish(out, options.limit);

  // ── 4 · fuzzy: trigram shortlist, then a real edit distance ────────────────
  // The trigram pass only narrows the haystack; edit distance is the judge. An
  // earlier Jaccard gate rejected short-key matches ("kutai" vs the "kutei" key)
  // because it penalised the length difference against the full name.
  const grams = trigrams(q);
  if (grams.length) {
    const overlap = new Map<number, number>();
    for (const gram of grams) {
      for (const i of index.byTrigram.get(gram) ?? []) overlap.set(i, (overlap.get(i) ?? 0) + 1);
    }
    const shortlist = [...overlap.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 800);
    // Short queries get a tight budget so "kutai"→"kutei" lands but "kutai"→"kuwait" does not.
    const budgetFor = (key: string) => {
      const longest = Math.max(q.length, key.length);
      return longest <= 6 ? 1 : longest <= 10 ? 2 : 3;
    };
    for (const [i] of shortlist) {
      const node = index.nodes[i];
      if (!ok(node)) continue;
      let best = Infinity;
      let bestKey = '';
      for (const key of node.normKeys) {
        const d = editDistance(q, key, budgetFor(key));
        if (d < best) { best = d; bestKey = key; }
      }
      if (best <= 3) offer(node, 'fuzzy', best, bestKey);
    }
  }
  if (out.size) return finish(out, options.limit);

  // ── 5 · phonetic: heard, never read ───────────────────────────────────────
  // The key is intentionally lossy, so it needs guard rails: "zzzzqqqq" collapses
  // to "sk" and matched seven Ecuadorian oil fields. A key under three consonants
  // carries no signal, and a crowded bucket means the key is too generic to act on.
  if (q.replace(/\s/g, '').length >= 4) {
    const key = phoneticKey(q);
    const bucket = key.length >= 3 ? index.byPhonetic.get(key) ?? [] : [];
    if (bucket.length && bucket.length <= 25) {
      for (const node of bucket) offer(node, 'phonetic', 2, node.normKeys[0]);
    }
  }
  return finish(out, options.limit);
}

function finish(out: Map<string, Candidate>, limit = 8): Candidate[] {
  return [...out.values()]
    .sort((a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name))
    .slice(0, Math.max(limit, 1));
}

/** How close two candidates must be to count as genuinely ambiguous. */
const AMBIGUITY_MARGIN = 30;

export function resolve(index: GazIndex, query: string, options: ResolveOptions = {}): Resolution {
  const candidates = rank(index, query, { ...options, limit: Math.max(options.limit ?? 6, 6) });
  if (!candidates.length) return { status: 'none', suggestions: [] };

  const [top, second] = candidates;

  // Two nodes describing the same geography at different tiers (Viking Graben as
  // basin AND as assessment unit) are NOT an ambiguity — answer at the coarser
  // tier and offer the finer one. Merging them would be the lie; asking would be
  // pedantry.
  const sameThing = second && (top.node.sameAs ?? []).includes(second.node.id);
  const contested = second
    && !sameThing
    && second.score > top.score - AMBIGUITY_MARGIN
    && top.stage !== 'exact';

  const alternates = candidates.slice(1)
    .filter((c) => (top.node.sameAs ?? []).includes(c.node.id) || c.score > top.score - AMBIGUITY_MARGIN * 2)
    .map((c) => c.node);

  if (contested) {
    return { status: 'ambiguous', candidates: candidates.filter((c) => c.score > top.score - AMBIGUITY_MARGIN * 2).slice(0, options.limit ?? 5) };
  }

  if (top.stage === 'exact' || top.stage === 'alias' || (top.stage === 'lexical' && top.distance === 0)) {
    return { status: 'exact', node: top.node, candidate: top, alternates };
  }

  // Everything else is a guess about what the user meant, and says so.
  return {
    status: 'corrected',
    node: top.node,
    from: query.trim(),
    distance: top.distance,
    // Only a PREFIX completion applies without asking: there the user typed a
    // real, correct fragment of the name and nothing was wrong. A fuzzy or
    // phonetic hit means characters actually differ, and in this domain landing
    // on the wrong basin quietly costs far more than one extra click.
    autoApply: top.stage === 'lexical',
    candidate: top,
    alternates,
  };
}

/** Type-ahead for the chat box and ⌘K. Same scorer, so the dropdown order and
 *  the resolution order can never disagree. */
export function suggest(index: GazIndex, query: string, options: ResolveOptions = {}): Candidate[] {
  return rank(index, query, { ...options, limit: options.limit ?? 8 });
}
