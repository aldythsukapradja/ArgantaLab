// sim/fv.ts (S5) — finite-volume two-phase (oil-water) IMPES simulator. Builds on
// the shared S4 pressure kernel: solves the total-mobility-weighted pressure
// (implicit), then updates water saturation EXPLICITLY with upstream fractional
// flow under a CFL sub-step. Oil-water is the correct physics for undersaturated
// Volve (no free gas). Screening-grade, deterministic, mass-conservative. Pure TS.
//
// Validated in scripts/test-sim.mjs against the Buckley-Leverett/Welge analytic
// (front saturation, breakthrough, recovery) and exact water mass conservation.
import type { Well } from './pressure';
import type { CoreyEndpoints } from './relperm';

// Runtime helpers inlined (identical to sim/pressure.ts + relperm.ts — the Node TS
// loader can't resolve extensionless runtime cross-imports; parity-locked copies).
function halfTrans(k: number, A: number, d: number): number { return k * A / d; }
function faceTrans(kA: number, kB: number, A: number, dA: number, dB: number): number { const ta = halfTrans(kA, A, dA), tb = halfTrans(kB, A, dB); return (ta * tb) / (ta + tb); }
function dot(a: Float64Array, b: Float64Array): number { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
// Jacobi-preconditioned CG (diag = matrix diagonal) — same solution, far fewer
// iterations for the well-penalty-stiffened pressure system.
function cg(apply: (x: Float64Array) => Float64Array, b: Float64Array, diag: Float64Array, tol = 1e-10, maxit = 5000): Float64Array {
  const n = b.length, x = new Float64Array(n); const r = b.slice();
  const minv = (v: Float64Array) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = v[i] / (diag[i] || 1); return o; };
  let z = minv(r), p = z.slice(); let rz = dot(r, z); const bnorm = Math.sqrt(dot(b, b)) || 1;
  for (let it = 0; it < maxit; it++) {
    const Ap = apply(p); const alpha = rz / dot(p, Ap);
    for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i]; }
    if (Math.sqrt(dot(r, r)) / bnorm < tol) break;
    z = minv(r); const rzNew = dot(r, z); const beta = rzNew / rz;
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i]; rz = rzNew;
  }
  return x;
}
function coreyKr(sw: number, e: CoreyEndpoints): { krw: number; kro: number } { const se = (sw - e.swc) / (1 - e.swc - e.sor); const s = Math.max(0, Math.min(1, se)); return { krw: e.krwMax * s ** e.nw, kro: e.kroMax * (1 - s) ** e.no }; }
function fracFlowW(sw: number, e: CoreyEndpoints, muw: number, muo: number): number { const { krw, kro } = coreyKr(sw, e); const mw = krw / muw, mo = kro / muo; return (mw + mo) === 0 ? 0 : mw / (mw + mo); }

export interface FvCfg {
  nx: number; ny: number; dx: number; dy: number; dz: number;
  phi: ArrayLike<number>;      // porosity [nx*ny]
  k: ArrayLike<number>;        // permeability [nx*ny]
  muw: number; muo: number;    // viscosities
  corey: CoreyEndpoints;
  wells: Well[];               // rate injectors inject WATER; bhp producers
  swInit?: ArrayLike<number>;  // initial water saturation (default = Swc)
}
export interface FvSnapshot {
  t: number; pvi: number;      // time, pore-volumes injected
  sw: Float64Array; p: Float64Array;
  fluxX: Float64Array; fluxY: Float64Array;  // per-face total flux (for streamline tracing)
  cumOil: number; cumWater: number;  // cumulative produced (reservoir volumes)
  waterCut: number;                  // producer water cut
  wellRate: number[];                // total rate per well (+ = production)
}
export interface FvResult { snapshots: FvSnapshot[]; poreVol: number; ooip: number }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Max |dfw/dSw| over the mobile range (for the CFL limit). */
function maxDfw(e: CoreyEndpoints, muw: number, muo: number): number {
  let m = 0; const lo = e.swc, hi = 1 - e.sor, h = 1e-3;
  for (let s = lo; s <= hi; s += 1e-3) { const d = Math.abs(fracFlowW(s + h, e, muw, muo) - fracFlowW(s - h, e, muw, muo)) / (2 * h); if (d > m) m = d; }
  return m || 1;
}

