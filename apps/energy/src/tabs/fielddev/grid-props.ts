// grid-props.ts — writing modelled properties back into the packed grid.
//
// ── THE BUG THIS EXISTS TO FIX ──────────────────────────────────────────────
//
// `buildPackedGrid` calls `fillGeometricOnly` — phi 0, sw 1, ntg 1, perm 0, facies 0 —
// because at build time there is no property model yet. The simulation then ran, and
// its result was stored in the session as a `SimResult`... and nothing ever wrote it
// back into `packed.props`.
//
// That matters because the PACKED GRID is what everything downstream reads: the
// viewport's colouring, the IJK slice, the colour table, `propRange`, and every QC
// statistic. So the model was fully simulated and the screen showed a single value
// everywhere — a legend reading 0.000 across every tick, a shell rendered at the bottom
// of its own ramp, and a layer player that appeared inert because every layer it drew
// was the same colour.
//
// ── QUANTISATION IS LOSSY, AND THE RANGE IS PART OF THE DATA ────────────────
//
// A packed property is u8 or u16 normalised over its OWN min/max. Writing new values
// therefore means recomputing that range — a property written against a stale min/max
// is silently clipped at both ends. The range is re-derived here from the values
// actually being written, over ACTIVE cells only.
//
// Pure — no DOM, no three.js, no IndexedDB.

export interface WritablePackedProp {
  name: string;
  dtype: 'u8' | 'u16';
  categorical: boolean;
  min: number;
  max: number;
  data: Uint8Array | Uint16Array;
}

export interface WritablePackedGrid {
  nx: number; ny: number; nz: number;
  activeCol: Uint8Array | ArrayLike<number>;
  props: WritablePackedProp[];
}

const DTYPE_MAX = { u8: 255, u16: 65535 } as const;

/**
 * A value for one cell, by areal column and layer.
 *
 * Returning NaN means "not modelled here" and is written as the property's minimum
 * rather than as a fabricated value — the caller keeps the record of which layers were
 * simulated, and a NaN must not become a plausible-looking number.
 */
export type CellSource = (col: number, layer: number) => number;

export interface PropWriteReport {
  name: string;
  min: number;
  max: number;
  /** cells that carried a finite value */
  written: number;
  /** active cells the source had nothing for */
  missing: number;
  /** true when every written value was identical — the symptom that started all this */
  degenerate: boolean;
}

export interface WriteReport {
  props: PropWriteReport[];
  activeCells: number;
  /** properties that came back with a single value across the whole grid */
  degenerate: string[];
}

/**
 * Write modelled values into the packed grid, IN PLACE, and requantise.
 *
 * In place because the packed arrays are large and shared by the viewport's geometry;
 * a copy would double the memory of the one structure that exists to be small.
 *
 * A property with no source is left exactly as it was — this must be usable to update
 * porosity without disturbing facies.
 */
