// Deterministic three-tier tagger (NEVER an LLM). Runs over extracted text blocks and
// proposes entity matches + claims against the ontology. Matches resolve to the MERGED
// KB by deterministic id; unresolved stays noteId:null (propose, never auto-merge).
import type { VaultNote, Claim } from './types';
import { normalizeWellbore } from '../model/schema-meta';

export interface MatchedEntity { entity: string; noteId: string | null; how: 'exact' | 'alias' | 'fuzzy' }
export interface TagHit {
  entity: string;
  noteId: string | null;
  how: 'exact' | 'alias' | 'fuzzy';
  kind: 'wellbore' | 'surface' | 'well';
  evidence: string[]; // up to 3 windows
}
export interface KvClaim { claim: Claim; evidence: string[] }

export interface EntityIndex {
  wellbore: Map<string, string>;   // normalized key → noteId
  surface: Map<string, string>;    // lowercase title → noteId
  well: Map<string, string>;
  surfaceTitles: { title: string; id: string }[];
}

const norm = (s: string) => s.trim().toLowerCase();

export function buildEntityIndex(notes: VaultNote[]): EntityIndex {
  const idx: EntityIndex = { wellbore: new Map(), surface: new Map(), well: new Map(), surfaceTitles: [] };
  for (const n of notes) {
    if (n.type === 'wellbore') {
      idx.wellbore.set(norm(n.title), n.id);
      idx.wellbore.set(norm(normalizeWellbore(n.title)), n.id);
    } else if (n.type === 'surface') {
      idx.surface.set(norm(n.title), n.id);
      idx.surfaceTitles.push({ title: n.title, id: n.id });
    } else if (n.type === 'well') {
      // well titles are "Well 15/9-19" — index by the bare identifier too
      idx.well.set(norm(n.title), n.id);
      idx.well.set(norm(n.title.replace(/^well\s+/i, '')), n.id);
    }
  }
  return idx;
}

// Evidence windows: up to 3 slices of slice(i-110, i+170) around match offsets.
function windows(text: string, offsets: number[]): string[] {
  return offsets.slice(0, 3).map((i) => {
    const w = text.slice(Math.max(0, i - 110), i + 170).replace(/\s+/g, ' ').trim();
    return '…' + w + '…';
  });
}

function offsetsOf(text: string, token: string): number[] {
  const out: number[] = [];
  const hay = text.toLowerCase();
  const needle = token.toLowerCase();
  let i = hay.indexOf(needle);
  while (i !== -1 && out.length < 3) { out.push(i); i = hay.indexOf(needle, i + needle.length); }
  return out;
}

// Tier-2 shape patterns for wellbore ids: "15/9-F-11 A", "15/9-19 BT2", "F-14", "F-15 D".
const WB_SHAPE = /\b(?:15\/9-)?(?:F-\d+[A-Z]?(?:\s?[A-Z]{1,3}\d?)?|19(?:\s?[A-Z]{1,3}\d?)?)\b/g;

/** Tag a text block: returns entity hits (tier 2/3) + kv claims (tier 1). */
export function tagBlock(text: string, _locator: string, idx: EntityIndex): { hits: TagHit[]; claims: KvClaim[] } {
  const hits: TagHit[] = [];
  const seen = new Set<string>();

  // ── Tier 2: wellbore shape patterns → normalizeWellbore → index lookup ──
  let m: RegExpExecArray | null;
  WB_SHAPE.lastIndex = 0;
  while ((m = WB_SHAPE.exec(text))) {
    const raw = m[0];
    const canon = norm(normalizeWellbore(raw));
    if (!canon || seen.has('wb:' + canon)) continue;
    const noteId = idx.wellbore.get(canon) ?? null;
    seen.add('wb:' + canon);
    hits.push({
      entity: raw, noteId, how: noteId ? 'exact' : 'fuzzy', kind: 'wellbore',
      evidence: windows(text, offsetsOf(text, raw)),
    });
  }

  // ── Tier 2/3: the 16 surface names (exact + case-insensitive alias) ──
  for (const s of idx.surfaceTitles) {
    const off = offsetsOf(text, s.title);
    if (off.length && !seen.has('su:' + s.id)) {
      seen.add('su:' + s.id);
      // exact case match vs case-insensitive alias
      const exact = text.includes(s.title);
      hits.push({ entity: s.title, noteId: s.id, how: exact ? 'exact' : 'alias', kind: 'surface', evidence: windows(text, off) });
    }
  }

  // ── Tier 1: labelled key: value regexes → claims ──
  const claims: KvClaim[] = [];
  const kvRules: { re: RegExp; predicate: string }[] = [
    { re: /\bwell(?:bore)?\s*[:=]\s*([A-Za-z0-9/\- ]{2,24})/gi, predicate: 'refers_to_well' },
    { re: /\bformation\s*[:=]\s*([A-Za-z0-9.\- ]{2,32})/gi, predicate: 'refers_to_formation' },
    { re: /\bdate\s*[:=]\s*(\d{4}-\d{2}-\d{2}|\d{2}[/.]\d{2}[/.]\d{4})/gi, predicate: 'dated' },
    { re: /\bdepth\s*[:=]?\s*(\d[\d.,]*\s?(?:m|ft|mMD|mTVD|m MD|m TVD))\b/gi, predicate: 'has_depth' },
    { re: /\b(?:volume|oil|gas|water)\s*[:=]?\s*(\d[\d.,]*\s?(?:Sm3|Sm³|bbl|MMscf|m3))\b/gi, predicate: 'has_volume' },
  ];
  for (const rule of kvRules) {
    rule.re.lastIndex = 0;
    let k: RegExpExecArray | null;
    let count = 0;
    while ((k = rule.re.exec(text)) && count < 6) {
      count++;
      const value = k[1].trim();
      const off = [k.index];
      claims.push({
        claim: {
          subject: 'upload', predicate: rule.predicate, object: value,
          evidence: [], confidence: 'provisional', flag: 'draft',
        },
        evidence: windows(text, off),
      });
    }
  }

  return { hits, claims };
}

export function toMatchedEntities(hits: TagHit[]): MatchedEntity[] {
  return hits.map((h) => ({ entity: h.entity, noteId: h.noteId, how: h.how }));
}
