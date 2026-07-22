// S4 SIMULATOR-KERNEL truth-lock (Fable). Independent reference implementations of
// the shared pressure kernel (TPFA transmissibility, Peaceman well index, CG solve
// of the single-phase incompressible pressure equation), PVT (Bo/Rs/Bg, Volve
// undersaturated), and Corey rock-fluid. Asserted against analytic identities
// (1D linear flow, flux continuity, harmonic averaging, mass balance,
// Buckley-Leverett fractional flow). These reference fns ARE the spec: Opus ports
// them 1:1 into src/engine/sim/{pressure,pvt,relperm}.ts; the PARITY block
// (existsSync-guarded) confirms the built engine reproduces them.
// Run: node scripts/test-sim.mjs   (exits nonzero on any failure)
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE — pressure kernel (the LOCKED spec)
// ═══════════════════════════════════════════════════════════════════════════════

// ── TPFA half-transmissibility + face transmissibility (harmonic) ──────────────
// half-trans of a cell toward a face: T_h = k·A / d  (d = centre→face distance)
// face trans between two cells: harmonic combination of the two half-trans.
function halfTrans(k, A, d) { return k * A / d; }
function faceTrans(kA, kB, A, dA, dB) { const ta = halfTrans(kA, A, dA), tb = halfTrans(kB, A, dB); return (ta * tb) / (ta + tb); }

// ── Peaceman well model ────────────────────────────────────────────────────────
function peacemanR0(dx, dy) { return 0.14 * Math.sqrt(dx * dx + dy * dy); }        // rectangular
function peacemanR0Square(dx) { return 0.2 * dx; }                                  // square (isotropic)
function wellIndex(k, h, r0, rw, skin = 0) { return (2 * Math.PI * k * h) / (Math.log(r0 / rw) + skin); }

// ── conjugate gradient (SPD, matrix-free) ──────────────────────────────────────
function cg(apply, b, tol = 1e-10, maxit = 5000) {
  const n = b.length, x = new Float64Array(n);
  let r = b.slice(), p = b.slice();
  let rs = dot(r, r); const bnorm = Math.sqrt(dot(b, b)) || 1;
  for (let it = 0; it < maxit; it++) {
    const Ap = apply(p);
    const alpha = rs / dot(p, Ap);
    for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i]; }
    const rsNew = dot(r, r);
    if (Math.sqrt(rsNew) / bnorm < tol) break;
    const beta = rsNew / rs;
    for (let i = 0; i < n; i++) p[i] = r[i] + beta * p[i];
    rs = rsNew;
  }
  return x;
}
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

// ── single-phase incompressible TPFA pressure solve on a structured 2D grid ────
// wells: [{i,j, mode:'bhp'|'rate', bhp?, rate?, WI?}]. Returns {p, wellRate, faceFluxX}.
function solvePressure({ nx, ny, dx, dy, dz, k, mu, wells }) {
  const N = nx * ny; const A = dy * dz, Ay = dx * dz;
  const id = (i, j) => j * nx + i;
  // face transmissibilities (÷mu folded into apply)
  const Tx = new Float64Array((nx - 1) * ny), Ty = new Float64Array(nx * (ny - 1));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) Tx[j * (nx - 1) + i] = faceTrans(k[id(i, j)], k[id(i + 1, j)], A, dx / 2, dx / 2);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) Ty[j * nx + i] = faceTrans(k[id(i, j)], k[id(i, j + 1)], Ay, dy / 2, dy / 2);
  // well diag/rhs contributions
  const wDiag = new Float64Array(N), wRhs = new Float64Array(N);
  for (const w of wells) { const c = id(w.i, w.j); if (w.mode === 'bhp') { const wi = w.WI / mu; wDiag[c] += wi; wRhs[c] += wi * w.bhp; } else { wRhs[c] += w.rate; } }
  const apply = (x) => {
    const y = new Float64Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = id(i, j); let diag = wDiag[c], acc = 0;
      if (i < nx - 1) { const t = Tx[j * (nx - 1) + i] / mu; diag += t; acc -= t * x[id(i + 1, j)]; }
      if (i > 0) { const t = Tx[j * (nx - 1) + i - 1] / mu; diag += t; acc -= t * x[id(i - 1, j)]; }
      if (j < ny - 1) { const t = Ty[j * nx + i] / mu; diag += t; acc -= t * x[id(i, j + 1)]; }
      if (j > 0) { const t = Ty[(j - 1) * nx + i] / mu; diag += t; acc -= t * x[id(i, j - 1)]; }
      y[c] = diag * x[c] + acc;
    }
    return y;
  };
  const p = cg(apply, wRhs);
  // well rates: producer BHP → q = WI/mu·(p−bhp) (positive = production out)
  const wellRate = wells.map((w) => { const c = id(w.i, w.j); return w.mode === 'bhp' ? (w.WI / mu) * (p[c] - w.bhp) : -w.rate; });
  // interior x-face flux from i→i+1 = Tx/mu·(p_i − p_{i+1})
  const faceFluxX = (i, j) => Tx[j * (nx - 1) + i] / mu * (p[id(i, j)] - p[id(i + 1, j)]);
  return { p, wellRate, faceFluxX };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE — PVT (black-oil). Volve anchors: undersaturated, Pb≈213 bar,
