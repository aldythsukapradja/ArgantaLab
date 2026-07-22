// surveillance.ts (R1) — the Reservoir-Management surveillance engine: the ONE new
// deterministic module for the "Reservoir Management" vertical. Everything else the
// vertical needs (DCA/forecast, opportunity/break-even, streamline allocation, PVT)
// is reused from review.ts / sim/*. Here we own:
//   • VRR (voidage replacement ratio) — reservoir-volume balance of injection vs offtake
//   • Hall plot — cumulative pressure-time vs cumulative injection (injectivity trend)
//   • water-cut / GOR diagnostics
//   • robust baseline (moving median) + exception detection (robust z-score) — the
//     "exception-first" surveillance signal
//   • simple, transparent well/field health roll-up
//
// Volve is UNDERSATURATED its whole life (reservoir P > Pb), so no free gas evolves in
// the reservoir → produced reservoir voidage = Bo·oil + Bw·water (the solution gas is
// carried inside Bo). This is the CORRECT physics, not a shortcut. Pure TS, no deps.
// Reference implementations + parity are truth-locked in scripts/test-surveillance.mjs.

// ── voidage / VRR ─────────────────────────────────────────────────────────────

/** Formation-volume factors for reservoir-voidage accounting (rm³/Sm³). Volve deck
 *  anchors: Bo≈1.47 (live oil at datum), Bw≈1.03, Bg 0 (no free gas — undersaturated). */
export interface Voidage { Bo: number; Bw: number; Bg: number }
export const VOIDAGE_DEFAULT: Voidage = { Bo: 1.47, Bw: 1.03, Bg: 0 };

/** Monthly surface volumes (Sm³). `gasFree` = FREE gas produced (Qg − Rs·Qo); ≈0 for an
 *  undersaturated field, so it defaults to 0 and the gas term drops out. */
export interface MonthVols { oil: number; water: number; wi: number; gasFree?: number; gi?: number }

/** Reservoir voidage WITHDRAWN this period (rm³): Bo·oil + Bw·water + Bg·freeGas. */
export function voidageProduced(m: MonthVols, v: Voidage = VOIDAGE_DEFAULT): number {
  return v.Bo * m.oil + v.Bw * m.water + v.Bg * (m.gasFree ?? 0);
}

/** Reservoir voidage INJECTED this period (rm³): Bw·waterInj + Bg·gasInj. */
export function voidageInjected(m: MonthVols, v: Voidage = VOIDAGE_DEFAULT): number {
  return v.Bw * m.wi + v.Bg * (m.gi ?? 0);
}

/** Instantaneous voidage replacement ratio: injected voidage / produced voidage.
 *  VRR=1 ⇒ perfect pressure maintenance; >1 ⇒ repressurising; <1 ⇒ depleting. */
export function vrr(m: MonthVols, v: Voidage = VOIDAGE_DEFAULT): number {
  const out = voidageProduced(m, v);
  return out > 0 ? voidageInjected(m, v) / out : 0;
}

/** Cumulative + instantaneous VRR over a series of months. Returns per-month running
 *  cumulative VRR and the instantaneous VRR, plus the final cumulative value. */
export function cumulativeVrr(rows: MonthVols[], v: Voidage = VOIDAGE_DEFAULT): {
  cum: number[]; inst: number[]; final: number;
} {
  const cum: number[] = [], inst: number[] = [];
  let ci = 0, co = 0;
  for (const m of rows) {
    ci += voidageInjected(m, v); co += voidageProduced(m, v);
    cum.push(co > 0 ? ci / co : 0);
    inst.push(vrr(m, v));
  }
  return { cum, inst, final: cum.length ? cum[cum.length - 1] : 0 };
}

/** Pattern VRR: aggregate injector-side and producer-side volumes over a pattern, then
 *  take the ratio. Reduces EXACTLY to field VRR when the pattern spans all wells. */
export function patternVrr(injRows: MonthVols[], prodRows: MonthVols[], v: Voidage = VOIDAGE_DEFAULT): number {
  let inj = 0, out = 0;
  for (const m of injRows) inj += voidageInjected(m, v);
  for (const m of prodRows) out += voidageProduced(m, v);
  return out > 0 ? inj / out : 0;
}

// ── Hall plot (injectivity surveillance) ──────────────────────────────────────

/** Cumulative sum. */
export function cumSum(x: number[]): number[] {
  const out: number[] = []; let s = 0;
  for (const v of x) { s += v; out.push(s); }
  return out;
}

/** Hall analysis: Y = Σ(Pwf − Pe)·Δt (cumulative pressure-time, "Hall integral"),
 *  X = Σ injected volume. The local slope dY/dX is proportional to 1/injectivity —
 *  a RISING slope means the injector is losing injectivity (plugging/skin); a FALLING
 *  slope means it is opening up (fracturing/thief zone). */
