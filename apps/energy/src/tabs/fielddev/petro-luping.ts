// petro-luping.ts — the LUPING table: the long-form zonation deliverable.
//
// The matrix on screen is one metric at a time, wide. The artifact that leaves
// this tab is the opposite shape: one ROW per bore per zone, carrying every
// number for that interval at once — depths, thickness, and the interpretation.
// That is the form a static model, a volumetrics run or a spreadsheet actually
// consumes, and it is what the download emits.
//
// ORDERING IS BY CUMULATIVE OIL, not alphabetically. A zonation table read
// top-down should start with the bores that made the field's production; F-14 and
// F-12 before an appraisal bore that made nothing. Bores with no production
// record sort after every producing one, and the reason is carried on the row
// rather than expressed as a zero — no production RECORD and no production are
// different facts.
import { useEffect, useMemo, useState } from 'react';
import { loadProd } from '../../wb/load';
import { summariseWell } from './well-stats';
import { forwardStats, type FieldZoneRow } from './petro-field';

export interface LupingRow {
  well: string;
  formation: string;
  /** interval, measured depth */
  top: number | null;
  base: number | null;
  /** base − top. The gross thickness, stated rather than left to be computed. */
  gross: number | null;
  net: number | null;
  ntg: number | null;
  phie: number | null;
  sw: number | null;
  /** why a cell is empty, when it is */
  status: 'evaluated' | 'no curves';
}

/** Cumulative oil per bore, for the column order. Null = no production record,
 *  which is NOT zero production. */
export type CumOil = Map<string, number | null>;

export function useCumulativeOil(wells: string[]): { cum: CumOil; loading: boolean } {
  const [cum, setCum] = useState<CumOil>(new Map());
  const [loading, setLoading] = useState(false);
  const key = useMemo(() => wells.slice().sort().join('|'), [wells]);

  useEffect(() => {
    if (!wells.length) { setCum(new Map()); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const out: CumOil = new Map();
      await Promise.all(wells.map(async (w) => {
        try {
          const p = await loadProd(w);
          // A bore with no prod file has no RECORD. Recording that as 0 would rank
          // it identically to a bore that produced nothing, and they are different.
          out.set(w, p?.monthly?.length ? summariseWell(p.monthly as never).cumOil : null);
        } catch { out.set(w, null); }
      }));
      if (alive) { setCum(out); setLoading(false); }
    })().catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { cum, loading };
}

/** Producing bores first, by cumulative oil descending; bores with no production
 *  record after them, alphabetically. */
export function orderByProduction(wells: string[], cum: CumOil): string[] {
  return wells.slice().sort((a, b) => {
    const ca = cum.get(a) ?? null, cb = cum.get(b) ?? null;
    if (ca == null && cb == null) return a.localeCompare(b, 'en', { numeric: true });
    if (ca == null) return 1;
    if (cb == null) return -1;
    return cb - ca;
  });
}

/**
 * The panel's left-to-right sequence, from the tree's filters.
 *
 * Lives here, and not in the panel, because the correlation map draws the SAME
 * sequence as a line on the field. Two implementations of "which bores, in what
 * order" is two answers the moment one of them is edited.
 *
 *   panelWells  empty = every bore (an empty filter is the absence of one)
 *   panelOrder  explicit sequence; anything unnamed keeps its production order
 *               AFTER the named ones, so a partial reorder never drops a bore
 */
export function panelSequence(
  wells: string[], panelWells: string[], panelOrder: string[], cum: CumOil,
): string[] {
  const shown = panelWells.length ? wells.filter((w) => panelWells.includes(w)) : wells.slice();
  const byProd = orderByProduction(shown, cum);
  if (!panelOrder.length) return byProd;
  const rank = new Map(panelOrder.map((w, i) => [w, i]));
  return byProd.slice().sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
}

/** Long form: one row per bore per zone. */
export function buildLuping(rows: FieldZoneRow[], order: string[]): LupingRow[] {
  const rank = new Map(order.map((w, i) => [w, i]));
  return rows
    .slice()
    .sort((a, b) => (rank.get(a.well) ?? 999) - (rank.get(b.well) ?? 999)
      || a.formation.localeCompare(b.formation))
    .map((r) => {
      const s = forwardStats(r);
      const top = Number.isFinite(r.top) ? r.top : null;
      const base = Number.isFinite(r.base) ? r.base : null;
      return {
        well: r.well,
        formation: r.formation,
        top,
        base,
        gross: top != null && base != null ? base - top : null,
        net: s ? s.netM : null,
        ntg: s ? s.ntg : null,
        phie: s ? s.phie : null,
        sw: s ? s.sw : null,
        status: s ? 'evaluated' as const : 'no curves' as const,
      };
    });
}

const CSV_COLS: Array<[keyof LupingRow, string]> = [
  ['well', 'Well'], ['formation', 'Formation'],
  ['top', 'Top MD (m)'], ['base', 'Base MD (m)'], ['gross', 'Gross (m)'],
  ['net', 'Net (m)'], ['ntg', 'N:G'], ['phie', 'PHIE (v/v)'], ['sw', 'Sw (v/v)'],
  ['status', 'Status'],
];

/**
 * CSV. An unevaluated interval writes an EMPTY cell, never a zero — the whole
 * point of the three-state table is lost the moment it is exported as numbers.
 * The status column carries the reason so the distinction survives the download.
 */
export function lupingCsv(rows: LupingRow[], meta: { field: string; when: string }): string {
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = [
    `# Luping — zonation deliverable`,
    `# field,${esc(meta.field)}`,
    `# generated,${esc(meta.when)}`,
    `# note,"empty cells are intervals that could not be evaluated — not zero"`,
    CSV_COLS.map(([, label]) => esc(label)).join(','),
  ];
  const body = rows.map((r) => CSV_COLS.map(([k]) => {
    const v = r[k];
    return typeof v === 'number' ? esc(Math.round(v * 1e4) / 1e4) : esc(v);
  }).join(','));
  return [...head, ...body].join('\n');
}

/** Distribution of one numeric column, for the click-through histogram. */
export interface Histogram {
  bins: Array<{ lo: number; hi: number; n: number }>;
  n: number;
  min: number; max: number; mean: number; median: number;
  /** rows that carry no value for this column — reported, never binned as 0 */
  missing: number;
}

export function histogram(values: Array<number | null>, binCount = 12): Histogram | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  const missing = values.length - v.length;
  if (v.length < 2) return null;
  const sorted = v.slice().sort((a, b) => a - b);
  const min = sorted[0], max = sorted[sorted.length - 1];
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  // a single-valued column is a real answer, not a degenerate histogram
  if (max === min) return { bins: [{ lo: min, hi: max, n: v.length }], n: v.length, min, max, mean, median, missing };
  const w = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({ lo: min + i * w, hi: min + (i + 1) * w, n: 0 }));
  for (const x of v) bins[Math.min(binCount - 1, Math.floor((x - min) / w))].n += 1;
  return { bins, n: v.length, min, max, mean, median, missing };
}
