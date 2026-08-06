// variogram-analysis.ts — measuring the spatial structure instead of assuming it.
//
// ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
//
// Every simulation in this project has run on one hardcoded variogram:
// `{ spherical, nugget 0.05, sill 1, range 800 }`. Nobody chose 800 m by looking at the
// data — it was a plausible number, and it has been the single least defensible input
// in the model. A range controls how far a value is allowed to propagate from a well,
// so on a field with nine flowing wells it is doing more work than almost any other
// parameter.
//
// This module computes the EXPERIMENTAL variogram from the upscaled cells, fits a model
// to it, and searches for anisotropy — the direction along which the rock actually
// correlates furthest. The output is a `Vario` the existing engines already accept.
//
// ── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────
//
// It will not return a fit it cannot support. A lag bin with three pairs in it is noise
// with a number attached, and a fitted range longer than the data extent is an
// extrapolation dressed as a measurement. Both are reported and both disqualify a fit
// rather than being quietly rounded into one.
//
// Pure — no DOM, no IndexedDB.
import { variogram as gammaModel, type Vario, type VarioModel } from '../../engine/geostat.ts';

export interface SpatialPoint { x: number; y: number; v: number }

export interface LagBin {
  /** mean separation of the pairs in this bin, metres */
  h: number;
  /** semivariance */
  gamma: number;
  /** how many PAIRS — not points. A bin under ~30 pairs is not evidence. */
  pairs: number;
}

export interface ExperimentalVariogram {
  bins: LagBin[];
  /** azimuth searched, degrees clockwise from north; null = omnidirectional */
  azimuthDeg: number | null;
  /** angular half-window, degrees */
  toleranceDeg: number;
  lagM: number;
  nLags: number;
  /** variance of the data — the sill a variogram should approach */
  variance: number;
  /** total pairs that fell in any bin */
  pairs: number;
  /** the largest separation in the data; a range beyond this is extrapolation */
  extentM: number;
}

export interface VariogramOptions {
  /** lag width, metres. Defaults to extent / 20 — enough bins to see a shape. */
  lagM?: number;
  nLags?: number;
  /** direction to measure along; omit for omnidirectional */
  azimuthDeg?: number;
  toleranceDeg?: number;
  /** perpendicular limit, metres — stops a wide tolerance sweeping in far-off pairs */
  bandwidthM?: number;
  /** pairs beyond this separation are ignored */
  maxDistM?: number;
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

/** Angular difference to a direction, folded to [0, 90] — a variogram has no sign. */
function angleTo(dx: number, dy: number, azimuthDeg: number): number {
  const az = (Math.atan2(dx, dy) * 180) / Math.PI;        // clockwise from north
  let d = Math.abs(az - azimuthDeg) % 180;
  if (d > 90) d = 180 - d;
  return d;
}

/**
 * The experimental variogram: γ(h) = ½ · mean[(v(x) − v(x+h))²].
 *
 * O(n²) over the data pairs, which is fine for the few hundred upscaled cells a field
 * has and would not be for a simulated grid — this is deliberately a tool for
 * CONDITIONING data, which is the only data that carries information about the
 * structure anyway.
 */
export function experimentalVariogram(pts: SpatialPoint[], opts: VariogramOptions = {}): ExperimentalVariogram {
  const data = pts.filter((p) => Number.isFinite(p.v) && Number.isFinite(p.x) && Number.isFinite(p.y));
  const vals = data.map((p) => p.v);
  const mu = mean(vals);
  const variance = vals.length > 1
    ? vals.reduce((a, v) => a + (v - mu) ** 2, 0) / (vals.length - 1)
    : NaN;

  let extent = 0;
  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      const d = Math.hypot(data[i].x - data[j].x, data[i].y - data[j].y);
      if (d > extent) extent = d;
    }
  }

  // half the extent by default: beyond that the pair count collapses and the variogram
  // is describing the few widest pairs rather than the field
  const maxDist = opts.maxDistM ?? extent / 2;
  const nLags = Math.max(1, opts.nLags ?? 20);
  const lag = opts.lagM ?? (maxDist > 0 ? maxDist / nLags : 1);
  const tol = opts.toleranceDeg ?? 22.5;
  const az = opts.azimuthDeg;
  const band = opts.bandwidthM ?? Infinity;

  const sum = new Float64Array(nLags);
  const hsum = new Float64Array(nLags);
  const cnt = new Int32Array(nLags);

  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      const dx = data[j].x - data[i].x, dy = data[j].y - data[i].y;
      const h = Math.hypot(dx, dy);
      if (!(h > 0) || h > maxDist) continue;
      if (az != null) {
        const a = angleTo(dx, dy, az);
        if (a > tol) continue;
        // perpendicular offset — without it a wide tolerance at long range sweeps in
        // pairs that are barely in the direction at all
        if (Math.abs(h * Math.sin((a * Math.PI) / 180)) > band) continue;
      }
      const b = Math.min(nLags - 1, Math.floor(h / lag));
      const d = data[i].v - data[j].v;
      sum[b] += d * d; hsum[b] += h; cnt[b]++;
    }
  }

  const bins: LagBin[] = [];
  for (let b = 0; b < nLags; b++) {
    if (!cnt[b]) continue;
    bins.push({ h: hsum[b] / cnt[b], gamma: sum[b] / (2 * cnt[b]), pairs: cnt[b] });
  }
  return {
    bins, azimuthDeg: az ?? null, toleranceDeg: tol, lagM: lag, nLags,
    variance, pairs: bins.reduce((a, x) => a + x.pairs, 0), extentM: extent,
  };
}

