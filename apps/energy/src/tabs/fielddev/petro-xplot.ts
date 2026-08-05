// petro-xplot.ts — the crossplots, and what each one is ENTITLED to say.
//
// A crossplot is the easiest chart in petrophysics to make look authoritative and
// the easiest to make meaningless: two curves, a cloud, a fitted line. So each
// plot here declares the curves it NEEDS, reports how much of the delivery
// actually carries them, and refuses to produce a result it cannot support.
//
// WHAT THIS DELIVERY SUPPORTS, counted from the 24 logged Volve bores:
//   GR, RT ............ 24    every plot that needs resistivity or shaliness
//   RHOB, NPHI ........ 20    lithology and the gas effect
//   DT ................ 17
//   PHIE, SWE, VSH .... 3     the LFP-interpreted wells only
//   permeability ...... 0     nothing, in any well
//
// That last line is the important one. There is NO permeability curve and no core
// K in this bundle, so a PHIE–K law cannot be fitted from it. `permeability()`
// therefore returns an explicit "unavailable" rather than a Timur or Coates curve
// with borrowed coefficients — a transform whose exponents came from the
// literature is not this field's rock, and drawing it through this field's
// porosity would produce a number people would plan wells with.

/** One point on a plot, carrying which bore it came from so a cloud can always be
 *  taken apart again — a crossplot that cannot be traced back to wells is a
 *  picture, not evidence. */
import { PHYSICAL_RANGE, PHIT_MAX } from './petro-compute.ts';
import { PHI_K_SCREENING, fitPhiK } from '../../engine/perm.ts';
import { fitCuddy, type CuddyShf } from './fluid-model.ts';

export interface XPoint { well: string; x: number; y: number; z?: number; depth?: number }

export type Availability = {
  /** curves the plot cannot run without */
  needs: string[];
  /** how many bores carry ALL of them */
  wells: number;
  /** how many bores were considered */
  ofWells: number;
  /** null when the plot can run; a reason when it cannot */
  blocked: string | null;
};

/** Bores keyed by name, each with the curves it carries. Values are aligned
 *  sample arrays; a missing curve is simply absent. */
export interface BoreCurves {
  well: string;
  depth?: (number | null)[];
  /**
   * What `depth` actually is. NOT optional in spirit: the delivered logs carry
   * MEASURED depth, and Volve's wells are deviated by hundreds of metres, so a
   * height-above-contact computed from MD is wrong everywhere and NEGATIVE in
   * most of the reservoir — which silently yields an empty saturation-height plot
   * rather than an obviously wrong one. Declaring the kind makes the caller
   * confront the MD→TVDSS conversion instead of getting a blank chart.
   */
  depthKind?: 'md' | 'tvdss';
  curves: Record<string, (number | null)[] | undefined>;
}

const finite = (v: unknown): v is number => Number.isFinite(v as number);

/**
 * Physical screening, and it is NOT optional here.
 *
 * The delivered logs encode absent samples as the LAS convention −999.25, which is
 * a perfectly finite number. A `Number.isFinite` guard accepts it, and it then
 * flows into every transform: a density of −999.25 gives a porosity of about 380,
 * a resistivity of −999.25 breaks Archie's logarithm, and the resulting cloud
 * looks like data. Screening against the SAME ranges the interpretation bench uses
 * (petro-compute.PHYSICAL_RANGE) is what keeps the two views agreeing about which
 * samples are real.
 */
const RANGE_OF: Record<string, { lo: number; hi: number }> = {
  GR: PHYSICAL_RANGE.gr,
  RHOB: PHYSICAL_RANGE.rhob,
  NPHI: PHYSICAL_RANGE.nphi,
  RT: PHYSICAL_RANGE.rt,
  RMED: PHYSICAL_RANGE.rt,
  DT: PHYSICAL_RANGE.dt,
  PHIE: { lo: 0, hi: PHIT_MAX },
  SWE: { lo: 0, hi: 1.0001 },
  VSH: { lo: 0, hi: 1.0001 },
  PERM: { lo: 1e-6, hi: 1e6 },
};

/** Curves that are conventionally a FRACTION but are sometimes delivered as a
 *  percent. Screening has to happen in the same units as the range, so the scale
 *  is resolved from the curve's own distribution FIRST — otherwise a percent-
 *  scaled neutron log is rejected sample-by-sample and the plot reports the
 *  delivery as carrying no NPHI at all, which is worse than wrong: it is a false
 *  statement about the data. */