export function hall(dp: number[], wi: number[], dt?: number[]): { cumPT: number[]; cumInj: number[]; slope: number } {
  const n = Math.min(dp.length, wi.length);
  const pt: number[] = [], inj: number[] = [];
  for (let i = 0; i < n; i++) { pt.push(Math.max(0, dp[i]) * (dt ? dt[i] : 1)); inj.push(wi[i]); }
  const cumPT = cumSum(pt), cumInj = cumSum(inj);
  return { cumPT, cumInj, slope: lsqSlope(cumInj, cumPT) };
}

/** Least-squares slope of y vs x through the data (not forced through origin). */
export function lsqSlope(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  return sxx > 1e-12 ? sxy / sxx : 0;
}

// ── production diagnostics ────────────────────────────────────────────────────

/** Water cut = water / (oil + water), fraction 0..1. */
export function waterCut(oil: number, water: number): number {
  const t = oil + water; return t > 0 ? water / t : 0;
}
/** Producing gas-oil ratio = gas / oil (Sm³/Sm³); 0 when no oil. */
export function gor(gas: number, oil: number): number { return oil > 0 ? gas / oil : 0; }

// ── robust baseline + exception detection (the "exception-first" signal) ──────

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Centered moving-median baseline (robust to spikes/outliers, unlike a moving mean).
 *  `win` is the full window width (clamped/odd-ised); edges use a shrinking window. */
export function movingMedian(series: number[], win = 7): number[] {
  const n = series.length, half = Math.max(1, Math.floor(win / 2));
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half), hi = Math.min(n - 1, i + half);
    out[i] = median(series.slice(lo, hi + 1));
  }
  return out;
}

/** Median absolute deviation → robust sigma (×1.4826 for normal-consistency). */
export function robustSigma(resid: number[]): number {
  const med = median(resid);
  return 1.4826 * median(resid.map((r) => Math.abs(r - med)));
}

export interface Exception { i: number; value: number; baseline: number; z: number; dir: 'high' | 'low'; kind: 'point' | 'shift' }

/** Surveillance exception detector — fires on BOTH transients and sustained shifts, the
 *  two ways a producer/injector departs from normal. It combines:
 *   • a POINT detector: |z| of the residual from the robust moving-median baseline,
 *     scaled by a robust sigma taken from an established-normal reference window (with a
 *     signal-relative floor, so a near-perfect baseline fit doesn't blind it) — catches
 *     spikes (choke events, test outliers);
 *   • a standardized two-sided CUSUM vs the reference level, flagged at ONSET — catches
 *     sustained level shifts a centered median absorbs (water-cut breakthrough, rate
 *     loss, injectivity step).
 *  `ref` = the normal-period window (defaults to the first quarter of the series). */
export function detectExceptions(
  series: number[],
  opts: { win?: number; k?: number; ref?: number; floorFrac?: number; h?: number; slack?: number } = {},
): Exception[] {
  const n = series.length;
  const { win = 7, k = 3, floorFrac = 0.005, h = 5, slack = 0.5 } = opts;
  if (n === 0) return [];
  // robust reference level + scale from an established-normal window
  const R = Math.max(3, Math.min(opts.ref ?? Math.ceil(n / 4), n));
  const refSlice = series.slice(0, R);
  const mu0 = median(refSlice);
  const floor = floorFrac * Math.max(1e-9, Math.abs(mu0) || median(series.map((x) => Math.abs(x))));
  let sigma = 1.4826 * median(refSlice.map((x) => Math.abs(x - mu0)));
  if (!(sigma > floor)) sigma = floor;

  const flags = new Map<number, Exception>();
  const set = (i: number, value: number, baseline: number, z: number, kind: 'point' | 'shift') => {
    const prev = flags.get(i);
    if (!prev || Math.abs(z) > Math.abs(prev.z)) flags.set(i, { i, value, baseline, z: Math.round(z * 100) / 100, dir: z > 0 ? 'high' : 'low', kind });
  };
  // 1 · point / spike — residual from robust moving-median baseline
  const base = movingMedian(series, win);
  for (let i = 0; i < n; i++) { const z = (series[i] - base[i]) / sigma; if (Math.abs(z) >= k) set(i, series[i], base[i], z, 'point'); }
  // 2 · sustained shift — onset-flagged standardized CUSUM vs the reference level
  let sp = 0, sm = 0, spOn = false, smOn = false;
  for (let i = 0; i < n; i++) {
    const d = (series[i] - mu0) / sigma;
    sp = Math.max(0, sp + d - slack); sm = Math.max(0, sm - d - slack);
    if (sp >= h) { if (!spOn) set(i, series[i], mu0, sp, 'shift'); spOn = true; } else spOn = false;
    if (sm >= h) { if (!smOn) set(i, series[i], mu0, -sm, 'shift'); smOn = true; } else smOn = false;
  }
  return [...flags.values()].sort((a, b) => a.i - b.i);
}

