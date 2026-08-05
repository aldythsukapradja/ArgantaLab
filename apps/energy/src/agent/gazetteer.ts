// agent/gazetteer.ts — load, expand and index the place graph (L1).
//
// `buildIndex(core, tail)` is PURE: it takes two already-parsed payloads and
// returns everything the resolver needs. `loadGazetteer()` is the thin fetching
// wrapper. That split is what lets `node scripts/test-gazetteer.mjs` exercise the
// real shipped data without a browser.
//
// Match keys, trigrams and phonetic codes are derived HERE rather than shipped —
// storing them would roughly triple the payload to hold what these pure
// functions reproduce in well under a frame.

import type { GazIndexed, GazKind, GazNode, Gazetteer, Ref } from './types.ts';
export type { GazIndexed } from './types.ts';

// ── text normalisation ───────────────────────────────────────────────────────

/** Lowercase, de-accent, collapse punctuation to single spaces. */
export function fold(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Generic type words users drop when they speak. "Kutei Basin" → "kutei". */
const GEOLOGIC_SUFFIX = /\s+(basin|graben|province|trough|arch|platform|shelf|uplift|embayment|sub basin|foldbelt|fold belt|rift|sag|depression|terrace|high)$/;
const FIELD_SUFFIX = /\s+(oil and gas condensate field|oil and gas field|oil and gas pool|condensate field|oil field|gas field|oil pool|gas pool|oil sand|field|pool)$/;
const TRAILING_PAREN = /\s*\([^)]*\)\s*$/;

/**
 * Every string this node should match on.
 *
 * Both directions matter. GOGET writes "Badak Oil and Gas Field (Indonesia)" but
 * users type "badak"; USGS writes "Kutei Basin" but users type "kutei"; and the
 * inverse — someone typing "kutei basin" must still hit a node named "Kutei".
 */
export function normKeysFor(node: Pick<GazNode, 'kind' | 'name' | 'aliases'>): string[] {
  return [...nameKeysFor(node), ...aliasKeysFor(node)];
}

/** Keys derived from the NAME, including its suffix-stripped forms.
 *
 *  Kept separate from alias keys because they are not equally strong evidence:
 *  "South Sumatra" is a legitimate way to say "South Sumatra Basin", whereas
 *  "3817" is a code that happens to point there. Ranking them identically made a
 *  suffix-stripped basin name lose to an assessment unit that happened to be
 *  named the stripped form outright. */
export function nameKeysFor(node: Pick<GazNode, 'kind' | 'name'>): string[] {
  const keys = new Set<string>();
  addNameVariants(keys, node.name);
  if (node.kind === 'basin' || node.kind === 'assessment-unit') {
    const base = fold(node.name);
    if (base && !GEOLOGIC_SUFFIX.test(base)) keys.add(`${base} basin`);
  }
  return [...keys].filter(Boolean);
}

export function aliasKeysFor(node: Pick<GazNode, 'aliases'>): string[] {
  const keys = new Set<string>();
  for (const alias of node.aliases ?? []) addNameVariants(keys, alias);
  return [...keys].filter(Boolean);
}

function addNameVariants(keys: Set<string>, raw: string): void {
  const base = fold(raw);
  if (!base) return;
  keys.add(base);

  // "Badak Oil and Gas Field (Indonesia)" → "badak oil and gas field" → "badak"
  const unParenthesised = fold(String(raw).replace(TRAILING_PAREN, ''));
  if (unParenthesised) keys.add(unParenthesised);

  for (const candidate of [base, unParenthesised]) {
    if (!candidate) continue;
    const withoutField = candidate.replace(FIELD_SUFFIX, '').trim();
    if (withoutField && withoutField !== candidate) keys.add(withoutField);

    const withoutGeologic = candidate.replace(GEOLOGIC_SUFFIX, '').trim();
    if (withoutGeologic && withoutGeologic !== candidate) keys.add(withoutGeologic);
  }
}

