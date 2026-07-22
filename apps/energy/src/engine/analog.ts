// analog.ts — the analog knowledge base + engineering-judgment engine. Philosophy
// (founder): the simulator visualises and sanity-checks ("are we crazy?"), but the
// BENCHMARK (analogs / history) and ENGINEERING JUDGEMENT take control. So the final
// answer is: analog anchors it, physics bands it, data-confidence weights the blend,
// and a derisk factor haircuts the upside — a quick P10/P50/P90 with a stated basis
// and limitations. Strong when data is scarce (analogs carry it); tightens as data
// and history arrive. Pure TS, deterministic, truth-locked in scripts/test-analog.mjs.

export type Lithology = 'sandstone' | 'carbonate' | 'other';
export type Drive = 'waterflood' | 'waterdrive' | 'solution-gas' | 'gas-cap' | 'gravity' | 'depletion';

export interface AnalogField {
  name: string;
  lithology: Lithology;
  drive: Drive;
  depthM?: number; porosity?: number; permMd?: number; oilAPI?: number;
  recoveryFactor: number;        // the outcome we benchmark against (fraction)
  arpsB?: number;                // decline exponent (secondary outcome)
  source: string;                // provenance
  confidence: 'field' | 'literature' | 'class'; // specific field > literature > class-prior
}

export interface AnalogTarget {
  lithology?: Lithology; drive?: Drive;
  depthM?: number; porosity?: number; permMd?: number; oilAPI?: number;
}

export interface AnalogMatch { field: AnalogField; similarity: number }
export interface Prior { p10: number; p50: number; p90: number; mean: number; n: number; effN: number }

// ── similarity: categorical must-ish match + normalised numeric distance ────────
const numClose = (a: number | undefined, b: number | undefined, scale: number): number =>
  (a == null || b == null) ? 1 : Math.exp(-Math.abs(a - b) / scale);   // 1 when unknown (no penalty)

export function similarity(t: AnalogTarget, f: AnalogField): number {
  let s = 1;
  if (t.lithology && t.lithology !== f.lithology) s *= 0.45;
  if (t.drive && t.drive !== f.drive) s *= 0.4;
  s *= numClose(t.depthM, f.depthM, 1500);
  s *= numClose(t.porosity, f.porosity, 0.08);
  if (t.permMd != null && f.permMd != null) s *= Math.exp(-Math.abs(Math.log10(Math.max(1, t.permMd)) - Math.log10(Math.max(1, f.permMd)))); // perm in log space
  s *= numClose(t.oilAPI, f.oilAPI, 12);
  return Math.max(0, Math.min(1, s));
}

