// sim/pressure.ts (S4) — the SHARED TPFA pressure kernel. Both simulator twins
// build on this: the FV black-oil sim (S5) and the streamline sim (S6) solve the
// SAME elliptic pressure equation, then branch only on transport. Single-phase
// incompressible here (the kernel + validation); multiphase mobility weighting is
// layered on in S5. Ported 1:1 from scripts/test-sim.mjs (26/26 truth-lock).
// Pure TS, no DOM.

// ── TPFA transmissibility ──────────────────────────────────────────────────────
/** Half-transmissibility of a cell toward a face: k·A / d (d = centre→face). */
export function halfTrans(k: number, A: number, d: number): number { return k * A / d; }
/** Face transmissibility between two cells — harmonic combination of half-trans. */
export function faceTrans(kA: number, kB: number, A: number, dA: number, dB: number): number {
  const ta = halfTrans(kA, A, dA), tb = halfTrans(kB, A, dB);
  return (ta * tb) / (ta + tb);
}

// ── Peaceman well model ────────────────────────────────────────────────────────
/** Equivalent radius for a rectangular block: 0.14·√(dx²+dy²). */
export function peacemanR0(dx: number, dy: number): number { return 0.14 * Math.sqrt(dx * dx + dy * dy); }
/** Equivalent radius for a square isotropic block: 0.2·dx. */
export function peacemanR0Square(dx: number): number { return 0.2 * dx; }
/** Well index WI = 2πkh / (ln(r0/rw) + skin). */
export function wellIndex(k: number, h: number, r0: number, rw: number, skin = 0): number {
  return (2 * Math.PI * k * h) / (Math.log(r0 / rw) + skin);
}

// ── conjugate gradient (SPD, matrix-free) ──────────────────────────────────────
function dot(a: Float64Array, b: Float64Array): number { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
/** Solve A·x = b for an SPD operator given as a matrix-free apply(). */
export function cg(apply: (x: Float64Array) => Float64Array, b: Float64Array, tol = 1e-10, maxit = 5000): Float64Array {
  const n = b.length, x = new Float64Array(n);
  const r = b.slice(), p = b.slice();
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

// ── single-phase incompressible TPFA pressure solve (structured 2D areal grid) ──
export type WellMode = 'bhp' | 'rate';
export interface Well { i: number; j: number; mode: WellMode; bhp?: number; rate?: number; WI?: number }
export interface PressureCfg {
  nx: number; ny: number; dx: number; dy: number; dz: number;
  k: ArrayLike<number>;   // per-cell permeability [nx*ny]
  mu: number;             // viscosity
  wells: Well[];
}
export interface PressureSolution {
  p: Float64Array;
  wellRate: number[];                      // + = production out, − = injection in
  faceFluxX: (i: number, j: number) => number; // interior x-face flux i→i+1
  faceFluxY: (i: number, j: number) => number; // interior y-face flux j→j+1
}

export function solvePressure(cfg: PressureCfg): PressureSolution {
  const { nx, ny, dx, dy, dz, k, mu, wells } = cfg;
  const N = nx * ny; const A = dy * dz, Ay = dx * dz;
  const id = (i: number, j: number) => j * nx + i;
  const Tx = new Float64Array((nx - 1) * ny), Ty = new Float64Array(nx * (ny - 1));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) Tx[j * (nx - 1) + i] = faceTrans(k[id(i, j)], k[id(i + 1, j)], A, dx / 2, dx / 2);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) Ty[j * nx + i] = faceTrans(k[id(i, j)], k[id(i, j + 1)], Ay, dy / 2, dy / 2);
  const wDiag = new Float64Array(N), wRhs = new Float64Array(N);
  for (const w of wells) { const c = id(w.i, w.j); if (w.mode === 'bhp') { const wi = (w.WI ?? 0) / mu; wDiag[c] += wi; wRhs[c] += wi * (w.bhp ?? 0); } else { wRhs[c] += w.rate ?? 0; } }
  const apply = (x: Float64Array): Float64Array => {
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
  const wellRate = wells.map((w) => { const c = id(w.i, w.j); return w.mode === 'bhp' ? ((w.WI ?? 0) / mu) * (p[c] - (w.bhp ?? 0)) : -(w.rate ?? 0); });
  const faceFluxX = (i: number, j: number) => Tx[j * (nx - 1) + i] / mu * (p[id(i, j)] - p[id(i + 1, j)]);
  const faceFluxY = (i: number, j: number) => Ty[j * nx + i] / mu * (p[id(i, j)] - p[id(i, j + 1)]);
  return { p, wellRate, faceFluxX, faceFluxY };
}