const FRACTIONAL = new Set(['NPHI', 'PHIE', 'SWE', 'VSH']);

/** 0.01 when the curve is clearly on a 0–100 scale, else 1. Judged on the upper
 *  reach of the PRESENT samples, so a handful of -999.25 cannot swing it. */
export function unitScale(curve: string, values: (number | null)[] | undefined): number {
  if (!FRACTIONAL.has(curve) || !values) return 1;
  const present = values.filter((v): v is number => finite(v) && !(v <= -999 && v >= -9999.99));
  if (present.length < 8) return 1;
  const sorted = present.slice().sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  return p90 > 1.5 ? 0.01 : 1;
}

/** True when the sample is present AND physically possible for that curve. */
function real(curve: string, v: unknown): v is number {
  if (!finite(v)) return false;
  const r = RANGE_OF[curve];
  // an unknown curve is still screened for the LAS absent family, which is the
  // one wrong value guaranteed to be present in every delivered log
  if (!r) return !(v <= -999 && v >= -9999.99);
  return v >= r.lo && v <= r.hi;
}

/** How many bores carry every one of `needs`. */
export function availability(bores: BoreCurves[], needs: string[], why?: string): Availability {
  const wells = bores.filter((b) => needs.every((c) => {
    const arr = b.curves[c];
    // `.some(real)` not `.some(finite)`: a curve present but entirely -999.25 is
    // an absent curve, and counting it would overstate what the delivery carries
    if (!Array.isArray(arr)) return false;
    const k = unitScale(c, arr);
    return arr.some((v) => real(c, finite(v) ? v * k : v));
  })).length;
  return {
    needs,
    wells,
    ofWells: bores.length,
    blocked: wells === 0 ? (why ?? `no bore carries ${needs.join(' + ')}`) : null,
  };
}

/** Walk aligned samples, yielding only rows where every named curve is finite. */
function rows(b: BoreCurves, names: string[]): Array<{ i: number; v: number[] }> {
  const arrs = names.map((n) => b.curves[n]);
  if (arrs.some((a) => !Array.isArray(a))) return [];
  const scale = names.map((n, k) => unitScale(n, arrs[k]));
  const n = Math.min(...arrs.map((a) => (a as (number | null)[]).length));
  const out: Array<{ i: number; v: number[] }> = [];
  for (let i = 0; i < n; i++) {
    const raw = arrs.map((a) => (a as (number | null)[])[i]);
    // scale FIRST, then screen — the range is expressed in fractions
    const v = raw.map((x, k) => (finite(x) ? x * scale[k] : x));
    if (v.every((x, k) => real(names[k], x))) out.push({ i, v: v as number[] });
  }
  return out;
}

// ── 1. density–neutron ───────────────────────────────────────────────────────

/** Matrix lines, in the standard limestone-compatible neutron convention.
 *  Sandstone reads ~-0.03 to -0.05 NPHI at zero porosity; the separation between
 *  these lines IS the lithology signal. */
export const MATRIX_RHO = { sandstone: 2.65, limestone: 2.71, dolomite: 2.87 };

export interface DensityNeutronPoint extends XPoint {
  /** apparent total porosity from the density curve alone */
  phiD: number;
  /** NPHI − PHID. Strongly NEGATIVE is the classic gas signature: gas lowers the
   *  neutron reading and lowers bulk density, so the two curves cross over. */
  separation: number;
  gasEffect: boolean;
}

/**
 * @param rhoMa matrix density; sandstone for a Hugin-type reservoir
 * @param rhoFl fluid density; 1.0 for water-based mud filtrate
 * @param gasCut separation below which a point is flagged as gas-affected.
 *        −0.06 is a conventional working threshold, NOT a measurement — it is a
 *        display flag, and callers should say so.
 */
export function densityNeutron(
  bores: BoreCurves[], rhoMa = MATRIX_RHO.sandstone, rhoFl = 1.0, gasCut = -0.06,
): { points: DensityNeutronPoint[]; availability: Availability } {
  const avail = availability(bores, ['RHOB', 'NPHI']);
  const points: DensityNeutronPoint[] = [];
  if (!avail.blocked) {
    for (const b of bores) {
      for (const r of rows(b, ['RHOB', 'NPHI', ...(b.depth ? [] : [])])) {
        // already unit-resolved and screened by rows()
        const [rhob, nphi] = r.v;
        const phiD = (rhoMa - rhob) / (rhoMa - rhoFl);
        if (!finite(phiD)) continue;
        const separation = nphi - phiD;
        points.push({
          well: b.well, x: nphi, y: rhob, phiD, separation,
          gasEffect: separation <= gasCut,
          depth: b.depth?.[r.i] ?? undefined,
        });
      }
    }
  }
  return { points, availability: avail };
}

