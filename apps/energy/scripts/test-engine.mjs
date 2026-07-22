// V1 numerics truth-lock (Fable). Independent reference implementations of the
// volumetrics / Monte-Carlo / decline / economics formulas, asserted against
// published Volve ground truth and analytic identities. When src/engine/ is ported
// (V1c), a parity block can import the real engine and confirm it matches these.
// Run: node scripts/test-engine.mjs   (exits nonzero on any failure)
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WB = join(__dirname, '..', 'public', 'wb');
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));

let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

// ── reference numerics (the LOCKED formulas the engine must match) ─────────────
// seeded RNG — deterministic, reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// gamma via Marsaglia–Tsang
function gamma(rng, k) {
  if (k < 1) return gamma(rng, k + 1) * Math.pow(rng(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = gauss(rng); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rng(); if (u < 1 - 0.0331 * x * x * x * x) return d * v; if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
}
function beta(rng, a, b) { const x = gamma(rng, a), y = gamma(rng, b); return x / (x + y); }
// PERT (min, mode, max) via Beta with the standard shape (lambda=4).
function samplePert(rng, min, mode, max) {
  if (max <= min) return min;
  const a = 1 + 4 * (mode - min) / (max - min), b = 1 + 4 * (max - mode) / (max - min);
  return min + beta(rng, a, b) * (max - min);
}
function sampleTri(rng, min, mode, max) { const u = rng(), c = (mode - min) / (max - min); return u < c ? min + Math.sqrt(u * (max - min) * (mode - min)) : max - Math.sqrt((1 - u) * (max - min) * (max - mode)); }
// percentile on sorted asc array, p in [0,100]
function pct(sortedAsc, p) { const idx = (p / 100) * (sortedAsc.length - 1); const lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? sortedAsc[lo] : sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo); }
// Arps decline: rate at time t (months); b=0 exp, b=1 harmonic, else hyperbolic
function arps(qi, Di, b, t) { if (b <= 1e-6) return qi * Math.exp(-Di * t); if (Math.abs(b - 1) < 1e-6) return qi / (1 + Di * t); return qi / Math.pow(1 + b * Di * t, 1 / b); }
// cumulative via trapezoid over monthly steps → volume (× days/month handled by caller units)
function arpsCum(qi, Di, b, months) { let cum = 0, prev = qi; for (let t = 1; t <= months; t++) { const q = arps(qi, Di, b, t); cum += (prev + q) / 2; prev = q; } return cum; }
// GRV between top/base grids inside a blanket contact, crest-connected closure
function grvClosure(top, base, owc, cell) {
  const { nx, ny } = top; const inCl = new Uint8Array(nx * ny);
  let crest = -1, cz = Infinity;
  for (let i = 0; i < nx * ny; i++) { const z = top.z[i]; if (z != null && z < cz) { cz = z; crest = i; } }
  const st = [crest]; inCl[crest] = 1;
  while (st.length) { const idx = st.pop(); const i = idx % nx, k = (idx / nx) | 0; for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nk = k + dk; if (ni < 0 || nk < 0 || ni >= nx || nk >= ny) continue; const n = nk * nx + ni; if (inCl[n]) continue; const z = top.z[n]; if (z != null && z < owc) { inCl[n] = 1; st.push(n); } } }
  let grv = 0;
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) { const idx = k * nx + i; if (!inCl[idx]) continue; const zt = top.z[idx]; const x = top.x0 + i * cell, y = top.y0 + k * cell; const bi = Math.round((x - base.x0) / cell), bk = Math.round((y - base.y0) / cell); if (bi < 0 || bk < 0 || bi >= base.nx || bk >= base.ny) continue; const zb = base.z[bk * base.nx + bi]; if (zb == null) continue; const h = Math.max(0, Math.min(zb, owc) - zt); if (h > 0) grv += h * cell * cell; }
  return grv;
}
const stoiip = (grv, ntg, phi, sw, bo) => grv * ntg * phi * (1 - sw) / bo;
// economics: mid-year discounting
function npv(cashflows, rate) { let v = 0; for (let y = 0; y < cashflows.length; y++) v += cashflows[y] / Math.pow(1 + rate, y + 0.5); return v; }

console.log('\n=== V1 engine numerics truth-lock ===');

// 1 · reproducibility
{
  const a = Array.from({ length: 5 }, mulberry32(20260722));
  const b = Array.from({ length: 5 }, mulberry32(20260722));
  const c = Array.from({ length: 5 }, mulberry32(20260723));
  check('RNG reproducible (same seed → same sequence)', a.every((v, i) => v === b[i]));
  check('RNG seed-sensitive (diff seed → diff sequence)', a.some((v, i) => v !== c[i]));
}

// 2 · percentile convention (oil: P90=pct10 ≤ P50 ≤ P10=pct90)
{
  const rng = mulberry32(1); const arr = Array.from({ length: 5000 }, () => samplePert(rng, 10, 20, 40)).sort((x, y) => x - y);
  const p90 = pct(arr, 10), p50 = pct(arr, 50), p10 = pct(arr, 90);
  check('oil percentile convention P90≤P50≤P10', p90 < p50 && p50 < p10, `P90=${p90.toFixed(1)} P50=${p50.toFixed(1)} P10=${p10.toFixed(1)}`);
}

