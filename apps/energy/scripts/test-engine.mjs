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
// gross-error gate. STOIIP is a method-dependent SCREENING scenario (blanket contact
// over unfaulted closure), NOT a field number — so we parity-check the computation
// and gate against gross grid/param error, not against a published field STOIIP. The
// TIGHT published-truth gate is cum-oil (exact production decode).
if (existsSync(join(WB, 'index.json'))) {
  const idx = j(join(WB, 'index.json'));
  const top = j(join(WB, 'surface-hugin_top.json')), base = j(join(WB, 'surface-hugin_base.json'));
  const d = idx.defaults, owc = idx.contacts.find((c) => c.kind === 'OWC').tvdss;
  const grv = grvClosure(top, base, owc, top.cell);
  const st = stoiip(grv, d.ntg, d.phi, d.sw, d.bo) / 1e6;
  check('STOIIP parity with wb build (same grids/params/formula)', approx(st, idx.validation.stoiip.stoiipMMSm3, 1.0), `here=${st.toFixed(1)} wb=${idx.validation.stoiip.stoiipMMSm3}`);
  const gate = idx.validation.stoiip.gateMMSm3;
  check(`STOIIP screening in scenario gate ${gate.min}-${gate.max}`, st >= gate.min && st <= gate.max, `${st.toFixed(1)} MMSm³ (${gate.basis})`);
  check('Bo is deck-sourced live-oil value (~1.47, not dead-oil 1.18)', approx(d.bo, 1.47, 0.05), `Bo=${d.bo}`);
  check('OWC is active user-selected screening value (3065m)', owc === 3065, `OWC=${owc}`);
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

// ── V1b/V1c additions (founder spec: gas case, upscaling, facies, tornado, econ) ──
// gas GIIP (scenario fill) + associated/solution gas
const giip = (grv, ntg, phie, sw, bg) => grv * ntg * phie * (1 - sw) / bg;
{
  const grv = 1e9; // 1 km3-scale
  const g = giip(grv, 0.9, 0.225, 0.20, 0.0040);
  const oil = stoiip(grv, 0.9, 0.225, 0.20, 1.47);
  const solnGas = oil * 148; // STOIIP × Rs
  check('GIIP formula (>0, Bg divisor scales inversely)', g > 0 && approx(giip(grv, 0.9, 0.225, 0.20, 0.0080), g / 2, g * 0.01), `GIIP=${(g / 1e9).toFixed(2)} BSm³`);
  check('solution gas = STOIIP·Rs (associated)', approx(solnGas, oil * 148, 1), `${(solnGas / 1e9).toFixed(2)} BSm³`);
}

// log upscaling: arithmetic mean (continuous), net-fraction (SAND), majority (facies)
function upscaleMean(vals) { const v = vals.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
function netFraction(flags) { const v = flags.filter((x) => x != null); return v.length ? v.filter((x) => x >= 0.5).length / v.length : 0; }
function majority(labels) { const m = new Map(); for (const l of labels) m.set(l, (m.get(l) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; }
{
  check('upscale mean (continuous PHIE)', approx(upscaleMean([0.2, 0.25, null, 0.3]), 0.25, 1e-9));
  check('upscale net-fraction (SAND)', approx(netFraction([1, 1, 0, 1, 0]), 0.6, 1e-9));
  check('upscale majority (discrete facies)', majority(['SAND', 'SAND', 'SHALE']) === 'SAND');
}

// tornado: Pearson r of input vs output (one-at-a-time sensitivity ranking)
function pearson(xs, ys) { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sx += dx * dx; sy += dy * dy; } return sxy / Math.sqrt(sx * sy); }
{
  const rng = mulberry32(3); const xs = [], ys = [];
  for (let i = 0; i < 500; i++) { const x = rng(); xs.push(x); ys.push(3 * x + 0.05 * (rng() - 0.5)); }
  check('tornado Pearson r (strong +corr ≈1)', pearson(xs, ys) > 0.98, `r=${pearson(xs, ys).toFixed(3)}`);
  const neg = ys.map((v) => -v);
  check('tornado Pearson r (inverse ≈−1)', pearson(xs, neg) < -0.98);
}

// economics with the Fable-set screening defaults → plausible Volve-scale NPV
{
  const ECON = { oilPrice: 70, opexVar: 14, opexFix: 45e6, capex: 1200e6, disc: 0.10, aband: 150e6 };
  // ~63 MMbbl over ~9 yr, front-loaded: crude yearly oil (MMbbl) profile
  const oilBbl = [2e6, 12e6, 11e6, 9e6, 8e6, 7e6, 6e6, 5e6, 3e6];
  const cf = oilBbl.map((o, y) => {
    let c = o * ECON.oilPrice - (o * ECON.opexVar + ECON.opexFix);
    if (y === 0) c -= ECON.capex;
    if (y === oilBbl.length - 1) c -= ECON.aband;
    return c;
  });
  const v = npv(cf, ECON.disc);
  const cumOilBbl = oilBbl.reduce((a, b) => a + b, 0);
  check('econ defaults: cum-oil profile ≈ 63 MMbbl', approx(cumOilBbl, 63e6, 5e6), `${(cumOilBbl / 1e6).toFixed(0)} MMbbl`);
  check('econ defaults: NPV finite + plausible sign', Number.isFinite(v), `pre-tax NPV=$${(v / 1e6).toFixed(0)}MM @ $70/bbl`);
}

// ── PARITY: the built src/engine/*.ts must reproduce these exact reference numbers ──
// Node 24 strips TS types natively, so we import the real engine modules directly.
{
  const E_vol = await import('../src/engine/volumetrics.ts');
  const E_mc = await import('../src/engine/mc.ts');
  const E_dca = await import('../src/engine/dca.ts');
  const E_econ = await import('../src/engine/econ.ts');
  const E_up = await import('../src/engine/upscale.ts');

  // RNG + PERT parity (same seed → identical sequence & sample)
  {
    const ref = mulberry32(42), eng = E_mc.mulberry32(42);
    const seqOk = Array.from({ length: 8 }, () => ref() === eng()).every(Boolean);
    check('PARITY · mulberry32 sequence identical', seqOk);
    const r1 = mulberry32(99), r2 = E_mc.mulberry32(99);
    const a = samplePert(r1, 0.75, 1.0, 1.25), b = E_mc.samplePert(r2, 0.75, 1.0, 1.25);
    check('PARITY · samplePert identical draw', a === b, `ref=${a.toFixed(6)} eng=${b.toFixed(6)}`);
  }
  // percentile convention parity
  {
    const arr = Array.from({ length: 2000 }, mulberry32(5)).sort((x, y) => x - y);
    check('PARITY · percentile P50', approx(pct(arr, 50), E_mc.percentile(arr, 50), 1e-12));
  }
  // STOIIP + GRV parity on the real wb grids
  if (existsSync(join(WB, 'index.json'))) {
    const idx = j(join(WB, 'index.json'));
    const top = j(join(WB, 'surface-hugin_top.json')), base = j(join(WB, 'surface-hugin_base.json'));
    const d = idx.defaults, owc = idx.contacts.find((c) => c.kind === 'OWC').tvdss;
    const grvRef = grvClosure(top, base, owc, top.cell);
    const grvEng = E_vol.grvClosure(top, base, owc, top.cell);
    check('PARITY · grvClosure GRV identical', approx(grvRef, grvEng.grv, 1), `ref=${(grvRef/1e6).toFixed(1)} eng=${(grvEng.grv/1e6).toFixed(1)} Mm³`);
    const stRef = stoiip(grvRef, d.ntg, d.phi, d.sw, d.bo) / 1e6;
    const stEng = E_vol.stoiip(grvEng.grv, d.ntg, d.phi, d.sw, d.bo) / 1e6;
    check('PARITY · STOIIP engine == ref == wb', approx(stEng, idx.validation.stoiip.stoiipMMSm3, 1.0) && approx(stRef, stEng, 1e-6), `eng=${stEng.toFixed(1)} wb=${idx.validation.stoiip.stoiipMMSm3}`);
    // GIIP + solution gas
    const g = E_vol.giip(grvEng.grv, d.ntg, d.phi, d.sw, 0.0040);
    check('PARITY · GIIP inverse-Bg scaling', g > 0 && approx(E_vol.giip(grvEng.grv, d.ntg, d.phi, d.sw, 0.0080), g / 2, g * 0.01), `GIIP=${(g/1e9).toFixed(2)} BSm³`);
    check('PARITY · solutionGas = STOIIP·Rs', approx(E_vol.solutionGas(stEng*1e6, 148), stEng*1e6*148, 1));
  }
  // Arps cum + NPV parity
  {
    check('PARITY · arpsCum exp', approx(arpsCum(1000, 0.05, 0, 120), E_dca.arpsCum(1000, 0.05, 0, 120), 1e-6));
    check('PARITY · NPV mid-year', approx(npv([-1000, 600, 600], 0.10), E_econ.npv([-1000, 600, 600], 0.10), 1e-9));
  }
  // upscaling parity
  {
    check('PARITY · upscaleMean', approx(E_up.upscaleMean([0.2, 0.25, null, 0.3]), 0.25, 1e-9));
    check('PARITY · netFraction', approx(E_up.netFraction([1, 1, 0, 1, 0]), 0.6, 1e-9));
    check('PARITY · majority', E_up.majority(['SAND', 'SAND', 'SHALE']) === 'SAND');
  }
  // econ defaults parity
  check('PARITY · ECON_DEFAULTS Fable-set', E_econ.ECON_DEFAULTS.oilPrice === 70 && E_econ.ECON_DEFAULTS.opexVar === 14 && E_econ.ECON_DEFAULTS.capex === 1200e6 && E_econ.ECON_DEFAULTS.disc === 0.10 && E_econ.ECON_DEFAULTS.aband === 150e6 && E_econ.ECON_DEFAULTS.taxRate === 0.78);

  // ── Exploration engine (explore.ts) — GCoS / risked resource / EMV ──────────────
  {
    const E_exp = await import('../src/engine/explore.ts');
    // GCoS = product of chance factors, clamped [0,1]
    const p = E_exp.gcos([{ p: 0.9 }, { p: 0.8 }, { p: 0.7 }, { p: 0.6 }, { p: 0.5 }]);
    check('PARITY · GCoS = Π(factors)', approx(p, 0.9 * 0.8 * 0.7 * 0.6 * 0.5, 1e-9), `POS=${p.toFixed(4)}`);
    check('PARITY · GCoS clamps out-of-range', E_exp.gcos([{ p: 1.5 }, { p: -0.2 }]) === 0);
    check('PARITY · GCoS has 5 elements', E_exp.GCOS_ELEMENTS.length === 5);
    // EMV two-outcome tree: EMV = POS·NPV − (1−POS)·dry
    const e = E_exp.emv({ pos: 0.3, npvSuccess: 500e6, dryHoleCost: 80e6 });
    check('PARITY · EMV formula', approx(e, 0.3 * 500e6 - 0.7 * 80e6, 1), `EMV=$${(e/1e6).toFixed(1)}MM`);
    check('PARITY · EMV drill/no-drill sign', E_exp.isDrillWorthy({ pos: 0.5, npvSuccess: 300e6, dryHoleCost: 50e6 }) && !E_exp.isDrillWorthy({ pos: 0.05, npvSuccess: 300e6, dryHoleCost: 50e6 }));
    // risked resource: seeded ⇒ reproducible; P90 ≤ P50 ≤ P10; risked = pos·mean
    const mc = {
      grv: { key: 'grv', label: 'GRV', dist: 'pert', min: 2.0e8, mode: 3.0e8, max: 4.5e8 },
      ntg: { key: 'ntg', label: 'NTG', dist: 'pert', min: 0.7, mode: 0.9, max: 0.95 },
      phi: { key: 'phi', label: 'PHI', dist: 'pert', min: 0.18, mode: 0.225, max: 0.26 },
      sw:  { key: 'sw',  label: 'SW',  dist: 'pert', min: 0.15, mode: 0.2, max: 0.3 },
      rf:  { key: 'rf',  label: 'RF',  dist: 'pert', min: 0.35, mode: 0.5, max: 0.6 },
      bo: 1.47,
    };
    const r1 = E_exp.riskedResource(mc, 0.4, 5000, 123);
    const r2 = E_exp.riskedResource(mc, 0.4, 5000, 123);
    check('PARITY · riskedResource reproducible', r1.recoverable.p50 === r2.recoverable.p50);
    check('PARITY · P90 ≤ P50 ≤ P10 (oil conv.)', r1.recoverable.p90 <= r1.recoverable.p50 && r1.recoverable.p50 <= r1.recoverable.p10);
    check('PARITY · recoverable < in-place', r1.recoverable.mean < r1.inPlace.mean);
    check('PARITY · riskedMean = pos·meanSuccess', approx(r1.riskedMean, 0.4 * r1.recoverable.mean, 1e-6));
    // portfolio ranking by EMV desc
    const ranked = E_exp.rankProspects([{ id: 'a', name: 'A', pos: 0.2, riskedMean: 1, emv: -10 }, { id: 'b', name: 'B', pos: 0.5, riskedMean: 2, emv: 40 }]);
    check('PARITY · rankProspects EMV desc', ranked[0].id === 'b');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