/** Mobility-weighted pressure solve (total mobility λt = krw/μw + kro/μo, arithmetic
 * face weighting). Returns pressure + a total face-flux accessor and well rates. */
function solvePressureMob(cfg: FvCfg, lt: Float64Array, Tx: Float64Array, Ty: Float64Array) {
  const { nx, ny, wells } = cfg;
  const N = nx * ny; const id = (i: number, j: number) => j * nx + i;
  const wDiag = new Float64Array(N), wRhs = new Float64Array(N);
  for (const w of wells) {
    const c = id(w.i, w.j);
    if (w.mode === 'bhp') { const wi = (w.WI ?? 0) * lt[c]; wDiag[c] += wi; wRhs[c] += wi * (w.bhp ?? 0); }
    else { wRhs[c] += w.rate ?? 0; }
  }
  const faceLtX = (i: number, j: number) => 0.5 * (lt[id(i, j)] + lt[id(i + 1, j)]);
  const faceLtY = (i: number, j: number) => 0.5 * (lt[id(i, j)] + lt[id(i, j + 1)]);
  const diag = new Float64Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = id(i, j); let d = wDiag[c];
    if (i < nx - 1) d += Tx[j * (nx - 1) + i] * faceLtX(i, j);
    if (i > 0) d += Tx[j * (nx - 1) + i - 1] * faceLtX(i - 1, j);
    if (j < ny - 1) d += Ty[j * nx + i] * faceLtY(i, j);
    if (j > 0) d += Ty[(j - 1) * nx + i] * faceLtY(i, j - 1);
    diag[c] = d;
  }
  const apply = (x: Float64Array): Float64Array => {
    const y = new Float64Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = id(i, j); let diag = wDiag[c], acc = 0;
      if (i < nx - 1) { const t = Tx[j * (nx - 1) + i] * faceLtX(i, j); diag += t; acc -= t * x[id(i + 1, j)]; }
      if (i > 0) { const t = Tx[j * (nx - 1) + i - 1] * faceLtX(i - 1, j); diag += t; acc -= t * x[id(i - 1, j)]; }
      if (j < ny - 1) { const t = Ty[j * nx + i] * faceLtY(i, j); diag += t; acc -= t * x[id(i, j + 1)]; }
      if (j > 0) { const t = Ty[(j - 1) * nx + i] * faceLtY(i, j - 1); diag += t; acc -= t * x[id(i, j - 1)]; }
      y[c] = diag * x[c] + acc;
    }
    return y;
  };
  const p = cg(apply, wRhs, diag);
  const fluxX = (i: number, j: number) => Tx[j * (nx - 1) + i] * faceLtX(i, j) * (p[id(i, j)] - p[id(i + 1, j)]);
  const fluxY = (i: number, j: number) => Ty[j * nx + i] * faceLtY(i, j) * (p[id(i, j)] - p[id(i, j + 1)]);
  const wellRate = wells.map((w) => { const c = id(w.i, w.j); return w.mode === 'bhp' ? (w.WI ?? 0) * lt[c] * (p[c] - (w.bhp ?? 0)) : -(w.rate ?? 0); });
  return { p, fluxX, fluxY, wellRate };
}

/** Local implicit saturation solve: a·S + fw(S)·out = rhs, S∈[Swc,1−Sor]. g(S) is
 * strictly increasing (a>0, fw↑) ⇒ a unique root ⇒ BISECTION is bulletproof
 * (Newton oscillates on the stiff injector cell where `out` is huge). */
function localSat(a: number, out: number, rhs: number, e: CoreyEndpoints, muw: number, muo: number): number {
  let lo = e.swc, hi = 1 - e.sor;
  const g = (S: number) => a * S + fracFlowW(S, e, muw, muo) * out - rhs;
  if (g(lo) >= 0) return lo;     // root at/below Swc
  if (g(hi) <= 0) return hi;     // root at/above 1−Sor
  for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; if (hi - lo < 1e-9) break; }
  return (lo + hi) / 2;
}