// ── health roll-up (Overview cockpit) ─────────────────────────────────────────

export interface HealthInputs { wct?: number; uptime?: number; declineRate?: number }

/** Transparent 0..100 well/field health score. Monotone: ↓ with water cut, ↑ with
 *  uptime, ↓ with decline rate. Intentionally simple and explainable — the cockpit
 *  shows the components, not just the number. */
export function wellHealth({ wct = 0, uptime = 1, declineRate = 0 }: HealthInputs): number {
  const s =
    0.45 * (1 - clamp01(wct)) +
    0.35 * clamp01(uptime) +
    0.20 * (1 - clamp01(declineRate));
  return Math.round(clamp01(s) * 1000) / 10;
}
function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }
function mean(a: number[]): number { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0; }

// ══════════════════════════════════════════════════════════════════════════════
// R1.5 — water/gas-diagnosis suite (Chan's, Tong's, Ershaghi X-plot, Hall derivative,
// trailing-slope alarms). These plots do NOT exist in the founder's reference apps;
// they are authored here from the petroleum-engineering literature and truth-locked.
// Every classifier is a SCREENING heuristic — it flags the likely mechanism, it does
// not replace full diagnostics. Honest by construction.
// ══════════════════════════════════════════════════════════════════════════════

/** Bourdet-style smoothed derivative dy/dx using logarithmic L-spacing (the standard
 *  pressure-transient/diagnostic derivative). `x` must be increasing. Larger L = smoother. */
export function bourdetDeriv(x: number[], y: number[], L = 0.15): number[] {
  const n = x.length, out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let j = i; while (j > 0 && x[i] - x[j] < L) j--;
    let k = i; while (k < n - 1 && x[k] - x[i] < L) k++;
    if (j === i) j = Math.max(0, i - 1);
    if (k === i) k = Math.min(n - 1, i + 1);
    const dxl = x[i] - x[j], dxr = x[k] - x[i];
    const dl = dxl > 0 ? (y[i] - y[j]) / dxl : 0;
    const dr = dxr > 0 ? (y[k] - y[i]) / dxr : 0;
    out[i] = (dxl + dxr) > 0 ? (dl * dxr + dr * dxl) / (dxl + dxr) : 0;
  }
  return out;
}

export type WaterMechanism = 'coning' | 'channeling' | 'multilayer' | 'undetermined';
export interface ChanResult { t: number[]; y: number[]; deriv: number[]; slope: number; mechanism: WaterMechanism }

/** Chan's diagnostic (SPE 30775): y (WOR or GOR) and its derivative wrt ln(t) on a
 *  log-log plot. The LATE-TIME slope of ln(y′) vs ln(t) classifies the mechanism:
 *   • ≲0.3 (flat/declining, y plateaus) → bottom-water/gas CONING
 *   • ~1 (unit positive slope)          → CHANNELING (high-perm streak / edge water)
 *   • ≳1.4 (steeper)                    → MULTILAYER channeling
 *  Screening only. */
export function chanDiagnostic(times: number[], y: number[], L = 0.15): ChanResult {
  const t: number[] = [], yy: number[] = [];
  for (let i = 0; i < times.length; i++) if (times[i] > 0 && Number.isFinite(y[i]) && y[i] > 0) { t.push(times[i]); yy.push(y[i]); }
  if (t.length < 3) return { t, y: yy, deriv: new Array(t.length).fill(0), slope: 0, mechanism: 'undetermined' };
  const lnt = t.map(Math.log);
  const deriv = bourdetDeriv(lnt, yy, L);
  // classify on the late-time segment (last 40%) where signatures separate
  const start = Math.floor(t.length * 0.6);
  const lx: number[] = [], ly: number[] = [];
  for (let i = start; i < t.length; i++) if (deriv[i] > 0) { lx.push(lnt[i]); ly.push(Math.log(deriv[i])); }
  const slope = lx.length >= 2 ? lsqSlope(lx, ly) : -1;   // no positive late derivative ⇒ plateau ⇒ coning
  const mechanism: WaterMechanism = slope < 0.3 ? 'coning' : slope < 1.4 ? 'channeling' : 'multilayer';
  return { t, y: yy, deriv, slope: Math.round(slope * 100) / 100, mechanism };
}

/** Chan's WATER diagnostic from oil/water rate series (WOR = water/oil, floored). */
export function chanWor(times: number[], oil: number[], water: number[], L = 0.15): ChanResult {
  return chanDiagnostic(times, water.map((w, i) => Math.max(1e-3, w / Math.max(1e-9, oil[i]))), L);
}
/** Chan's GAS diagnostic from oil/gas rate series (GOR = gas/oil). */
export function chanGor(times: number[], oil: number[], gas: number[], L = 0.15): ChanResult {
  return chanDiagnostic(times, gas.map((g, i) => (oil[i] > 0 ? g / oil[i] : 0)), L);
}

