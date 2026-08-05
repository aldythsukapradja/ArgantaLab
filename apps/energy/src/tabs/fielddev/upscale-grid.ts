// upscale-grid.ts — well logs → grid cells (S4).
//
// Blocking a log into a cell is an averaging decision, and the average you pick
// changes the answer. Each property gets the one its physics demands:
//
//   FACIES   mode (majority). A facies is a label. A "mean facies" of 0.4 between
//            sand and shale is not a rock that exists.
//   POROSITY arithmetic, thickness-weighted. φ is a volume fraction, so the
//            volume-weighted arithmetic mean is not an approximation — it is exact.
//   PERM     GEOMETRIC by default. k is not additive. Arithmetic is the upper bound
//            (parallel flow), harmonic the lower (series flow), geometric the
//            standard screening compromise for a random medium. Between the three
//            there can be orders of magnitude, so the choice is explicit and
//            recorded on the result rather than defaulted invisibly.
//   SW       arithmetic over the NET samples only — averaging Sw through shale
//            drags the reservoir's saturation toward the seal's.
//
// The input is ArgantaEnergy's own petrophysics under the current parameter set
// (petro-compute.runPetro). Never the delivery's interpreted curves: those stay QC.
// See `forwardStats` in petro-field.ts for the same rule at the zone level.
//
// Pure — no DOM, no IndexedDB, no `import.meta` — so scripts/test-upscale-grid.mjs
// can truth-lock it directly.

export type PermAverage = 'geometric' | 'arithmetic' | 'harmonic';

/** One survey station. Offsets are metres north/east of the wellhead. */
export interface TrajStation { md: number; tvd: number; dispNs?: number; dispEw?: number }

/**
 * Position along a survey at a measured depth: vertical depth AND lateral offset.
 *
 * The lateral part is what makes a deviated well block correctly. Volve's producers
 * step out 463 m (F-12) to 1,595 m (F-15 D) — 9 to 32 columns on a 50 m grid — so a
 * well placed at its surface slot is blocked into rock it never touched, and misses
 * every column it actually drilled.
 *
 * Beyond the last station the final tangent is continued rather than clamped: a log
 * routinely runs past the last survey point, and stacking those samples at one point
 * would pile a whole reservoir section into a single cell.
 */
export function mdToPoint(
  stations: TrajStation[], md: number,
): { tvd: number; ns: number; ew: number } {
  const st = stations.filter((s) => Number.isFinite(s.md) && Number.isFinite(s.tvd));
  if (!st.length) return { tvd: md, ns: 0, ew: 0 };
  const ns = (s: TrajStation) => (Number.isFinite(s.dispNs) ? (s.dispNs as number) : 0);
  const ew = (s: TrajStation) => (Number.isFinite(s.dispEw) ? (s.dispEw as number) : 0);

  if (md <= st[0].md) return { tvd: md, ns: ns(st[0]), ew: ew(st[0]) };
  const last = st[st.length - 1];
  if (md >= last.md) {
    if (st.length < 2) return { tvd: last.tvd, ns: ns(last), ew: ew(last) };
    const prev = st[st.length - 2];
    const dmd = last.md - prev.md;
    const f = dmd > 0 ? (md - last.md) / dmd : 0;
    return {
      tvd: last.tvd + (last.tvd - prev.tvd) * f,
      ns: ns(last) + (ns(last) - ns(prev)) * f,
      ew: ew(last) + (ew(last) - ew(prev)) * f,
    };
  }
  let lo = 0, hi = st.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (st[m].md <= md) lo = m; else hi = m; }
  const span = st[hi].md - st[lo].md;
  const f = span > 0 ? (md - st[lo].md) / span : 0;
  return {
    tvd: st[lo].tvd + (st[hi].tvd - st[lo].tvd) * f,
    ns: ns(st[lo]) + (ns(st[hi]) - ns(st[lo])) * f,
    ew: ew(st[lo]) + (ew(st[hi]) - ew(st[lo])) * f,
  };
}

/**
 * MD → TVD along a survey, by linear interpolation between stations.
 *
 * THIS IS NOT OPTIONAL. A log is indexed in measured depth; a grid is built in true
 * vertical depth. On Volve's F-12 — a 53° well — MD 3,520 m is TVD 3,108 m, a 412 m
 * difference. Blocking a log by MD against a TVDSS grid puts every sample in the
 * wrong layer, and on a deviated well it misses the reservoir entirely.
 *
 * Beyond the last station the survey's own final gradient is continued, because a
 * log routinely runs deeper than the last survey point and clamping would stack
 * every deeper sample at one depth. Before the first station MD is returned as-is:
 * near surface the two are equal to within the thickness of the conductor.
 */