/** Sorted, de-duplicated character 3-grams. Padded so short names still index. */
export function trigrams(raw: string): string[] {
  const s = ` ${fold(raw).replace(/\s+/g, ' ')} `;
  if (s.length < 3) return [];
  const out = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i += 1) out.add(s.slice(i, i + 3));
  return [...out].sort();
}

/**
 * A deliberately simple phonetic key — not Double Metaphone.
 *
 * It exists to catch the one failure mode the earlier stages miss: a name the
 * user has only ever heard. "Kutai"/"Kutei" (the alternate transliteration that
 * returns ZERO hits against the shipped index today) and "Volv"/"Volve" both
 * collapse here. It is intentionally lossy, which is safe because it is the last
 * stage in the ladder and its hits are always offered for confirmation, never
 * executed silently.
 */
export function phoneticKey(raw: string): string {
  let s = fold(raw).replace(/\s+/g, '');
  if (!s) return '';
  s = s
    .replace(/[^a-z]/g, '')
    .replace(/^(kn|gn|pn|wr|ps)/, (m) => m[1])
    .replace(/ph/g, 'f')
    .replace(/gh/g, 'g')
    .replace(/ck/g, 'k')
    .replace(/sch/g, 'sk')
    .replace(/c([eiy])/g, 's$1')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/z/g, 's')
    .replace(/wh/g, 'w')
    .replace(/[^a-z]/g, '');
  if (!s) return '';
  const first = s[0];
  // Vowels after the first letter carry almost no signal across transliterations.
  const rest = s.slice(1).replace(/[aeiouyhw]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}

// ── tail expansion ───────────────────────────────────────────────────────────

export interface TailEncoding {
  columns: Record<string, string[]>;
  flags: Record<string, Record<string, string>>;
  idPrefix: Record<string, string>;
  gazPrefix: Record<string, string>;
  zoom: Record<string, number>;
  parentConfidence: { basin: string; country: string };
  /** Counts that exist only for a node carrying the deep well bundle. Held out
   *  of the boolean flag string and applied on expansion. */
  bundleCounts?: Record<string, number>;
  sources: string[];
}

export interface TailPayload {
  encoding: TailEncoding;
  counts: Record<string, number>;
  aliases: Record<string, string[]>;
  rows: Record<string, unknown[][]>;
}

/**
 * Expand one compact tail row into the same GazNode shape the core file ships
 * directly. The ONLY place that knows the row format — everything downstream
 * sees uniform nodes.
 */
export function expandTailRow(kind: GazKind, row: unknown[], enc: TailEncoding, aliases: Record<string, string[]>): GazNode {
  const columns = enc.columns[kind];
  const cell = (name: string) => row[columns.indexOf(name)];
  const short = String(cell('id'));
  const lon = cell('lon') as number | null;
  const lat = cell('lat') as number | null;
  const sourceIndex = cell('source') as number;
  const flagChars = String(cell('flags') ?? '');

  const has: Record<string, boolean | number> = {};
  // Every flag in the table is assessed for every row, so an absent char is a
  // measured "no" — not "unknown". That is what lets the agent say "Badak has no
  // logs" instead of hedging.
  for (const [char, name] of Object.entries(enc.flags[kind])) has[name] = flagChars.includes(char);
  for (const [name, count] of Object.entries(enc.bundleCounts ?? {})) has[name] = has.bundle ? count : 0;

  const parents: GazNode['parents'] = [];
  if (kind === 'field') {
    const basin = cell('basin');
    const country = cell('country');
    if (basin) parents.push({ kind: 'basin', id: `gaz:basin:${basin}`, confidence: enc.parentConfidence.basin as never });
    if (country) parents.push({ kind: 'country', id: `gaz:country:${country}`, confidence: enc.parentConfidence.country as never });
  }

  return {
    id: `${enc.gazPrefix[kind]}${short}`,
    kind,
    name: String(cell('name')),
    aliases: aliases[short] ?? [],
    parents,
    fly: lon === null || lat === null ? null : { lon, lat, zoom: enc.zoom[kind] },
    sources: sourceIndex >= 0 ? [enc.sources[sourceIndex]] : [],
    has,
    nativeIds: [`${enc.idPrefix[kind]}${short}`],
  };
}

