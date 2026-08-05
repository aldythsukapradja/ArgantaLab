// petro-xplot3d.ts — the 3D crossplot's maths, kept out of the renderer.
//
// A third axis is only worth the interaction cost when it separates something
// two axes overlap on. So the presets are not "any three curves" — each is a
// triad where the third axis is the one that resolves the ambiguity of the
// other two:
//
//   fluid       NPHI × RHOB × log RT.  Density–neutron alone cannot tell a gas
//               sand from a light-matrix sand; resistivity can, and it is the
//               axis density–neutron has no access to.
//   lithology   GR × RHOB × NPHI.  Shale and tight carbonate sit on top of each
//               other on density–neutron; GR pulls them apart.
//   quality     PHIE × Sw × Vsh.  The reservoir-quality space itself — where the
//               cutoffs actually cut.
//
// COLOUR IS PAY, and it is OURS. The delivery ships an interpretation in three
// of twenty-four bores, so colouring by a delivered flag would leave 87% of the
// cloud grey. The `net` flag comes from runPetro under the rail's current
// parameters, which means moving a cutoff recolours the cloud — that is the
// point of plotting it.
//
// There is no facies curve in this delivery. Pay/non-pay is what the data can
// actually support, and it is what was asked for; a fabricated facies class
// would look better and mean nothing.
import { isReal, unitScale } from './petro-xplot.ts';
import type { BoreCurveSet } from './petro-curves.ts';

/** Axis keys the presets draw on. `RT` is plotted as log10 — resistivity spans
 *  decades and a linear resistivity axis is one grey smear at the origin. */
export type Axis3Key = 'GR' | 'RHOB' | 'NPHI' | 'RT' | 'DT' | 'PHIE' | 'SW' | 'VSH';

export interface Axis3 {
  key: Axis3Key;
  label: string;
  unit: string;
  /** plotted as log10(v) */
  log?: boolean;
  /** fixed display domain; when absent the domain comes from the data */
  lo?: number;
  hi?: number;
}

export interface Preset3 {
  id: 'fluid' | 'lithology' | 'quality';
  label: string;
  /** what the third axis buys you — shown under the plot, not decoration */
  hint: string;
  axes: [Axis3, Axis3, Axis3];
}