export interface VariogramFit {
  vario: Vario;
  /** weighted residual — pairs weight each bin, so a 3-pair bin cannot steer the fit */
  rmse: number;
  /** bins the fit actually rested on */
  binsUsed: number;
  /** true when the fit is worth using; see `reason` when it is not */
  usable: boolean;
  reason?: string;
}

const MODELS: VarioModel[] = ['spherical', 'exponential', 'gaussian'];

/**
 * Fit nugget, sill and range by weighted least squares over a grid of candidates.
 *
 * A grid search rather than a gradient method: three parameters over a bounded space,
 * evaluated on at most twenty bins, is trivially cheap and cannot land in a local
 * minimum or fail to converge — which matters more than elegance for something a user
 * will re-run on every property.
 *
 * BINS ARE WEIGHTED BY PAIR COUNT. An unweighted fit lets the longest lag — always the
 * emptiest — pull the range, and the range is the number everything downstream uses.
 */
export function fitVariogram(
  exp: ExperimentalVariogram,
  opts: { model?: VarioModel; minPairs?: number } = {},
): VariogramFit {
  const minPairs = opts.minPairs ?? 30;
  const bins = exp.bins.filter((b) => b.pairs >= minPairs);
  const fallback: Vario = { model: 'spherical', nugget: 0.05, sill: exp.variance || 1, range: exp.extentM / 3 || 800 };

  if (bins.length < 3) {
    return {
      vario: fallback, rmse: NaN, binsUsed: bins.length, usable: false,
      reason: `only ${bins.length} lag bin(s) carry ${minPairs}+ pairs — not enough to fit a shape`,
    };
  }

  const maxG = Math.max(...bins.map((b) => b.gamma));
  const sillHi = Math.max(maxG * 1.4, exp.variance || maxG);
  const rangeHi = exp.extentM > 0 ? exp.extentM : Math.max(...bins.map((b) => b.h)) * 2;

  let best: VariogramFit | null = null;
  for (const model of opts.model ? [opts.model] : MODELS) {
    for (let ri = 1; ri <= 40; ri++) {
      const range = (rangeHi * ri) / 40;
      for (let ni = 0; ni <= 12; ni++) {
        const nugget = (sillHi * ni) / 24;             // nugget up to half the sill
        for (let si = 4; si <= 20; si++) {
          const sill = (sillHi * si) / 20;
          if (sill <= nugget) continue;
          const p: Vario = { model, nugget, sill, range };
          let num = 0, den = 0;
          for (const b of bins) {
            const r = gammaModel(b.h, p) - b.gamma;
            num += b.pairs * r * r; den += b.pairs;
          }
          const rmse = Math.sqrt(num / den);
          if (!best || rmse < best.rmse) best = { vario: p, rmse, binsUsed: bins.length, usable: true };
        }
      }
    }
  }
  if (!best) return { vario: fallback, rmse: NaN, binsUsed: bins.length, usable: false, reason: 'no candidate fitted' };

  // A range longer than the data extent is not a measurement — the data cannot see that
  // far. It is reported as unusable rather than silently accepted, because it is exactly
  // the case where an assumed 800 m would have looked fine.
  if (best.vario.range > exp.extentM * 0.95) {
    return {
      ...best, usable: false,
      reason: `fitted range ${best.vario.range.toFixed(0)} m exceeds the data extent ${exp.extentM.toFixed(0)} m — the wells cannot resolve it`,
    };
  }
  return best;
}

export interface AnisotropyResult {
  /** major direction, degrees clockwise from north */
  azimuthDeg: number;
  majorRangeM: number;
  minorRangeM: number;
  /** minor / major, 0–1 */
  ratio: number;
  /** every direction tried, for the rose plot */
  directions: Array<{ azimuthDeg: number; rangeM: number; pairs: number; usable: boolean }>;
  usable: boolean;
  reason?: string;
}