/** Run the oil-water flood. `timestepping`: 'implicit' (sequential-implicit, no CFL
 * — default, near-linear scaling) or 'impes' (explicit, CFL sub-stepped — the
 * Buckley-Leverett-validated reference). Records `nReports` snapshots to tEnd. */
export function simulateFV(cfg: FvCfg, opts: { tEnd: number; nReports?: number; cfl?: number; timestepping?: 'implicit' | 'impes'; implicitSubs?: number }): FvResult {
  const { nx, ny, dx, dy, dz, phi, k, muw, muo, corey, wells } = cfg;
  const N = nx * ny; const id = (i: number, j: number) => j * nx + i;
  const Vcell = dx * dy * dz, A = dy * dz, Ay = dx * dz;
  // static geometric transmissibilities (harmonic on k)
  const Tx = new Float64Array((nx - 1) * ny), Ty = new Float64Array(nx * (ny - 1));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) Tx[j * (nx - 1) + i] = faceTrans(k[id(i, j)], k[id(i + 1, j)], A, dx / 2, dx / 2);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) Ty[j * nx + i] = faceTrans(k[id(i, j)], k[id(i, j + 1)], Ay, dy / 2, dy / 2);

  const sw = new Float64Array(N);
  for (let c = 0; c < N; c++) sw[c] = cfg.swInit ? cfg.swInit[c] : corey.swc;
  const lt = new Float64Array(N);
  const computeLt = () => { for (let c = 0; c < N; c++) { const { krw, kro } = coreyKr(sw[c], corey); lt[c] = krw / muw + kro / muo; } };

  let poreVol = 0, ooip = 0;
  for (let c = 0; c < N; c++) { const pv = phi[c] * Vcell; poreVol += pv; ooip += pv * (1 - sw[c]); }
  const injRate = wells.filter((w) => w.mode === 'rate').reduce((a, w) => a + (w.rate ?? 0), 0);
  const dfwMax = maxDfw(corey, muw, muo);

  const nReports = opts.nReports ?? 40, cfl = opts.cfl ?? 0.4;
  const dtReport = opts.tEnd / nReports;
  const snapshots: FvSnapshot[] = [];
  let t = 0, cumOil = 0, cumWater = 0;

  const record = () => {
    computeLt();
    const sol = solvePressureMob(cfg, lt, Tx, Ty);
    const fx = new Float64Array((nx - 1) * ny), fy = new Float64Array(nx * (ny - 1));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) fx[j * (nx - 1) + i] = sol.fluxX(i, j);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) fy[j * nx + i] = sol.fluxY(i, j);
    let wc = 0, prodTot = 0;
    wells.forEach((w, wi) => { if (w.mode === 'bhp' && sol.wellRate[wi] > 0) { const c = id(w.i, w.j); wc += fracFlowW(sw[c], corey, muw, muo) * sol.wellRate[wi]; prodTot += sol.wellRate[wi]; } });
    snapshots.push({ t, pvi: poreVol > 0 ? (injRate * t) / poreVol : 0, sw: sw.slice(), p: sol.p.slice(), fluxX: fx, fluxY: fy, cumOil, cumWater, waterCut: prodTot > 0 ? wc / prodTot : 0, wellRate: sol.wellRate });
  };
  record();

  const mode = opts.timestepping ?? 'implicit';
  const MAX_SUBSTEPS = 5000; // backstop against a pathological CFL (impes)
  for (let r = 0; r < nReports; r++) {
    // solve pressure ONCE per report (mobility lagged), then advance saturation on
    // the frozen flux field — implicit (no CFL) or explicit-CFL (impes reference).
    computeLt();
    const sol = solvePressureMob(cfg, lt, Tx, Ty);
    const fX = new Float64Array((nx - 1) * ny), fY = new Float64Array(nx * (ny - 1));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) fX[j * (nx - 1) + i] = sol.fluxX(i, j);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) fY[j * nx + i] = sol.fluxY(i, j);

    if (mode === 'implicit') {
      // build per-cell incoming faces + total outgoing flux (fixed for the report)
      const outQ = new Float64Array(N); const injW = new Float64Array(N);
      const incoming: Array<Array<[number, number]>> = Array.from({ length: N }, () => []);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) { const q = fX[j * (nx - 1) + i], a = id(i, j), b = id(i + 1, j); if (q > 0) { outQ[a] += q; incoming[b].push([a, q]); } else if (q < 0) { outQ[b] += -q; incoming[a].push([b, -q]); } }
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) { const q = fY[j * nx + i], a = id(i, j), b = id(i, j + 1); if (q > 0) { outQ[a] += q; incoming[b].push([a, q]); } else if (q < 0) { outQ[b] += -q; incoming[a].push([b, -q]); } }
      wells.forEach((w, wi) => { const c = id(w.i, w.j), q = sol.wellRate[wi]; if (q < 0) injW[c] += -q; else outQ[c] += q; });
      const nSub = opts.implicitSubs ?? 4, dt = dtReport / nSub;
      for (let s = 0; s < nSub; s++) {
        const swOld = sw.slice();
        for (let sweep = 0; sweep < 200; sweep++) {
          let maxD = 0; const back = sweep % 2 === 1; // alternate direction → GS propagates both ways (diagonal flow)
          for (let cc = 0; cc < N; cc++) {
            const c = back ? N - 1 - cc : cc;
            const pv = phi[c] * Vcell; if (pv <= 0) continue;
            const a = pv / dt; let inflow = injW[c];
            const inc = incoming[c]; for (let m = 0; m < inc.length; m++) inflow += fracFlowW(sw[inc[m][0]], corey, muw, muo) * inc[m][1];
            const S = localSat(a, outQ[c], a * swOld[c] + inflow, corey, muw, muo);
            const d = Math.abs(S - sw[c]); if (d > maxD) maxD = d; sw[c] = S;
          }
          if (maxD < 1e-9) break;
        }
        wells.forEach((w, wi) => { const q = sol.wellRate[wi]; if (q > 0) { const c = id(w.i, w.j), fw = fracFlowW(sw[c], corey, muw, muo); cumWater += fw * q * dt; cumOil += (1 - fw) * q * dt; } });
        t += dt;
      }
    } else {
      // IMPES: explicit upstream saturation under a CFL sub-step (validated reference)
      const outflow = new Float64Array(N);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) { const q = fX[j * (nx - 1) + i]; if (q > 0) outflow[id(i, j)] += q; else outflow[id(i + 1, j)] += -q; }
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) { const q = fY[j * nx + i]; if (q > 0) outflow[id(i, j)] += q; else outflow[id(i, j + 1)] += -q; }
      wells.forEach((w, wi) => { if (sol.wellRate[wi] > 0) outflow[id(w.i, w.j)] += sol.wellRate[wi]; });
      let dtMax = dtReport; for (let c = 0; c < N; c++) if (outflow[c] > 1e-12) dtMax = Math.min(dtMax, cfl * phi[c] * Vcell / (outflow[c] * dfwMax));
      let remaining = dtReport, steps = 0;
      while (remaining > 1e-12 && steps++ < MAX_SUBSTEPS) {
        const dt = Math.min(remaining, dtMax);
        const netW = new Float64Array(N);
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) { const q = fX[j * (nx - 1) + i]; const fw = fracFlowW(sw[q > 0 ? id(i, j) : id(i + 1, j)], corey, muw, muo); const wq = fw * q; netW[id(i, j)] -= wq; netW[id(i + 1, j)] += wq; }
        for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) { const q = fY[j * nx + i]; const fw = fracFlowW(sw[q > 0 ? id(i, j) : id(i, j + 1)], corey, muw, muo); const wq = fw * q; netW[id(i, j)] -= wq; netW[id(i, j + 1)] += wq; }
        wells.forEach((w, wi) => { const c = id(w.i, w.j), q = sol.wellRate[wi]; if (q < 0) netW[c] += -q; else { const fw = fracFlowW(sw[c], corey, muw, muo); netW[c] -= fw * q; cumWater += fw * q * dt; cumOil += (1 - fw) * q * dt; } });
        for (let c = 0; c < N; c++) { const pv = phi[c] * Vcell; if (pv > 0) sw[c] = clamp(sw[c] + dt * netW[c] / pv, corey.swc, 1 - corey.sor); }
        t += dt; remaining -= dt;
      }
    }
    record();
  }
  return { snapshots, poreVol, ooip };
}