// ── index ────────────────────────────────────────────────────────────────────

export interface GazIndex {
  version: string;
  generatedAt: string;
  method: string;
  nodes: GazIndexed[];
  byId: Map<string, GazIndexed>;
  /** normKey → nodes that answer to it. */
  byKey: Map<string, GazIndexed[]>;
  /** trigram → node array indices, for typo scoring without a full scan. */
  byTrigram: Map<string, number[]>;
  byPhonetic: Map<string, GazIndexed[]>;
  byKind: Map<GazKind, GazIndexed[]>;
  /** parent id → children. Built from the edges, so it can never drift. */
  childrenOf: Map<string, GazIndexed[]>;
  counts: Record<string, number>;
  /** True once the field/wellbore tail has been merged in. */
  tailLoaded: boolean;
}

function indexNode(node: GazNode): GazIndexed {
  const nameKeys = nameKeysFor(node);
  const aliasKeys = aliasKeysFor(node).filter((k) => !nameKeys.includes(k));
  const normKeys = [...nameKeys, ...aliasKeys];
  // Trigrams over EVERY key, not just the first. Indexing only the full name
  // made "kutai" unreachable from "Kutei Basin": the query's 5 grams overlapped
  // the 11-gram full-name set too weakly to survive the shortlist, even though
  // it is one edit from the "kutei" key.
  const grams = new Set<string>();
  for (const key of normKeys) for (const gram of trigrams(key)) grams.add(gram);
  return {
    ...node,
    displayName: node.displayName ?? node.name,
    nameKeys,
    normKeys,
    trigrams: [...grams].sort(),
    phonetic: phoneticKey(nameKeys[nameKeys.length - 1] ?? node.name),
    capabilities: [],
  };
}

/** Pure. `tail` may be null — the index simply carries fewer nodes until it lands. */
export function buildIndex(core: Gazetteer, tail: TailPayload | null): GazIndex {
  const nodes: GazIndexed[] = core.nodes.map(indexNode);
  if (tail) {
    for (const [kind, rows] of Object.entries(tail.rows)) {
      for (const row of rows) nodes.push(indexNode(expandTailRow(kind as GazKind, row, tail.encoding, tail.aliases)));
    }
  }

  const byId = new Map<string, GazIndexed>();
  const byKey = new Map<string, GazIndexed[]>();
  const byTrigram = new Map<string, number[]>();
  const byPhonetic = new Map<string, GazIndexed[]>();
  const byKind = new Map<GazKind, GazIndexed[]>();
  const childrenOf = new Map<string, GazIndexed[]>();

  nodes.forEach((node, i) => {
    byId.set(node.id, node);
    for (const key of node.normKeys) {
      const bucket = byKey.get(key);
      if (bucket) bucket.push(node); else byKey.set(key, [node]);
    }
    for (const gram of node.trigrams) {
      const bucket = byTrigram.get(gram);
      if (bucket) bucket.push(i); else byTrigram.set(gram, [i]);
    }
    if (node.phonetic) {
      const bucket = byPhonetic.get(node.phonetic);
      if (bucket) bucket.push(node); else byPhonetic.set(node.phonetic, [node]);
    }
    const kindBucket = byKind.get(node.kind);
    if (kindBucket) kindBucket.push(node); else byKind.set(node.kind, [node]);
    for (const parent of node.parents ?? []) {
      const bucket = childrenOf.get(parent.id);
      if (bucket) bucket.push(node); else childrenOf.set(parent.id, [node]);
    }
  });

  return {
    version: core.version,
    generatedAt: core.generatedAt,
    method: core.method,
    nodes, byId, byKey, byTrigram, byPhonetic, byKind, childrenOf,
    counts: core.counts,
    tailLoaded: !!tail,
  };
}

// ── helpers used by every layer above ────────────────────────────────────────

export const toRef = (node: GazNode): Ref => ({
  id: node.id, kind: node.kind, name: node.name, source: node.sources?.[0],
});

