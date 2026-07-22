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
