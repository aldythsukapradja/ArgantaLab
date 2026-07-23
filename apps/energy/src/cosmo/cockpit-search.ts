// cockpit-search.ts — Stream D: OSDU-grounded search (handoff §11). Fetches the real search
// index built at data-build time from the OSDU catalogue (fields · provinces · assessment
// units · wellbores · companies · countries) — never a hard-coded place list. Fetched once,
// lazily, on first search-box focus; cached for the session.
const base = import.meta.env.BASE_URL || '/';

export type SearchEntryType = 'field' | 'province' | 'assessment-unit' | 'wellbore' | 'company' | 'country';
export interface SearchEntry {
  id: string;
  type: SearchEntryType;
  name: string;
  aliases: string[];
  parent: string;
  source: string;
  fly: { lon: number; lat: number } | null;
  tokens: string;
}

let indexPromise: Promise<SearchEntry[]> | null = null;

export function loadSearchIndex(): Promise<SearchEntry[]> {
  if (!indexPromise) {
    indexPromise = fetch(`${base}osdu/cockpit-search.json`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((j) => (Array.isArray(j.entries) ? (j.entries as SearchEntry[]) : []))
      .catch(() => []);
  }
  return indexPromise;
}

const TYPE_LABEL: Record<SearchEntryType, string> = {
  field: 'Field', province: 'Petroleum province', 'assessment-unit': 'Assessment unit',
  wellbore: 'Wellbore', company: 'Company', country: 'Country / geopolitical entity',
};
export const searchTypeLabel = (t: SearchEntryType): string => TYPE_LABEL[t] ?? t;

/** Punctuation-insensitive, prefix-first ranking across name/aliases/tokens. */
export function rankSearch(entries: SearchEntry[], query: string, limit = 14): SearchEntry[] {
  const q = query.trim().toLowerCase().replace(/[^\w\s/-]/g, '');
  if (!q) return [];
  const scored: Array<{ e: SearchEntry; score: number }> = [];
  for (const e of entries) {
    const name = e.name.toLowerCase();
    let score = -1;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 82;
    else if (e.aliases.some((a) => a.toLowerCase() === q)) score = 78;
    else if (e.aliases.some((a) => a.toLowerCase().startsWith(q))) score = 60;
    else if (e.tokens.includes(q)) score = 45;
    if (score >= 0) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, limit).map((s) => s.e);
}