// 3 · PERT mean ≈ (min+4·mode+max)/6
{
  const rng = mulberry32(7); const N = 40000; let s = 0; const min = 0.75, mode = 1.0, max = 1.25;
  for (let i = 0; i < N; i++) s += samplePert(rng, min, mode, max);
  const emp = s / N, theo = (min + 4 * mode + max) / 6;
  check('PERT empirical mean ≈ theoretical', approx(emp, theo, 0.01), `emp=${emp.toFixed(4)} theo=${theo.toFixed(4)}`);
}

// 4 · triangular mean ≈ (min+mode+max)/3
{
  const rng = mulberry32(9); const N = 40000; let s = 0; const min = 1.0, mode = 1.1, max = 1.4;
  for (let i = 0; i < N; i++) s += sampleTri(rng, min, mode, max);
  const emp = s / N, theo = (min + mode + max) / 3;
  check('triangular empirical mean ≈ theoretical', approx(emp, theo, 0.01), `emp=${emp.toFixed(4)} theo=${theo.toFixed(4)}`);
}

// 5 · Arps exponential cum ≈ analytic qi/Di·(1−e^−Di·t)
{
  const qi = 1000, Di = 0.05, months = 120;
  const num = arpsCum(qi, Di, 0, months);
  const analytic = (qi / Di) * (1 - Math.exp(-Di * months));
  check('Arps exp cum ≈ analytic', approx(num, analytic, analytic * 0.01), `trapz=${num.toFixed(0)} analytic=${analytic.toFixed(0)}`);
  // decline monotonic
  const rates = Array.from({ length: 24 }, (_, t) => arps(qi, Di, 0.5, t));
  check('Arps hyperbolic monotonic decline', rates.every((r, i) => i === 0 || r <= rates[i - 1]));
}

// 6 · NPV: known cashflow, mid-year discount
{
  const v = npv([-1000, 600, 600], 0.10);
  // -1000/1.10^0.5 + 600/1.10^1.5 + 600/1.10^2.5
  const expected = -1000 / Math.pow(1.1, 0.5) + 600 / Math.pow(1.1, 1.5) + 600 / Math.pow(1.1, 2.5);
  check('NPV mid-year discount matches hand calc', approx(v, expected, 0.01), `npv=${v.toFixed(2)}`);
}

// 7 · STOIIP from REAL wb grids — PARITY with the wb build (same computation) + a
// gross-error gate. STOIIP is a method-dependent SCREENING upper bound (blanket deck
// OWC over unfaulted closure), NOT a field number — so we parity-check the computation
// and gate against gross grid/param error, not against a published field STOIIP. The
// TIGHT published-truth gate is cum-oil (exact production decode).
if (existsSync(join(WB, 'index.json'))) {
  const idx = j(join(WB, 'index.json'));
  const top = j(join(WB, 'surface-hugin_top.json')), base = j(join(WB, 'surface-hugin_base.json'));
  const d = idx.defaults, owc = idx.contacts.find((c) => c.kind === 'OWC').tvdss;
  const grv = grvClosure(top, base, owc, top.cell);
  const st = stoiip(grv, d.ntg, d.phi, d.sw, d.bo) / 1e6;
  check('STOIIP parity with wb build (same grids/params/formula)', approx(st, idx.validation.stoiip.stoiipMMSm3, 1.0), `here=${st.toFixed(1)} wb=${idx.validation.stoiip.stoiipMMSm3}`);
  check('STOIIP screening in gross-error gate 40-220', st >= 40 && st <= 220, `${st.toFixed(1)} MMSm³ (screening upper bound; dynamic model ≈22)`);
  check('Bo is deck-sourced live-oil value (~1.47, not dead-oil 1.18)', approx(d.bo, 1.47, 0.05), `Bo=${d.bo}`);
  check('OWC is deck main-structure value (3200m)', owc === 3200, `OWC=${owc}`);
  check('cum-oil reconciles ~63 MMbbl (tight published-truth gate)', idx.validation.cumOilOk, `${idx.validation.cumOilMMSm3} MMSm³ ≈ ${(idx.validation.cumOilMMSm3 * 6.2898).toFixed(1)} MMbbl`);
} else {
  console.log('SKIP  STOIIP grid checks — run `npm run data:wb` first');
}

// 8 · trajectory TVD ≤ MD on real definitive surveys
if (existsSync(join(WB, 'index.json'))) {
  const idx = j(join(WB, 'index.json'));
  let bad = 0, checked = 0;
  for (const wl of idx.wells.filter((x) => x.has.traj)) {
    const f = join(WB, `traj-${wl.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.json`);
    if (!existsSync(f)) continue;
    for (const s of j(f).stations) { checked++; if (s.tvd > s.md + 0.5) bad++; }
  }
  check('trajectory TVD ≤ MD (all definitive stations)', bad === 0, `${checked} stations, ${bad} violations`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
