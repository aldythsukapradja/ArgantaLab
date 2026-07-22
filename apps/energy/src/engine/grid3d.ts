// grid3d.ts — the unfaulted 3D cell grid (S1). Vertical pillars collapse the
// corner-point grid to regular Cartesian I/J + per-column top/base Z, so the whole
// static grid is plain array math (no COORD/ZCORN). Proportional layering +
// geometric modeling + HCPV. Ported 1:1 from scripts/test-geostat.mjs. Pure TS.

/** Proportional layer thickness: the zone [topZ,baseZ] split into nz equal layers. */
export function layerThickness(topZ: number, baseZ: number, nz: number): number {
  return (baseZ - topZ) / nz;
}
/** Cell bulk volume — vertical pillars ⇒ dx·dy·thk. */
export function bulkVol(dx: number, dy: number, thk: number): number { return dx * dy * thk; }

export interface Cell {
  active: boolean;
  bulkVol: number;
  ntg: number;
  phi: number;
  sw: number;
}
/** Hydrocarbon pore volume = Σ active bulkVol·ntg·φ·(1−Sw). For a uniform cube
 * this equals STOIIP·Bo exactly — the S2 reconciliation gate. */
export function hcpv(cells: Cell[]): number {
  return cells.reduce((a, c) => a + (c.active ? c.bulkVol * c.ntg * c.phi * (1 - c.sw) : 0), 0);
}

// ── GridModel — the shared 3D cell grid every downstream consumer reads ─────────
export interface GridModel {
  nx: number; ny: number; nz: number;      // cell counts
  dx: number; dy: number;                   // areal cell size (m)
  x0: number; y0: number;                   // origin (m)
  topZ: Float64Array;                       // [nx*ny] top surface per column (tvdss, m)
  baseZ: Float64Array;                      // [nx*ny] base surface per column
  cellZ: Float64Array;                      // [nx*ny*nz] cell-centre tvdss
  cellThk: Float64Array;                    // [nx*ny*nz] true vertical thickness
  cellBulk: Float64Array;                   // [nx*ny*nz] bulk volume
  active: Uint8Array;                       // [nx*ny*nz] 1 = in-model
  // properties (filled by geostat/upscaling, per cell)
  facies: Uint8Array;                       // 0 SHALE | 1 SAND
  phi: Float64Array;                        // porosity
  ntg: Float64Array;                        // net-to-gross
  sw: Float64Array;                         // water saturation
  perm: Float64Array;                       // horizontal permeability (mD)
}

export interface GridSpec {
  nx: number; ny: number; nz: number;
  dx: number; dy: number; x0: number; y0: number;
  topZ: ArrayLike<number>;    // per column [nx*ny], null-as-NaN
  baseZ: ArrayLike<number>;
  activeCol?: ArrayLike<number>; // optional per-column mask (1/0); default: finite top&base
}
const idx3 = (i: number, k: number, l: number, nx: number, ny: number) => (l * ny + k) * nx + i;

/** Build the empty geometric grid (proportional layering). Properties are filled
 * afterwards by geostat.sgs / sis / upscaling. */
export function buildGrid(spec: GridSpec): GridModel {
  const { nx, ny, nz, dx, dy, x0, y0 } = spec;
  const nCol = nx * ny, nCell = nCol * nz;
  const topZ = Float64Array.from({ length: nCol }, (_, c) => spec.topZ[c]);
  const baseZ = Float64Array.from({ length: nCol }, (_, c) => spec.baseZ[c]);
  const cellZ = new Float64Array(nCell), cellThk = new Float64Array(nCell), cellBulk = new Float64Array(nCell);
  const active = new Uint8Array(nCell);
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    const col = k * nx + i;
    const t = topZ[col], b = baseZ[col];
    const colOk = isFinite(t) && isFinite(b) && b > t && (spec.activeCol ? spec.activeCol[col] >= 0.5 : true);
    const thk = colOk ? (b - t) / nz : 0;
    for (let l = 0; l < nz; l++) {
      const ci = idx3(i, k, l, nx, ny);
      cellThk[ci] = thk;
      cellZ[ci] = colOk ? t + (l + 0.5) * thk : NaN;
      cellBulk[ci] = colOk ? bulkVol(dx, dy, thk) : 0;
      active[ci] = colOk ? 1 : 0;
    }
  }
  return {
    nx, ny, nz, dx, dy, x0, y0, topZ, baseZ, cellZ, cellThk, cellBulk, active,
    facies: new Uint8Array(nCell), phi: new Float64Array(nCell),
    ntg: new Float64Array(nCell), sw: new Float64Array(nCell), perm: new Float64Array(nCell),
  };
}

/** HCPV over a GridModel's property arrays (Σ active bulk·ntg·φ·(1−Sw)). */
export function gridHcpv(g: GridModel): number {
  let s = 0;
  for (let c = 0; c < g.active.length; c++) if (g.active[c]) s += g.cellBulk[c] * g.ntg[c] * g.phi[c] * (1 - g.sw[c]);
  return s;
}
/** Cell-centre world XY for column (i,k). */
export function cellXY(g: GridModel, i: number, k: number): { x: number; y: number } {
  return { x: g.x0 + (i + 0.5) * g.dx, y: g.y0 + (k + 0.5) * g.dy };
}
export const cellIndex = (g: GridModel, i: number, k: number, l: number) => (l * g.ny + k) * g.nx + i;