// Rsb≈160 Sm³/Sm³, Bob≈1.47, Pi≈330 bara.
// ═══════════════════════════════════════════════════════════════════════════════
// undersaturated Bo above bubble point: Bo = Bob·exp(−co·(p−pb))
function boUndersat(p, pb, bob, co) { return bob * Math.exp(-co * (p - pb)); }
// solution GOR: below pb increases with p (linear screening), above pb constant = Rsb
function rs(p, pb, rsb) { return p >= pb ? rsb : rsb * (p / pb); }
// gas FVF (real gas, metric rm³/Sm³): Bg = Zsc·psc/Tsc · Z·T/p ≈ (T[K]/p[bara])·(Z·0.003466)
function bg(p, T, Z) { return 0.003466 * Z * T / p; }
// per-cell saturation state
function saturationState(p, pb) { return p >= pb ? 'undersaturated' : 'saturated'; }

// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE — Corey rock-fluid + fractional flow
// ═══════════════════════════════════════════════════════════════════════════════
function coreyKr(sw, e) { // e = {swc, sor, krwMax, kroMax, nw, no}
  const se = (sw - e.swc) / (1 - e.swc - e.sor);
  const s = Math.max(0, Math.min(1, se));
  return { krw: e.krwMax * s ** e.nw, kro: e.kroMax * (1 - s) ** e.no };
}
function fracFlowW(sw, e, muw, muo) { const { krw, kro } = coreyKr(sw, e); const mw = krw / muw, mo = kro / muo; return (mw + mo) === 0 ? 0 : mw / (mw + mo); }

// ── Buckley-Leverett / Welge tangent (analytic 1D waterflood) ──────────────────
// shock-front saturation = argmax of the secant slope fw(Sw)/(Sw−Swc) from Swc;
// at the tangent point fw'(Swf) == that secant. Returns {swf, fwf, dfwf, swBar, btPVI}.
function welge(e, muw, muo) {
  const lo = e.swc, hi = 1 - e.sor; let best = lo + 1e-4, bestSlope = -1;
  for (let s = lo + 1e-4; s < hi; s += 1e-4) { const slope = fracFlowW(s, e, muw, muo) / (s - lo); if (slope > bestSlope) { bestSlope = slope; best = s; } }
  const swf = best, fwf = fracFlowW(swf, e, muw, muo);
  const h = 1e-4, dfwf = (fracFlowW(swf + h, e, muw, muo) - fracFlowW(swf - h, e, muw, muo)) / (2 * h);
  const swBar = swf + (1 - fwf) / dfwf;   // Welge average behind the front
  return { swf, fwf, dfwf, swBar, btPVI: 1 / dfwf };
}

console.log('\n=== S4 simulator kernel truth-lock ===');

