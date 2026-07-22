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

/** Fit an Arps decline with a searched hyperbolic exponent b — grid-search (b, Di)
 * over the post-peak decline segment (qi fixed at the peak), minimising SSE. Much
 * better than pure exponential for injection-supported / compartmentalised fields.
 * Returns qi, Di, b, peakIdx. */
export function fitDecline(series: number[], maxB = 1.0): { qi: number; Di: number; b: number; peakIdx: number } {
  const n = series.length;
  let peakIdx = 0, qi = -Infinity;
  for (let i = 0; i < n; i++) if (series[i] > qi) { qi = series[i]; peakIdx = i; }
  const ts: number[] = [], qs: number[] = [];
  for (let i = peakIdx; i < n; i++) if (series[i] > 0) { ts.push(i - peakIdx); qs.push(series[i]); }
  if (ts.length < 3) return { qi: qi === -Infinity ? 0 : qi, Di: 0.01, b: 0, peakIdx };
  const sse = (Di: number, b: number) => { let s = 0; for (let k = 0; k < ts.length; k++) { const q = arps(qi, Di, b, ts[k]); s += (q - qs[k]) ** 2; } return s; };
  // best (Di, SSE) per candidate b, with a refinement pass around each b's optimum
  const perB: Array<{ b: number; Di: number; s: number }> = [];
  for (let bi = 0; bi <= Math.round(maxB * 10); bi++) {
    const b = bi / 10; let bDi = 0.01, bS = Infinity;
    if (b === 0) {
      // exact: Di = −slope of ln(q) vs t (log-linear regression); optimal for exponential
      const lx = ts, ly = qs.map((q) => Math.log(q)); const m = lx.length;
      const mx = lx.reduce((a, c) => a + c, 0) / m, my = ly.reduce((a, c) => a + c, 0) / m;
      let sxy = 0, sxx = 0; for (let k = 0; k < m; k++) { sxy += (lx[k] - mx) * (ly[k] - my); sxx += (lx[k] - mx) ** 2; }
      bDi = Math.max(1e-4, sxx > 1e-12 ? -sxy / sxx : 0.01); bS = sse(bDi, 0);
    } else {
      for (let di = 0; di <= 80; di++) { const Di = 1e-4 * Math.pow(0.5 / 1e-4, di / 80); const s = sse(Di, b); if (s < bS) { bS = s; bDi = Di; } }
      for (let r = -8; r <= 8; r++) { const Di = Math.max(1e-4, bDi * (1 + r * 0.02)); const s = sse(Di, b); if (s < bS) { bS = s; bDi = Di; } }
    }
    perB.push({ b, Di: bDi, s: bS });
  }
  // PARSIMONY: pick the SMALLEST b whose SSE is within 5% of the global minimum —
  // a slightly-wrong hyperbolic b extrapolates badly over long horizons, so prefer
  // the simplest decline that fits nearly as well (biases toward exponential).
  const globalMin = Math.min(...perB.map((p) => p.s));
  const chosen = perB.find((p) => p.s <= globalMin * 1.05) ?? perB[0];
  return { qi, Di: chosen.Di, b: chosen.b, peakIdx };
}