export function mdToTvd(stations: TrajStation[], md: number): number {
  const st = stations.filter((s) => Number.isFinite(s.md) && Number.isFinite(s.tvd));
  if (!st.length) return md;
  if (md <= st[0].md) return md;
  const last = st[st.length - 1];
  if (md >= last.md) {
    if (st.length < 2) return last.tvd;
    const prev = st[st.length - 2];
    const dmd = last.md - prev.md;
    // the last surveyed gradient, continued — never a clamp
    const grad = dmd > 0 ? (last.tvd - prev.tvd) / dmd : 1;
    return last.tvd + (md - last.md) * grad;
  }
  let lo = 0, hi = st.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (st[m].md <= md) lo = m; else hi = m; }
  const span = st[hi].md - st[lo].md;
  const f = span > 0 ? (md - st[lo].md) / span : 0;
  return st[lo].tvd + (st[hi].tvd - st[lo].tvd) * f;
}

/** One log sample, already interpreted and in metres. */
export interface LogSample {
  md: number;
  /** true vertical depth of the sample — what a cell is indexed by */
  tvdss: number;
  vsh: number | null;
  phie: number | null;
  sw: number | null;
  /** true where this sample passed the net cutoffs */
  net: boolean | null;
}

/** A wellbore's samples, with the surface slot needed to place it areally. */
export interface UpscaleWell {
  name: string;
  /** wellhead position in the model's CRS */
  x: number;
  y: number;
  samples: LogSample[];
}

export interface UpscaledCell {
  /** column index in the areal grid */
  i: number; j: number;
  /** layer index within the whole stacked model */
  k: number;
  well: string;
  facies: 0 | 1;
  phie: number;
  sw: number;
  perm: number;
  /** net fraction of the samples in this cell — the cell's NTG */
  ntg: number;
  /**
   * Whether the net fraction could be EVALUATED at all.
   *
   * A cell whose samples all lack a porosity curve is not a cell with no reservoir —
   * it is a cell nobody measured. Recording it as ntg = 0 conditions the net-to-gross
   * simulation with a zero it never observed, and on Volve that is 144 of 347
   * reservoir cells, because RHOB is only run over part of each well. It dragged the
   * modelled NTG from 0.745 to 0.352 and the STOIIP with it.
   */
  ntgKnown: boolean;
  /** how many log samples fell in this cell; 1 or 2 is a thin blocking, and the
   *  caller is told rather than left to assume the average is well-supported */
  nSamples: number;
}

export interface UpscaleResultGrid {
  cells: UpscaledCell[];
  permAverage: PermAverage;
  /** wells that produced no cell at all, with the reason */
  skipped: Array<{ well: string; why: string }>;
  /** cells whose average rests on fewer than 3 samples */
  thinCells: number;
}

// ── the averages ─────────────────────────────────────────────────────────────

/** Arithmetic mean of the finite values; null when there are none. */
export function arithmetic(xs: Array<number | null | undefined>): number | null {
  let s = 0, n = 0;
  for (const x of xs) if (x != null && Number.isFinite(x)) { s += x; n++; }
  return n ? s / n : null;
}

/** Geometric mean. Zero and negative values are EXCLUDED rather than clamped: a
 *  permeability of zero would send the geometric mean to zero regardless of every
 *  other sample, which is a property of the formula, not of the rock. */
export function geometric(xs: Array<number | null | undefined>): number | null {
  let s = 0, n = 0;
  for (const x of xs) if (x != null && Number.isFinite(x) && x > 0) { s += Math.log(x); n++; }
  return n ? Math.exp(s / n) : null;
}

/** Harmonic mean — the series-flow lower bound. Same exclusion rule. */
export function harmonic(xs: Array<number | null | undefined>): number | null {
  let s = 0, n = 0;
  for (const x of xs) if (x != null && Number.isFinite(x) && x > 0) { s += 1 / x; n++; }
  return n ? n / s : null;
}

export function averageBy(kind: PermAverage, xs: Array<number | null | undefined>): number | null {
  return kind === 'arithmetic' ? arithmetic(xs) : kind === 'harmonic' ? harmonic(xs) : geometric(xs);
}

/** The mode of a label set. Ties go to the FIRST label seen, which keeps the result
 *  deterministic — a coin-flip facies would make two identical runs disagree. */