// 1 · TPFA transmissibility
{
  check('half-trans T=k·A/d', approx(halfTrans(100, 50, 5), 1000, 1e-9));
  check('faceTrans homogeneous == k·A/dx (centre distance)', approx(faceTrans(100, 100, 50, 5, 5), 100 * 50 / 10, 1e-9), `T=${faceTrans(100, 100, 50, 5, 5)}`);
  // heterogeneous: harmonic — dominated by the low-k block
  const t = faceTrans(1, 1000, 50, 5, 5), tLow = faceTrans(1, 1, 50, 5, 5);
  check('faceTrans heterogeneous ≈ harmonic (≈2× the low-k limit)', t > tLow && t < 2.001 * tLow, `T(1,1000)=${t.toFixed(3)} 2·T(1,1)=${(2 * tLow).toFixed(3)}`);
}

// 2 · Peaceman
{
  check('Peaceman r0 rectangular 0.14·√(dx²+dy²)', approx(peacemanR0(100, 100), 0.14 * Math.sqrt(2e4), 1e-9), `r0=${peacemanR0(100, 100).toFixed(2)}`);
  check('Peaceman r0 square 0.2·dx', approx(peacemanR0Square(100), 20, 1e-9));
  const wi = wellIndex(100, 10, 14, 0.1, 0); // r0=14, rw=0.1
  check('well index 2πkh/(ln(r0/rw)+s) > 0', wi > 0 && approx(wi, 2 * Math.PI * 100 * 10 / Math.log(14 / 0.1), 1e-6), `WI=${wi.toFixed(1)}`);
  check('skin increases resistance → lowers WI', wellIndex(100, 10, 14, 0.1, 5) < wi);
}

// 3 · CG solver on a known SPD system (1D Poisson, Dirichlet via strong wells)
{
  // -u'' = 0 on [0,1], u(0)=0,u(1)=1 → linear u(x)=x. Model as 1D grid, end BHP wells.
  const nx = 21, dx = 1 / (nx - 1);
  const wells = [{ i: 0, j: 0, mode: 'bhp', bhp: 0, WI: 1e6 }, { i: nx - 1, j: 0, mode: 'bhp', bhp: 1, WI: 1e6 }];
  const { p } = solvePressure({ nx, ny: 1, dx, dy: 1, dz: 1, k: new Float64Array(nx).fill(1), mu: 1, wells });
  let maxErr = 0; for (let i = 0; i < nx; i++) maxErr = Math.max(maxErr, Math.abs(p[i] - i * dx));
  check('CG solves 1D linear pressure profile (u=x)', maxErr < 1e-4, `maxErr=${maxErr.toExponential(2)}`);
}

// 4 · 1D incompressible: flux continuity (every interior face carries the injection rate)
{
  const nx = 12;
  const wells = [{ i: 0, j: 0, mode: 'rate', rate: 5 }, { i: nx - 1, j: 0, mode: 'bhp', bhp: 100, WI: 1e6 }];
  const sol = solvePressure({ nx, ny: 1, dx: 10, dy: 10, dz: 10, k: new Float64Array(nx).fill(100), mu: 2, wells });
  let uniform = true; const f0 = sol.faceFluxX(0, 0);
  for (let i = 1; i < nx - 1; i++) if (!approx(sol.faceFluxX(i, 0), f0, 1e-6)) uniform = false;
  check('1D flux continuity (every interior face == injection rate)', uniform && approx(f0, 5, 1e-4), `faceFlux=${f0.toFixed(4)} inj=5`);
  check('1D homogeneous → linear pressure (constant gradient)', approx(sol.p[1] - sol.p[0], sol.p[5] - sol.p[4], 1e-6));
  // mass balance: producer rate == −injection
  check('mass balance producer rate ≈ −injection', approx(sol.wellRate[1], 5, 1e-3), `qProd=${sol.wellRate[1].toFixed(3)}`);
}

