// model-stats.ts — the numbers a modeller reads off a static model.
//
// Distinct from `model-qc.ts`, deliberately. That module answers "is this fit to hand
// over" with pass/fail. This one answers "what IS it" with distributions: the structure,
// the property statistics, the facies proportions, what the upscaling did, and the
// volumes. A QC panel needs both, and mixing them produces a screen that is neither.
//
// ── WHY PERCENTILES AND NOT JUST MIN/MEAN/MAX ───────────────────────────────
//
// A single unresolved null or one capped permeability sets a min or a max, and a mean
// over a log-distributed property describes no cell in the model. Every continuous
// summary here carries P10/P50/P90 alongside, and permeability additionally carries a
// geometric mean, because for permeability that is the one that means anything.
//
// Pure — no DOM, no IndexedDB, no three.js.
import { propValueAt, styleFor, type PackedGridLike } from './prop-view.ts';

export interface Distribution {
  n: number;
  min: number; max: number;
  mean: number;
  p10: number; p50: number; p90: number;
  /** only meaningful for a log-distributed property; NaN otherwise */
  geoMean: number;
  /** cells that were skipped because the column is inactive */
  skipped: number;
}

const EMPTY: Distribution = {
  n: 0, min: NaN, max: NaN, mean: NaN, p10: NaN, p50: NaN, p90: NaN, geoMean: NaN, skipped: 0,
};

/** Summarise a set of values. Sorts once and reads the percentiles off it. */
export function distribution(values: number[], skipped = 0, wantGeo = false): Distribution {
  const v = values.filter(Number.isFinite);
  if (!v.length) return { ...EMPTY, skipped };
  v.sort((a, b) => a - b);
  const at = (f: number) => v[Math.min(v.length - 1, Math.max(0, Math.floor(f * (v.length - 1))))];
  const sum = v.reduce((a, b) => a + b, 0);
  let geoMean = NaN;
  if (wantGeo) {
    // a single zero would take the whole logarithm with it, so the floor is explicit
    let ls = 0;
    for (const x of v) ls += Math.log(Math.max(1e-6, x));
    geoMean = Math.exp(ls / v.length);
  }
  return {
    n: v.length, min: v[0], max: v[v.length - 1], mean: sum / v.length,
    p10: at(0.1), p50: at(0.5), p90: at(0.9), geoMean, skipped,
  };
}

export interface PropertyStats {
  key: string;
  label: string;
  unit: string;
  dist: Distribution;
  /** true when the mean is a poor summary and the geometric mean should be quoted */
  logDistributed: boolean;
}

/** Every packed property, summarised over the active cells. */
export function propertyStats(g: PackedGridLike): PropertyStats[] {
  return g.props.filter((p) => !p.categorical).map((prop) => {
    const style = styleFor(prop.name);
    const vals: number[] = [];
    let skipped = 0;
    for (let l = 0; l < g.nz; l++) {
      for (let j = 0; j < g.ny; j++) {
        for (let i = 0; i < g.nx; i++) {
          const v = propValueAt(g, prop, i, j, l);
          if (Number.isFinite(v)) vals.push(v); else skipped++;
        }
      }
    }
    return {
      key: prop.name, label: style.label, unit: style.unit,
      dist: distribution(vals, skipped, !!style.log),
      logDistributed: !!style.log,
    };
  });
}

export interface FaciesStats {
  total: number;
  codes: Array<{ code: number; label: string; count: number; fraction: number }>;
  /** the sand fraction, when a code is labelled sand */
  sandFraction: number;
}

/**
 * Facies proportions over the active cells.
 *
 * Counted, never averaged. A "mean facies" of 0.8 is not a rock, and the moment it
 * appears on a panel somebody will compare it to a net-to-gross and conclude they are
 * the same number.
 */
export function faciesStats(g: PackedGridLike): FaciesStats | null {
  const prop = g.props.find((p) => p.categorical);
  if (!prop) return null;
  const style = styleFor(prop.name);
  const counts = new Map<number, number>();
  let total = 0;
  for (let l = 0; l < g.nz; l++) {
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const v = propValueAt(g, prop, i, j, l);
        if (!Number.isFinite(v)) continue;
        const c = Math.round(v);
        counts.set(c, (counts.get(c) ?? 0) + 1);
        total++;
      }
    }
  }
  const codes = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, count]) => ({
      code,
      label: style.codes?.find((x) => x.code === code)?.label ?? `code ${code}`,
      count,
      fraction: total ? count / total : 0,
    }));
  const sand = codes.find((c) => /sand/i.test(c.label));
  return { total, codes, sandFraction: sand ? sand.fraction : NaN };
}

export interface StructureStats {
  nx: number; ny: number; nz: number;
  cells: number;
  activeColumns: number;
  liveCells: number;
  /** areal footprint of the active columns, km² */
  areaKm2: number;
  cellSizeM: number;
  /** gross thickness across the active columns */
  thickness: Distribution;
  topDepth: Distribution;
  baseDepth: Distribution;
}