/**
 * Search for the direction the rock correlates furthest along.
 *
 * Fits a variogram in each of `nDir` directions and takes the longest range as major,
 * the perpendicular as minor. Deliberately NOT "the shortest range anywhere" for minor:
 * the two axes of a geometric anisotropy are orthogonal by definition, and picking the
 * global minimum independently produces a pair that no ellipse can satisfy.
 */
export function detectAnisotropy(
  pts: SpatialPoint[],
  opts: VariogramOptions & { nDirections?: number; model?: VarioModel } = {},
): AnisotropyResult {
  const nDir = opts.nDirections ?? 6;                    // 0–180 in 30° steps
  const dirs: AnisotropyResult['directions'] = [];
  for (let d = 0; d < nDir; d++) {
    const azimuthDeg = (180 * d) / nDir;
    const exp = experimentalVariogram(pts, { ...opts, azimuthDeg, toleranceDeg: opts.toleranceDeg ?? 30 });
    const fit = fitVariogram(exp, { model: opts.model });
    dirs.push({ azimuthDeg, rangeM: fit.vario.range, pairs: exp.pairs, usable: fit.usable });
  }
  const good = dirs.filter((d) => d.usable);
  if (good.length < 2) {
    return {
      azimuthDeg: 0, majorRangeM: NaN, minorRangeM: NaN, ratio: 1, directions: dirs,
      usable: false,
      reason: `only ${good.length} of ${nDir} directions produced a usable fit — the data are too sparse to resolve anisotropy`,
    };
  }
  const major = good.reduce((a, b) => (b.rangeM > a.rangeM ? b : a));
  // the PERPENDICULAR direction, not the global minimum: a geometric anisotropy has
  // orthogonal axes, and two independently-chosen extremes describe no ellipse
  const perpAz = (major.azimuthDeg + 90) % 180;
  const minor = dirs.reduce((a, b) =>
    (Math.abs(((b.azimuthDeg - perpAz + 90) % 180) - 90) < Math.abs(((a.azimuthDeg - perpAz + 90) % 180) - 90) ? b : a));
  const ratio = major.rangeM > 0 ? Math.min(1, minor.rangeM / major.rangeM) : 1;
  return {
    azimuthDeg: major.azimuthDeg,
    majorRangeM: major.rangeM, minorRangeM: minor.rangeM,
    ratio, directions: dirs, usable: true,
  };
}

/**
 * The whole analysis, as one call: omnidirectional fit plus an anisotropy search,
 * returned as a `Vario` the engines already take.
 *
 * When anisotropy is not resolvable the result is the isotropic fit — with the reason
 * carried, so a caller can say "we could not measure it" rather than presenting a
 * default as a finding.
 */
export function analyseVariogram(
  pts: SpatialPoint[],
  opts: VariogramOptions & { nDirections?: number; model?: VarioModel } = {},
): { vario: Vario; fit: VariogramFit; exp: ExperimentalVariogram; aniso: AnisotropyResult } {
  const exp = experimentalVariogram(pts, opts);
  const fit = fitVariogram(exp, { model: opts.model });
  const aniso = detectAnisotropy(pts, opts);
  const vario: Vario = aniso.usable && aniso.ratio < 0.9
    ? { ...fit.vario, range: aniso.majorRangeM, aniso: { azimuthDeg: aniso.azimuthDeg, ratio: aniso.ratio } }
    : fit.vario;
  return { vario, fit, exp, aniso };
}

// ── trends ──────────────────────────────────────────────────────────────────

export interface TrendFit {
  /** value = a + b·z */
  a: number; b: number;
  r2: number;
  n: number;
  /** true when the trend explains enough to be worth removing */
  usable: boolean;
}

/**
 * A vertical trend, fitted by least squares against depth.
 *
 * Removing a trend before simulating matters because a variogram assumes stationarity:
 * if porosity falls systematically with depth, the experimental variogram reads that
 * fall as a lack of correlation and returns a range far shorter than the rock actually
 * has. Fit it, simulate the residual, add it back.
 *
 * `usable` is false below r² 0.1 — a trend that explains a tenth of the variance is
 * noise, and removing it moves the data without informing anything.
 */
export function fitVerticalTrend(samples: Array<{ z: number; v: number }>): TrendFit {
  const d = samples.filter((s) => Number.isFinite(s.z) && Number.isFinite(s.v));
  if (d.length < 10) return { a: NaN, b: 0, r2: 0, n: d.length, usable: false };
  const mz = mean(d.map((s) => s.z)), mv = mean(d.map((s) => s.v));
  let sxy = 0, sxx = 0, syy = 0;
  for (const s of d) {
    const dz = s.z - mz, dv = s.v - mv;
    sxy += dz * dv; sxx += dz * dz; syy += dv * dv;
  }
  if (!(sxx > 0)) return { a: mv, b: 0, r2: 0, n: d.length, usable: false };
  const b = sxy / sxx;
  const a = mv - b * mz;
  const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
  return { a, b, r2, n: d.length, usable: r2 >= 0.1 };
}

