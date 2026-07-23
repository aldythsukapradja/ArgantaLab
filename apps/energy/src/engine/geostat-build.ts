// geostat-build.ts — the static-model build (coarsen surfaces → closure mask → per-layer
// SGS porosity + SIS facies → declustering rescale → perm → HCPV reconciliation), lifted
// OUT of GridModelView's synchronous useMemo so it can run in a Web Worker (the build is
// heavy — SIS/SGS per layer — and was blocking first paint on the Static Model tab).
// Pure TS (no three/DOM/React) → runs in workers/geostat.worker.ts and is unit-testable.
import type { SurfaceJson } from './grid';
import { buildGrid, gridHcpv, cellXY, cellIndex, type GridModel } from './grid3d';
import { sgs, sis, type Pt, type FaciesPt, type Vario } from './geostat';
import { phiToK } from './perm';

export interface GeostatWell { name: string; x: number; y: number; phie: number; netSand: number; role: string }
export interface GeostatBuildInput {
  top: SurfaceJson; base: SurfaceJson;
  wellPts: GeostatWell[];
  res: number; nz: number; range: number; nugget: number; seed: number; owc: number;
  phi: number; ntg: number; sw: number; bo: number;
}
export interface GeostatBuildOutput {
  grid: GridModel; nx: number; ny: number;
  stoiipGrid: number; sandFrac: number; phiMean: number; nCells: number;
}

export function buildStaticModel(inp: GeostatBuildInput): GeostatBuildOutput | null {
  const { top: g, base: b, wellPts, res, nz, range, nugget, seed, owc, phi: dPhi, ntg: dNtg, sw: dSw, bo: dBo } = inp;
  if (!g || !b) return null;

  // coarsen the fine Hugin grid to ≤ res in the larger dimension
  const factor = Math.max(1, Math.ceil(Math.max(g.nx, g.ny) / res));
  const nx = Math.ceil(g.nx / factor), ny = Math.ceil(g.ny / factor), dx = g.cell * factor;
  const topZ = new Float64Array(nx * ny), baseZ = new Float64Array(nx * ny);
  const sample = (s: SurfaceJson, ci: number, ck: number): number => {
    const fi = Math.min(s.nx - 1, ci * factor), fk = Math.min(s.ny - 1, ck * factor);
    const v = s.z[fk * s.nx + fi]; return v == null ? NaN : (v as number);
  };
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) { topZ[k * nx + i] = sample(g, i, k); baseZ[k * nx + i] = sample(b, i, k); }

  // closure mask on the coarse top (crest-connected flood-fill to OWC)
  const activeCol = new Uint8Array(nx * ny);
  let crest = -1, cz = Infinity;
  for (let c = 0; c < nx * ny; c++) { const z = topZ[c]; if (isFinite(z) && z < cz) { cz = z; crest = c; } }
  if (crest >= 0) {
    const st = [crest]; activeCol[crest] = 1;
    while (st.length) {
      const ci = st.pop()!; const i = ci % nx, k = (ci / nx) | 0;
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = i + di, nk = k + dk; if (ni < 0 || nk < 0 || ni >= nx || nk >= ny) continue;
        const n = nk * nx + ni; if (activeCol[n]) continue;
        const z = topZ[n]; if (isFinite(z) && z < owc) { activeCol[n] = 1; st.push(n); }
      }
    }
  }

  const grid = buildGrid({ nx, ny, nz, dx, dy: dx, x0: g.x0, y0: g.y0, topZ, baseZ, activeCol });

  // conditioning data (well x/y → world coords). SGS on porosity, SIS on facies.
  const phiCond: Pt[] = wellPts.map((w) => ({ x: w.x, y: w.y, v: w.phie }));
  const facCond: FaciesPt[] = wellPts.map((w) => ({ x: w.x, y: w.y, f: w.netSand >= 0.5 ? 1 : 0 }));
  const cols: Array<{ i: number; k: number; x: number; y: number }> = [];
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) if (activeCol[k * nx + i]) { const p = cellXY(grid, i, k); cols.push({ i, k, x: p.x, y: p.y }); }
  const targets = cols.map((c) => ({ x: c.x, y: c.y }));
  const vario: Vario = { model: 'spherical', nugget, sill: 1, range };
  // per-layer independent realizations (same conditioning) → vertical variation
  for (let l = 0; l < nz; l++) {
    const phiL = phiCond.length ? sgs(phiCond, targets, vario, seed + l * 7919) : targets.map(() => dPhi);
    const fac = facCond.length ? sis(facCond, targets, vario, seed + l * 104729, dNtg) : targets.map(() => 1 as 0 | 1);
    cols.forEach((c, ti) => {
      const ci = cellIndex(grid, c.i, c.k, l);
      grid.phi[ci] = Math.max(0.03, Math.min(0.35, phiL[ti]));
      grid.facies[ci] = fac[ti];
      grid.ntg[ci] = fac[ti] ? 1 : 0; // facies IS the net/gross (SAND=net)
      grid.sw[ci] = dSw;
    });
  }
  // declustering / global-mean control: rescale to the deck declustered field mean
  let rawSum = 0, rawN = 0; for (let c = 0; c < grid.active.length; c++) if (grid.active[c]) { rawSum += grid.phi[c]; rawN++; }
  const rawMean = rawN ? rawSum / rawN : dPhi;
  const gf = rawMean > 1e-6 ? dPhi / rawMean : 1;
  for (let c = 0; c < grid.active.length; c++) if (grid.active[c]) {
    grid.phi[c] = Math.max(0.03, Math.min(0.35, grid.phi[c] * gf));
    grid.perm[c] = grid.facies[c] ? phiToK(grid.phi[c]) : phiToK(grid.phi[c]) * 0.01;
  }
  // reconciliation
  const hc = gridHcpv(grid);
  const stoiipGrid = hc / dBo / 1e6;
  let sand = 0, tot = 0, phiSum = 0;
  for (let c = 0; c < grid.active.length; c++) if (grid.active[c]) { tot++; if (grid.facies[c]) sand++; phiSum += grid.phi[c]; }
  return { grid, nx, ny, stoiipGrid, sandFrac: tot ? sand / tot : 0, phiMean: tot ? phiSum / tot : 0, nCells: tot };
}