export function structureStats(
  g: { nx: number; ny: number; nz: number; dx: number; dy: number;
       topZ: ArrayLike<number>; baseZ: ArrayLike<number>; activeCol: ArrayLike<number> },
): StructureStats {
  const thk: number[] = [], top: number[] = [], base: number[] = [];
  let activeColumns = 0;
  for (let c = 0; c < g.nx * g.ny; c++) {
    if (!g.activeCol[c]) continue;
    activeColumns++;
    const t = g.topZ[c], b = g.baseZ[c];
    if (!Number.isFinite(t) || !Number.isFinite(b)) continue;
    top.push(t); base.push(b);
    if (b > t) thk.push(b - t);
  }
  return {
    nx: g.nx, ny: g.ny, nz: g.nz,
    cells: g.nx * g.ny * g.nz,
    activeColumns,
    liveCells: thk.length * g.nz,
    areaKm2: (activeColumns * g.dx * g.dy) / 1e6,
    cellSizeM: g.dx,
    thickness: distribution(thk),
    topDepth: distribution(top),
    baseDepth: distribution(base),
  };
}

export interface UpscaleStats {
  wells: number;
  wellsWithCells: number;
  cells: number;
  /** cells resting on fewer than three log samples — a thin blocking */
  thinCells: number;
  columnsCrossed: number;
  perWell: Array<{ well: string; cells: number; columns: number; meanPhi: number; meanNtg: number }>;
  /** blocked φ against the log φ it came from — the blocking bias */
  logPhi: Distribution;
  blockedPhi: Distribution;
}

/**
 * What the upscaling actually did.
 *
 * The blocked and the log distributions are reported side by side because the
 * interesting number is the DIFFERENCE: blocking many samples into one cell is an
 * averaging step, and an averaging step that shifts the mean has changed the model.
 */
export function upscaleStats(
  cells: Array<{ well: string; i: number; j: number; phie: number; ntg: number; nSamples: number }>,
  logPhiSamples: number[],
  wellCount: number,
): UpscaleStats {
  const byWell = new Map<string, typeof cells>();
  for (const c of cells) {
    const list = byWell.get(c.well);
    if (list) list.push(c); else byWell.set(c.well, [c]);
  }
  const perWell = [...byWell.entries()].map(([well, cs]) => {
    const cols = new Set(cs.map((c) => `${c.i},${c.j}`));
    const fin = (xs: number[]) => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
    return {
      well, cells: cs.length, columns: cols.size,
      meanPhi: fin(cs.map((c) => c.phie)),
      meanNtg: fin(cs.map((c) => c.ntg)),
    };
  }).sort((a, b) => b.cells - a.cells);

  const allCols = new Set(cells.map((c) => `${c.i},${c.j}`));
  return {
    wells: wellCount,
    wellsWithCells: byWell.size,
    cells: cells.length,
    thinCells: cells.filter((c) => c.nSamples < 3).length,
    columnsCrossed: allCols.size,
    perWell,
    logPhi: distribution(logPhiSamples),
    blockedPhi: distribution(cells.map((c) => c.phie)),
  };
}

export interface VolumeReportRow {
  label: string;
  value: string;
  /** where the number came from — modelled, assumed, or published */
  source: 'modelled' | 'assumed' | 'published' | 'derived';
  note?: string;
}

/**
 * The volumetric report, as rows that carry their own PROVENANCE.
 *
 * Every row says whether it was modelled, assumed or published. A volumetric report
 * whose terms all look alike invites the reader to trust an assumed saturation exactly
 * as much as a simulated porosity, and that is how a screening number ends up in a
 * decision document.
 */
export function volumeReport(v: {
  grvM3: number; ntg: number; phi: number; sw: number; bo: number;
  stoiipMMSm3: number;
  officialMMSm3?: number;
  ntgSource?: VolumeReportRow['source'];
  swSource?: VolumeReportRow['source'];
  contactM?: number;
  contactNature?: string;
  poolName?: string;
}): VolumeReportRow[] {
  const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '—');
  const rows: VolumeReportRow[] = [
    { label: 'Gross rock volume', value: `${f(v.grvM3 / 1e6, 1)} Mm³`, source: 'modelled' },
    { label: 'Net-to-gross', value: f(v.ntg), source: v.ntgSource ?? 'modelled' },
    { label: 'Porosity', value: f(v.phi), source: 'modelled' },
    { label: 'Water saturation', value: f(v.sw), source: v.swSource ?? 'modelled' },
    { label: 'Bo', value: f(v.bo, 2), source: 'published', note: 'deck PVTO' },
  ];
  if (Number.isFinite(v.contactM as number)) {
    rows.push({
      label: 'Fluid contact', value: `${f(v.contactM as number, 0)} m TVDSS`,
      source: 'assumed', note: v.contactNature,
    });
  }
  rows.push({
    label: v.poolName ? `STOIIP — ${v.poolName}` : 'STOIIP',
    value: `${f(v.stoiipMMSm3, 2)} MMSm³`, source: 'derived',
  });
  if (Number.isFinite(v.officialMMSm3 as number)) {
    const r = v.stoiipMMSm3 / (v.officialMMSm3 as number);
    rows.push({
      label: 'vs published', value: `${f(r, 2)}×`,
      source: 'published', note: `${f(v.officialMMSm3 as number, 2)} MMSm³`,
    });
  }
  return rows;
}

