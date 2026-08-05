// geo-time.ts — the geologic time model the two geology charts zoom against.
//
// The workbook's Geologic Timescale tab currently carries PERIOD rank only (12 rows,
// Cambrian→Quaternary). Screening questions are routinely finer than that — "the
// Oligocene–Miocene section", "Lower vs Upper Cretaceous" — so this module supplies
// the epoch/series tier as an explicitly-labelled FALLBACK.
//
// The fallback is self-retiring: any rank the workbook provides WINS, and the moment
// epoch rows appear in Geologic Timescale the constants below stop being consulted
// for that rank. They are ICS chronostratigraphic boundaries — published reference
// constants, not interpretation — and each is tagged `source: 'ics-fallback'` so the
// UI can say where a boundary came from.
//
// Ages: ICS International Chronostratigraphic Chart (v2023/09 values, unchanged in
// the 2026/06 revision the workbook cites for its period tier).

export type GeoRank = 'era' | 'period' | 'epoch';

export interface GeoUnit {
  id: string;
  name: string;
  rank: GeoRank;
  /** Older bound, Ma. Always >= `to`. */
  from: number;
  /** Younger bound, Ma. */
  to: number;
  parent?: string;
  source: 'workbook' | 'ics-fallback';
}

const ERAS: Array<[string, number, number]> = [
  ['Cenozoic', 66, 0],
  ['Mesozoic', 251.902, 66],
  ['Paleozoic', 538.8, 251.902],
];

/** Epoch / series tier. `parent` matches the period names the workbook uses. */
const EPOCHS: Array<[string, number, number, string]> = [
  // Cenozoic — the tier most exploration questions are actually posed in
  ['Holocene', 0.0117, 0, 'Quaternary'],
  ['Pleistocene', 2.58, 0.0117, 'Quaternary'],
  ['Pliocene', 5.333, 2.58, 'Neogene'],
  ['Miocene', 23.04, 5.333, 'Neogene'],
  ['Oligocene', 33.9, 23.04, 'Paleogene'],
  ['Eocene', 56, 33.9, 'Paleogene'],
  ['Paleocene', 66, 56, 'Paleogene'],
  // Mesozoic series — "Lower/Upper Cretaceous" etc.
  ['Upper Cretaceous', 100.5, 66, 'Cretaceous'],
  ['Lower Cretaceous', 143.1, 100.5, 'Cretaceous'],
  ['Upper Jurassic', 161.5, 143.1, 'Jurassic'],
  ['Middle Jurassic', 174.7, 161.5, 'Jurassic'],
  ['Lower Jurassic', 201.4, 174.7, 'Jurassic'],
  ['Upper Triassic', 237, 201.4, 'Triassic'],
  ['Middle Triassic', 246.7, 237, 'Triassic'],
  ['Lower Triassic', 251.902, 246.7, 'Triassic'],
  // Paleozoic series
  ['Lopingian', 259.51, 251.902, 'Permian'],
  ['Guadalupian', 273.01, 259.51, 'Permian'],
  ['Cisuralian', 298.9, 273.01, 'Permian'],
  ['Pennsylvanian', 323.2, 298.9, 'Carboniferous'],
  ['Mississippian', 358.86, 323.2, 'Carboniferous'],
];

export interface TimescaleRow {
  rank?: string; unit_id?: string; name?: string;
  start_ma?: number; end_ma?: number; parent_name?: string;
}

/** Merge the workbook's timescale with the fallback tiers it does not yet carry. */
export function buildTimescale(rows: TimescaleRow[] | undefined): GeoUnit[] {
  const out: GeoUnit[] = [];
  const seen = new Set<string>();

  for (const r of rows ?? []) {
    if (!r.name || !Number.isFinite(r.start_ma) || !Number.isFinite(r.end_ma)) continue;
    const rank = (r.rank ?? 'period') as GeoRank;
    out.push({
      id: r.unit_id ?? r.name.toLowerCase(),
      name: r.name, rank,
      from: Math.max(r.start_ma!, r.end_ma!), to: Math.min(r.start_ma!, r.end_ma!),
      parent: r.parent_name, source: 'workbook',
    });
    seen.add(`${rank}:${r.name.toLowerCase()}`);
  }

  for (const [name, from, to] of ERAS) {
    if (seen.has(`era:${name.toLowerCase()}`)) continue;
    out.push({ id: `era-${name.toLowerCase()}`, name, rank: 'era', from, to, source: 'ics-fallback' });
  }
  for (const [name, from, to, parent] of EPOCHS) {
    if (seen.has(`epoch:${name.toLowerCase()}`)) continue;
    out.push({ id: `epoch-${name.toLowerCase().replace(/\s+/g, '-')}`, name, rank: 'epoch', from, to, parent, source: 'ics-fallback' });
  }
  return out.sort((a, b) => b.from - a.from);
}

export const unitsOfRank = (all: GeoUnit[], rank: GeoRank) => all.filter((u) => u.rank === rank);
export const childrenOf = (all: GeoUnit[], parentName: string) =>
  all.filter((u) => u.parent?.toLowerCase() === parentName.toLowerCase());

/** Inclusive span of two units, so shift-click can select "Oligocene → Miocene". */
export const spanOf = (a: GeoUnit, b: GeoUnit): [number, number] =>
  [Math.max(a.from, b.from), Math.min(a.to, b.to)];

/** Clamp a proposed [from,to] window to something renderable. */
export function clampRange(range: [number, number], bounds: [number, number]): [number, number] {
  const [bFrom, bTo] = bounds;
  let [from, to] = range;
  if (from - to < 0.5) from = to + 0.5; // never collapse to a zero-width axis
  from = Math.min(from, bFrom);
  to = Math.max(to, bTo);
  return [from, to];
}

/** Which unit of a rank best contains a window — used to label the current zoom. */
export function describeRange(all: GeoUnit[], range: [number, number] | null, full: [number, number]): string {
  if (!range) return 'Full column';
  const [from, to] = range;
  if (from >= full[0] - 0.01 && to <= full[1] + 0.01) return 'Full column';
  const covering = all
    .filter((u) => u.from >= from - 0.01 && u.to <= to + 0.01)
    .sort((a, b) => (b.from - b.to) - (a.from - a.to));
  const exact = covering.find((u) => Math.abs(u.from - from) < 0.01 && Math.abs(u.to - to) < 0.01);
  if (exact) return exact.name;
  const inner = all.filter((u) => u.rank === 'epoch' && u.from <= from + 0.01 && u.to >= to - 0.01);
  if (inner.length) return `${inner[inner.length - 1].name}–${inner[0].name}`;
  return `${Math.round(from)}–${Math.round(to)} Ma`;
}
