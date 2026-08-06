// prop-view.ts — reading a packed property back out, and colouring it honestly.
//
// `pack3d` stores each property normalised into u8 or u16 with its own min/max, which
// is what makes a 10 M-cell model fit in memory. Everything that DISPLAYS a property
// has to undo that, and has to do it the same way every time: a legend computed from
// one dequantisation and a mesh coloured from another is a lie told in two places.
// This module is the single decoder, the single set of ramps, and the single colour
// table generator.
//
// ── WHY CATEGORICAL IS NOT JUST ANOTHER RAMP ────────────────────────────────
//
// Facies is a code, not a measurement. Interpolating between facies 0 and facies 1
// produces a colour that stands for a rock that does not exist, and a continuous ramp
// invites exactly that reading. Categorical properties therefore get discrete swatches
// and an explicit legend entry per code, never a gradient.
//
// Pure — no DOM, no three.js, no IndexedDB.

export interface PackedPropLike {
  name: string;
  dtype: 'u8' | 'u16';
  categorical: boolean;
  min: number;
  max: number;
  data: Uint8Array | Uint16Array;
}

export interface PackedGridLike {
  nx: number; ny: number; nz: number;
  activeCol: Uint8Array | ArrayLike<number>;
  props: PackedPropLike[];
}

const DTYPE_MAX = { u8: 255, u16: 65535 } as const;

/** Flat index of cell (i, j, layer) in a packed property's `data`. */
export const cellIndex = (g: { nx: number; ny: number }, i: number, j: number, l: number) =>
  l * (g.nx * g.ny) + j * g.nx + i;

/**
 * Physical value of one cell, or NaN where the column is inactive.
 *
 * NaN rather than 0: a cell outside the model has no porosity, and returning zero puts
 * a legitimate-looking value into every statistic and every colour scale.
 */
export function propValueAt(
  g: PackedGridLike, prop: PackedPropLike, i: number, j: number, l: number,
): number {
  if (i < 0 || j < 0 || l < 0 || i >= g.nx || j >= g.ny || l >= g.nz) return NaN;
  if (!g.activeCol[j * g.nx + i]) return NaN;
  const raw = prop.data[cellIndex(g, i, j, l)];
  if (prop.categorical) return raw;
  const span = DTYPE_MAX[prop.dtype];
  return prop.min + (raw / span) * (prop.max - prop.min);
}

// ── ramps ───────────────────────────────────────────────────────────────────

export interface RampStop { t: number; color: string }

/**
 * The named ramps.
 *
 * A ramp is a reading instrument, not decoration, and different questions want
 * different ones:
 *
 *  · RAINBOW resolves the most steps — the eye separates hue far better than lightness,
 *    so a rainbow shows structure a single-hue ramp flattens. Its cost is that it has no
 *    inherent order (is orange more than green?), so it belongs on a property being
 *    EXPLORED, with a legend, not on one being compared at a glance.
 *  · SEQUENTIAL ramps carry order for free and are the right default for anything
 *    read against a threshold.
 *  · The green→blue SATURATION ramp is a domain convention: green is oil, blue is water.
 */
export const RAMPS: Record<string, RampStop[]> = {
  rainbow: [
    { t: 0, color: '#3b0f70' }, { t: 0.18, color: '#2166ac' }, { t: 0.36, color: '#4eb3d3' },
    { t: 0.52, color: '#57c9a5' }, { t: 0.66, color: '#a8d84e' }, { t: 0.8, color: '#fec44f' },
    { t: 0.92, color: '#e6550d' }, { t: 1, color: '#a50026' },
  ],
  viridis: [
    { t: 0, color: '#440154' }, { t: 0.25, color: '#3b528b' }, { t: 0.5, color: '#21918c' },
    { t: 0.75, color: '#5ec962' }, { t: 1, color: '#e8d51f' },
  ],
  amber: [
    { t: 0, color: '#4a3208' }, { t: 0.25, color: '#8a5a0d' },
    { t: 0.5, color: '#d19a16' }, { t: 0.75, color: '#f0c93a' }, { t: 1, color: '#f7dd6b' },
  ],
  // ── GREEN → BLUE, THROUGH TEAL, NEVER THROUGH CREAM ──────────────────────
  //
  // This ramp used to pass through '#d8ecc4' at t = 0.55 — 56 RGB units from the light
  // theme's canvas ground. On Volve that midpoint is the oil-water transition, so a
  // whole band of real modelled cells rendered the same colour as "nothing here", and
  // because a transition band follows the structure contours the model looked shot
  // through with contour-parallel holes. It was never sparse; the middle of the scale
  // was invisible. Teal keeps the green-is-oil / blue-is-water reading and stays
  // saturated the whole way across.
  saturation: [
    { t: 0, color: '#0f9d58' }, { t: 0.3, color: '#3fa87a' }, { t: 0.55, color: '#3f9bab' },
    { t: 0.78, color: '#2f6fbf' }, { t: 1, color: '#0b2f6b' },
  ],
  // bounded at both ends: pure white is the light ground and pure black is the dark one
  greyscale: [{ t: 0, color: '#333c4d' }, { t: 1, color: '#c2ccdb' }],
};