// ── 2. Pickett ───────────────────────────────────────────────────────────────

export interface PickettLine { sw: number; points: Array<[number, number]> }

/**
 * Pickett plot: log RT against log PHIE, with Archie iso-saturation lines.
 *
 * Archie: Sw^n = a·Rw / (PHIE^m · RT)  ⇒  RT = a·Rw / (PHIE^m · Sw^n)
 * so on log-log axes each Sw is a straight line of slope −m. Points that sit
 * ABOVE the Sw=1 line are more resistive than wet rock of the same porosity,
 * which is the hydrocarbon indication — and the reason this plot is the honest
 * HC-detection view when only GR and RT are available field-wide.
 */
export function pickettLines(
  phiRange: [number, number], rw: number, a: number, m: number, n: number, sws = [1, 0.6, 0.4, 0.2],
): PickettLine[] {
  const [p0, p1] = [Math.max(1e-3, phiRange[0]), Math.max(1e-3, phiRange[1])];
  return sws.map((sw) => ({
    sw,
    points: [p0, p1].map((phi) => [phi, (a * rw) / (phi ** m * sw ** n)] as [number, number]),
  }));
}

export function pickett(
  bores: BoreCurves[], phieCurve = 'PHIE',
): { points: XPoint[]; availability: Availability } {
  const avail = availability(bores, [phieCurve, 'RT']);
  const points: XPoint[] = [];
  if (!avail.blocked) {
    for (const b of bores) {
      for (const r of rows(b, [phieCurve, 'RT'])) {
        const [phi, rt] = r.v;
        // log axes: a zero or negative reading is not plottable, and clamping it
        // to an epsilon would invent a decade of resistivity
        if (phi > 0 && rt > 0) points.push({ well: b.well, x: phi, y: rt, depth: b.depth?.[r.i] ?? undefined });
      }
    }
  }
  return { points, availability: avail };
}

// ── 3. permeability: the plot this delivery cannot support ───────────────────

export interface PermeabilityResult {
  points: XPoint[];
  availability: Availability;
  /** Null for a delivery with no K. Present so the shape of an honest result is
   *  identical to a blocked one, and a caller cannot forget to check. */
  law: { form: string; a: number; b: number; r2: number | null; basis: 'core' | 'screening' } | null;
  /**
   * The law the STATIC MODEL is populating permeability with right now.
   *
   * Reconciliation, not decoration. Analytics answers "can this delivery support
   * a φ–k law" and the static model answers "what k did I put in the cells", and
   * with no core those are different answers to what a reader hears as one
   * question: Analytics says "blocked, no K anywhere" while the grid is quietly
   * full of 10^(19φ−1.5). Both are true and the pair is what matters, so the card
   * shows the screening law IN FORCE alongside the refusal to fit one.
   */
  inForce: { form: string; a: number; b: number; basis: 'screening' };
}

/**
 * PHIE–K.
 *
 * Returns blocked unless the delivery actually carries a permeability curve or
 * core K. Volve's logs carry none, so this reports why rather than fitting a
 * literature transform: Timur and Coates coefficients describe the rocks they
 * were derived from, and running this field's porosity through them produces a
 * permeability that looks measured and is not. If core K is later extracted from
 * the reports, pass it as a curve and the fit becomes real.
 */
export function permeability(bores: BoreCurves[], kCurve = 'PERM', phieCurve = 'PHIE'): PermeabilityResult {
  // What the static model is doing regardless of what can be fitted here.
  const inForce = {
    form: 'log10(k) = a·PHIE + b',
    a: PHI_K_SCREENING.a, b: PHI_K_SCREENING.b,
    basis: 'screening' as const,
  };

  const avail = availability(
    bores, [phieCurve, kCurve],
    'no permeability curve and no core K in this delivery — a PHIE–K law cannot be fitted from it, '
    + "and a literature transform would not be this field's rock",
  );
  if (avail.blocked) return { points: [], availability: avail, law: null, inForce };

  const points: XPoint[] = [];
  for (const b of bores) {
    for (const r of rows(b, [phieCurve, kCurve])) {
      const [phi, k] = r.v;
      if (phi > 0 && k > 0) points.push({ well: b.well, x: phi, y: k, depth: b.depth?.[r.i] ?? undefined });
    }
  }
  // ONE fitter, shared with the static model (engine/perm.fitPhiK), so a law shown
  // on this card and a law used to populate the grid can never be different code
  // with different fallbacks — which is exactly what they were.
  const fit = fitPhiK(points.map((p) => p.x), points.map((p) => p.y));
  return {
    points,
    availability: avail,
    law: fit.basis === 'core'
      ? { form: 'log10(k) = a·PHIE + b', a: fit.a, b: fit.b, r2: fit.r2, basis: 'core' }
      : null,
    inForce,
  };
}