// ── the volumetric breakdown ────────────────────────────────────────────────
//
// A single STOIIP is a decision number, not a working one. What a modeller argues from
// is the breakdown: which zone holds the rock, which segment holds the oil, and where
// the net-to-gross or the saturation is doing the work. This is the table that goes in
// the report.

export interface VolumeBreakdownRow {
  /** zone name, pool id, or whatever the caller grouped by */
  group: string;
  cells: number;
  /** gross rock volume, m³ */
  grvM3: number;
  /** NET rock volume = GRV × NTG. Quoted separately because NRV is what a net-pay map
   *  integrates to, and reporting only GRV invites the reader to compare a gross
   *  volume against someone else's net one. */
  nrvM3: number;
  /** pore volume, m³ */
  pvM3: number;
  /** hydrocarbon pore volume, m³ */
  hcpvM3: number;
  /** bulk-weighted averages over the group */
  ntg: number;
  phi: number;
  sw: number;
  stoiipMMSm3: number;
  /** share of the total STOIIP */
  share: number;
}

export interface VolumeCellLike {
  group: string;
  /** bulk volume of the part of the cell that counts (already contact-cut) */
  bulkM3: number;
  ntg: number;
  phi: number;
  sw: number;
}

/**
 * Roll cells up into a breakdown, grouped by whatever the caller put in `group`.
 *
 * Averages are BULK-WEIGHTED, not cell-means. Layers are proportional within a zone, so
 * a thick cell and a thin one are not equal evidence about the rock — and a plain mean
 * over cells lets a zone split into many thin layers outvote one split into few thick
 * ones for no physical reason.
 */
export function volumeBreakdown(cells: VolumeCellLike[], bo: number): VolumeBreakdownRow[] {
  const acc = new Map<string, { cells: number; grv: number; nrv: number; pv: number; hcpv: number }>();
  for (const c of cells) {
    if (!Number.isFinite(c.bulkM3) || c.bulkM3 <= 0) continue;
    const ntg = Number.isFinite(c.ntg) ? c.ntg : 0;
    const phi = Number.isFinite(c.phi) ? c.phi : 0;
    const sw = Number.isFinite(c.sw) ? c.sw : 1;
    const a = acc.get(c.group) ?? { cells: 0, grv: 0, nrv: 0, pv: 0, hcpv: 0 };
    a.cells++;
    a.grv += c.bulkM3;
    a.nrv += c.bulkM3 * ntg;
    a.pv += c.bulkM3 * ntg * phi;
    a.hcpv += c.bulkM3 * ntg * phi * (1 - sw);
    acc.set(c.group, a);
  }
  const rows = [...acc.entries()].map(([group, a]) => ({
    group, cells: a.cells,
    grvM3: a.grv, nrvM3: a.nrv, pvM3: a.pv, hcpvM3: a.hcpv,
    ntg: a.grv > 0 ? a.nrv / a.grv : NaN,
    phi: a.nrv > 0 ? a.pv / a.nrv : NaN,
    sw: a.pv > 0 ? 1 - a.hcpv / a.pv : NaN,
    stoiipMMSm3: bo > 0 ? a.hcpv / bo / 1e6 : NaN,
    share: 0,
  }));
  const total = rows.reduce((s, r) => s + r.stoiipMMSm3, 0);
  for (const r of rows) r.share = total > 0 ? r.stoiipMMSm3 / total : 0;
  return rows.sort((a, b) => b.stoiipMMSm3 - a.stoiipMMSm3);
}

/**
 * Does the breakdown add up to the total it claims to explain?
 *
 * A breakdown that does not sum to its own total is worse than no breakdown: every row
 * looks defensible and the reader has no way to see that one is missing. Returns the
 * relative residual, so the report can print it rather than assume it is zero.
 */
export function breakdownResidual(rows: VolumeBreakdownRow[], totalMMSm3: number): number {
  const sum = rows.reduce((s, r) => s + r.stoiipMMSm3, 0);
  return totalMMSm3 > 0 ? Math.abs(sum - totalMMSm3) / totalMMSm3 : 0;
}