export const PRESETS_3D: Preset3[] = [
  {
    id: 'fluid',
    label: 'Fluid',
    hint: 'Density–neutron cannot separate gas from a light matrix. Resistivity can — '
      + 'hydrocarbon lifts RT while the density–neutron pair stays put.',
    axes: [
      { key: 'NPHI', label: 'NPHI', unit: 'v/v', lo: 0.6, hi: 0 },
      { key: 'RHOB', label: 'RHOB', unit: 'g/cm³', lo: 1.9, hi: 2.9 },
      { key: 'RT', label: 'RT', unit: 'Ω·m', log: true },
    ],
  },
  {
    id: 'lithology',
    label: 'Lithology',
    hint: 'Shale and tight rock overlie each other on density–neutron. GR is the axis '
      + 'that pulls them apart.',
    axes: [
      { key: 'NPHI', label: 'NPHI', unit: 'v/v', lo: 0.6, hi: 0 },
      { key: 'RHOB', label: 'RHOB', unit: 'g/cm³', lo: 1.9, hi: 2.9 },
      { key: 'GR', label: 'GR', unit: 'API', lo: 0, hi: 150 },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    hint: 'The space the cutoffs actually cut in. Pay is the corner where porosity '
      + 'is high, Sw is low and the rock is clean — you can see whether it is a corner '
      + 'or a smear.',
    axes: [
      { key: 'PHIE', label: 'PHIE', unit: 'v/v', lo: 0, hi: 0.4 },
      { key: 'SW', label: 'Sw', unit: 'v/v', lo: 1, hi: 0 },
      { key: 'VSH', label: 'Vsh', unit: 'v/v', lo: 0, hi: 1 },
    ],
  },
];

/**
 * Where each axis reads from.
 *
 * RHOB/NPHI/RT/DT/GR are the MEASUREMENTS; PHIE/SW/VSH are OURS. Mixing the two
 * on one plot is deliberate and is why `raw` is carried alongside the
 * interpretation on the same sample index — the alternative is two decodes that
 * can disagree about which sample is which.
 */
export function curveOf(b: BoreCurveSet, key: Axis3Key): (number | null)[] | undefined {
  switch (key) {
    case 'GR': return b.gr;
    case 'RHOB': return b.raw.rhob;
    case 'NPHI': return b.raw.nphi;
    case 'RT': return b.raw.rt;
    case 'DT': return b.raw.dt;
    case 'PHIE': return b.phie;
    case 'SW': return b.sw;
    case 'VSH': return b.vsh;
  }
}

/** The name `isReal`/`unitScale` screen under. Ours are already fractions in the
 *  interpretation's own units, so they screen under the same names the bench
 *  uses (SWE for saturation — SW is not in the range table). */
const SCREEN_AS: Record<Axis3Key, string> = {
  GR: 'GR', RHOB: 'RHOB', NPHI: 'NPHI', RT: 'RT', DT: 'DT',
  PHIE: 'PHIE', SW: 'SWE', VSH: 'VSH',
};

export interface Cloud3D {
  /** xyz triples, already normalised into the unit cube [-1,1] */
  position: Float32Array;
  /** rgb triples in 0–1 */
  color: Float32Array;
  /** per point: index into `wells` */
  wellIx: Uint16Array;
  /**
   * Per point: 0 non-pay, 1 pay, 2 no verdict. Carried EXPLICITLY rather than
   * recovered from the colour floats — a renderer that decides what a point is
   * by comparing its green channel is one palette change away from being wrong
   * about the data.
   */
  cls: Uint8Array;
  wells: string[];
  n: number;
  /** samples that passed screening before the render cap was applied */
  found: number;
  /** how many of the drawn points are pay */
  pay: number;
  /** samples with no net verdict — no colour is claimed for them */
  unclassified: number;
  /** resolved per-axis domain [lo, hi], in the axis's PLOTTED space (log10 for RT) */
  domains: Array<[number, number]>;
  /** null when the cloud can be drawn, else why not */
  blocked: string | null;
  /** bores that carry all three axes, of those offered */
  wellsWithAll: number;
  ofWells: number;
}

const PAY_RGB: [number, number, number] = [0.06, 0.72, 0.51];      // green — net pay
const NONPAY_RGB: [number, number, number] = [0.42, 0.45, 0.52];   // grey — not pay
const UNKNOWN_RGB: [number, number, number] = [0.85, 0.62, 0.20];  // amber — no verdict

const EMPTY = (): Cloud3D => ({
  position: new Float32Array(0), color: new Float32Array(0), wellIx: new Uint16Array(0),
  cls: new Uint8Array(0),
  wells: [], n: 0, found: 0, pay: 0, unclassified: 0,
  domains: [[0, 1], [0, 1], [0, 1]], blocked: 'no bores', wellsWithAll: 0, ofWells: 0,
});

/**
 * Deterministic thinning.
 *
 * A GPU will happily draw a million points; a 24-bore field is a few hundred
 * thousand samples and drawing all of them makes an opaque block, not a cloud.
 * The stride is uniform rather than random so the same data always gives the
 * same picture — a plot that reshuffles on every render is one you cannot
 * compare against the one you looked at a minute ago. And it is a STRIDE, not a
 * head-truncation: taking the first N samples would plot the top of every well
 * and none of the reservoir.
 */
export const MAX_POINTS = 120_000;

export function buildCloud3D(
  bores: BoreCurveSet[], preset: Preset3, cap = MAX_POINTS,
): Cloud3D {
  if (!bores.length) return EMPTY();
  const keys = preset.axes.map((a) => a.key);
  const screen = keys.map((k) => SCREEN_AS[k]);

  // which bores carry all three — stated even when the answer is "none", because
  // "the plot is empty" and "no bore in this delivery carries RT" are different
  // findings and only one of them is a data problem
  const carries = (b: BoreCurveSet) => keys.every((k, i) => {
    const arr = curveOf(b, k);
    if (!Array.isArray(arr)) return false;
    const s = unitScale(screen[i], arr);
    return arr.some((v) => isReal(screen[i], Number.isFinite(v as number) ? (v as number) * s : v));
  });
  const usable = bores.filter(carries);
  if (!usable.length) {
    const out = EMPTY();
    out.ofWells = bores.length;
    out.blocked = `no bore carries ${preset.axes.map((a) => a.label).join(' + ')}`;
    return out;
  }

  // ── pass 1: collect screened samples in plotted space ──────────────────────
  type Row = { v: [number, number, number]; w: number; net: boolean | null };
  const rowsAll: Row[] = [];
  const wells: string[] = [];

  for (const b of usable) {
    const wi = wells.push(b.well) - 1;
    const arrs = keys.map((k) => curveOf(b, k) as (number | null)[]);
    const scales = arrs.map((a, i) => unitScale(screen[i], a));
    const n = Math.min(...arrs.map((a) => a.length), b.net.length);
    for (let i = 0; i < n; i++) {
      const v: number[] = [];
      let ok = true;
      for (let k = 0; k < 3; k++) {
        const rawV = arrs[k][i];
        const x = Number.isFinite(rawV as number) ? (rawV as number) * scales[k] : rawV;
        if (!isReal(screen[k], x)) { ok = false; break; }
        // log10 AFTER screening — the range table is expressed in linear units
        v.push(preset.axes[k].log ? Math.log10(x as number) : (x as number));
      }
      if (!ok || !Number.isFinite(v[0] + v[1] + v[2])) continue;
      rowsAll.push({ v: [v[0], v[1], v[2]], w: wi, net: b.net[i] ?? null });
    }
  }

  if (!rowsAll.length) {
    const out = EMPTY();
    out.wells = wells;
    out.wellsWithAll = usable.length;
    out.ofWells = bores.length;
    out.blocked = 'every sample was screened out — the curves are present but hold no physical values';
    return out;
  }

  const stride = Math.max(1, Math.ceil(rowsAll.length / cap));
  const rows = stride === 1 ? rowsAll : rowsAll.filter((_r, i) => i % stride === 0);

  // ── pass 2: domains ───────────────────────────────────────────────────────
  // A fixed domain is used where the preset declares one, so the same rock lands
  // in the same place across fields. Where it does not, the domain comes from the
  // data — and a degenerate one is widened rather than dividing by zero.
  const domains: Array<[number, number]> = preset.axes.map((a, k) => {
    if (a.lo != null && a.hi != null) {
      return [a.log ? Math.log10(Math.max(a.lo, 1e-6)) : a.lo,
        a.log ? Math.log10(Math.max(a.hi, 1e-6)) : a.hi] as [number, number];
    }
    let lo = Infinity, hi = -Infinity;
    for (const r of rows) { if (r.v[k] < lo) lo = r.v[k]; if (r.v[k] > hi) hi = r.v[k]; }
    if (!(hi > lo)) { lo -= 0.5; hi += 0.5; }
    return [lo, hi];
  });

  // ── pass 3: pack ──────────────────────────────────────────────────────────
  const position = new Float32Array(rows.length * 3);
  const color = new Float32Array(rows.length * 3);
  const wellIx = new Uint16Array(rows.length);
  const cls = new Uint8Array(rows.length);
  let pay = 0, unclassified = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (let k = 0; k < 3; k++) {
      const [lo, hi] = domains[k];
      // normalise into [-1,1]; clamp so a fixed domain cannot throw a sample out
      // of the box and take the camera framing with it
      const u = (r.v[k] - lo) / (hi - lo);
      position[i * 3 + k] = Math.max(-1, Math.min(1, u * 2 - 1));
    }
    const rgb = r.net == null ? (unclassified++, UNKNOWN_RGB) : r.net ? (pay++, PAY_RGB) : NONPAY_RGB;
    cls[i] = r.net == null ? 2 : r.net ? 1 : 0;
    color[i * 3] = rgb[0]; color[i * 3 + 1] = rgb[1]; color[i * 3 + 2] = rgb[2];
    wellIx[i] = r.w;
  }

  return {
    position, color, wellIx, cls, wells, n: rows.length, found: rowsAll.length,
    pay, unclassified, domains, blocked: null,
    wellsWithAll: usable.length, ofWells: bores.length,
  };
}

/** Axis tick values in PLOTTED space, with the label in the axis's real units. */
export function axisTicks(axis: Axis3, domain: [number, number], count = 4): Array<{ at: number; label: string }> {
  const [lo, hi] = domain;
  const out: Array<{ at: number; label: string }> = [];
  for (let i = 0; i <= count; i++) {
    const at = lo + ((hi - lo) * i) / count;
    const real = axis.log ? Math.pow(10, at) : at;
    const label = axis.log
      ? (real >= 100 ? real.toFixed(0) : real >= 1 ? real.toFixed(1) : real.toFixed(2))
      : (Math.abs(hi - lo) < 2 ? real.toFixed(2) : real.toFixed(0));
    out.push({ at: (at - lo) / (hi - lo) * 2 - 1, label });
  }
  return out;
}