// 5 · heterogeneous 1D: flux still uniform; larger Δp across the low-k block
{
  const nx = 6; const k = Float64Array.from([100, 100, 100, 10, 100, 100]); // one tight block (i=3)
  const wells = [{ i: 0, j: 0, mode: 'rate', rate: 3 }, { i: nx - 1, j: 0, mode: 'bhp', bhp: 50, WI: 1e6 }];
  const sol = solvePressure({ nx, ny: 1, dx: 10, dy: 10, dz: 10, k, mu: 1, wells });
  check('hetero 1D flux continuity preserved', approx(sol.faceFluxX(0, 0), sol.faceFluxX(3, 0), 1e-6), `f0=${sol.faceFluxX(0, 0).toFixed(4)} f3=${sol.faceFluxX(3, 0).toFixed(4)}`);
  const dpTight = sol.p[3] - sol.p[4], dpOpen = sol.p[1] - sol.p[2];
  check('hetero 1D: Δp larger across the tight block', dpTight > 5 * dpOpen, `Δp_tight=${dpTight.toFixed(3)} Δp_open=${dpOpen.toFixed(3)}`);
}

// 6 · 2D quarter five-spot: injector rate ↔ producer BHP mass balance
{
  const nx = 15, ny = 15;
  const wells = [{ i: 0, j: 0, mode: 'rate', rate: 20 }, { i: nx - 1, j: ny - 1, mode: 'bhp', bhp: 200, WI: 1e5 }];
  const sol = solvePressure({ nx, ny, dx: 30, dy: 30, dz: 15, k: new Float64Array(nx * ny).fill(200), mu: 1, wells });
  check('five-spot mass balance (producer ≈ −injector)', approx(sol.wellRate[1], 20, 1e-2), `qProd=${sol.wellRate[1].toFixed(3)} inj=20`);
  check('five-spot: injector cell is the pressure max', sol.p[0] === Math.max(...sol.p), `pInj=${sol.p[0].toFixed(1)}`);
}

// 7 · PVT (Volve undersaturated)
{
  const pb = 213, rsb = 160, bob = 1.47, co = 1.2e-4;
  check('Bo at bubble point == Bob', approx(boUndersat(pb, pb, bob, co), bob, 1e-12));
  check('Bo decreases above Pb (oil compresses)', boUndersat(330, pb, bob, co) < bob, `Bo(330)=${boUndersat(330, pb, bob, co).toFixed(4)}`);
  check('Rs constant = Rsb above Pb (undersaturated — Volve)', rs(330, pb, rsb) === rsb && rs(250, pb, rsb) === rsb);
  check('Rs decreases below Pb (gas evolves)', rs(100, pb, rsb) < rsb, `Rs(100)=${rs(100, pb, rsb).toFixed(1)}`);
  check('Bg inversely ∝ p', approx(bg(400, 380, 0.9), bg(200, 380, 0.9) / 2, 1e-9));
  check('saturation state switches at Pb', saturationState(330, pb) === 'undersaturated' && saturationState(150, pb) === 'saturated');
}

// 8 · Corey rock-fluid + fractional flow
{
  const e = { swc: 0.15, sor: 0.25, krwMax: 0.4, kroMax: 0.9, nw: 3, no: 2 };
  const atSwc = coreyKr(e.swc, e), atMax = coreyKr(1 - e.sor, e);
  check('Corey endpoints: krw(Swc)=0, kro(Swc)=kroMax', approx(atSwc.krw, 0, 1e-12) && approx(atSwc.kro, e.kroMax, 1e-12));
  check('Corey endpoints: kro(1−Sor)=0, krw(1−Sor)=krwMax', approx(atMax.kro, 0, 1e-12) && approx(atMax.krw, e.krwMax, 1e-12));
  const a = coreyKr(0.3, e), b = coreyKr(0.5, e);
  check('krw ↑ and kro ↓ with Sw (monotone)', b.krw > a.krw && b.kro < a.kro);
  check('fractional flow fw(Swc)=0, fw(1−Sor)=1', approx(fracFlowW(e.swc, e, 0.5, 2), 0, 1e-9) && approx(fracFlowW(1 - e.sor, e, 0.5, 2), 1, 1e-9));
  check('fw monotone increasing (S-shaped)', fracFlowW(0.5, e, 0.5, 2) > fracFlowW(0.3, e, 0.5, 2) && fracFlowW(0.3, e, 0.5, 2) > fracFlowW(0.2, e, 0.5, 2));
}

