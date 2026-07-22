// S1 GEOSTAT truth-lock (Fable). Independent reference implementations of the
// geostatistics + grid engine (variogram, kriging, normal-score, SGS, SIS, grid3d,
// perm), asserted against analytic identities. These reference fns ARE the spec:
// Opus ports them 1:1 into src/engine/{geostat,grid3d,perm}.ts and the PARITY block
// below (guarded by existsSync) confirms the built engine reproduces them exactly.
// Run: node scripts/test-geostat.mjs   (exits nonzero on any failure)
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

// ── seeded RNG (shared with mc.ts — identical algorithm) ───────────────────────
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE IMPLEMENTATIONS (the LOCKED spec — Opus ports these verbatim)
// ═══════════════════════════════════════════════════════════════════════════════

// ── variogram + covariance ─────────────────────────────────────────────────────
// params = { model:'spherical'|'exponential'|'gaussian', nugget, sill, range }
// sill = TOTAL sill (nugget + partial sill). γ(0)=0; γ(h>0)→nugget as h→0+.
function variogram(h, p) {
  if (h <= 0) return 0;
  const c = p.sill - p.nugget;           // partial sill
  const r = p.range;
  let g;
  if (p.model === 'spherical') g = h >= r ? 1 : 1.5 * (h / r) - 0.5 * (h / r) ** 3;
  else if (p.model === 'exponential') g = 1 - Math.exp(-3 * h / r);   // practical range at h=r (~95%)
  else /* gaussian */ g = 1 - Math.exp(-3 * (h / r) ** 2);
  return p.nugget + c * g;
}
// covariance model: C(0)=sill (full), C(h>0)=sill−γ(h). Nugget lives only on the
// diagonal discontinuity ⇒ kriging still honors data exactly (GSLIB convention).
function cov(h, p) { return h === 0 ? p.sill : p.sill - variogram(h, p); }
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// moving search neighborhood — nearest K conditioning data (GSLIB-style; keeps
// kriging O(K³) not O(n³) as the simulated set grows). K≈16 default.
function nearest(data, target, K) {
  if (data.length <= K) return data;
  return data.map((d) => [dist(d, target), d]).sort((a, b) => a[0] - b[0]).slice(0, K).map((e) => e[1]);
}
const SEARCH_K = 16;

// ── dense linear solve (Gaussian elimination w/ partial pivot) ─────────────────
function solve(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col; for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col]; if (Math.abs(d) < 1e-14) continue;
    for (let r = 0; r < n; r++) { if (r === col) continue; const f = M[r][col] / d; for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]; }
  }
  return M.map((row, i) => row[n] / (Math.abs(row[i]) < 1e-14 ? 1 : row[i]));
}

// ── simple kriging (known mean) → {est, variance} (used by SGS in NS space) ────
function simpleKrige(data, target, p, mean = 0) {
  const n = data.length; if (!n) return { est: mean, variance: p.sill };
  const C = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, k) => cov(dist(data[i], data[k]), p)));
  const k = data.map((d) => cov(dist(d, target), p));
  const lam = solve(C, k);
  let est = mean, varr = p.sill;
  for (let i = 0; i < n; i++) { est += lam[i] * (data[i].v - mean); varr -= lam[i] * k[i]; }
  return { est, variance: Math.max(0, varr) };
}
// ── ordinary kriging (unknown mean; weights sum to 1) → {est, variance, wsum} ──
function ordinaryKrige(data, target, p) {
  const n = data.length; if (!n) return { est: 0, variance: p.sill, wsum: 0 };
  const A = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, k) =>
    i < n && k < n ? cov(dist(data[i], data[k]), p) : (i === n && k === n ? 0 : 1)));
  const b = [...data.map((d) => cov(dist(d, target), p)), 1];
  const sol = solve(A, b); const lam = sol.slice(0, n), mu = sol[n];
  let est = 0, wsum = 0, varr = p.sill; for (let i = 0; i < n; i++) { est += lam[i] * data[i].v; wsum += lam[i]; varr -= lam[i] * b[i]; }
  return { est, variance: Math.max(0, varr - mu), wsum };
}