export function majority<T extends string | number>(labels: T[]): T | null {
  if (!labels.length) return null;
  const count = new Map<T, number>();
  for (const l of labels) count.set(l, (count.get(l) ?? 0) + 1);
  let best = labels[0], bestN = 0;
  for (const l of labels) {
    const n = count.get(l) as number;
    if (n > bestN) { best = l; bestN = n; }
  }
  return best;
}

/** Fraction of samples flagged net. Samples with no flag are excluded from BOTH
 *  numerator and denominator — an unevaluable sample is not a non-net sample. */
export function netFraction(flags: Array<boolean | null | undefined>): number | null {
  let n = 0, t = 0;
  for (const f of flags) if (f != null) { t++; if (f) n++; }
  return t ? n / t : null;
}

// ── the blocking ─────────────────────────────────────────────────────────────

/** The vertical extent of one layer in one column, from the model's own geometry. */
export interface ColumnLayers {
  /** layer k → [topTvdss, baseTvdss], positive down, shallowest first */
  spans: Array<[number, number]>;
}

/**
 * Block one well's samples into the layers of the column it sits in.
 *
 * A sample belongs to the layer whose depth span contains it. Samples above the
 * first layer or below the last are DROPPED, not clamped into the nearest — a log
 * that starts above the model is not evidence about the model's top layer.
 */
export function blockWell(
  well: UpscaleWell,
  column: { i: number; j: number },
  layers: ColumnLayers,
  opts: { permAverage: PermAverage; phiToK: (phi: number) => number; sandVshCutoff?: number },
): UpscaledCell[] {
  const sandCut = opts.sandVshCutoff ?? 0.5;
  const buckets = new Map<number, LogSample[]>();

  for (const s of well.samples) {
    if (!Number.isFinite(s.tvdss)) continue;
    // binary search would be faster; layer counts here are tens, so a scan is clearer
    for (let k = 0; k < layers.spans.length; k++) {
      const [t, b] = layers.spans[k];
      if (s.tvdss >= t && s.tvdss < b) {
        const list = buckets.get(k);
        if (list) list.push(s); else buckets.set(k, [s]);
        break;
      }
    }
  }

  const out: UpscaledCell[] = [];
  for (const [k, samples] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    // net samples drive φ, Sw and k; the whole set drives NTG and facies, because
    // "how much of this cell is reservoir" is a question about all of it
    const net = samples.filter((s) => s.net === true);
    const forProps = net.length ? net : samples;

    const phie = arithmetic(forProps.map((s) => s.phie));
    if (phie == null) continue;                   // no porosity ⇒ no cell

    const sw = arithmetic(forProps.map((s) => s.sw)) ?? 1;
    const perm = averageBy(opts.permAverage, forProps.map((s) => (s.phie != null ? opts.phiToK(s.phie) : null))) ?? 0;
    const ntgRaw = netFraction(samples.map((s) => s.net));
    const ntgKnown = ntgRaw != null;
    const ntg = ntgRaw ?? (net.length ? net.length / samples.length : 0);
    const facies = majority(samples.map((s) => ((s.vsh ?? 1) <= sandCut ? 1 : 0) as 0 | 1)) ?? 0;

    out.push({
      i: column.i, j: column.j, k,
      well: well.name,
      facies, phie, sw, perm, ntg, ntgKnown,
      nSamples: samples.length,
    });
  }
  return out;
}

/** A sample carrying its own position, from the survey. */
export interface PlacedSample extends LogSample {
  /** world easting/northing of this sample, wellhead + survey offset */
  x: number;
  y: number;
}

export interface PathWell {
  name: string;
  samples: PlacedSample[];
}

/** Place a well's samples along its own survey. */
export function placeSamples(
  wellhead: { x: number; y: number },
  stations: TrajStation[],
  samples: LogSample[],
): PlacedSample[] {
  return samples.map((s) => {
    const p = mdToPoint(stations, s.md);
    return { ...s, tvdss: p.tvd, x: wellhead.x + p.ew, y: wellhead.y + p.ns };
  });
}

/**
 * Block a well along its PATH: every column it crosses, not just its slot.
 *
 * This is the difference between a producer contributing one column of conditioning
 * data and contributing the thirty it actually drilled. Samples are grouped by
 * (column, layer) and averaged within each group by the same rules `blockWell` uses.
 */