/**
 * The canvas grounds a property is drawn against, light and dark.
 *
 * A ramp is only a scale if every value on it is DISTINGUISHABLE FROM NOTHING. These
 * are the two colours "no cell here" takes, and `rampClearance` measures how close a
 * ramp comes to them — see the truth-lock, which refuses a ramp that gets too near.
 */
export const CANVAS_GROUND = { light: '#eef2f7', dark: '#070b16' } as const;

/** RGB distance from the nearer canvas ground, minimised over the whole ramp. */
export function rampClearance(stops: RampStop[], steps = 100): { light: number; dark: number; worstT: number } {
  const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const L = rgb(CANVAS_GROUND.light), D = rgb(CANVAS_GROUND.dark);
  const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let light = Infinity, dark = Infinity, worstT = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = rgb(rampColor(stops, t));
    const dl = d(c, L), dd = d(c, D);
    if (Math.min(dl, dd) < Math.min(light, dark)) worstT = t;
    if (dl < light) light = dl;
    if (dd < dark) dark = dd;
  }
  return { light, dark, worstT };
}

export const RAMP_IDS = Object.keys(RAMPS);

export interface PropertyStyle {
  /** the packed property's name */
  key: string;
  label: string;
  unit: string;
  /** decimals for a legend tick */
  decimals: number;
  categorical: boolean;
  /** continuous ramp, low → high */
  stops?: RampStop[];
  /** the default ramp id; a caller may override it per property */
  rampId?: string;
  /** categorical swatches, by integer code */
  codes?: Array<{ code: number; label: string; color: string }>;
  /** true when HIGH values are the good ones — drives which end the legend emphasises */
  highIsGood: boolean;
  /** display the ramp on a log scale (permeability spans decades) */
  log?: boolean;
}

/**
 * The house styles.
 *
 * Porosity is yellow-through-red and saturation is blue, deliberately: they are the two
 * properties a reader compares most often, and giving them the same ramp makes two
 * different maps look like the same map. Water saturation runs light→dark blue so that
 * "more water" reads as "more blue" without a legend.
 */
export const PROPERTY_STYLES: PropertyStyle[] = [
  {
    key: 'phi', label: 'Porosity', unit: 'v/v', decimals: 3, categorical: false, highIsGood: true,
    rampId: 'rainbow',
  },
  {
    // LOW Sw IS GREEN, high is blue.
    //
    // A light-to-dark blue ramp is technically legible and practically useless: the
    // eye reads "more blue" as "more of something" without saying whether that is good.
    // Green→blue is the industry's own convention for a saturation map — green is where
    // the oil is, blue is water — so the map answers "where is the hydrocarbon" at a
    // glance instead of after a trip to the legend.
    key: 'sw', label: 'Water saturation', unit: 'v/v', decimals: 3, categorical: false, highIsGood: false,
    rampId: 'saturation',
  },
  {
    key: 'ntg', label: 'Net-to-gross', unit: 'v/v', decimals: 3, categorical: false, highIsGood: true,
    rampId: 'viridis',
  },
  {
    key: 'perm', label: 'Permeability', unit: 'mD', decimals: 1, categorical: false, highIsGood: true, log: true,
    rampId: 'rainbow',
  },
  {
    // HCPV is the property a volumetric report is actually about — it answers "where is
    // the oil", where porosity only answers "where is the good rock". Log-scaled
    // because cell volumes span orders of magnitude between a thin pinch-out and a
    // thick crestal cell.
    key: 'hcpv', label: 'HC pore volume', unit: 'm³', decimals: 0, categorical: false,
    highIsGood: true, log: true,
    rampId: 'rainbow',
  },
  {
    key: 'facies', label: 'Facies', unit: '', decimals: 0, categorical: true, highIsGood: true,
    codes: [
      { code: 0, label: 'Shale', color: '#6b5b4a' },
      { code: 1, label: 'Sand', color: '#f0c674' },
    ],
  },
];