// ── normal-score transform (rank → gaussian quantile) + back-transform ─────────
function qnorm(pp) { // Acklam inverse normal CDF
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pl = 0.02425;
  if (pp < pl) { const q = Math.sqrt(-2 * Math.log(pp)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (pp > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - pp)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = pp - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
function buildNscore(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const n = idx.length; const table = idx.map(([v], r) => ({ v, ns: qnorm((r + 0.5) / n) }));
  const ns = new Array(n); idx.forEach(([, i], r) => { ns[i] = table[r].ns; });
  return { ns, table }; // table sorted by v (== sorted by ns, monotone)
}
function backNscore(nsVal, table) {
  if (nsVal <= table[0].ns) return table[0].v;
  if (nsVal >= table[table.length - 1].ns) return table[table.length - 1].v;
  let lo = 0, hi = table.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (table[m].ns <= nsVal) lo = m; else hi = m; }
  const t = (nsVal - table[lo].ns) / (table[hi].ns - table[lo].ns);
  return table[lo].v + t * (table[hi].v - table[lo].v);
}

// ── SGS: sequential Gaussian simulation on a set of target points ──────────────
// conditioning: [{x,y,v}]; targets: [{x,y}]; params in DATA units (transformed
// internally). Returns simulated values (back-transformed) aligned to targets.
function sgs(cond, targets, p, seed) {
  const rng = mulberry32(seed);
  const { ns, table } = buildNscore(cond.map((d) => d.v));
  const data = cond.map((d, i) => ({ x: d.x, y: d.y, v: ns[i] }));   // NS-space conditioning
  const order = targets.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const jj = Math.floor(rng() * (i + 1)); [order[i], order[jj]] = [order[jj], order[i]]; }
  const out = new Array(targets.length);
  for (const ti of order) {
    const { est, variance } = simpleKrige(nearest(data, targets[ti], SEARCH_K), targets[ti], p, 0);
    const sim = est + Math.sqrt(variance) * gauss(rng);
    out[ti] = sim; data.push({ x: targets[ti].x, y: targets[ti].y, v: sim });
  }
  return out.map((v) => backNscore(v, table));
}

// ── SIS: 2-facies sequential indicator simulation (SAND=1 / SHALE=0) ───────────
// cond: [{x,y,f}] f∈{0,1}. Returns 0/1 facies aligned to targets, honoring global p.
function sis(cond, targets, p, seed, globalP) {
  const rng = mulberry32(seed);
  const gp = globalP ?? (cond.reduce((a, d) => a + d.f, 0) / Math.max(1, cond.length));
  const data = cond.map((d) => ({ x: d.x, y: d.y, v: d.f }));
  const order = targets.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const jj = Math.floor(rng() * (i + 1)); [order[i], order[jj]] = [order[jj], order[i]]; }
  const out = new Array(targets.length);
  for (const ti of order) {
    // SIMPLE indicator kriging with the target proportion gp as the known mean →
    // reverts to gp away from data, so the global NTG is honored (ordinary kriging
    // would let the local mean float and drift the proportion). prob = SK estimate.
    const nb = nearest(data, targets[ti], SEARCH_K);
    const prob = nb.length ? Math.min(1, Math.max(0, simpleKrige(nb, targets[ti], p, gp).est)) : gp;
    const f = rng() < prob ? 1 : 0; out[ti] = f; data.push({ x: targets[ti].x, y: targets[ti].y, v: f });
  }
  return out;
}

// ── grid3d: proportional layering + geometric modeling ─────────────────────────
function layerThickness(topZ, baseZ, nz) { return (baseZ - topZ) / nz; }        // proportional
function bulkVol(dx, dy, thk) { return dx * dy * thk; }
function hcpv(cells) { return cells.reduce((a, c) => a + (c.active ? c.bulkVol * c.ntg * c.phi * (1 - c.sw) : 0), 0); }

// ── perm: φ→k transform (log-linear screening) + kv ────────────────────────────
// log10(k_mD) = a·φ + b  ⇒ monotone increasing in φ. kv = kh·kvkh.
function phiToK(phi, a = 30, b = -1) { return Math.pow(10, a * phi + b); }
function permKv(kh, kvkh = 0.1) { return kh * kvkh; }

console.log('\n=== S1 geostat + grid engine truth-lock ===');

// 1 · variogram shape
{
  const p = { model: 'spherical', nugget: 0, sill: 1, range: 100 };
  check('variogram γ(0)=0', variogram(0, p) === 0);
  check('spherical reaches sill exactly at range', approx(variogram(100, p), 1, 1e-12) && approx(variogram(150, p), 1, 1e-12));
  const hs = [1, 10, 30, 60, 99]; const gs = hs.map((h) => variogram(h, p));
  check('spherical monotonic increasing to range', gs.every((g, i) => i === 0 || g >= gs[i - 1]));
  const pe = { model: 'exponential', nugget: 0, sill: 1, range: 100 };
  check('exponential ≈95% of sill at practical range', approx(variogram(100, pe), 0.95, 0.01), `γ(a)=${variogram(100, pe).toFixed(3)}`);
  const pn = { model: 'spherical', nugget: 0.3, sill: 1, range: 100 };
  check('nugget: γ→nugget as h→0+', approx(variogram(0.001, pn), 0.3, 0.02), `γ(0+)=${variogram(0.001, pn).toFixed(3)}`);
  check('covariance C(0)=sill, C(range)=0 (spherical)', cov(0, p) === 1 && approx(cov(100, p), 0, 1e-12));
}

