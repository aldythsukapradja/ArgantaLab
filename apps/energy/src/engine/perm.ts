// perm.ts — φ→k transform (S1). The bridge from the static property model to the
// dynamic simulator. Log-linear screening transform; replace (a,b) with a core
// cloud-fit when core is available. Ported 1:1 from scripts/test-geostat.mjs.

/** log10(k_mD) = a·φ + b — strictly monotone increasing in φ, k>0. Defaults
 * (a=19, b=-1.5) give ~1 mD at φ=0.08, ~200 mD at φ=0.20, ~600 mD at φ=0.225 —
 * a realistic North-Sea sand screening range (the old a=30 gave an unphysical
 * ~560 D at φ=0.225). */
export function phiToK(phi: number, a = 19, b = -1.5): number { return Math.pow(10, a * phi + b); }

/** Vertical permeability from horizontal via a kv/kh ratio (default 0.1). */
export function permKv(kh: number, kvkh = 0.1): number { return kh * kvkh; }

/** Fit (a,b) of log10(k)=a·φ+b from a core cloud (least squares); fallback to
 * screening defaults when <2 points. */
export function fitPhiK(phi: number[], k: number[]): { a: number; b: number } {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < phi.length; i++) if (isFinite(phi[i]) && k[i] > 0) pts.push([phi[i], Math.log10(k[i])]);
  const n = pts.length;
  if (n < 2) return { a: 30, b: -1 };
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) * (x - mx); }
  const a = sxx > 1e-12 ? sxy / sxx : 30;
  return { a, b: my - a * mx };
}