export function blockWellPath(
  well: PathWell,
  grid: { nx: number; ny: number; dx: number; dy: number; x0: number; y0: number },
  layersFor: (i: number, j: number) => ColumnLayers | null,
  opts: { permAverage: PermAverage; phiToK: (phi: number) => number; sandVshCutoff?: number },
): { cells: UpscaledCell[]; columnsCrossed: number; outsideGrid: number; noLayer: number } {
  const sandCut = opts.sandVshCutoff ?? 0.5;
  // (column, layer) → samples
  const buckets = new Map<string, { i: number; j: number; k: number; s: LogSample[] }>();
  const columns = new Set<number>();
  let outsideGrid = 0, noLayer = 0;
  // one layer lookup per column, not per sample
  const layerCache = new Map<number, ColumnLayers | null>();

  for (const s of well.samples) {
    if (!Number.isFinite(s.tvdss)) continue;
    const col = columnOf(s.x, s.y, grid);
    if (!col) { outsideGrid++; continue; }
    const cIdx = col.j * grid.nx + col.i;
    columns.add(cIdx);
    let layers = layerCache.get(cIdx);
    if (layers === undefined) { layers = layersFor(col.i, col.j); layerCache.set(cIdx, layers); }
    if (!layers?.spans.length) { noLayer++; continue; }

    let placed = false;
    for (let k = 0; k < layers.spans.length; k++) {
      const [t, b] = layers.spans[k];
      if (!Number.isFinite(t) || !Number.isFinite(b)) continue;
      if (s.tvdss >= t && s.tvdss < b) {
        const key = `${cIdx}|${k}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.s.push(s); else buckets.set(key, { i: col.i, j: col.j, k, s: [s] });
        placed = true;
        break;
      }
    }
    if (!placed) noLayer++;
  }

  const cells: UpscaledCell[] = [];
  for (const { i, j, k, s: samples } of buckets.values()) {
    const net = samples.filter((x) => x.net === true);
    const forProps = net.length ? net : samples;
    const phie = arithmetic(forProps.map((x) => x.phie));
    if (phie == null) continue;
    const sw = arithmetic(forProps.map((x) => x.sw)) ?? 1;
    const perm = averageBy(opts.permAverage, forProps.map((x) => (x.phie != null ? opts.phiToK(x.phie) : null))) ?? 0;
    const ntgRaw = netFraction(samples.map((x) => x.net));
    const ntgKnown = ntgRaw != null;
    const ntg = ntgRaw ?? (net.length ? net.length / samples.length : 0);
    const facies = majority(samples.map((x) => ((x.vsh ?? 1) <= sandCut ? 1 : 0) as 0 | 1)) ?? 0;
    cells.push({ i, j, k, well: well.name, facies, phie, sw, perm, ntg, ntgKnown, nSamples: samples.length });
  }

  return { cells, columnsCrossed: columns.size, outsideGrid, noLayer };
}

/** Areal column a well falls in; null when it sits outside the grid. */
export function columnOf(
  x: number, y: number,
  grid: { nx: number; ny: number; dx: number; dy: number; x0: number; y0: number },
): { i: number; j: number } | null {
  const i = Math.floor((x - grid.x0) / grid.dx);
  const j = Math.floor((y - grid.y0) / grid.dy);
  if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) return null;
  return { i, j };
}

/**
 * Block every well into the grid.
 *
 * One well can only condition ONE column — the column its wellhead sits in. A
 * deviated well genuinely crosses several columns, and following its trajectory is
 * the correct treatment; that needs the survey rather than the slot, and until it is
 * wired the single-column result is reported as such rather than presented as a
 * trajectory-aware blocking.
 */
export function upscaleWells(
  wells: UpscaleWell[],
  grid: { nx: number; ny: number; dx: number; dy: number; x0: number; y0: number },
  layersFor: (i: number, j: number) => ColumnLayers | null,
  opts: { permAverage: PermAverage; phiToK: (phi: number) => number; sandVshCutoff?: number },
): UpscaleResultGrid {
  const cells: UpscaledCell[] = [];
  const skipped: UpscaleResultGrid['skipped'] = [];

  for (const w of wells) {
    if (!w.samples.length) { skipped.push({ well: w.name, why: 'no interpreted samples' }); continue; }
    const col = columnOf(w.x, w.y, grid);
    if (!col) { skipped.push({ well: w.name, why: 'wellhead outside the model area' }); continue; }
    const layers = layersFor(col.i, col.j);
    if (!layers || !layers.spans.length) { skipped.push({ well: w.name, why: 'column is not in the model' }); continue; }
    const got = blockWell(w, col, layers, opts);
    if (!got.length) { skipped.push({ well: w.name, why: 'no sample fell inside a layer' }); continue; }
    cells.push(...got);
  }

  return {
    cells,
    permAverage: opts.permAverage,
    skipped,
    thinCells: cells.filter((c) => c.nSamples < 3).length,
  };
}