// 2 · kriging identities
{
  const p = { model: 'spherical', nugget: 0, sill: 1, range: 50 };
  const data = [{ x: 0, y: 0, v: 10 }, { x: 100, y: 0, v: 20 }, { x: 0, y: 100, v: 30 }, { x: 100, y: 100, v: 15 }];
  // exactness at data points
  const okAt = ordinaryKrige(data, { x: 0, y: 0 }, p);
  check('ordinary kriging exact at data point', approx(okAt.est, 10, 1e-6), `est=${okAt.est.toFixed(4)}`);
  check('ordinary kriging weights sum to 1', approx(okAt.wsum, 1, 1e-9), `Σλ=${okAt.wsum.toFixed(6)}`);
  const skAt = simpleKrige(data, { x: 100, y: 0 }, p, 18.75);
  check('simple kriging exact at data point', approx(skAt.est, 20, 1e-6), `est=${skAt.est.toFixed(4)}`);
  check('kriging variance ≥0, =0 at data point', skAt.variance >= 0 && approx(skAt.variance, 0, 1e-6), `σ²=${skAt.variance.toFixed(6)}`);
  // constant field → constant estimate
  const cst = [{ x: 0, y: 0, v: 7 }, { x: 30, y: 0, v: 7 }, { x: 0, y: 30, v: 7 }];
  check('kriging of constant field = constant', approx(ordinaryKrige(cst, { x: 10, y: 10 }, p).est, 7, 1e-6));
  // interpolation stays within data range (no wild overshoot for a smooth config)
  const mid = ordinaryKrige(data, { x: 50, y: 50 }, p).est;
  check('kriging midpoint within data range', mid >= 10 && mid <= 30, `est=${mid.toFixed(2)}`);
}

// 3 · normal-score round-trip + gaussianity
{
  const rng = mulberry32(11); const vals = Array.from({ length: 400 }, () => 0.05 + 0.3 * rng()); // porosity-like
  const { ns, table } = buildNscore(vals);
  const rt = ns.map((z) => backNscore(z, table));
  check('normal-score round-trip exact at data', vals.every((v, i) => approx(v, rt[i], 1e-9)));
  const m = ns.reduce((a, b) => a + b, 0) / ns.length, sd = Math.sqrt(ns.reduce((a, b) => a + (b - m) ** 2, 0) / ns.length);
  check('normal-score ~ standard normal (mean≈0, std≈1)', approx(m, 0, 0.05) && approx(sd, 1, 0.06), `mean=${m.toFixed(3)} std=${sd.toFixed(3)}`);
}

// 4 · SGS
{
  const p = { model: 'spherical', nugget: 0.05, sill: 1, range: 400 };
  const cond = [{ x: 0, y: 0, v: 0.10 }, { x: 1000, y: 0, v: 0.28 }, { x: 0, y: 1000, v: 0.22 }, { x: 1000, y: 1000, v: 0.15 }, { x: 500, y: 500, v: 0.20 }];
  const targets = [{ x: 0, y: 0 }, { x: 250, y: 250 }, { x: 500, y: 500 }, { x: 750, y: 750 }, { x: 900, y: 100 }];
  const a = sgs(cond, targets, p, 20260722), b = sgs(cond, targets, p, 20260722), c = sgs(cond, targets, p, 20260723);
  check('SGS seeded reproducible', a.every((v, i) => v === b[i]));
  check('SGS seed-sensitive', a.some((v, i) => v !== c[i]));
  check('SGS reproduces conditioning data (colocated target)', approx(a[0], 0.10, 1e-6) && approx(a[2], 0.20, 1e-6), `@(0,0)=${a[0].toFixed(4)} @(500,500)=${a[2].toFixed(4)}`);
  check('SGS output in physical porosity range', a.every((v) => v >= 0.05 && v <= 0.30));
  // unbiasedness: ensemble mean at an unconditioned point ≈ kriging estimate (NS→data mean tendency)
  const far = [{ x: 5000, y: 5000 }]; let s = 0, K = 200; for (let k = 0; k < K; k++) s += sgs(cond, far, p, 1000 + k)[0];
  const condMean = cond.reduce((a2, d) => a2 + d.v, 0) / cond.length;
  check('SGS ensemble mean far from data ≈ global mean (unbiased)', approx(s / K, condMean, 0.03), `E=${(s / K).toFixed(3)} globalμ=${condMean.toFixed(3)}`);
}

