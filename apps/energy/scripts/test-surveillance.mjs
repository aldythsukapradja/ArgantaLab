// R1 SURVEILLANCE-ENGINE truth-lock (Fable). Independent reference implementations of
// the Reservoir-Management surveillance math — VRR (voidage replacement ratio), Hall
// injectivity, water-cut/GOR, robust baseline + exception detection, health roll-up —
// asserted against analytic identities. Plus a REAL-DATA gate: the field VRR computed
// from the built public/wb/prod-field.json must reproduce Volve's pressure-maintained
// waterflood (VRR ≈ 1). The PARITY block (existsSync-guarded) confirms the built
// src/engine/surveillance.ts reproduces every reference value.
// Run: node scripts/test-surveillance.mjs   (exits nonzero on any failure)
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE — the LOCKED spec (independent of the built engine)
// ═══════════════════════════════════════════════════════════════════════════════
const V = { Bo: 1.47, Bw: 1.03, Bg: 0 };
const vProd = (m, v = V) => v.Bo * m.oil + v.Bw * m.water + v.Bg * (m.gasFree ?? 0);
const vInj = (m, v = V) => v.Bw * m.wi + v.Bg * (m.gi ?? 0);
const vrrRef = (m, v = V) => { const o = vProd(m, v); return o > 0 ? vInj(m, v) / o : 0; };
function cumVrrRef(rows, v = V) { const cum = []; let ci = 0, co = 0; for (const m of rows) { ci += vInj(m, v); co += vProd(m, v); cum.push(co > 0 ? ci / co : 0); } return cum; }
const cumSumRef = (x) => { const o = []; let s = 0; for (const v of x) { s += v; o.push(s); } return o; };
function lsqSlopeRef(x, y) { const n = Math.min(x.length, y.length); if (n < 2) return 0; let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; } const mx = sx / n, my = sy / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; } return sxx > 1e-12 ? sxy / sxx : 0; }
const medianRef = (a) => { if (!a.length) return 0; const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function movMedRef(series, win = 7) { const n = series.length, half = Math.max(1, Math.floor(win / 2)), out = new Array(n); for (let i = 0; i < n; i++) { const lo = Math.max(0, i - half), hi = Math.min(n - 1, i + half); out[i] = medianRef(series.slice(lo, hi + 1)); } return out; }
function detectRef(series, opts = {}) {
  const n = series.length; if (n === 0) return [];
  const win = opts.win ?? 7, k = opts.k ?? 3, floorFrac = opts.floorFrac ?? 0.005, h = opts.h ?? 5, slack = opts.slack ?? 0.5;
  const R = Math.max(3, Math.min(opts.ref ?? Math.ceil(n / 4), n));
  const refSlice = series.slice(0, R), mu0 = medianRef(refSlice);
  const floor = floorFrac * Math.max(1e-9, Math.abs(mu0) || medianRef(series.map((x) => Math.abs(x))));
  let sigma = 1.4826 * medianRef(refSlice.map((x) => Math.abs(x - mu0))); if (!(sigma > floor)) sigma = floor;
  const flags = new Map();
  const set = (i, z) => { const p = flags.get(i); if (!p || Math.abs(z) > Math.abs(p.z)) flags.set(i, { i, z: Math.round(z * 100) / 100 }); };
  const base = movMedRef(series, win);
  for (let i = 0; i < n; i++) { const z = (series[i] - base[i]) / sigma; if (Math.abs(z) >= k) set(i, z); }
  let sp = 0, sm = 0, spOn = false, smOn = false;
  for (let i = 0; i < n; i++) { const d = (series[i] - mu0) / sigma; sp = Math.max(0, sp + d - slack); sm = Math.max(0, sm - d - slack); if (sp >= h) { if (!spOn) set(i, sp); spOn = true; } else spOn = false; if (sm >= h) { if (!smOn) set(i, -sm); smOn = true; } else smOn = false; }
  return [...flags.values()].sort((a, b) => a.i - b.i);
}
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const healthRef = ({ wct = 0, uptime = 1, declineRate = 0 }) => Math.round(clamp01(0.45 * (1 - clamp01(wct)) + 0.35 * clamp01(uptime) + 0.20 * (1 - clamp01(declineRate))) * 1000) / 10;

// ── 1 · VRR identities ──────────────────────────────────────────────────────
{
  // with unit FVFs, VRR reduces to wi/(oil+water)
  const m = { oil: 100, water: 50, wi: 210 };
  check('VRR: unit FVFs → wi/(oil+water)', approx(vrrRef(m, { Bo: 1, Bw: 1, Bg: 0 }), 210 / 150, 1e-12), (210 / 150).toFixed(3));
  // exact voidage balance ⇒ VRR = 1
  const bal = { oil: 100, water: 40 };
  const wiBal = (V.Bo * bal.oil + V.Bw * bal.water) / V.Bw;   // choose wi to replace exactly
  check('VRR: reservoir-voidage balance → exactly 1', approx(vrrRef({ ...bal, wi: wiBal }), 1, 1e-12));
  // monotone in injection
  check('VRR: strictly increases with injection', vrrRef({ oil: 100, water: 40, wi: 200 }) > vrrRef({ oil: 100, water: 40, wi: 150 }));
  // no production → guarded 0
  check('VRR: no offtake → 0 (guarded)', vrrRef({ oil: 0, water: 0, wi: 100 }) === 0);
  // cumulative VRR final equals total-injected/total-produced voidage
  const rows = [{ oil: 50, water: 10, wi: 30 }, { oil: 40, water: 30, wi: 90 }, { oil: 30, water: 60, wi: 140 }];
  const cum = cumVrrRef(rows);
  const totV = rows.reduce((a, m) => a + vInj(m), 0) / rows.reduce((a, m) => a + vProd(m), 0);
  check('VRR: cumulative final = ΣVinj/ΣVprod', approx(cum[cum.length - 1], totV, 1e-12), totV.toFixed(3));
  // pattern VRR spanning all wells == field VRR
  const patt = rows.reduce((a, m) => a + vInj(m), 0) / rows.reduce((a, m) => a + vProd(m), 0);
  check('VRR: pattern spanning all wells = field VRR', approx(patt, totV, 1e-12));
}

// ── 2 · Hall injectivity ────────────────────────────────────────────────────
{
  // constant Δp and constant rate → cumPT linear in cumInj, slope = Δp/rate
  const n = 12, dp = Array(n).fill(20), wi = Array(n).fill(500);
  const cumPT = cumSumRef(dp), cumInj = cumSumRef(wi);
  const slope = lsqSlopeRef(cumInj, cumPT);
  check('Hall: constant injectivity → constant slope Δp/rate', approx(slope, 20 / 500, 1e-9), slope.toExponential(3));
  // r² ≈ 1 (perfectly linear)
  const my = cumPT.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0, ssRes = 0; const b0 = my - slope * (cumInj.reduce((a, c) => a + c, 0) / n);
  for (let i = 0; i < n; i++) { ssTot += (cumPT[i] - my) ** 2; ssRes += (cumPT[i] - (b0 + slope * cumInj[i])) ** 2; }
  check('Hall: constant-injectivity fit is linear (r²≈1)', 1 - ssRes / ssTot > 0.999);
  // injectivity LOSS: Δp rises at fixed rate → later slope steeper than early slope
  const dp2 = Array.from({ length: n }, (_, i) => 20 + i * 4);
  const cp2 = cumSumRef(dp2), ci2 = cumSumRef(wi);
  const early = lsqSlopeRef(ci2.slice(0, 4), cp2.slice(0, 4)), late = lsqSlopeRef(ci2.slice(-4), cp2.slice(-4));
  check('Hall: injectivity loss → slope steepens over time', late > early * 1.5, `early=${early.toExponential(2)} late=${late.toExponential(2)}`);
}

// ── 3 · diagnostics ─────────────────────────────────────────────────────────
{
  check('water cut = water/(oil+water)', approx(30 / (70 + 30), 0.3, 1e-12));
  check('water cut: no fluids → 0 (guarded)', (0 + 0) === 0);
  check('GOR = gas/oil', approx(160000 / 1000, 160, 1e-9));
  check('GOR: no oil → 0 (guarded)', gorGuard(5000, 0) === 0);
}
function gorGuard(gas, oil) { return oil > 0 ? gas / oil : 0; }

// ── 4 · robust baseline + exception detection ───────────────────────────────
{
  // constant series → baseline equals it, zero exceptions
  const flat = Array(30).fill(100);
  check('baseline: constant series unchanged', movMedRef(flat).every((v) => v === 100));
  check('exceptions: constant series → none', detectRef(flat).length === 0);
  // deterministic small noise (±2, sawtooth) → no false alarms at k=3
  const noisy = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 ? 2 : -2));
  check('exceptions: small deterministic noise → no false alarms', detectRef(noisy).length === 0, `flags=${detectRef(noisy).length}`);
  // single spike → flagged, at the spike index
  const spike = Array(30).fill(100); spike[15] = 300;
  const es = detectRef(spike);
  check('exceptions: isolated spike flagged at its index', es.some((e) => e.i === 15 && e.z > 0), `n=${es.length}`);
  // median baseline is robust — a lone spike barely moves the baseline
  check('baseline: robust to a lone spike (≤1% shift at spike)', Math.abs(movMedRef(spike)[15] - 100) <= 1);
  // step change → at least one exception near the step (CUSUM catches the sustained shift)
  const step = [...Array(20).fill(100), ...Array(20).fill(160)];
  const est = detectRef(step);
  check('exceptions: step change detected near transition', est.some((e) => e.i >= 17 && e.i <= 23), `flags at ${est.map((e) => e.i).join(',')}`);
}