/** Nearest-K analogs by similarity (descending). */
export function matchAnalogs(t: AnalogTarget, db: AnalogField[], k = 6): AnalogMatch[] {
  return db.map((f) => ({ field: f, similarity: similarity(t, f) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

// ── weighted percentile over matched analogs → the benchmark prior ─────────────
function weightedPct(items: Array<{ v: number; w: number }>, p: number): number {
  const a = items.filter((x) => x.w > 0).sort((x, y) => x.v - y.v);
  if (!a.length) return NaN;
  const total = a.reduce((s, x) => s + x.w, 0);
  const target = (p / 100) * total; let cum = 0;
  for (let i = 0; i < a.length; i++) { cum += a[i].w; if (cum >= target) return a[i].v; }
  return a[a.length - 1].v;
}

/** Benchmark prior for a key outcome (default recoveryFactor) from matched analogs,
 * weighted by similarity × source confidence. */
export function analogPrior(matches: AnalogMatch[], key: 'recoveryFactor' | 'arpsB' = 'recoveryFactor'): Prior {
  const cw = { field: 1, literature: 0.7, class: 0.5 } as const;
  const items = matches
    .map((m) => ({ v: (m.field[key] ?? NaN) as number, w: m.similarity * cw[m.field.confidence] }))
    .filter((x) => isFinite(x.v) && x.w > 0);
  const totW = items.reduce((s, x) => s + x.w, 0);
  const mean = totW ? items.reduce((s, x) => s + x.v * x.w, 0) / totW : NaN;
  const effN = totW ? (totW ** 2) / items.reduce((s, x) => s + x.w * x.w, 0) : 0; // Kish effective N
  return { p10: weightedPct(items, 10), p50: weightedPct(items, 50), p90: weightedPct(items, 90), mean, n: items.length, effN };
}

// ── the engineering-judgement reconcile: physics + analog → the answer ──────────
export interface ScreeningAnswer {
  p10: number; p50: number; p90: number;
  physicsWeight: number; analogWeight: number;   // how the blend was struck
  derisk: number;                                 // upside haircut applied
  basis: string;                                  // one-line reasoning
  effN: number;                                   // effective analog count behind it
}

/**
 * Reconcile a physics estimate with the analog benchmark under engineering judgement.
 * - `dataConfidence` 0..1 = how much to trust the physics run (data-rich → high →
 *   physics leads; data-scarce → low → analogs carry it and the range widens).
 * - `physics` may be null (no run yet → pure analog answer).
 * - `derisk` (<1) haircuts the P50/P90 (upside), keeping the downside — the discount
 *   REs apply so a forecast is shippable, not optimistic. P10 is left honest.
 * - `physicsCV` = assumed physics-model uncertainty (band around the point).
 */
export function reconcile(
  physics: number | null, prior: Prior, dataConfidence: number,
  opts: { derisk?: number; physicsCV?: number } = {},
): ScreeningAnswer {
  const derisk = opts.derisk ?? 0.9, cv = opts.physicsCV ?? 0.2;
  const dc = Math.max(0, Math.min(1, dataConfidence));
  const wPhys = physics == null ? 0 : dc, wAna = 1 - wPhys;
  // physics band (lognormal-ish around the point) vs analog band
  const phys50 = physics ?? prior.p50;
  const phys10 = phys50 * (1 - 1.28 * cv), phys90 = phys50 * (1 + 1.28 * cv);
  const p50 = wPhys * phys50 + wAna * prior.p50;
  const p10raw = wPhys * phys10 + wAna * prior.p10;
  const p90raw = wPhys * phys90 + wAna * prior.p90;
  // engineering derisk: haircut central + upside, keep the honest downside
  const P50 = p50 * derisk, P90 = p90raw * derisk, P10 = Math.min(p10raw, P50);
  const basis = physics == null
    ? `analog-only (data scarce): ${prior.n} analogs, effN ${prior.effN.toFixed(1)}; ${(derisk * 100).toFixed(0)}% derisk`
    : `${(wPhys * 100).toFixed(0)}% physics / ${(wAna * 100).toFixed(0)}% analog, ${(derisk * 100).toFixed(0)}% derisk`;
  return { p10: P10, p50: P50, p90: P90, physicsWeight: wPhys, analogWeight: wAna, derisk, basis, effN: prior.effN };
}

// ── WHY the blend weight? Inverse-variance (Bates-Granger optimal combination) ──
// The optimal weight on an unbiased estimator is proportional to its precision
// (1/variance). So physicsWeight = varAnalog / (varPhysics + varAnalog). A "40/60"
// isn't a magic number — it means the analog benchmark is ~1.5× more precise here.
// σ from a P10–P90 band (normal): σ ≈ (p90 − p10) / 2.563.
export function optimalPhysicsWeight(physicsVal: number, physicsCV: number, prior: Prior): number {
  const varP = (physicsVal * physicsCV) ** 2;
  const sigmaA = (prior.p90 - prior.p10) / 2.563;
  const varA = sigmaA * sigmaA;
  if (varP + varA <= 0) return 0.5;
  return varA / (varP + varA);
}

// ── BLIND TEST — leave-one-out cross-validation of the analog method ────────────
// For each field: predict its recovery factor from the OTHER analogs only, compare
// to the actual. Reports the honest accuracy (MAE) AND calibration (does the actual
// fall inside the predicted P10–P90 the right fraction of the time?). This is how you
// earn a confidence level in the method itself — and it improves as the KB grows.
export interface CrossVal {
  rows: Array<{ name: string; actual: number; p50: number; p10: number; p90: number; absErr: number; inRange: boolean }>;
  mae: number;          // mean absolute error of P50
  medAbsErr: number;
  coverageP80: number;  // fraction of actuals inside P10–P90 (target ≈ 0.80 = well-calibrated)
  n: number;
}
export function crossValidate(db: AnalogField[], k = 6): CrossVal {
  const rows: CrossVal['rows'] = [];
  for (let i = 0; i < db.length; i++) {
    const held = db[i], rest = db.filter((_, j) => j !== i);
    if (!rest.length) continue;
    const target: AnalogTarget = { lithology: held.lithology, drive: held.drive, depthM: held.depthM, porosity: held.porosity, permMd: held.permMd, oilAPI: held.oilAPI };
    const prior = analogPrior(matchAnalogs(target, rest, k));
    if (!isFinite(prior.p50)) continue;
    const actual = held.recoveryFactor;
    rows.push({ name: held.name, actual, p50: prior.p50, p10: prior.p10, p90: prior.p90, absErr: Math.abs(prior.p50 - actual), inRange: actual >= prior.p10 && actual <= prior.p90 });
  }
  const n = rows.length;
  const errs = rows.map((r) => r.absErr).sort((a, b) => a - b);
  return {
    rows, n,
    mae: n ? errs.reduce((s, e) => s + e, 0) / n : NaN,
    medAbsErr: n ? errs[Math.floor(n / 2)] : NaN,
    coverageP80: n ? rows.filter((r) => r.inRange).length / n : NaN,
  };
}

// ── tornado sensitivity — which input swings the answer most ────────────────────
export interface TornadoBar { param: string; low: number; high: number; swing: number }
/** Vary each reconcile input across its range; return the P50-answer swing, sorted. */
export function reconcileTornado(
  physics: number, prior: Prior, dataConfidence: number, derisk: number,
  ranges: { physics: [number, number]; dataConfidence: [number, number]; derisk: [number, number] },
): TornadoBar[] {
  const base = { physics, dataConfidence, derisk };
  const p50 = (o: typeof base) => reconcile(o.physics, prior, o.dataConfidence, { derisk: o.derisk }).p50;
  const bars: TornadoBar[] = [
    { param: 'physics RF', ...swingOf(p50, base, 'physics', ranges.physics) },
    { param: 'data confidence', ...swingOf(p50, base, 'dataConfidence', ranges.dataConfidence) },
    { param: 'derisk', ...swingOf(p50, base, 'derisk', ranges.derisk) },
  ];
  return bars.sort((a, b) => b.swing - a.swing);
}
function swingOf(fn: (o: { physics: number; dataConfidence: number; derisk: number }) => number, base: { physics: number; dataConfidence: number; derisk: number }, key: 'physics' | 'dataConfidence' | 'derisk', range: [number, number]): { low: number; high: number; swing: number } {
  const lo = fn({ ...base, [key]: range[0] }), hi = fn({ ...base, [key]: range[1] });
  return { low: Math.min(lo, hi), high: Math.max(lo, hi), swing: Math.abs(hi - lo) };
}

// ── seed knowledge base — textbook recovery-factor priors by drive × lithology ──
// Literature/class-level ranges (Tarek Ahmed; SPE); replace/extend with your own
// specific-field analogs (confidence:'field') — those outrank these class priors.
export const SEED_ANALOGS: AnalogField[] = [
  { name: 'Solution-gas drive · sandstone', lithology: 'sandstone', drive: 'solution-gas', recoveryFactor: 0.18, arpsB: 0.4, source: 'literature (5–30%)', confidence: 'class' },
  { name: 'Solution-gas drive · carbonate', lithology: 'carbonate', drive: 'solution-gas', recoveryFactor: 0.12, source: 'literature', confidence: 'class' },
  { name: 'Gas-cap drive · sandstone', lithology: 'sandstone', drive: 'gas-cap', recoveryFactor: 0.30, source: 'literature (20–40%)', confidence: 'class' },
  { name: 'Water drive · sandstone (strong)', lithology: 'sandstone', drive: 'waterdrive', recoveryFactor: 0.55, arpsB: 0.6, source: 'literature (35–75%)', confidence: 'class' },
  { name: 'Water drive · carbonate', lithology: 'carbonate', drive: 'waterdrive', recoveryFactor: 0.40, source: 'literature', confidence: 'class' },
  { name: 'Gravity drainage · sandstone', lithology: 'sandstone', drive: 'gravity', recoveryFactor: 0.55, source: 'literature (40–80%)', confidence: 'class' },
  { name: 'Waterflood · sandstone (typical)', lithology: 'sandstone', drive: 'waterflood', porosity: 0.22, permMd: 300, recoveryFactor: 0.42, arpsB: 0.5, source: 'literature (30–55%)', confidence: 'class' },
  { name: 'Waterflood · sandstone (low perm)', lithology: 'sandstone', drive: 'waterflood', porosity: 0.16, permMd: 20, recoveryFactor: 0.32, source: 'literature', confidence: 'class' },
  { name: 'Waterflood · carbonate', lithology: 'carbonate', drive: 'waterflood', recoveryFactor: 0.30, source: 'literature', confidence: 'class' },
  { name: 'Depletion · tight sandstone', lithology: 'sandstone', drive: 'depletion', permMd: 5, recoveryFactor: 0.10, source: 'literature', confidence: 'class' },
  // North-Sea Jurassic sandstone waterflood band (Volve-like published RF 30–54%)
  { name: 'Volve (published)', lithology: 'sandstone', drive: 'waterflood', depthM: 3000, porosity: 0.21, permMd: 400, oilAPI: 29, recoveryFactor: 0.46, arpsB: 0.5, source: 'Equinor Volve (30–54%)', confidence: 'field' },
];
