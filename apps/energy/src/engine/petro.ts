// petro.ts — deterministic petrophysics primitives (Vsh · φt · φe · Sw · net flag).
// 1:1 port of the reference formulas locked in scripts/test-engine.mjs. Pure TS,
// no DOM. Labelled `derived` when surfaced (Archie recompute), vs the `interpreted`
// Equinor LFP curves shipped in the wb logs.

export type VshMethod = 'linear' | 'larionov_tertiary' | 'larionov_older';

/** GR index → shale volume. Larionov tertiary is the young-rock default. */
export function vsh(gr: number, grMin: number, grMax: number, method: VshMethod = 'larionov_tertiary'): number {
  if (grMax <= grMin) return 0;
  const igr = Math.max(0, Math.min(1, (gr - grMin) / (grMax - grMin)));
  switch (method) {
    case 'linear': return igr;
    case 'larionov_older': return 0.33 * (Math.pow(2, 2 * igr) - 1);
    case 'larionov_tertiary':
    default: return 0.083 * (Math.pow(2, 3.7 * igr) - 1);
  }
}

/** Density porosity (total). rhoFl defaults to brine 1.0 g/cc. */
export function phit(rhob: number, rhoMa: number, rhoFl = 1.0): number {
  if (rhoMa === rhoFl) return 0;
  return (rhoMa - rhob) / (rhoMa - rhoFl);
}

/** Effective porosity = total − shale-bound, clamped [0,1]. phiSh = shale porosity. */
export function phie(phitVal: number, vshVal: number, phiSh = 0.1): number {
  return Math.max(0, Math.min(1, phitVal - vshVal * phiSh));
}

/** Archie water saturation, clamped [0,1]. */
export function sw(phieVal: number, rt: number, a: number, m: number, n: number, rw: number): number {
  if (phieVal <= 0 || rt <= 0) return 1;
  return Math.max(0, Math.min(1, Math.pow((a * rw) / (Math.pow(phieVal, m) * rt), 1 / n)));
}

export interface NetCutoffs { vsh: number; phie: number; sw: number }
export const DEFAULT_CUTOFFS: NetCutoffs = { vsh: 0.5, phie: 0.08, sw: 0.6 };

/** Net-reservoir flag: pay if Vsh ≤ cut, φe ≥ cut, Sw ≤ cut. */
export function netFlag(vshVal: number, phieVal: number, swVal: number, cuts: NetCutoffs = DEFAULT_CUTOFFS): boolean {
  return vshVal <= cuts.vsh && phieVal >= cuts.phie && swVal <= cuts.sw;
}

export interface ZoneCurves {
  vsh?: (number | null)[];
  phie?: (number | null)[];
  sw?: (number | null)[];
}
export interface ZoneAverages {
  ntg: number;        // net-to-gross fraction over the interval
  phie: number;       // net-weighted mean effective porosity
  sw: number;         // net-weighted mean water saturation
  netM: number;       // net metres
  grossM: number;     // gross metres
  nSamples: number;   // samples inside the interval
}

/**
 * zoneAverages — net-weighted zone statistics over [topMd, baseMd].
 * md ascending; curves index-aligned to md. Uses cutoffs to flag net, then
 * averages φe/Sw over the net samples only. NTG = netM / grossM.
 */
export function zoneAverages(
  md: number[],
  curves: ZoneCurves,
  topMd: number,
  baseMd: number,
  cuts: NetCutoffs = DEFAULT_CUTOFFS,
): ZoneAverages {
  const lo = Math.min(topMd, baseMd), hi = Math.max(topMd, baseMd);
  let grossM = 0, netM = 0, phieSum = 0, swSum = 0, n = 0, samples = 0;
  for (let i = 0; i < md.length; i++) {
    const d = md[i];
    if (d < lo || d > hi) continue;
    // sample thickness = half-step to each neighbour (trapezoid-ish)
    const prev = i > 0 ? md[i - 1] : d;
    const next = i < md.length - 1 ? md[i + 1] : d;
    const dz = Math.max(0, (next - prev) / 2);
    samples++;
    const v = curves.vsh?.[i], p = curves.phie?.[i], s = curves.sw?.[i];
    if (p == null || !isFinite(p)) continue;
    grossM += dz;
    const isNet = netFlag(v ?? 0, p, s ?? 0, cuts);
    if (isNet) {
      netM += dz;
      phieSum += p * dz;
      swSum += (s ?? 0) * dz;
      n += dz;
    }
  }
  return {
    ntg: grossM > 0 ? netM / grossM : 0,
    phie: n > 0 ? phieSum / n : 0,
    sw: n > 0 ? swSum / n : 0,
    netM, grossM, nSamples: samples,
  };
}