/**
 * Ancestors, NEAREST assertion per kind.
 *
 * Breadth-first, not a single chain, and deliberately so. Volve's own record
 * says Norway; the basin it sits in (the North Sea Graben) is shared by five
 * countries and its heaviest country edge is the UK. A depth-first "follow the
 * heaviest edge" walk therefore reports Volve as British. Taking the nearest
 * assertion for each kind keeps the field's own country and only falls back to
 * the basin's when the field itself is silent.
 *
 * Ties at equal depth break on edge weight, then on confidence.
 */
const CONFIDENCE_RANK: Record<string, number> = { authoritative: 3, spatial: 2, membership: 1, inferred: 0 };

export function ancestryOf(index: GazIndex, node: GazIndexed, limit = 8): GazIndexed[] {
  const best = new Map<GazKind, { node: GazIndexed; depth: number; weight: number; confidence: number }>();
  const seen = new Set<string>([node.id]);
  let frontier: GazIndexed[] = [node];

  for (let depth = 1; depth <= limit && frontier.length; depth += 1) {
    const next: GazIndexed[] = [];
    for (const current of frontier) {
      for (const edge of current.parents ?? []) {
        const parent = index.byId.get(edge.id);
        if (!parent) continue;
        const weight = edge.weight ?? 0;
        const confidence = CONFIDENCE_RANK[edge.confidence] ?? 0;
        const incumbent = best.get(parent.kind);
        const better = !incumbent
          || depth < incumbent.depth
          || (depth === incumbent.depth && (weight > incumbent.weight
            || (weight === incumbent.weight && confidence > incumbent.confidence)));
        if (better) best.set(parent.kind, { node: parent, depth, weight, confidence });
        if (!seen.has(parent.id)) { seen.add(parent.id); next.push(parent); }
      }
    }
    frontier = next;
  }

  // Coarse → fine, so callers can render a breadcrumb straight from the result.
  const ORDER: GazKind[] = ['region', 'country', 'basin', 'petroleum-system', 'assessment-unit', 'basin-cycle', 'play', 'field', 'reservoir', 'well'];
  return ORDER.map((kind) => best.get(kind)?.node).filter((n): n is GazIndexed => !!n);
}

/** Children of one kind, ranked by how much data each has. */
export function childrenOfKind(index: GazIndex, id: string, kind: GazKind, limit = 0): GazIndexed[] {
  const all = (index.childrenOf.get(id) ?? []).filter((n) => n.kind === kind);
  all.sort((a, b) => richness(b) - richness(a) || a.name.localeCompare(b.name));
  return limit > 0 ? all.slice(0, limit) : all;
}

/** How much this node can actually show. Ranks candidates and drill-down chips. */
export function richness(node: GazNode): number {
  let score = 0;
  for (const value of Object.values(node.has ?? {})) {
    if (typeof value === 'number') score += Math.min(value, 500);
    else if (value) score += 1;
  }
  return score;
}

// ── loading ──────────────────────────────────────────────────────────────────

// Vite always defines import.meta.env; plain Node (the truth-lock scripts) does
// not, so this stays optional-chained — same guard as tabs/fielddev/field-record.
const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';

let cached: Promise<GazIndex> | null = null;

/**
 * Fetch the gazetteer. The core file (containers) and the tail (fields,
 * wellbores) go out in parallel; if the tail fails or is slow the index is still
 * returned, just smaller — a degraded agent beats a broken one.
 */
export function loadGazetteer(): Promise<GazIndex> {
  if (cached) return cached;
  cached = (async () => {
    const [core, tail] = await Promise.all([
      fetch(`${BASE}agent/gazetteer.json`).then((r) => {
        if (!r.ok) throw new Error(`gazetteer ${r.status}`);
        return r.json() as Promise<Gazetteer>;
      }),
      fetch(`${BASE}agent/gazetteer-tail.json`)
        .then((r) => (r.ok ? (r.json() as Promise<TailPayload>) : null))
        .catch(() => null),
    ]);
    return buildIndex(core, tail);
  })();
  return cached;
}

/** Test seam — drop the memoised index. */
export function resetGazetteer(): void { cached = null; }