// 9 · Buckley-Leverett / Welge analytic (1D waterflood)
{
  const e = { swc: 0.15, sor: 0.2, krwMax: 0.35, kroMax: 0.9, nw: 3, no: 2 };
  const w = welge(e, 0.5, 3);
  check('Welge shock saturation in (Swc, 1−Sor)', w.swf > e.swc && w.swf < 1 - e.sor, `Swf=${w.swf.toFixed(3)}`);
  // tangent condition: fw'(Swf) ≈ fw(Swf)/(Swf−Swc)
  const secant = w.fwf / (w.swf - e.swc);
  check('Welge tangent: fw′(Swf) ≈ secant from Swc', approx(w.dfwf, secant, 0.02), `fw′=${w.dfwf.toFixed(3)} secant=${secant.toFixed(3)}`);
  check('Welge average behind front Sw̄ > Swf', w.swBar > w.swf && w.swBar <= 1 - e.sor + 1e-6, `Sw̄=${w.swBar.toFixed(3)}`);
  check('breakthrough PVI = 1/fw′(Swf) < 1', w.btPVI > 0 && w.btPVI < 1, `btPVI=${w.btPVI.toFixed(3)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARITY: once Opus builds src/engine/sim/{pressure,pvt,relperm}.ts, confirm the
// engine reproduces every reference number. Skipped until the modules exist.
// ═══════════════════════════════════════════════════════════════════════════════
if (existsSync(join(__dirname, '..', 'src', 'engine', 'sim', 'pressure.ts'))) {
  const P = await import('../src/engine/sim/pressure.ts');
  const V = await import('../src/engine/sim/pvt.ts');
  const R = await import('../src/engine/sim/relperm.ts');
  check('PARITY · faceTrans', approx(P.faceTrans(1, 1000, 50, 5, 5), faceTrans(1, 1000, 50, 5, 5), 1e-9));
  check('PARITY · wellIndex', approx(P.wellIndex(100, 10, 14, 0.1, 0), wellIndex(100, 10, 14, 0.1, 0), 1e-6));
  {
    const nx = 12;
    const wells = [{ i: 0, j: 0, mode: 'rate', rate: 5 }, { i: nx - 1, j: 0, mode: 'bhp', bhp: 100, WI: 1e6 }];
    const cfg = { nx, ny: 1, dx: 10, dy: 10, dz: 10, k: new Float64Array(nx).fill(100), mu: 2, wells };
    const eng = P.solvePressure(cfg); const ref = solvePressure(cfg);
    let same = true; for (let i = 0; i < nx; i++) if (!approx(eng.p[i], ref.p[i], 1e-6)) same = false;
    check('PARITY · solvePressure 1D identical', same);
  }
  const e = { swc: 0.15, sor: 0.25, krwMax: 0.4, kroMax: 0.9, nw: 3, no: 2 };
  check('PARITY · Corey kr', approx(R.coreyKr(0.4, e).krw, coreyKr(0.4, e).krw, 1e-12));
  check('PARITY · Bo undersaturated', approx(V.boUndersat(330, 213, 1.47, 1.2e-4), boUndersat(330, 213, 1.47, 1.2e-4), 1e-12));

  // ── S5 FV oil-water: validate vs Buckley-Leverett/Welge + exact mass balance ──
  if (existsSync(join(__dirname, '..', 'src', 'engine', 'sim', 'fv.ts'))) {
    const FV = await import('../src/engine/sim/fv.ts');
    const ec = { swc: 0.15, sor: 0.2, krwMax: 0.35, kroMax: 0.9, nw: 3, no: 2 };
    const muw = 0.5, muo = 3;
    const nx = 100;
    const phi = new Float64Array(nx).fill(0.2), k = new Float64Array(nx).fill(200);
    const Vcell = 10 * 10 * 10, pv = 0.2 * Vcell * nx;
    const wells = [{ i: 0, j: 0, mode: 'rate', rate: pv }, { i: nx - 1, j: 0, mode: 'bhp', bhp: 100, WI: 1e6 }]; // 1 PVI / unit time
    const res = FV.simulateFV({ nx, ny: 1, dx: 10, dy: 10, dz: 10, phi, k, muw, muo, corey: ec, wells }, { tEnd: 1.2, nReports: 60, cfl: 0.3 });
    const last = res.snapshots[res.snapshots.length - 1];
    // exact water mass balance: injected = ΔWIP_water + produced water
    let wip0 = 0, wipN = 0; const first = res.snapshots[0];
    for (let i = 0; i < nx; i++) { wip0 += phi[i] * Vcell * first.sw[i]; wipN += phi[i] * Vcell * last.sw[i]; }
    const injected = pv * last.t;
    check('FV water mass balance (injected = ΔWIP + produced)', approx(injected, (wipN - wip0) + last.cumWater, injected * 1e-6), `inj=${injected.toFixed(1)} ΔWIP+prod=${((wipN - wip0) + last.cumWater).toFixed(1)}`);
    // saturation front monotone decreasing from injector (before full sweep)
    const mid = res.snapshots[Math.floor(res.snapshots.length * 0.35)];
    let mono = true; for (let i = 1; i < nx; i++) if (mid.sw[i] > mid.sw[i - 1] + 1e-9) mono = false;
    check('FV Buckley-Leverett front monotone (injector→producer)', mono);
    // breakthrough (water cut > 1%) before 1 PVI, near the Welge prediction
    const wl = welge(ec, muw, muo);
    const bt = res.snapshots.find((s) => s.waterCut > 0.01);
    check('FV breakthrough before 1 PVI, ≈ Welge (numerical diffusion → early)', !!bt && bt.pvi > 0.4 * wl.btPVI && bt.pvi < wl.btPVI + 0.1, `btPVI=${bt ? bt.pvi.toFixed(3) : 'none'} Welge=${wl.btPVI.toFixed(3)}`);
    // recovery grows monotonically and is plausible at 1.2 PVI
    let recMono = true; for (let s = 1; s < res.snapshots.length; s++) if (res.snapshots[s].cumOil < res.snapshots[s - 1].cumOil - 1e-9) recMono = false;
    const rf = last.cumOil / res.ooip;
    check('FV oil recovery monotone & plausible (RF 0.4–0.8 @1.2PVI)', recMono && rf > 0.4 && rf < 0.8, `RF=${(rf * 100).toFixed(1)}%`);
    // 2D quarter five-spot: mass balance + breakthrough
    const n2 = 25; const N2 = n2 * n2;
    const res2 = FV.simulateFV({ nx: n2, ny: n2, dx: 20, dy: 20, dz: 12, phi: new Float64Array(N2).fill(0.22), k: new Float64Array(N2).fill(300), muw, muo, corey: ec,
      wells: [{ i: 0, j: 0, mode: 'rate', rate: 0.22 * 20 * 20 * 12 * N2 }, { i: n2 - 1, j: n2 - 1, mode: 'bhp', bhp: 150, WI: 1e5 }] }, { tEnd: 1.0, nReports: 30, cfl: 0.3 });
    const l2 = res2.snapshots[res2.snapshots.length - 1];
    let wip20 = 0, wip2N = 0; const f2 = res2.snapshots[0];
    for (let c = 0; c < N2; c++) { wip20 += 0.22 * (20 * 20 * 12) * f2.sw[c]; wip2N += 0.22 * (20 * 20 * 12) * l2.sw[c]; }
    const inj2 = (0.22 * 20 * 20 * 12 * N2) * l2.t;
    check('FV five-spot water mass balance', approx(inj2, (wip2N - wip20) + l2.cumWater, inj2 * 1e-5), `Δ=${(inj2 - ((wip2N - wip20) + l2.cumWater)).toExponential(1)}`);
    check('FV five-spot: water breaks through, oil recovered', l2.waterCut > 0 && l2.cumOil > 0 && l2.cumOil / res2.ooip > 0.2, `RF=${(100 * l2.cumOil / res2.ooip).toFixed(1)}% WC=${(l2.waterCut * 100).toFixed(0)}%`);
  } else {
    console.log('SKIP  FV oil-water — src/engine/sim/fv.ts not built yet');
  }
} else {
  console.log('SKIP  engine parity — src/engine/sim/pressure.ts not built yet (Opus S4 impl)');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