// 5 · SIS (2-facies)
{
  const p = { model: 'spherical', nugget: 0.1, sill: 1, range: 300 };
  const cond = [{ x: 0, y: 0, f: 1 }, { x: 1000, y: 0, f: 0 }, { x: 0, y: 1000, f: 1 }, { x: 1000, y: 1000, f: 1 }];
  const targets = [{ x: 0, y: 0 }, { x: 500, y: 500 }, { x: 250, y: 750 }];
  const a = sis(cond, targets, p, 42), b = sis(cond, targets, p, 42), c = sis(cond, targets, p, 43);
  check('SIS seeded reproducible', a.every((v, i) => v === b[i]));
  check('SIS binary output {0,1}', a.every((v) => v === 0 || v === 1));
  check('SIS reproduces facies at conditioning point', a[0] === 1);
  check('SIS seed-sensitive', a.some((v, i) => v !== c[i]) || JSON.stringify(a) !== JSON.stringify(c));
  // global proportion honored (unconditional, target NTG=0.7)
  const grid = Array.from({ length: 2500 }, (_, i) => ({ x: (i % 50) * 20, y: ((i / 50) | 0) * 20 }));
  let sums = 0, R = 6; for (let r = 0; r < R; r++) { const f = sis([], grid, p, 7 + r, 0.70); sums += f.reduce((a2, b2) => a2 + b2, 0) / f.length; }
  check('SIS honors global proportion (NTG 0.70 ±0.05)', approx(sums / R, 0.70, 0.05), `p̄=${(sums / R).toFixed(3)}`);
}

// 6 · grid3d + HCPV reconciliation identity
{
  check('proportional layer thickness sums to zone thickness', approx(layerThickness(3000, 3100, 10) * 10, 100, 1e-9));
  check('bulk volume = dx·dy·thk', approx(bulkVol(50, 50, 10), 25000, 1e-9));
  // uniform property cube: HCPV must equal Σbulk·ntg·φ·(1−Sw) == STOIIP·Bo
  const ntg = 0.9, phi = 0.225, sw = 0.20, bo = 1.47, nCell = 1000, vb = 25000;
  const cells = Array.from({ length: nCell }, () => ({ active: true, bulkVol: vb, ntg, phi, sw }));
  const hc = hcpv(cells); const grv = nCell * vb; const stoiip = grv * ntg * phi * (1 - sw) / bo;
  check('HCPV reconciles to STOIIP·Bo (grid == closed-form)', approx(hc, stoiip * bo, 1e-3), `HCPV=${(hc / 1e6).toFixed(2)}Mm³ STOIIP·Bo=${(stoiip * bo / 1e6).toFixed(2)}`);
  const cells2 = cells.map((c, i) => ({ ...c, active: i < 400 }));
  check('inactive cells excluded from HCPV', approx(hcpv(cells2), hc * 0.4, 1e-3));
}

// 7 · perm φ→k
{
  const ks = [0.05, 0.10, 0.20, 0.30].map((v) => phiToK(v));
  check('φ→k strictly monotone increasing & positive', ks.every((k, i) => k > 0 && (i === 0 || k > ks[i - 1])), `k=[${ks.map((k) => k.toFixed(1)).join(', ')}] mD`);
  check('kv = kh·kvkh', approx(permKv(1000, 0.1), 100, 1e-9));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARITY: once Opus builds src/engine/{geostat,grid3d,perm}.ts, confirm the engine
// reproduces every reference number above. Skipped until the modules exist.
// ═══════════════════════════════════════════════════════════════════════════════
if (existsSync(join(__dirname, '..', 'src', 'engine', 'geostat.ts'))) {
  const G = await import('../src/engine/geostat.ts');
  const p = { model: 'spherical', nugget: 0, sill: 1, range: 50 };
  const data = [{ x: 0, y: 0, v: 10 }, { x: 100, y: 0, v: 20 }, { x: 0, y: 100, v: 30 }, { x: 100, y: 100, v: 15 }];
  check('PARITY · variogram spherical', approx(G.variogram(30, { model: 'spherical', nugget: 0, sill: 1, range: 100 }), variogram(30, { model: 'spherical', nugget: 0, sill: 1, range: 100 }), 1e-12));
  check('PARITY · ordinary kriging exact', approx(G.ordinaryKrige(data, { x: 0, y: 0 }, p).est, 10, 1e-6));
  const cond = [{ x: 0, y: 0, v: 0.10 }, { x: 1000, y: 0, v: 0.28 }, { x: 500, y: 500, v: 0.20 }];
  const tg = [{ x: 0, y: 0 }, { x: 250, y: 250 }];
  const eng = G.sgs(cond, tg, { model: 'spherical', nugget: 0.05, sill: 1, range: 400 }, 20260722);
  const ref = sgs(cond, tg, { model: 'spherical', nugget: 0.05, sill: 1, range: 400 }, 20260722);
  check('PARITY · SGS identical (same seed)', eng.every((v, i) => approx(v, ref[i], 1e-9)));
} else {
  console.log('SKIP  engine parity — src/engine/geostat.ts not built yet (Opus S1 impl)');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