/**
 * A style, with its ramp resolved.
 *
 * `rampOverride` lets a viewer change the colours without touching the registry — the
 * ramp is a reading choice, and forcing everyone onto one palette makes some questions
 * unanswerable. Explicit `stops` on a style still win, so a domain convention (the
 * green-to-blue saturation ramp) cannot be lost by accident.
 */
export const styleFor = (key: string, rampOverride?: string): PropertyStyle => {
  const base = PROPERTY_STYLES.find((s) => s.key === key) ?? {
    key, label: key, unit: '', decimals: 3, categorical: false, highIsGood: true, rampId: 'viridis',
  };
  if (base.categorical) return base;
  const id = rampOverride ?? base.rampId ?? 'viridis';
  return { ...base, rampId: id, stops: base.stops ?? RAMPS[id] ?? RAMPS.viridis };
};

const hex = (c: string) => {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const toHex = (r: number, gr: number, b: number) =>
  `#${[r, gr, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Colour at a normalised position on a continuous ramp. */
export function rampColor(stops: RampStop[], t: number): string {
  if (!stops.length) return '#000000';
  const x = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i].t) {
      const a = stops[i - 1], b = stops[i];
      const f = b.t === a.t ? 0 : (x - a.t) / (b.t - a.t);
      const ca = hex(a.color), cb = hex(b.color);
      return toHex(ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f);
    }
  }
  return stops[stops.length - 1].color;
}

/**
 * Normalise a physical value onto 0..1 for its ramp.
 *
 * Permeability is normalised in log space. On a linear scale a field running 1 to
 * 20,000 mD renders as one colour with a few bright specks, which says nothing about
 * the 1–100 mD range where the flow behaviour actually differs.
 */
export function normalise(style: PropertyStyle, v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return NaN;
  if (style.log) {
    const l = Math.log10(Math.max(1e-4, lo)), h = Math.log10(Math.max(1e-3, hi));
    return h > l ? (Math.log10(Math.max(1e-4, v)) - l) / (h - l) : 0;
  }
  return hi > lo ? (v - lo) / (hi - lo) : 0;
}

export interface ColorTableEntry {
  /** the physical value this swatch stands for */
  value: number;
  label: string;
  color: string;
}

export interface ColorTable {
  style: PropertyStyle;
  lo: number;
  hi: number;
  entries: ColorTableEntry[];
  /** css linear-gradient for a continuous ramp; undefined when categorical */
  gradient?: string;
}

/**
 * The legend, generated from the SAME ramp and the SAME range the mesh is coloured
 * with. Passing the range in rather than recomputing it is deliberate — a legend that
 * derives its own range will silently disagree with the picture beside it.
 */
export function colorTable(style: PropertyStyle, lo: number, hi: number, ticks = 5): ColorTable {
  if (style.categorical) {
    return {
      style, lo, hi,
      entries: (style.codes ?? []).map((c) => ({ value: c.code, label: c.label, color: c.color })),
    };
  }
  const stops = style.stops ?? [];
  const entries: ColorTableEntry[] = [];
  for (let i = 0; i < ticks; i++) {
    const t = ticks === 1 ? 0 : i / (ticks - 1);
    const v = style.log
      ? 10 ** (Math.log10(Math.max(1e-4, lo)) + t * (Math.log10(Math.max(1e-3, hi)) - Math.log10(Math.max(1e-4, lo))))
      : lo + t * (hi - lo);
    entries.push({ value: v, label: v.toFixed(style.decimals), color: rampColor(stops, t) });
  }
  return {
    style, lo, hi, entries,
    gradient: `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${(s.t * 100).toFixed(0)}%`).join(', ')})`,
  };
}

