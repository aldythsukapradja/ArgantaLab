// perm.ts — φ→k transform (S1). The bridge from the static property model to the
// dynamic simulator. Log-linear screening transform; replace (a,b) with a core
// cloud-fit when core is available. Ported 1:1 from scripts/test-geostat.mjs.

/**
 * THE screening φ→k law, in one place.
 *
 * It was written down twice with different numbers: `phiToK` defaulted to
 * (19, −1.5) while `fitPhiK` fell back to (30, −1) when it had nothing to fit.
 * So a field with no core got permeability from one law while anything asking
 * "what law is in force" was told another — and (30, −1) is the value this file's
 * own comment records as UNPHYSICAL, ~560 D at φ=0.225. One constant now, used by
 * both, so the static model and the analytics cannot disagree about the rock.
 */
export const PHI_K_SCREENING = { a: 19, b: -1.5 } as const;

/** log10(k_mD) = a·φ + b — strictly monotone increasing in φ, k>0. Defaults
 * (a=19, b=-1.5) give ~1 mD at φ=0.08, ~200 mD at φ=0.20, ~600 mD at φ=0.225 —
 * a realistic North-Sea sand screening range (the old a=30 gave an unphysical
 * ~560 D at φ=0.225). */
export function phiToK(phi: number, a: number = PHI_K_SCREENING.a, b: number = PHI_K_SCREENING.b): number {
  return Math.pow(10, a * phi + b);
}

/** Vertical permeability from horizontal via a kv/kh ratio (default 0.1). */
export function permKv(kh: number, kvkh = 0.1): number { return kh * kvkh; }

export interface PhiKLaw {
  a: number; b: number;
  /** 'core' = fitted to the points given. 'screening' = NOTHING was fitted and
   *  PHI_K_SCREENING was returned. The caller must be able to tell these apart:
   *  a screening law is an assumption about North Sea sand, a fitted one is this
   *  field's rock, and they carry completely different authority. */
  basis: 'core' | 'screening';
  /** points that survived screening — 0 when nothing was fitted */
  n: number;
  /** coefficient of determination; null when nothing was fitted */
  r2: number | null;
}

/**
 * Fit log10(k)=a·φ+b to a core cloud.
 *
 * Needs THREE points, not two: two points define a line exactly, so the fit is
 * guaranteed and the r² is 1 no matter how meaningless the pair is. Below that —
 * or on a vertical cloud, where the slope is undefined — it returns the screening
 * law and SAYS SO, rather than handing back a different invented law that reads
 * identically to a real fit.
 */
export function fitPhiK(phi: number[], k: number[]): PhiKLaw {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < phi.length; i++) if (isFinite(phi[i]) && k[i] > 0) pts.push([phi[i], Math.log10(k[i])]);
  const n = pts.length;
  const fallback: PhiKLaw = { ...PHI_K_SCREENING, basis: 'screening', n: 0, r2: null };
  if (n < 3) return fallback;

  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (!(sxx > 1e-12)) return fallback;          // every point at one porosity
  const a = sxy / sxx;
  return { a, b: my - a * mx, basis: 'core', n, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) };
}
