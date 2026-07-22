// dca.ts — Arps decline-curve analysis (rate, cumulative, fit, EUR).
// 1:1 port of the reference arps/arpsCum in scripts/test-engine.mjs. Pure TS.

/** Arps rate at time t (months). b=0 exponential, b=1 harmonic, else hyperbolic. */
export function arps(qi: number, Di: number, b: number, t: number): number {
  if (b <= 1e-6) return qi * Math.exp(-Di * t);
  if (Math.abs(b - 1) < 1e-6) return qi / (1 + Di * t);
  return qi / Math.pow(1 + b * Di * t, 1 / b);
}

/** Cumulative via trapezoid over monthly steps (per-month volume units). */
export function arpsCum(qi: number, Di: number, b: number, months: number): number {
  let cum = 0, prev = qi;
  for (let t = 1; t <= months; t++) { const q = arps(qi, Di, b, t); cum += (prev + q) / 2; prev = q; }
  return cum;
}

export interface ArpsFit { qi: number; Di: number; b: number; peakIdx: number; nDecline: number }

/**
 * fitArps — log-linear fit of Di on the decline segment (after peak) with an
 * assumed b. qi is the peak rate. Robust to zero/near-zero months.
 */
export function fitArps(series: number[], b = 0.5): ArpsFit {
  // find peak
  let peakIdx = 0, peak = -Infinity;
  for (let i = 0; i < series.length; i++) if (series[i] > peak) { peak = series[i]; peakIdx = i; }
  const qi = Math.max(1e-9, peak);
  // decline segment: peak → end, positive rates only
  const xs: number[] = [], ys: number[] = [];
  for (let i = peakIdx; i < series.length; i++) {
    const q = series[i];
    if (q > 1e-6) { xs.push(i - peakIdx); ys.push(Math.log(q)); }
  }
  let Di = 0.05;
  if (xs.length >= 2) {
    // slope of ln(q) vs t  →  exponential-equivalent decline; convert with b.
    const n = xs.length;
    const mx = xs.reduce((a, c) => a + c, 0) / n, my = ys.reduce((a, c) => a + c, 0) / n;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx; sxy += dx * (ys[i] - my); sxx += dx * dx; }
    const slope = sxx > 0 ? sxy / sxx : -0.05; // ln-rate per month (negative)
    Di = Math.max(1e-4, -slope); // nominal exponential decline; hyperbolic uses same nominal at t=0
  }
  return { qi, Di, b, peakIdx, nDecline: xs.length };
}

/** EUR (same volume units as qi·month) = cumulative to the economic-limit rate. */
export function eur(qi: number, Di: number, b: number, qEcon: number, maxMonths = 1200): number {
  let cum = 0, prev = qi;
  for (let t = 1; t <= maxMonths; t++) {
    const q = arps(qi, Di, b, t);
    cum += (prev + q) / 2;
    prev = q;
    if (q <= qEcon) break;
  }
  return cum;
}