/**
 * Percentile range of a property over the ACTIVE cells.
 *
 * Percentiles, not min/max: one unresolved null or one capped permeability sets the
 * whole colour scale and flattens everything else to a single shade. The clipped tails
 * are still drawn — they just take the end colour instead of defining it.
 */
export interface RangeResult {
  lo: number; hi: number; n: number;
  /** the untrimmed extremes, so a reader can see what was clipped */
  dataMin: number; dataMax: number;
  /** cells falling outside the displayed range */
  clippedLo: number; clippedHi: number;
}

/**
 * Percentile range over the ACTIVE cells, with the clipped tails REPORTED.
 *
 * Percentiles, not min/max: one unresolved null or one capped permeability sets the
 * whole scale and flattens everything else to a single shade. The tails are still
 * drawn — they take the end colour — but the caller is told how many cells are pinned
 * there, because a map with 30% of its cells at the top of the ramp is a map with the
 * wrong range, and nothing on the picture says so.
 */
export function propRange(
  g: PackedGridLike, prop: PackedPropLike, loPct = 0.02, hiPct = 0.98,
): RangeResult {
  if (prop.categorical) {
    return { lo: prop.min, hi: prop.max, n: 0, dataMin: prop.min, dataMax: prop.max, clippedLo: 0, clippedHi: 0 };
  }
  const vals: number[] = [];
  for (let l = 0; l < g.nz; l++) {
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const v = propValueAt(g, prop, i, j, l);
        if (Number.isFinite(v)) vals.push(v);
      }
    }
  }
  if (!vals.length) return { lo: 0, hi: 1, n: 0, dataMin: NaN, dataMax: NaN, clippedLo: 0, clippedHi: 0 };
  vals.sort((a, b) => a - b);
  const at = (f: number) => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(f * (vals.length - 1))))];
  const lo = at(loPct), hi0 = at(hiPct);
  const hi = hi0 > lo ? hi0 : lo + 1e-6;
  let clippedLo = 0, clippedHi = 0;
  for (const v of vals) { if (v < lo) clippedLo++; else if (v > hi) clippedHi++; }
  return { lo, hi, n: vals.length, dataMin: vals[0], dataMax: vals[vals.length - 1], clippedLo, clippedHi };
}

/**
 * Clamp a user-typed range back to something drawable.
 *
 * An inverted or zero-width range is not an error worth blocking on — a user midway
 * through typing a minus sign should not get a red box — so it is repaired and the
 * caller carries on.
 */
export function safeRange(lo: number, hi: number, fallback: { lo: number; hi: number }) {
  const a = Number.isFinite(lo) ? lo : fallback.lo;
  const b = Number.isFinite(hi) ? hi : fallback.hi;
  return b > a ? { lo: a, hi: b } : { lo: Math.min(a, b), hi: Math.min(a, b) + 1e-6 };
}

// ── slices ──────────────────────────────────────────────────────────────────

export type SliceAxis = 'i' | 'j' | 'k';

export interface Slice2D {
  axis: SliceAxis;
  index: number;
  /** width and height of the returned raster */
  w: number;
  h: number;
  /** [w*h] physical values, NaN where inactive */
  values: Float64Array;
  /** how many cells carried a value */
  live: number;
}

/**
 * One slice of a property as a 2D raster.
 *
 * i → a section across (j, layer); j → a section across (i, layer); k → an areal map
 * of one LAYER across (i, j). The k case is the one the 3D viewer's layer player uses
 * and the one `gridmesh` has no builder for, since the shell only ever draws the skin.
 */
export function sliceProp(
  g: PackedGridLike, prop: PackedPropLike, axis: SliceAxis, index: number,
): Slice2D {
  const w = axis === 'i' ? g.ny : g.nx;
  const h = axis === 'k' ? g.ny : g.nz;
  const values = new Float64Array(w * h).fill(NaN);
  let live = 0;
  for (let b = 0; b < h; b++) {
    for (let a = 0; a < w; a++) {
      let v: number;
      if (axis === 'i') v = propValueAt(g, prop, index, a, b);
      else if (axis === 'j') v = propValueAt(g, prop, a, index, b);
      else v = propValueAt(g, prop, a, b, index);
      values[b * w + a] = v;
      if (Number.isFinite(v)) live++;
    }
  }
  return { axis, index, w, h, values, live };
}