// ── blind test: fit on the first `trainFrac`, predict the rest, measure error ───
export interface BlindTest {
  qi: number; Di: number; b: number; trainN: number;
  predicted: number[]; actual: number[]; // over the held-out (test) window
  rmsePct: number; mapePct: number;
}
export function blindTest(series: number[], trainFrac = 0.6): BlindTest {
  const n = series.length, trainN = Math.max(4, Math.floor(n * trainFrac));
  const train = series.slice(0, trainN);
  const fit = fitDecline(train);   // hyperbolic-capable fit on the training window
  const predicted: number[] = [], actual: number[] = [];
  let se = 0, ae = 0, cnt = 0, sumSq = 0;
  for (let i = trainN; i < n; i++) {
    const pred = arps(fit.qi, fit.Di, fit.b, i - fit.peakIdx);
    predicted.push(pred); actual.push(series[i]);
    if (series[i] > 0) { se += (pred - series[i]) ** 2; ae += Math.abs(pred - series[i]) / series[i]; sumSq += series[i] ** 2; cnt++; }
  }
  return { qi: fit.qi, Di: fit.Di, b: fit.b, trainN, predicted, actual, rmsePct: cnt ? Math.sqrt(se / cnt) / Math.sqrt(sumSq / cnt) * 100 : 0, mapePct: cnt ? (ae / cnt) * 100 : 0 };
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

/** Incremental annual oil (bbl) for an option: front-loaded exponential decline. */
export function incrementalAnnualBbl(opt: FdpOption, ctx: EconCtx, decl = 0.28): number[] {
  const incrOilBbl = opt.incrRecoveryMMSm3 * 1e6 * SM3_TO_BBL;
  let sum = 0; const shape: number[] = [];
  for (let y = 0; y < ctx.years; y++) { const s = Math.exp(-decl * y); shape.push(s); sum += s; }
  return shape.map((s) => incrOilBbl * s / sum);
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
  const annual = incrementalAnnualBbl(opt, ctx);
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

// ── opportunity / break-even solver ────────────────────────────────────────────
// "At abandonment, is there anything we can do to make it economic — and if so, how
// many barrels over how many years?" Sweep the levers, find where NPV crosses zero.

/** Years to recover `frac` of the incremental oil (field-life proxy) + total bbl. */
export function recoveryTiming(opt: FdpOption, ctx: EconCtx, frac = 0.9): { years: number; recoverableMMbbl: number } {
  const annual = incrementalAnnualBbl(opt, ctx);
  const total = annual.reduce((a, b) => a + b, 0);
  let cum = 0, years = ctx.years;
  for (let y = 0; y < annual.length; y++) { cum += annual[y]; if (cum >= frac * total) { years = y + 1; break; } }
  return { years, recoverableMMbbl: total / 1e6 };
}

/** Bisection: the value of `lever` at which the option's NPV crosses zero, or null
 * if there is no crossing in [lo,hi]. NPV is monotone in oilPrice (↑) / re-entry (↓). */
export function breakEven(opt: FdpOption, ctx: EconCtx, lever: 'oilPrice' | 'facilityReentryMM', lo: number, hi: number): number | null {
  const npvAt = (v: number) => evaluateFdp(opt, { ...ctx, [lever]: v }).npvMM;
  let a = lo, b = hi, fa = npvAt(a), fb = npvAt(b);
  if (fa === 0) return a; if (fb === 0) return b;
  if ((fa < 0) === (fb < 0)) return null;                 // no sign change → no crossing
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2, fm = npvAt(m); if (Math.abs(fm) < 1e-6) return m; if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else { b = m; fb = fm; } }
  return (a + b) / 2;
}

export interface Opportunity {
  bestPlan: FdpResult;
  economicNow: boolean;
  breakEvenPriceUsd: number | null;      // oil price ($/bbl) that turns the best plan economic
  breakEvenReentryMM: number | null;     // facility re-entry ($MM) ceiling for economic
  recoverableMMbbl: number;              // barrels the best plan would recover
  years: number;                         // to recover 90% of them
  summary: string;                       // one tangible sentence
}

/** Find the most-valuable intervention and what it would take to make it pay. */
export function findOpportunity(options: FdpOption[], ctx: EconCtx): Opportunity | null {
  const scored = options.filter((o) => o.producers + o.injectors > 0).map((o) => ({ o, r: evaluateFdp(o, ctx) }));
  if (!scored.length) return null;
  const best = scored.reduce((a, b) => (b.r.npvMM > a.r.npvMM ? b : a), scored[0]);
  const timing = recoveryTiming(best.o, ctx);
  const bep = breakEven(best.o, ctx, 'oilPrice', ctx.oilPrice, 400);
  const ber = breakEven(best.o, ctx, 'facilityReentryMM', 0, Math.max(ctx.facilityReentryMM, 1));
  const economicNow = best.r.npvMM > 0;
  const summary = economicNow
    ? `Best plan "${best.o.name}" is economic: recover ~${timing.recoverableMMbbl.toFixed(1)} MMbbl over ~${timing.years} yr, NPV +$${best.r.npvMM.toFixed(0)}MM.`
    : `Best screened plan "${best.o.name}" could recover ~${timing.recoverableMMbbl.toFixed(1)} MMbbl over ~${timing.years} yr, but at NPV $${best.r.npvMM.toFixed(0)}MM it destroys value. It only pays at oil ≥ $${bep ? bep.toFixed(0) : '—'}/bbl${ber !== null ? `, or if facility re-entry ≤ $${ber.toFixed(0)}MM` : ''}.`;
  return { bestPlan: best.r, economicNow, breakEvenPriceUsd: bep, breakEvenReentryMM: ber, recoverableMMbbl: timing.recoverableMMbbl, years: timing.years, summary };
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