// ── 4. saturation height, and Cuddy's FOIL ───────────────────────────────────

export interface ShfPoint extends XPoint { height: number; sw: number; bvw: number }

/**
 * Saturation–height, in both the classic Sw-vs-H view and Cuddy's.
 *
 * RECONCILED, not reimplemented. The fit itself is `fluid-model.fitCuddy` — the
 * same function the Fluids & Rock initialization uses to build the equilibration
 * — so the Analytics card and the dynamic model can never quote different
 * saturation-height constants for one field. This module only assembles the
 * samples and says whether the delivery can support them.
 *
 * That inheritance also brings the stricter guard: fitCuddy needs 20 surviving
 * samples, where a bare least-squares would happily "fit" three points through
 * log noise and report r²≈1. And it returns the height RANGE it was fitted over,
 * which is what lets a caller refuse to extrapolate above the highest sample.
 *
 * Cuddy's FOIL fits BULK VOLUME WATER against height rather than Sw, because BVW
 * collapses the porosity dependence that makes an Sw-vs-H cloud fan out — which
 * is exactly why it is reached for when rock typing is thin, as it is here.
 *
 * @param contactDepth free water level, m TVDSS positive down
 */
export function saturationHeight(
  bores: BoreCurves[], contactDepth: number, swCurve = 'SWE', phieCurve = 'PHIE',
): { points: ShfPoint[]; cuddy: CuddyShf | null; availability: Availability } {
  const avail = availability(bores, [swCurve, phieCurve]);
  // Height above a contact is a TRUE VERTICAL question. A bore whose depths are
  // measured depth is refused outright rather than quietly producing nothing.
  const withDepth = bores.filter((b) => b.depth);
  const mdOnly = withDepth.filter((b) => b.depthKind !== 'tvdss');
  if (!avail.blocked && withDepth.length > 0 && mdOnly.length === withDepth.length) {
    return {
      points: [],
      cuddy: null,
      availability: {
        ...avail,
        blocked: 'log depths are measured depth — height above a contact needs TVDSS, '
          + 'so the surveys must be applied before this plot means anything',
      },
    };
  }

  const points: ShfPoint[] = [];
  if (!avail.blocked && Number.isFinite(contactDepth)) {
    for (const b of bores) {
      if (!b.depth || b.depthKind !== 'tvdss') continue;
      for (const r of rows(b, [swCurve, phieCurve])) {
        const d = b.depth[r.i];
        if (!finite(d)) continue;
        const height = contactDepth - Math.abs(d);      // above the contact ⇒ positive
        if (height <= 0) continue;                      // below the FWL is not a column
        const [sw, phi] = r.v;                          // unit-resolved and screened by rows()
        if (!(sw > 0 && sw <= 1) || !(phi > 0)) continue;
        points.push({ well: b.well, x: height, y: sw, height, sw, bvw: sw * phi, depth: Math.abs(d) });
      }
    }
  }

  return {
    points,
    cuddy: fitCuddy(points.map((p) => ({ h: p.height, sw: p.sw, phi: p.bvw / p.sw }))),
    availability: avail,
  };
}

/** BVW predicted by the shared Cuddy fit at a height above the free water level. */
export const cuddyBvw = (fit: { a: number; b: number }, height: number) => fit.a * height ** fit.b;

// ── shared ───────────────────────────────────────────────────────────────────

/** Least squares y = a·x + b, with r². Null below three points — a "fit" through
 *  two points has an r² of 1 and means nothing. */
export function linreg(xy: Array<[number, number]>): { a: number; b: number; r2: number } | null {
  const pts = xy.filter(([x, y]) => finite(x) && finite(y));
  if (pts.length < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (sxx === 0) return null;
  const a = sxy / sxx;
  return { a, b: my - a * mx, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) };
}