export function writePackedProps(
  g: WritablePackedGrid,
  sources: Record<string, CellSource>,
  /**
   * What a NaN means, per property.
   *
   * ── THE TRAP THIS CLOSES ──────────────────────────────────────────────────
   *
   * A NaN used to be written as `data = 0`, and 0 decodes to the property's MINIMUM.
   * For porosity that reads as tight rock, which is at least plausible. For SATURATION
   * it reads as the LOWEST water — the most oil-bearing cell in the model — so the
   * caprock, which is not simulated at all, rendered as the best rock on the map.
   *
   * A seal holds no hydrocarbon: its Sw is 1, not "unknown, shown as zero". Callers
   * name that here rather than discovering it on a screenshot.
   */
  missing: Record<string, number> = {},
): WriteReport {
  const nCol = g.nx * g.ny;
  let activeCells = 0;
  for (let c = 0; c < nCol; c++) if (g.activeCol[c]) activeCells += g.nz;

  const report: PropWriteReport[] = [];

  for (const prop of g.props) {
    const src = sources[prop.name];
    if (!src) continue;

    // ── pass 1: the range, over active cells only ──
    //
    // Inactive columns hold zeros that mean "no cell here". Including them would drag
    // every range down to zero and re-create the bug this module fixes.
    const miss = missing[prop.name];
    const hasMiss = Number.isFinite(miss);
    let min = Infinity, max = -Infinity, written = 0, missingN = 0;
    for (let l = 0; l < g.nz; l++) {
      for (let c = 0; c < nCol; c++) {
        if (!g.activeCol[c]) continue;
        const raw = src(c, l);
        const v = Number.isFinite(raw) ? raw : (hasMiss ? (miss as number) : NaN);
        if (!Number.isFinite(v)) { missingN++; continue; }
        written++;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!written) {
      report.push({ name: prop.name, min: prop.min, max: prop.max, written: 0, missing: missingN, degenerate: true });
      continue;
    }
    if (min > max) { min = 0; max = 1; }

    // A single-valued property is legitimate (a constant net-to-gross, one facies) but
    // it is also exactly what a broken pipeline looks like, so it is REPORTED.
    const degenerate = max - min < 1e-12;

    // ── pass 2: quantise ──
    const qmax = DTYPE_MAX[prop.dtype];
    const span = max - min || 1;
    for (let l = 0; l < g.nz; l++) {
      for (let c = 0; c < nCol; c++) {
        const di = l * nCol + c;
        if (!g.activeCol[c]) { prop.data[di] = 0; continue; }
        const raw = src(c, l);
        const v = Number.isFinite(raw) ? raw : (hasMiss ? (miss as number) : NaN);
        if (!Number.isFinite(v)) { prop.data[di] = 0; continue; }
        prop.data[di] = prop.categorical
          ? Math.max(0, Math.min(qmax, Math.round(v)))
          : Math.max(0, Math.min(qmax, Math.round(((v - min) / span) * qmax)));
      }
    }
    // categorical properties keep raw codes, so their min/max is the code range
    prop.min = prop.categorical ? 0 : min;
    prop.max = prop.categorical ? Math.max(1, Math.round(max)) : max;

    report.push({ name: prop.name, min: prop.min, max: prop.max, written, missing: missingN, degenerate });
  }

  return { props: report, activeCells, degenerate: report.filter((r) => r.degenerate).map((r) => r.name) };
}

/**
 * Append a property the packer does not create.
 *
 * `pack3d.DEFAULT_PROPS` is keyed to fields of `GridModel`, so a DERIVED property —
 * one computed from the others rather than simulated — has nowhere to live at build
 * time. It is added here instead, and idempotently: calling this twice must not give
 * the grid two porosity arrays.
 */
export function ensureProp(
  g: WritablePackedGrid, name: string, dtype: 'u8' | 'u16' = 'u16', categorical = false,
): WritablePackedProp {
  const found = g.props.find((p) => p.name === name);
  if (found) return found;
  const n = g.nx * g.ny * g.nz;
  const prop: WritablePackedProp = {
    name, dtype, categorical, min: 0, max: 1,
    data: dtype === 'u8' ? new Uint8Array(n) : new Uint16Array(n),
  };
  g.props.push(prop);
  return prop;
}

/**
 * Sources built from a simulation result.
 *
 * `sim.layers[l]` carries `facies`, `phie`, `ntg`, `perm` per areal column. Layers the
 * simulation deliberately skipped (`simulated === false`) return NaN rather than their
 * zero-filled arrays: an unsimulated layer has no porosity, and writing its zeros would
 * put a real-looking 0.0 into the range and flatten every colour scale.
 */
export function sourcesFromSim(sim: {
  layers: Array<{
    simulated: boolean;
    facies: ArrayLike<number>; phie: ArrayLike<number>;
    ntg: ArrayLike<number>; perm: ArrayLike<number>; permZ?: ArrayLike<number>;
  }>;
}): Record<string, CellSource> {
  const pick = (field: 'facies' | 'phie' | 'ntg' | 'perm'): CellSource =>
    (col, layer) => {
      const L = sim.layers[layer];
      if (!L || !L.simulated) return NaN;
      const v = L[field][col];
      return Number.isFinite(v) ? v : NaN;
    };
  return { facies: pick('facies'), phi: pick('phie'), ntg: pick('ntg'), perm: pick('perm') };
}

/**
 * Hydrocarbon pore volume per cell, m³ — the property a volumetric report is actually
 * about, and the one that lets a map answer "where is the oil" rather than "where is
 * the good rock".
 *
 *     HCPV = bulk × NTG × φ × (1 − Sw)
 *
 * Cells below the contact contribute nothing, so they are written as zero rather than
 * NaN: they ARE modelled, and their hydrocarbon volume is genuinely none.
 */
export function hcpvSource(
  g: { nx: number; ny: number; nz: number; dx: number; dy: number;
       topZ: ArrayLike<number>; baseZ: ArrayLike<number>; activeCol: ArrayLike<number> },
  get: { ntg: CellSource; phi: CellSource; sw: CellSource },
  opts: {
    owc?: number;
    /**
     * The TRUE depth span of a cell.
     *
     * Without it this falls back to `(base − top) / nz`, which assumes every zone is
     * equally thick. `PackedGrid3D` carries ONE top and base per column — the model-wide
     * extremes — so on a stacked grid that assumption spreads a 70 m reservoir and a
     * 130 m seal uniformly across every layer, and the volume it produces is not the
     * volume the grid holds. It cost 37.7% on the first Volve HCPV map. Callers holding
     * a `BuiltGrid` must pass `layerSpan`.
     */
    spanOf?: (col: number, layer: number) => { top: number; base: number } | null;
  } = {},
): CellSource {
  const area = g.dx * g.dy;
  return (col, layer) => {
    if (!g.activeCol[col]) return NaN;
    let zTop: number, zBase: number, lh: number;
    if (opts.spanOf) {
      const sp = opts.spanOf(col, layer);
      if (!sp) return NaN;
      zTop = sp.top; zBase = sp.base; lh = zBase - zTop;
      if (!(lh > 0)) return NaN;
    } else {
      const t = g.topZ[col], b = g.baseZ[col];
      if (!Number.isFinite(t) || !Number.isFinite(b) || b <= t) return NaN;
      lh = (b - t) / g.nz;
      zTop = t + layer * lh; zBase = zTop + lh;
    }
    // fractional straddle: a 20 m layer sitting across the contact must not swing the
    // answer by its whole volume
    let frac = 1;
    if (opts.owc != null) {
      if (zTop >= opts.owc) frac = 0;
      else if (zBase > opts.owc) frac = (opts.owc - zTop) / lh;
    }
    const ntg = get.ntg(col, layer), phi = get.phi(col, layer), sw = get.sw(col, layer);
    if (!Number.isFinite(ntg) || !Number.isFinite(phi) || !Number.isFinite(sw)) return NaN;
    return Math.max(0, area * lh * frac * ntg * phi * (1 - sw));
  };
}

// ── average maps ────────────────────────────────────────────────────────────

export type ContactFilter = 'all' | 'above' | 'below';

export interface AverageMap {
  nx: number; ny: number;
  /** [nx*ny] column average, NaN where nothing qualified */
  values: Float64Array;
  /** columns that produced a value */
  live: number;
  filter: ContactFilter;
  /** cells excluded by the contact filter */
  excluded: number;
  /** the layer band averaged, when the map is scoped to a zone */
  layers?: { k0: number; nz: number };
  /** how the column was collapsed — a sum and a mean are not the same map */
  mode?: 'average' | 'sum';
}

/**
 * Collapse a property down each column into an areal map.
 *
 * THICKNESS-WEIGHTED, not a plain cell mean. Layers are proportional within a zone, so
 * a column split into thick layers and one split into thin layers would otherwise
 * contribute equally per cell and unequally per metre of rock — which is the wrong way
 * round for anything a volume is computed from.
 */
export function averageMap(
  g: { nx: number; ny: number; nz: number;
       topZ: ArrayLike<number>; baseZ: ArrayLike<number>; activeCol: ArrayLike<number> },
  src: CellSource,
  opts: {
    owc?: number; filter?: ContactFilter;
    /**
     * Restrict to a LAYER RANGE — the zone.
     *
     * A field-wide average across a stacked model is a number about no zone in
     * particular: it mixes a 70 m reservoir with 1.2 km of overburden and reports the
     * overburden, because there is more of it. Zones are contiguous layer bands
     * (`BuiltGrid.zoneLayers` gives `k0` and `nz`), so a range is all this needs.
     */
    layers?: { k0: number; nz: number };
    /** true cell spans; see `hcpvSource` for why the fallback is wrong on a stacked grid */
    spanOf?: (col: number, layer: number) => { top: number; base: number } | null;
    /**
     * How the column is collapsed.
     *
     * 'average' — thickness-weighted mean. Right for an INTENSIVE property: porosity,
     *   saturation, permeability. The answer does not depend on how thick the column is.
     * 'sum' — thickness-weighted total. Right for an EXTENSIVE one: hydrocarbon pore
     *   volume, net pay metres. Averaging these is the classic mistake — a mean HCPV
     *   per cell is a number nobody reasons with, and it makes a thick rich column look
     *   identical to a thin one.
     */
    mode?: 'average' | 'sum';
  } = {},
): AverageMap {
  const filter = opts.filter ?? 'all';
  const kLo = opts.layers ? Math.max(0, opts.layers.k0) : 0;
  const kHi = opts.layers ? Math.min(g.nz, opts.layers.k0 + opts.layers.nz) : g.nz;
  const nCol = g.nx * g.ny;
  const values = new Float64Array(nCol).fill(NaN);
  let live = 0, excluded = 0;

  for (let c = 0; c < nCol; c++) {
    if (!g.activeCol[c]) continue;
    const t = g.topZ[c], b = g.baseZ[c];
    if (!Number.isFinite(t) || !Number.isFinite(b) || b <= t) continue;
    const uniformLh = (b - t) / g.nz;
    let sum = 0, wsum = 0;
    for (let l = kLo; l < kHi; l++) {
      // the same stacked-zone trap as `hcpvSource`: without a real span the weights are
      // a uniform slice of the model-wide extent, not of the zone
      const sp = opts.spanOf?.(c, l);
      const lh = sp ? sp.base - sp.top : uniformLh;
      if (!(lh > 0)) continue;
      const zMid = sp ? (sp.top + sp.base) / 2 : t + (l + 0.5) * uniformLh;
      if (filter !== 'all' && opts.owc != null) {
        const above = zMid < opts.owc;
        if ((filter === 'above') !== above) { excluded++; continue; }
      }
      const v = src(c, l);
      if (!Number.isFinite(v)) continue;
      sum += v * lh; wsum += lh;
    }
    if (wsum > 0) { values[c] = opts.mode === 'sum' ? sum : sum / wsum; live++; }
  }
  return { nx: g.nx, ny: g.ny, values, live, filter, excluded, layers: opts.layers, mode: opts.mode ?? 'average' };
}

/**
 * A per-COLUMN map — structure, thickness — with no layer loop at all.
 *
 * Depth to a zone top is not an average of anything, so it cannot come from
 * `averageMap` without inventing a cell property that carries the same number in every
 * layer. `at` receives the column's own top and base and the zone's layer band, and the
 * proportional-layering rule (the rule the grid was BUILT with) turns those into the
 * zone's own top and base.
 */
export function columnMap(
  g: { nx: number; ny: number; nz: number;
       topZ: ArrayLike<number>; baseZ: ArrayLike<number>; activeCol: ArrayLike<number> },
  at: (zoneTop: number, zoneBase: number, col: number) => number,
  layers?: { k0: number; nz: number },
): AverageMap {
  const nCol = g.nx * g.ny;
  const values = new Float64Array(nCol).fill(NaN);
  const k0 = layers ? Math.max(0, layers.k0) : 0;
  const k1 = layers ? Math.min(g.nz, layers.k0 + layers.nz) : g.nz;
  let live = 0;
  for (let c = 0; c < nCol; c++) {
    if (!g.activeCol[c]) continue;
    const t = g.topZ[c], b = g.baseZ[c];
    if (!Number.isFinite(t) || !Number.isFinite(b) || b <= t) continue;
    const zt = t + (k0 / g.nz) * (b - t);
    const zb = t + (k1 / g.nz) * (b - t);
    const v = at(zt, zb, c);
    if (Number.isFinite(v)) { values[c] = v; live++; }
  }
  return { nx: g.nx, ny: g.ny, values, live, filter: 'all', excluded: 0, layers, mode: 'average' };
}