// ── 5 · health roll-up monotonicity ─────────────────────────────────────────
{
  check('health: ↓ with water cut', healthRef({ wct: 0.2, uptime: 0.9 }) > healthRef({ wct: 0.8, uptime: 0.9 }));
  check('health: ↑ with uptime', healthRef({ wct: 0.4, uptime: 0.95 }) > healthRef({ wct: 0.4, uptime: 0.5 }));
  check('health: ↓ with decline rate', healthRef({ wct: 0.4, uptime: 0.9, declineRate: 0.1 }) > healthRef({ wct: 0.4, uptime: 0.9, declineRate: 0.6 }));
  check('health: bounded 0..100', healthRef({ wct: 1, uptime: 0, declineRate: 1 }) >= 0 && healthRef({ wct: 0, uptime: 1, declineRate: 0 }) <= 100);
}

// ── 6 · R1.5 diagnostics — Chan / Tong / Ershaghi / Hall-deriv / trailing slope ──
function bourdetRef(x, y, L = 0.15) {
  const n = x.length, out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let j = i; while (j > 0 && x[i] - x[j] < L) j--;
    let k = i; while (k < n - 1 && x[k] - x[i] < L) k++;
    if (j === i) j = Math.max(0, i - 1); if (k === i) k = Math.min(n - 1, i + 1);
    const dxl = x[i] - x[j], dxr = x[k] - x[i];
    const dl = dxl > 0 ? (y[i] - y[j]) / dxl : 0, dr = dxr > 0 ? (y[k] - y[i]) / dxr : 0;
    out[i] = (dxl + dxr) > 0 ? (dl * dxr + dr * dxl) / (dxl + dxr) : 0;
  }
  return out;
}
function chanRef(times, y, L = 0.15) {
  const t = [], yy = [];
  for (let i = 0; i < times.length; i++) if (times[i] > 0 && Number.isFinite(y[i]) && y[i] > 0) { t.push(times[i]); yy.push(y[i]); }
  if (t.length < 3) return { slope: 0, mechanism: 'undetermined' };
  const lnt = t.map(Math.log), deriv = bourdetRef(lnt, yy, L), start = Math.floor(t.length * 0.6), lx = [], ly = [];
  for (let i = start; i < t.length; i++) if (deriv[i] > 0) { lx.push(lnt[i]); ly.push(Math.log(deriv[i])); }
  const slope = lx.length >= 2 ? lsqSlopeRef(lx, ly) : -1;
  return { slope: Math.round(slope * 100) / 100, mechanism: slope < 0.3 ? 'coning' : slope < 1.4 ? 'channeling' : 'multilayer' };
}
const meanRef = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const ershaghiXRef = (fw) => { const d = 1 - fw; return d > 1e-9 ? Math.log(1 / d) - 1 / d : NaN; };
{
  const times = Array.from({ length: 40 }, (_, i) => i + 1);
  // channeling: WOR ∝ t (unit late-slope)
  const chan = chanRef(times, times.map((t) => 0.5 * t));
  check('Chan: WOR∝t → channeling (late-slope≈1)', chan.mechanism === 'channeling', `slope=${chan.slope}`);
  // coning: WOR plateaus (exp approach) → late derivative collapses
  const con = chanRef(times, times.map((t) => 5 * (1 - Math.exp(-t / 8))));
  check('Chan: plateauing WOR → coning', con.mechanism === 'coning', `slope=${con.slope}`);
  // multilayer: WOR ∝ t² (steeper)
  const ml = chanRef(times, times.map((t) => 0.05 * t * t));
  check('Chan: WOR∝t² → multilayer', ml.mechanism === 'multilayer', `slope=${ml.slope}`);

  // Tong: synthetic Type-A water drive lg(Wp)=a0+b0·Np (physical params → fw crosses 0.5
  // mid-life, positive EUR at economic fw). Fit must recover the line + closed-form EUR.
  {
    const a0 = -1.0, b0 = 0.15;
    const np = Array.from({ length: 30 }, (_, i) => 2 + i * 1.0);
    const wp = np.map((x) => Math.pow(10, a0 + b0 * x));
    const fw = np.map((x) => { const wor = b0 * Math.LN10 * Math.pow(10, a0 + b0 * x); return wor / (1 + wor); });
    const worEc = 0.95 / 0.05, eurRef = (Math.log10(worEc / (b0 * Math.LN10)) - a0) / b0;
    const xs = [], ys = []; for (let i = 0; i < np.length; i++) if (fw[i] >= 0.5) { xs.push(np[i]); ys.push(Math.log10(wp[i])); }
    const b = lsqSlopeRef(xs, ys), a = meanRef(ys) - b * meanRef(xs);
    check('Tong: fit recovers water-drive line (a,b)', approx(a, a0, 1e-6) && approx(b, b0, 1e-9), `a=${a.toFixed(3)} b=${b.toFixed(4)}`);
    const eurNp = (Math.log10(worEc / (b * Math.LN10)) - a) / b;
    check('Tong: EUR at economic fw matches closed form & is positive', approx(eurNp, eurRef, 1e-6) && eurNp > 0, `EUR=${eurNp.toFixed(2)}`);
  }
  // Ershaghi X-plot: generate Np linear in X(fw) directly (his log-linear-relperm model),
  // over an UNDEVELOPED fw range 0.5–0.90, so extrapolation to fw=0.95 exceeds the data.
  {
    const m0 = -2.0, c0 = 5.0, N = 100;
    const fw = Array.from({ length: 20 }, (_, i) => 0.5 + i * (0.40 / 19));   // 0.50 … 0.90
    const X = fw.map(ershaghiXRef);
    const np = X.map((x) => m0 * x + c0);
    check('Ershaghi: Np monotonically increases with fw', np.every((v, i) => i === 0 || v > np[i - 1]));
    const m = lsqSlopeRef(X, np), c = meanRef(np) - m * meanRef(X);
    check('Ershaghi: fit recovers the X-plot line (m,c)', approx(m, m0, 1e-9) && approx(c, c0, 1e-9), `m=${m.toFixed(3)}`);
    const eurNp = m * ershaghiXRef(0.95) + c;
    check('Ershaghi: EUR extrapolated past the data', Number.isFinite(eurNp) && eurNp > Math.max(...np), `EUR=${eurNp.toFixed(1)} > ${Math.max(...np).toFixed(1)}`);
    check('Ershaghi: eurR = EUR/N', approx(eurNp / N, eurNp / N, 1e-12));
  }

  // Hall derivative: plugging (Δp rising) → trend>0; fracturing (Δp falling) → trend<0
  const wiRate = Array(20).fill(500), cumInj = cumSumRef(wiRate);
  const plug = cumSumRef(Array.from({ length: 20 }, (_, i) => (20 + i * 3) * 1));
  const frac = cumSumRef(Array.from({ length: 20 }, (_, i) => (80 - i * 3) * 1));
  const hd = (ci, cp, win = 4) => { const n = ci.length, s = new Array(n).fill(0); for (let i = 0; i < n; i++) { const lo = Math.max(0, i - win), hi = Math.min(n - 1, i + win); s[i] = lsqSlopeRef(ci.slice(lo, hi + 1), cp.slice(lo, hi + 1)); } return lsqSlopeRef(ci, s); };
  check('Hall-deriv: plugging (Δp↑) → trend > 0', hd(cumInj, plug) > 0);
  check('Hall-deriv: fracturing (Δp↓) → trend < 0', hd(cumInj, frac) < 0);

  // trailing slope / annualised percent
  const worExp = Array.from({ length: 24 }, (_, i) => 1.0 * Math.exp(0.02 * i));
  const tsRef = (() => { const xs = [], ys = []; for (let i = Math.max(0, worExp.length - 12); i < worExp.length; i++) { xs.push(xs.length); ys.push(Math.log(worExp[i])); } return lsqSlopeRef(xs, ys); })();
  check('trailingSlope recovers the monthly log-rate', approx(tsRef, 0.02, 1e-6), tsRef.toFixed(4));
  check('annualPct = (e^{12·slope}−1)·100', approx((Math.exp(tsRef * 12) - 1) * 100, (Math.exp(0.24) - 1) * 100, 1e-6));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-DATA GATE — Volve field VRR reproduces a pressure-maintained waterflood
// ═══════════════════════════════════════════════════════════════════════════════
{
  const fp = join(__dirname, '..', 'public', 'wb', 'prod-field.json');
  if (existsSync(fp)) {
    const field = JSON.parse(readFileSync(fp, 'utf8'));
    const cum = cumVrrRef(field.monthly);
    const finalVrr = cum[cum.length - 1];
    check('REAL Volve field VRR ≈ 1 (pressure-maintained waterflood)', finalVrr >= 0.9 && finalVrr <= 1.15, `VRR=${finalVrr.toFixed(3)}`);
    // BHP surveillance signal present + physical (producer flowing BHP 150–360 bara)
    const f12p = join(__dirname, '..', 'public', 'wb', 'prod-f-12.json');
    if (existsSync(f12p)) {
      const f12 = JSON.parse(readFileSync(f12p, 'utf8'));
      const bhps = f12.monthly.filter((m) => m.bhp != null).map((m) => m.bhp);
      check('REAL BHP series present + physical (F-12)', bhps.length > 10 && Math.min(...bhps) > 150 && Math.max(...bhps) < 360, `${bhps.length} months, ${Math.min(...bhps)}–${Math.max(...bhps)} bara`);
    } else check('REAL BHP series present (F-12)', false, 'prod-f-12.json missing');
  } else {
    console.log('SKIP  real-data VRR gate — public/wb/prod-field.json not built (run npm run data:wb)');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARITY — the built engine reproduces every reference value
// ═══════════════════════════════════════════════════════════════════════════════
if (existsSync(join(__dirname, '..', 'src', 'engine', 'surveillance.ts'))) {
  const S = await import('../src/engine/surveillance.ts');
  const m = { oil: 100, water: 40, wi: 200 };
  check('PARITY vrr', approx(S.vrr(m), vrrRef(m), 1e-12));
  const rows = [{ oil: 50, water: 10, wi: 30 }, { oil: 40, water: 30, wi: 90 }, { oil: 30, water: 60, wi: 140 }];
  check('PARITY cumulativeVrr.final', approx(S.cumulativeVrr(rows).final, cumVrrRef(rows).at(-1), 1e-12));
  // patternVrr over the SAME rows on both sides = ΣVinj/ΣVprod = field cumulative VRR
  check('PARITY patternVrr reduces to field VRR', approx(S.patternVrr(rows, rows), cumVrrRef(rows).at(-1), 1e-9));
  const dp = [20, 20, 20, 20], wi = [500, 500, 500, 500];
  check('PARITY hall.slope', approx(S.hall(dp, wi).slope, lsqSlopeRef(cumSumRef(wi), cumSumRef(dp)), 1e-9));
  check('PARITY waterCut', approx(S.waterCut(70, 30), 0.3, 1e-12));
  check('PARITY gor', approx(S.gor(160000, 1000), 160, 1e-9));
  const spike = Array(30).fill(100); spike[15] = 300;
  check('PARITY movingMedian', S.movingMedian(spike).every((v, i) => approx(v, movMedRef(spike)[i], 1e-9)));
  check('PARITY detectExceptions', S.detectExceptions(spike).map((e) => e.i).join(',') === detectRef(spike).map((e) => e.i).join(','));
  check('PARITY wellHealth', approx(S.wellHealth({ wct: 0.4, uptime: 0.9 }), healthRef({ wct: 0.4, uptime: 0.9 }), 1e-9));
  // R1.5 diagnostics parity
  const tms = Array.from({ length: 40 }, (_, i) => i + 1);
  check('PARITY chanDiagnostic (channeling)', S.chanDiagnostic(tms, tms.map((t) => 0.5 * t)).mechanism === chanRef(tms, tms.map((t) => 0.5 * t)).mechanism);
  check('PARITY chanWor mechanism', S.chanWor(tms, tms.map(() => 100), tms.map((t) => 5 * t)).mechanism === 'channeling');
  check('PARITY ershaghiX', approx(S.ershaghiX(0.9), ershaghiXRef(0.9), 1e-12));
  const npA = Array.from({ length: 30 }, (_, i) => 2 + i), wpA = npA.map((x) => Math.pow(10, 4 + 0.25 * x)), fwA = npA.map((x) => { const w = 0.25 * Math.LN10 * Math.pow(10, 4 + 0.25 * x); return w / (1 + w); });
  check('PARITY tongWaterDrive.b', approx(S.tongWaterDrive(npA, wpA, fwA, 100).b, 0.25, 1e-9));
  check('PARITY ershaghiXplot finite EUR', Number.isFinite(S.ershaghiXplot(npA, fwA, 100).eurNp));
  check('PARITY hallDerivative.trend sign', S.hallDerivative(cumSumRef(Array(20).fill(500)), cumSumRef(Array.from({ length: 20 }, (_, i) => 20 + i * 3))).trend > 0);
  const we = Array.from({ length: 24 }, (_, i) => Math.exp(0.02 * i));
  check('PARITY trailingSlope', approx(S.trailingSlope(we), 0.02, 1e-6));
  check('PARITY annualPct', approx(S.annualPct(we), (Math.exp(0.24) - 1) * 100, 1e-6));
} else {
  console.log('SKIP  surveillance engine not built');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
