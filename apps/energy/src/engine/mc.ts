// mc.ts — seeded Monte-Carlo primitives (RNG, distributions, percentiles, MC run,
// tornado sensitivity). 1:1 port of scripts/test-engine.mjs reference numerics.
// Reproducible: same seed → identical sequence. Pure TS, no DOM.

export type Rng = () => number;

/** mulberry32 — deterministic seeded PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller. */
export function gauss(rng: Rng): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(k,1) via Marsaglia–Tsang. */
export function gamma(rng: Rng, k: number): number {
  if (k < 1) return gamma(rng, k + 1) * Math.pow(rng(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = gauss(rng); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Beta(a,b) via two gammas. */
export function beta(rng: Rng, a: number, b: number): number {
  const x = gamma(rng, a), y = gamma(rng, b);
  return x / (x + y);
}

/** PERT(min,mode,max) via Beta with the standard shape (λ=4). Mean=(min+4·mode+max)/6. */
export function samplePert(rng: Rng, min: number, mode: number, max: number): number {
  if (max <= min) return min;
  const a = 1 + (4 * (mode - min)) / (max - min);
  const b = 1 + (4 * (max - mode)) / (max - min);
  return min + beta(rng, a, b) * (max - min);
}

/** Triangular(min,mode,max). Mean=(min+mode+max)/3. */
export function sampleTri(rng: Rng, min: number, mode: number, max: number): number {
  const u = rng(), c = (mode - min) / (max - min);
  return u < c
    ? min + Math.sqrt(u * (max - min) * (mode - min))
    : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

/** Percentile on a sorted-ascending array, p∈[0,100] (linear interpolation). */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sortedAsc[lo] : sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

export type DistKind = 'pert' | 'triangular';
export interface McInput { key: string; label: string; dist: DistKind; min: number; mode: number; max: number }

export interface McResult {
  realizations: number[];       // sorted ascending
  samples: Record<string, number[]>; // per-input raw samples (for tornado)
  outputs: number[];            // per-realization output (unsorted, index-aligned to samples)
  p90: number; p50: number; p10: number; mean: number;
}

/**
 * monteCarlo — draw n realizations of each input, evaluate `fn`, return sorted
 * outputs + oil-convention percentiles (P90=pct10 ≤ P50 ≤ P10=pct90).
 */
export function monteCarlo(
  inputs: McInput[],
  fn: (vals: Record<string, number>) => number,
  n: number,
  seed: number,
): McResult {
  const rng = mulberry32(seed);
  const samples: Record<string, number[]> = {};
  for (const inp of inputs) samples[inp.key] = new Array(n);
  const outputs = new Array<number>(n);
  const vals: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    for (const inp of inputs) {
      const v = inp.dist === 'triangular'
        ? sampleTri(rng, inp.min, inp.mode, inp.max)
        : samplePert(rng, inp.min, inp.mode, inp.max);
      samples[inp.key][i] = v;
      vals[inp.key] = v;
    }
    outputs[i] = fn(vals);
  }
  const sorted = outputs.slice().sort((a, b) => a - b);
  const mean = outputs.reduce((a, b) => a + b, 0) / n;
  return {
    realizations: sorted,
    samples, outputs,
    p90: percentile(sorted, 10),
    p50: percentile(sorted, 50),
    p10: percentile(sorted, 90),
    mean,
  };
}

/** Pearson correlation coefficient. */
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sx += dx * dx; sy += dy * dy; }
  const d = Math.sqrt(sx * sy);
  return d === 0 ? 0 : sxy / d;
}

export interface TornadoBar { key: string; label: string; r: number; lowOut: number; highOut: number }

/**
 * tornado — Pearson r of each input vs the output across realizations, sorted by
 * |r| desc. low/high output bars from the input's own low/high quantile split.
 */
export function tornado(mc: McResult, inputs: McInput[]): TornadoBar[] {
  const bars: TornadoBar[] = inputs.map((inp) => {
    const xs = mc.samples[inp.key];
    const r = pearson(xs, mc.outputs);
    // one-at-a-time low/high: mean output for the lowest vs highest tercile of this input
    const order = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    const k = Math.max(1, Math.floor(order.length / 3));
    const meanOf = (idxs: readonly (readonly [number, number])[]) =>
      idxs.reduce((a, [, i]) => a + mc.outputs[i], 0) / idxs.length;
    const lowOut = meanOf(order.slice(0, k));
    const highOut = meanOf(order.slice(-k));
    return { key: inp.key, label: inp.label, r, lowOut, highOut };
  });
  return bars.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}
