// review.ts — field-review / redevelopment decision engine. Decline-curve history
// match, a BLIND TEST (train on early history, predict the held-out tail → honest
// robustness), remaining-reserves forecast, and an automated Field-Development-Plan
// evaluator that ranks redevelopment options on NPV. Deterministic, pure TS. The
// verdict is whatever the arithmetic says — if it's not economic, it says so.
// Validated in scripts/test-review.mjs.

const SM3_TO_BBL = 6.2898;

// ── Arps decline (self-contained; screening exponential/hyperbolic) ────────────
export function arps(qi: number, Di: number, b: number, t: number): number {
  if (b <= 1e-6) return qi * Math.exp(-Di * t);
  if (Math.abs(b - 1) < 1e-6) return qi / (1 + Di * t);
  return qi / Math.pow(1 + b * Di * t, 1 / b);
}

/** Fit an exponential decline (ln q = ln qi − Di·t) on the post-peak decline segment.
 * Robust for screening + blind testing. Returns qi, Di and the peak index. */
export function fitExpDecline(series: number[]): { qi: number; Di: number; peakIdx: number } {
  const n = series.length;
  let peakIdx = 0, peak = -Infinity;
  for (let i = 0; i < n; i++) if (series[i] > peak) { peak = series[i]; peakIdx = i; }
  // regress ln(q) vs t over the decline segment (post-peak, positive rates)
  const xs: number[] = [], ys: number[] = [];
  for (let i = peakIdx; i < n; i++) if (series[i] > 0) { xs.push(i - peakIdx); ys.push(Math.log(series[i])); }
  if (xs.length < 3) return { qi: peak, Di: 0.01, peakIdx };
  const m = xs.length, mx = xs.reduce((a, b) => a + b, 0) / m, my = ys.reduce((a, b) => a + b, 0) / m;
  let sxy = 0, sxx = 0; for (let i = 0; i < m; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxx > 1e-12 ? sxy / sxx : -0.01;
  return { qi: Math.exp(my - slope * mx), Di: Math.max(1e-4, -slope), peakIdx };
}

// ── blind test: fit on the first `trainFrac`, predict the rest, measure error ───
export interface BlindTest {
  qi: number; Di: number; trainN: number;
  predicted: number[]; actual: number[]; // over the held-out (test) window
  rmsePct: number; mapePct: number;
}
export function blindTest(series: number[], trainFrac = 0.6): BlindTest {
  const n = series.length, trainN = Math.max(4, Math.floor(n * trainFrac));
  const train = series.slice(0, trainN);
  const fit = fitExpDecline(train);
  const predicted: number[] = [], actual: number[] = [];
  let se = 0, ae = 0, cnt = 0, sumSq = 0;
  for (let i = trainN; i < n; i++) {
    const pred = arps(fit.qi, fit.Di, 0, i - fit.peakIdx);
    predicted.push(pred); actual.push(series[i]);
    if (series[i] > 0) { se += (pred - series[i]) ** 2; ae += Math.abs(pred - series[i]) / series[i]; sumSq += series[i] ** 2; cnt++; }
  }
  return { qi: fit.qi, Di: fit.Di, trainN, predicted, actual, rmsePct: cnt ? Math.sqrt(se / cnt) / Math.sqrt(sumSq / cnt) * 100 : 0, mapePct: cnt ? (ae / cnt) * 100 : 0 };
}

/** Exponential-decline EUR from a rate qi to an economic-limit rate qEcon (per step). */
export function expCumToLimit(qi: number, Di: number, qEcon: number): number {
  if (qi <= qEcon || Di <= 0) return 0;
  return (qi - qEcon) / Di; // ∫ qi·e^(−Di·t) from now to when q=qEcon
}

// ── automated FDP evaluator ────────────────────────────────────────────────────
export interface EconCtx {
  oilPrice: number;      // $/bbl
  opexVar: number;       // $/bbl
  opexFixMM: number;     // $MM/yr while producing
  perWellCapexMM: number;
  facilityReentryMM: number; // cost to re-establish an offshore production facility
  discount: number;      // fraction
  abandonMM: number;     // incremental decommissioning at end
  years: number;         // incremental project life
}
export interface FdpOption { name: string; producers: number; injectors: number; incrRecoveryMMSm3: number }
export interface FdpResult {
  name: string; incrOilMMbbl: number; capexMM: number; npvMM: number; irrPct: number | null;
  paybackYr: number | null; economic: boolean; note: string;
}

/** Mid-year discounted NPV of an incremental oil profile (exponential decline). */
function npvOf(annualOilBbl: number[], ctx: EconCtx, capexMM: number): number {
  let npv = -capexMM;
  for (let y = 0; y < annualOilBbl.length; y++) {
    const rev = annualOilBbl[y] * (ctx.oilPrice - ctx.opexVar) / 1e6 - ctx.opexFixMM;
    const cf = y === annualOilBbl.length - 1 ? rev - ctx.abandonMM : rev;
    npv += cf / Math.pow(1 + ctx.discount, y + 0.5);
  }
  return npv;
}

export function evaluateFdp(opt: FdpOption, ctx: EconCtx): FdpResult {
  const incrOilBbl = opt.incrRecoveryMMSm3 * 1e6 * SM3_TO_BBL;
  // front-loaded exponential incremental profile over ctx.years
  const decl = 0.28; let sum = 0; const shape: number[] = [];
  for (let y = 0; y < ctx.years; y++) { const s = Math.exp(-decl * y); shape.push(s); sum += s; }
  const annual = shape.map((s) => incrOilBbl * s / sum);
  const capexMM = opt.producers * ctx.perWellCapexMM + opt.injectors * ctx.perWellCapexMM + (opt.producers + opt.injectors > 0 ? ctx.facilityReentryMM : 0);
  const npvMM = npvOf(annual, ctx, capexMM);
  // simple payback (undiscounted cumulative cashflow crossing zero)
  let cum = -capexMM, payback: number | null = null;
  for (let y = 0; y < annual.length; y++) { cum += annual[y] * (ctx.oilPrice - ctx.opexVar) / 1e6 - ctx.opexFixMM; if (cum >= 0 && payback === null) payback = y + 1; }
  return {
    name: opt.name, incrOilMMbbl: incrOilBbl / 1e6, capexMM,
    npvMM, irrPct: null, paybackYr: payback,
    economic: npvMM > 0,
    note: npvMM > 0 ? 'positive NPV — screens in' : `NPV $${npvMM.toFixed(0)}MM — capex not recovered`,
  };
}

export interface Verdict { redevelop: boolean; headline: string; reasons: string[] }
export function fdpVerdict(results: FdpResult[], remainingMMbbl: number): Verdict {
  const best = results.reduce((a, b) => (b.npvMM > a.npvMM ? b : a), results[0]);
  const anyEconomic = results.some((r) => r.economic);
  if (anyEconomic) {
    return { redevelop: true, headline: `Marginally developable — best option "${best.name}" NPV +$${best.npvMM.toFixed(0)}MM`, reasons: [`${best.incrOilMMbbl.toFixed(1)} MMbbl incremental at $${best.capexMM.toFixed(0)}MM capex`, 'sensitive to oil price + incremental-recovery assumptions', 'not investment advice — screening economics'] };
  }
  return {
    redevelop: false,
    headline: `Sub-economic — do NOT redevelop. Every screened option has negative NPV (best "${best.name}" $${best.npvMM.toFixed(0)}MM).`,
    reasons: [
      `Remaining reserves ~${remainingMMbbl.toFixed(1)} MMbbl are too small to carry offshore re-entry capex ($${(best.capexMM).toFixed(0)}MM).`,
      'Field is watered-out / at economic decline limit; incremental per-well recovery is low.',
      'The facility was removed at decommissioning — re-establishing production infrastructure dominates the cost.',
      'This matches reality: the field was decommissioned. Missing upside > fabricated upside.',
    ],
  };
}
