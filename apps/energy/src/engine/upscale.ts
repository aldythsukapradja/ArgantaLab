// upscale.ts — the Petrel "scale-up well logs" step: block fine LFP samples over
// the picks-bounded interval into upscaled cell values. Three averaging modes,
// matching the reference in scripts/test-engine.mjs exactly:
//   continuous (PHIE) → arithmetic mean; SAND → net-fraction; facies → majority.
// Pure TS, no DOM.

/** Arithmetic mean of non-null continuous values (e.g. PHIE). */
export function upscaleMean(vals: Array<number | null | undefined>): number | null {
  const v = vals.filter((x): x is number => x != null && isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Net fraction of a 0/1 flag (e.g. SAND) — share of samples ≥ 0.5. */
export function netFraction(flags: Array<number | null | undefined>): number {
  const v = flags.filter((x): x is number => x != null && isFinite(x));
  return v.length ? v.filter((x) => x >= 0.5).length / v.length : 0;
}

/** Majority vote over discrete labels (e.g. facies). */
export function majority<T>(labels: T[]): T | undefined {
  const m = new Map<T, number>();
  for (const l of labels) m.set(l, (m.get(l) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export interface UpscaleResult {
  phieRaw: number | null;   // raw arithmetic mean over interval (continuous)
  phieUp: number | null;    // upscaled (same mean here — single cell block)
  netSand: number;          // net-sand fraction (SAND ≥ 0.5)
  facies: 'SAND' | 'SHALE'; // majority discrete facies
  nSamples: number;
}

/**
 * upscaleWell — block the LFP samples inside [topMd, baseMd] into a single
 * upscaled cell per well (v1: one Hugin cell). Returns raw-vs-upscaled so the
 * viewer can post both (nothing hidden).
 */
export function upscaleWell(
  md: number[],
  phie: Array<number | null | undefined>,
  sand: Array<number | null | undefined>,
  topMd: number,
  baseMd: number,
  sandThreshold = 0.5,
): UpscaleResult {
  const lo = Math.min(topMd, baseMd), hi = Math.max(topMd, baseMd);
  const inPhie: Array<number | null> = [];
  const inSand: number[] = [];
  const faciesLabels: Array<'SAND' | 'SHALE'> = [];
  for (let i = 0; i < md.length; i++) {
    if (md[i] < lo || md[i] > hi) continue;
    inPhie.push(phie[i] ?? null);
    const s = sand[i];
    if (s != null && isFinite(s)) {
      inSand.push(s);
      faciesLabels.push(s >= sandThreshold ? 'SAND' : 'SHALE');
    }
  }
  const mean = upscaleMean(inPhie);
  const netSand = netFraction(inSand);
  const facies = (majority(faciesLabels) ?? (netSand >= sandThreshold ? 'SAND' : 'SHALE')) as 'SAND' | 'SHALE';
  return { phieRaw: mean, phieUp: mean, netSand, facies, nSamples: inPhie.length };
}
