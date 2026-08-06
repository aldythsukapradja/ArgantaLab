// geostat.ts — the geostatistics engine (S1). Ported 1:1 from the locked reference
// in scripts/test-geostat.mjs (30/30 truth-lock). Variogram + covariance (GSLIB
// nugget convention), ordinary/simple kriging (K=16 search neighborhood), Acklam
// normal-score transform, SGS (sequential Gaussian sim), SIS (2-facies indicator).
// Pure TS, no DOM. Do NOT re-derive — this must reproduce the reference numbers.

// seeded RNG + gaussian — identical algorithm to engine/mc.ts (inlined to avoid a
// runtime cross-module import; parity-locked to the same sequence).
type Rng = () => number;
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(rng: Rng): number { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export type VarioModel = 'spherical' | 'exponential' | 'gaussian';
export interface Vario {
  model: VarioModel; nugget: number; sill: number; range: number;   // sill = TOTAL sill
  /**
   * Geometric anisotropy. Absent = isotropic, and every result is bit-identical to
   * before this existed.
   *
   * `range` is then the MAJOR range and `ratio` is minor/major (0–1]. A deposit is
   * almost never isotropic — a channel system correlates ten times further along its
   * axis than across it — and simulating it isotropically produces round blobs where
   * the geology has ribbons. `azimuthDeg` is the major direction, degrees clockwise
   * from north, which is how a geologist states it.
   */
  aniso?: { azimuthDeg: number; ratio: number };
}
export interface Pt { x: number; y: number; v: number }        // conditioning datum (value or 0/1 indicator)
export interface FaciesPt { x: number; y: number; f: 0 | 1 }   // SAND=1 / SHALE=0

const SEARCH_K = 16; // moving search neighbourhood — nearest K conditioning data

// ── variogram + covariance ─────────────────────────────────────────────────────
/** γ(0)=0; γ(h>0)→nugget as h→0+. sill is the TOTAL sill (nugget + partial). */
export function variogram(h: number, p: Vario): number {
  if (h <= 0) return 0;
  const c = p.sill - p.nugget;      // partial sill
  const r = p.range;
  let g: number;
  if (p.model === 'spherical') g = h >= r ? 1 : 1.5 * (h / r) - 0.5 * (h / r) ** 3;
  else if (p.model === 'exponential') g = 1 - Math.exp(-3 * h / r);       // practical range at h=r
  else g = 1 - Math.exp(-3 * (h / r) ** 2);                                // gaussian
  return p.nugget + c * g;
}
/** C(0)=sill (full); C(h>0)=sill−γ(h). Nugget lives on the diagonal only ⇒
 * kriging honors data exactly (GSLIB convention). */
export function cov(h: number, p: Vario): number { return h === 0 ? p.sill : p.sill - variogram(h, p); }

/**
 * Separation between two points, in the variogram's own frame.
 *
 * With anisotropy the lag is rotated into the major/minor axes and the minor component
 * is stretched by 1/ratio, so a single isotropic `range` then describes both directions.
 * This is the standard reduced-distance transform, and doing it here means every
 * consumer — kriging, SGS, SIS, the neighbour search — becomes anisotropic at once
 * rather than three of them agreeing and one not.
 */
const dist = (a: { x: number; y: number }, b: { x: number; y: number }, p?: Vario) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  const an = p?.aniso;
  if (!an || !(an.ratio > 0) || an.ratio >= 1) return Math.hypot(dx, dy);
  // azimuth is clockwise from NORTH, so the major axis is (sin, cos)
  const t = (an.azimuthDeg * Math.PI) / 180;
  const major = dx * Math.sin(t) + dy * Math.cos(t);
  const minor = dx * Math.cos(t) - dy * Math.sin(t);
  return Math.hypot(major, minor / an.ratio);
};
/** nearest K conditioning data (keeps kriging O(K³) as the simulated set grows). */
function nearest<T extends { x: number; y: number }>(data: T[], target: { x: number; y: number }, K: number, p?: Vario): T[] {
  if (data.length <= K) return data;
  // the neighbourhood must be anisotropic too, or the search picks points the
  // variogram then says are uncorrelated
  return data.map((d) => [dist(d, target, p), d] as [number, T]).sort((a, b) => a[0] - b[0]).slice(0, K).map((e) => e[1]);
}

// ── dense linear solve (Gaussian elimination, partial pivot) ───────────────────
function solve(A: number[][], b: number[]): number[] {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col; for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col]; if (Math.abs(d) < 1e-14) continue;
    for (let r = 0; r < n; r++) { if (r === col) continue; const f = M[r][col] / d; for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]; }
  }
  return M.map((row, i) => row[n] / (Math.abs(row[i]) < 1e-14 ? 1 : row[i]));
}