export const applyTrend = (t: TrendFit, z: number) => t.a + t.b * z;
export const removeTrend = (t: TrendFit, z: number, v: number) => v - applyTrend(t, z);

export interface ProportionCurve {
  /** one entry per layer, shallowest first */
  layers: Array<{ k: number; sand: number; n: number }>;
  /** overall sand fraction of the conditioning data */
  overall: number;
}

/**
 * The vertical proportion curve — sand fraction layer by layer.
 *
 * A single global sand fraction makes a coarsening-upward reservoir look uniform. The
 * curve is what lets an indicator simulation honour the fact that the good rock is at
 * the top, and it is read straight off the blocked cells rather than assumed.
 *
 * Layers with no data report `n: 0` and are left for the caller to interpolate or skip.
 * Filling them with the global mean here would hide which layers no well ever saw.
 */
export function verticalProportionCurve(
  cells: Array<{ k: number; facies: number }>,
  nz: number,
): ProportionCurve {
  const sand = new Int32Array(nz), tot = new Int32Array(nz);
  for (const c of cells) {
    if (c.k < 0 || c.k >= nz) continue;
    tot[c.k]++; if (c.facies === 1) sand[c.k]++;
  }
  let s = 0, t = 0;
  const layers = [];
  for (let k = 0; k < nz; k++) {
    s += sand[k]; t += tot[k];
    layers.push({ k, sand: tot[k] ? sand[k] / tot[k] : NaN, n: tot[k] });
  }
  return { layers, overall: t ? s / t : NaN };
}

// ── collocated cokriging ────────────────────────────────────────────────────

export interface CokrigeResult {
  est: number;
  /** weight the secondary variable actually took, 0–1 */
  secondaryWeight: number;
}

/**
 * Collocated simple cokriging with a Markov-model secondary variable.
 *
 * The case this exists for: porosity is known at nine wells and a seismic attribute is
 * known everywhere. Kriging the wells alone spreads nine numbers across a field;
 * cokriging lets the attribute carry the shape between them, weighted by how well it
 * actually correlates.
 *
 * Under the Markov screening approximation the collocated secondary reduces to a single
 * extra equation, which is why this is a closed form rather than a solve. `rho` is the
 * correlation between primary and secondary AT THE DATA — a caller that passes an
 * assumed one has cokriged with a guess, so it is a required argument, not a default.
 *
 * Everything is in NORMAL-SCORE space: both variables standardised, mean zero, unit
 * variance. Feeding raw values makes the weights meaningless.
 */
export function collocatedCokrige(
  primary: Array<{ x: number; y: number; v: number }>,
  target: { x: number; y: number },
  secondaryAtTarget: number,
  p: Vario,
  rho: number,
  krigeFn: (data: Array<{ x: number; y: number; v: number }>, t: { x: number; y: number }, p: Vario) => { est: number; variance: number },
): CokrigeResult {
  const r = Math.max(-0.999, Math.min(0.999, rho));
  if (!primary.length || !Number.isFinite(secondaryAtTarget)) {
    // no primary data: the secondary IS the estimate, scaled by how much it is trusted
    return { est: Number.isFinite(secondaryAtTarget) ? r * secondaryAtTarget : 0, secondaryWeight: Math.abs(r) };
  }
  const { est, variance } = krigeFn(primary, target, p);
  // Markov-model collocated cokriging: the secondary's weight rises with the kriging
  // VARIANCE — it matters most exactly where the wells say least, which is the whole
  // point of bringing it in.
  const denom = 1 - r * r * (1 - variance);
  const w = denom > 1e-9 ? (r * variance) / denom : 0;
  const wClamped = Math.max(-1, Math.min(1, w));
  return {
    est: est * (1 - Math.abs(wClamped)) + wClamped * secondaryAtTarget,
    secondaryWeight: Math.abs(wClamped),
  };
}

/** Pearson correlation between paired samples — the `rho` cokriging requires. */
export function correlation(a: number[], b: number[]): { rho: number; n: number } {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) pairs.push([a[i], b[i]]);
  }
  if (pairs.length < 3) return { rho: NaN, n: pairs.length };
  const ma = mean(pairs.map((x) => x[0])), mb = mean(pairs.map((x) => x[1]));
  let sab = 0, saa = 0, sbb = 0;
  for (const [x, y] of pairs) {
    const da = x - ma, db = y - mb;
    sab += da * db; saa += da * da; sbb += db * db;
  }
  return { rho: saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN, n: pairs.length };
}