/** How far the player can scrub on each axis. */
export const axisExtent = (g: { nx: number; ny: number; nz: number }, axis: SliceAxis) =>
  axis === 'i' ? g.nx : axis === 'j' ? g.ny : g.nz;

// ── user-drawn cross-section ────────────────────────────────────────────────

export interface PolylinePoint { x: number; y: number }

export interface SectionColumn {
  /** distance along the polyline to this column's centre, metres */
  sM: number;
  i: number;
  j: number;
  /** true when the polyline left the model here */
  inside: boolean;
}

/**
 * Walk a user-drawn polyline and return the grid columns it crosses, in order.
 *
 * Samples at half a cell so no column is skipped on a diagonal, then collapses
 * consecutive duplicates — a section drawn at 45° must not show every cell twice, and
 * one drawn along a row must not miss cells between samples.
 *
 * Columns OUTSIDE the model are kept, flagged `inside: false`, rather than dropped.
 * A section that silently closes a gap where the user crossed open water reads as
 * continuous geology.
 */
export function sectionColumns(
  grid: { nx: number; ny: number; dx: number; dy: number; x0: number; y0: number; activeCol: Uint8Array | ArrayLike<number> },
  points: PolylinePoint[],
): SectionColumn[] {
  if (points.length < 2) return [];
  const step = Math.min(grid.dx, grid.dy) / 2;
  const out: SectionColumn[] = [];
  let sM = 0;
  let last = -1;

  for (let seg = 0; seg + 1 < points.length; seg++) {
    const a = points[seg], b = points[seg + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(len > 0)) continue;
    const n = Math.max(1, Math.ceil(len / step));
    for (let t = 0; t <= n; t++) {
      // the joint between two segments is sampled once, not twice
      if (t === 0 && seg > 0) continue;
      const f = t / n;
      const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      const i = Math.floor((x - grid.x0) / grid.dx), j = Math.floor((y - grid.y0) / grid.dy);
      const key = j * grid.nx + i;
      if (key !== last) {
        const inBounds = i >= 0 && j >= 0 && i < grid.nx && j < grid.ny;
        out.push({
          sM: sM + len * f,
          i, j,
          inside: inBounds && grid.activeCol[key] === 1,
        });
        last = key;
      }
    }
    sM += len;
  }
  return out;
}

export interface SectionPanel {
  columns: SectionColumn[];
  /** total length of the drawn line, metres */
  lengthM: number;
  /** [columns × nz] physical values, NaN outside the model */
  values: Float64Array;
  nz: number;
  /** per-column top and base depth, for drawing the panel to true geometry */
  topZ: Float64Array;
  baseZ: Float64Array;
  live: number;
}

/** Sample a property down every column the polyline crosses. */
export function sectionPanel(
  g: PackedGridLike & { dx: number; dy: number; x0: number; y0: number; topZ: ArrayLike<number>; baseZ: ArrayLike<number> },
  prop: PackedPropLike,
  points: PolylinePoint[],
): SectionPanel {
  const columns = sectionColumns(g as never, points);
  const values = new Float64Array(columns.length * g.nz).fill(NaN);
  const topZ = new Float64Array(columns.length).fill(NaN);
  const baseZ = new Float64Array(columns.length).fill(NaN);
  let live = 0;
  for (let c = 0; c < columns.length; c++) {
    const { i, j, inside } = columns[c];
    if (!inside) continue;
    topZ[c] = g.topZ[j * g.nx + i];
    baseZ[c] = g.baseZ[j * g.nx + i];
    for (let l = 0; l < g.nz; l++) {
      const v = propValueAt(g, prop, i, j, l);
      values[c * g.nz + l] = v;
      if (Number.isFinite(v)) live++;
    }
  }
  // the length of the LINE THE USER DREW, not the distance at which the last column
  // happened to be entered — those differ by up to a cell and the axis of the panel is
  // drawn against the former
  let lengthM = 0;
  for (let n = 0; n + 1 < points.length; n++) {
    lengthM += Math.hypot(points[n + 1].x - points[n].x, points[n + 1].y - points[n].y);
  }
  return { columns, lengthM, values, nz: g.nz, topZ, baseZ, live };
}