// ── kriging ────────────────────────────────────────────────────────────────────
export interface KrigeResult { est: number; variance: number; wsum: number }
/** Simple kriging (known mean) → {est, variance}. Used by SGS/SIS. */
export function simpleKrige(data: Pt[], target: { x: number; y: number }, p: Vario, mean = 0): KrigeResult {
  const n = data.length; if (!n) return { est: mean, variance: p.sill, wsum: 0 };
  const C = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, k) => cov(dist(data[i], data[k], p), p)));
  const k = data.map((d) => cov(dist(d, target, p), p));
  const lam = solve(C, k);
  let est = mean, varr = p.sill, wsum = 0;
  for (let i = 0; i < n; i++) { est += lam[i] * (data[i].v - mean); varr -= lam[i] * k[i]; wsum += lam[i]; }
  return { est, variance: Math.max(0, varr), wsum };
}
/** Ordinary kriging (unknown mean; weights sum to 1). */
export function ordinaryKrige(data: Pt[], target: { x: number; y: number }, p: Vario): KrigeResult {
  const n = data.length; if (!n) return { est: 0, variance: p.sill, wsum: 0 };
  const A = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, k) =>
    i < n && k < n ? cov(dist(data[i], data[k], p), p) : (i === n && k === n ? 0 : 1)));
  const b = [...data.map((d) => cov(dist(d, target, p), p)), 1];
  const sol = solve(A, b); const lam = sol.slice(0, n), mu = sol[n];
  let est = 0, wsum = 0, varr = p.sill;
  for (let i = 0; i < n; i++) { est += lam[i] * data[i].v; wsum += lam[i]; varr -= lam[i] * b[i]; }
  return { est, variance: Math.max(0, varr - mu), wsum };
}

// ── normal-score transform (rank → gaussian quantile) + back-transform ─────────
export interface NscoreTable { v: number; ns: number }
/** Acklam inverse normal CDF (qnorm). */
export function qnorm(pp: number): number {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pl = 0.02425;
  if (pp < pl) { const q = Math.sqrt(-2 * Math.log(pp)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (pp > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - pp)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = pp - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
export function buildNscore(values: number[]): { ns: number[]; table: NscoreTable[] } {
  const idx = values.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const n = idx.length; const table = idx.map(([v], r) => ({ v, ns: qnorm((r + 0.5) / n) }));
  const ns = new Array<number>(n); idx.forEach(([, i], r) => { ns[i] = table[r].ns; });
  return { ns, table };
}
export function backNscore(nsVal: number, table: NscoreTable[]): number {
  if (nsVal <= table[0].ns) return table[0].v;
  if (nsVal >= table[table.length - 1].ns) return table[table.length - 1].v;
  let lo = 0, hi = table.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (table[m].ns <= nsVal) lo = m; else hi = m; }
  const t = (nsVal - table[lo].ns) / (table[hi].ns - table[lo].ns);
  return table[lo].v + t * (table[hi].v - table[lo].v);
}

// ── SGS: sequential Gaussian simulation ────────────────────────────────────────
/** Simulate continuous property (e.g. porosity) on target points, conditioned to
 * `cond`. Returns back-transformed values aligned to `targets`. Seeded, reproducible. */
export function sgs(cond: Pt[], targets: Array<{ x: number; y: number }>, p: Vario, seed: number): number[] {
  const rng = mulberry32(seed);
  const { ns, table } = buildNscore(cond.map((d) => d.v));
  const data: Pt[] = cond.map((d, i) => ({ x: d.x, y: d.y, v: ns[i] }));   // NS-space conditioning
  const order = targets.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const jj = Math.floor(rng() * (i + 1)); [order[i], order[jj]] = [order[jj], order[i]]; }
  const out = new Array<number>(targets.length);
  for (const ti of order) {
    const { est, variance } = simpleKrige(nearest(data, targets[ti], SEARCH_K, p), targets[ti], p, 0);
    const sim = est + Math.sqrt(variance) * gauss(rng);
    out[ti] = sim; data.push({ x: targets[ti].x, y: targets[ti].y, v: sim });
  }
  return out.map((v) => backNscore(v, table));
}

// ── SIS: 2-facies sequential indicator simulation (SAND=1 / SHALE=0) ───────────
/** Simulate discrete SAND/SHALE facies honoring global proportion `globalP`
 * (defaults to the conditioning proportion). Simple indicator kriging with gp as
 * the known mean (ordinary would drift the proportion). Seeded, reproducible. */
export function sis(cond: FaciesPt[], targets: Array<{ x: number; y: number }>, p: Vario, seed: number, globalP?: number): Array<0 | 1> {
  const rng = mulberry32(seed);
  const gp = globalP ?? (cond.length ? cond.reduce((a, d) => a + d.f, 0) / cond.length : 0.5);
  const data: Pt[] = cond.map((d) => ({ x: d.x, y: d.y, v: d.f }));
  const order = targets.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const jj = Math.floor(rng() * (i + 1)); [order[i], order[jj]] = [order[jj], order[i]]; }
  const out = new Array<0 | 1>(targets.length);
  for (const ti of order) {
    const nb = nearest(data, targets[ti], SEARCH_K, p);
    const prob = nb.length ? Math.min(1, Math.max(0, simpleKrige(nb, targets[ti], p, gp).est)) : gp;
    const f: 0 | 1 = rng() < prob ? 1 : 0;
    out[ti] = f; data.push({ x: targets[ti].x, y: targets[ti].y, v: f });
  }
  return out;
}
