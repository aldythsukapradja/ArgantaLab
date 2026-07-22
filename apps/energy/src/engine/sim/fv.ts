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
function cg(apply: (x: Float64Array) => Float64Array, b: Float64Array, tol = 1e-10, maxit = 5000): Float64Array {
  const n = b.length, x = new Float64Array(n); const r = b.slice(), p = b.slice();
  let rs = dot(r, r); const bnorm = Math.sqrt(dot(b, b)) || 1;
  for (let it = 0; it < maxit; it++) { const Ap = apply(p); const alpha = rs / dot(p, Ap); for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i]; } const rsNew = dot(r, r); if (Math.sqrt(rsNew) / bnorm < tol) break; const beta = rsNew / rs; for (let i = 0; i < n; i++) p[i] = r[i] + beta * p[i]; rs = rsNew; }
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
  const p = cg(apply, wRhs);
  const fluxX = (i: number, j: number) => Tx[j * (nx - 1) + i] * faceLtX(i, j) * (p[id(i, j)] - p[id(i + 1, j)]);
  const fluxY = (i: number, j: number) => Ty[j * nx + i] * faceLtY(i, j) * (p[id(i, j)] - p[id(i, j + 1)]);
  const wellRate = wells.map((w) => { const c = id(w.i, w.j); return w.mode === 'bhp' ? (w.WI ?? 0) * lt[c] * (p[c] - (w.bhp ?? 0)) : -(w.rate ?? 0); });
  return { p, fluxX, fluxY, wellRate };
}

/** Run the IMPES oil-water flood. Records `nReports` evenly-spaced snapshots to tEnd. */
export function simulateFV(cfg: FvCfg, opts: { tEnd: number; nReports?: number; cfl?: number }): FvResult {
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
    let wc = 0, prodTot = 0;
    wells.forEach((w, wi) => { if (w.mode === 'bhp' && sol.wellRate[wi] > 0) { const c = id(w.i, w.j); wc += fracFlowW(sw[c], corey, muw, muo) * sol.wellRate[wi]; prodTot += sol.wellRate[wi]; } });
    snapshots.push({ t, pvi: poreVol > 0 ? (injRate * t) / poreVol : 0, sw: sw.slice(), p: sol.p.slice(), cumOil, cumWater, waterCut: prodTot > 0 ? wc / prodTot : 0, wellRate: sol.wellRate });
  };
  record();

  const MAX_SUBSTEPS = 5000; // backstop against a pathological CFL
  for (let r = 0; r < nReports; r++) {
    // IMPES: solve pressure ONCE per report (mobility lagged), then cheap saturation
    // sub-steps on the frozen flux field. Slashes CG solves from thousands → nReports.
    computeLt();
    const sol = solvePressureMob(cfg, lt, Tx, Ty);
    const fX = new Float64Array((nx - 1) * ny), fY = new Float64Array(nx * (ny - 1));
    const outflow = new Float64Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) { const q = sol.fluxX(i, j); fX[j * (nx - 1) + i] = q; if (q > 0) outflow[id(i, j)] += q; else outflow[id(i + 1, j)] += -q; }
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) { const q = sol.fluxY(i, j); fY[j * nx + i] = q; if (q > 0) outflow[id(i, j)] += q; else outflow[id(i, j + 1)] += -q; }
    wells.forEach((w, wi) => { if (sol.wellRate[wi] > 0) outflow[id(w.i, w.j)] += sol.wellRate[wi]; });
    let dtMax = dtReport;
    for (let c = 0; c < N; c++) if (outflow[c] > 1e-12) dtMax = Math.min(dtMax, cfl * phi[c] * Vcell / (outflow[c] * dfwMax));
    let remaining = dtReport, steps = 0;
    while (remaining > 1e-12 && steps++ < MAX_SUBSTEPS) {
      const dt = Math.min(remaining, dtMax);
      const netW = new Float64Array(N);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) { const q = fX[j * (nx - 1) + i]; const fw = fracFlowW(sw[q > 0 ? id(i, j) : id(i + 1, j)], corey, muw, muo); const wq = fw * q; netW[id(i, j)] -= wq; netW[id(i + 1, j)] += wq; }
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) { const q = fY[j * nx + i]; const fw = fracFlowW(sw[q > 0 ? id(i, j) : id(i, j + 1)], corey, muw, muo); const wq = fw * q; netW[id(i, j)] -= wq; netW[id(i, j + 1)] += wq; }
      wells.forEach((w, wi) => {
        const c = id(w.i, w.j), q = sol.wellRate[wi];
        if (q < 0) netW[c] += -q;                                   // injector: water in (fw=1)
        else { const fw = fracFlowW(sw[c], corey, muw, muo); netW[c] -= fw * q; cumWater += fw * q * dt; cumOil += (1 - fw) * q * dt; }
      });
      for (let c = 0; c < N; c++) { const pv = phi[c] * Vcell; if (pv > 0) sw[c] = clamp(sw[c] + dt * netW[c] / pv, corey.swc, 1 - corey.sor); }
      t += dt; remaining -= dt;
    }
    record();
  }
  return { snapshots, poreVol, ooip };
}