export interface TongResult { fwR: Array<{ R: number; fw: number }>; a: number; b: number; eurNp: number; eurR: number }

/** Tong's water-drive chart (童氏图版): water cut fw vs recovery degree R, with the
 *  Type-A water-drive characteristic straight line lg(Wp) = a + b·Np fitted over the
 *  developed (high-fw) stage, then extrapolated to an economic water cut for EUR.
 *  `npCum`/`wpCum` cumulative oil/water (any consistent volume unit), `N` = OOIP. */
export function tongWaterDrive(npCum: number[], wpCum: number[], fw: number[], N: number, fwEcon = 0.95, fitFrom = 0.5): TongResult {
  const fwR = npCum.map((np, i) => ({ R: N > 0 ? np / N : 0, fw: fw[i] }));
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < npCum.length; i++) if (fw[i] >= fitFrom && wpCum[i] > 0) { xs.push(npCum[i]); ys.push(Math.log10(wpCum[i])); }
  if (xs.length < 2) return { fwR, a: 0, b: 0, eurNp: 0, eurR: 0 };
  const b = lsqSlope(xs, ys), a = mean(ys) - b * mean(xs);
  // at economic fw: WOR_ec = fw/(1−fw) = dWp/dNp = b·ln10·Wp ⇒ Wp_ec, then Np_ec from the line
  const worEc = fwEcon / (1 - fwEcon);
  const wpEc = worEc / (b * Math.LN10);
  const eurNp = wpEc > 0 && b !== 0 ? (Math.log10(wpEc) - a) / b : 0;
  return { fwR, a, b, eurNp, eurR: N > 0 ? eurNp / N : 0 };
}

/** Ershaghi–Omoregie X-function: X = ln(1/(1−fw)) − 1/(1−fw). Recovery Np is linear in
 *  X for log-linear relative permeability, so an X-plot straight line extrapolates to a
 *  waterflood EUR at an economic water cut. */
export function ershaghiX(fw: number): number { const d = 1 - fw; return d > 1e-9 ? Math.log(1 / d) - 1 / d : NaN; }

export interface XplotResult { pts: Array<{ X: number; Np: number }>; m: number; c: number; eurNp: number; eurR: number }
export function ershaghiXplot(npCum: number[], fw: number[], N: number, fwEcon = 0.95, fitFrom = 0.5): XplotResult {
  const pts: Array<{ X: number; Np: number }> = [], xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < fw.length; i++) { const X = ershaghiX(fw[i]); if (Number.isFinite(X)) { pts.push({ X, Np: npCum[i] }); if (fw[i] >= fitFrom) { xs.push(X); ys.push(npCum[i]); } } }
  if (xs.length < 2) return { pts, m: 0, c: 0, eurNp: 0, eurR: 0 };
  const m = lsqSlope(xs, ys), c = mean(ys) - m * mean(xs);
  const eurNp = m * ershaghiX(fwEcon) + c;
  return { pts, m, c, eurNp, eurR: N > 0 ? eurNp / N : 0 };
}

/** Hall-plot injectivity trend: the LOCAL slope of the Hall integral vs cumulative
 *  injection (∝ injection resistance), plus its overall trend. Rising (trend>0) ⇒
 *  plugging / skin build-up; falling (trend<0) ⇒ fracturing / thief-zone opening. */
export function hallDerivative(cumInj: number[], cumPT: number[], win = 4): { slope: number[]; trend: number } {
  const n = cumInj.length, slope = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) { const lo = Math.max(0, i - win), hi = Math.min(n - 1, i + win); slope[i] = lsqSlope(cumInj.slice(lo, hi + 1), cumPT.slice(lo, hi + 1)); }
  return { slope, trend: lsqSlope(cumInj, slope) };
}

/** OLS slope of ln(y) over the last `n` positive points — the trailing log-linear rate. */
export function trailingSlope(series: number[], n = 12): number {
  const xs: number[] = [], ys: number[] = [];
  for (let i = Math.max(0, series.length - n); i < series.length; i++) if (series[i] > 0) { xs.push(xs.length); ys.push(Math.log(series[i])); }
  return xs.length >= 2 ? lsqSlope(xs, ys) : 0;
}
/** Annualised percent change of a monthly series from its trailing log-linear slope
 *  (the WellNexus rule-engine signal): (e^{slope·periodsPerYear} − 1)·100. */
export function annualPct(series: number[], periodsPerYear = 12, n = 12): number {
  return (Math.exp(trailingSlope(series, n) * periodsPerYear) - 1) * 100;
}
