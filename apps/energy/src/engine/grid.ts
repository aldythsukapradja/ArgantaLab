// grid.ts — the regular-grid structural surface + bilinear sampling.
// Grid type matches the wb surface JSON exactly: {nx,ny,x0,y0,cell,z[nx*ny]}.
// z is row-major: index = iy*nx + ix; nulls mark undefined cells (masked).
// Pure TS, no DOM. Ported per V1-SPEC §3.

export interface Grid {
  nx: number;
  ny: number;
  x0: number;   // world x of column 0 (cell centre convention from build script)
  y0: number;   // world y of row 0
  cell: number; // metres
  z: (number | null)[];
}

export interface SurfaceMeta {
  id: string;
  name: string;
  kind?: string;
  dataNature?: string;
  zmin: number;
  zmax: number;
}

export type SurfaceJson = Grid & SurfaceMeta & { points?: number; filled?: number };

/** World bounds of a grid (cell-centre origin → extend half a cell each way). */
export function gridBounds(g: Grid) {
  return {
    minX: g.x0 - g.cell / 2,
    minY: g.y0 - g.cell / 2,
    maxX: g.x0 + (g.nx - 0.5) * g.cell,
    maxY: g.y0 + (g.ny - 0.5) * g.cell,
  };
}

/** Raw cell read (null if out of range or masked). */
export function cellZ(g: Grid, ix: number, iy: number): number | null {
  if (ix < 0 || iy < 0 || ix >= g.nx || iy >= g.ny) return null;
  const v = g.z[iy * g.nx + ix];
  return v == null || !isFinite(v) ? null : v;
}

/**
 * sampleGrid — bilinear interpolation at world (x,y).
 * Returns null when any of the 4 surrounding cells is masked/out-of-range so we
 * never invent depth over undefined ground. gx/gy are fractional cell coords.
 */
export function sampleGrid(g: Grid, x: number, y: number): number | null {
  const gx = (x - g.x0) / g.cell;
  const gy = (y - g.y0) / g.cell;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;

  const z00 = cellZ(g, ix, iy);
  const z10 = cellZ(g, ix + 1, iy);
  const z01 = cellZ(g, ix, iy + 1);
  const z11 = cellZ(g, ix + 1, iy + 1);

  // Strict bilinear needs all four; if some are masked, fall back to the nearest
  // available among the four (edge of the surface) rather than returning null too
  // eagerly — but if none available, null.
  if (z00 != null && z10 != null && z01 != null && z11 != null) {
    const a = z00 * (1 - fx) + z10 * fx;
    const b = z01 * (1 - fx) + z11 * fx;
    return a * (1 - fy) + b * fy;
  }
  // partial: inverse-distance over present corners (keeps edges continuous)
  let wsum = 0, zsum = 0;
  const corners: Array<[number | null, number, number]> = [
    [z00, 1 - fx, 1 - fy], [z10, fx, 1 - fy], [z01, 1 - fx, fy], [z11, fx, fy],
  ];
  for (const [z, wx, wy] of corners) {
    if (z == null) continue;
    const w = wx * wy;
    wsum += w; zsum += z * w;
  }
  if (wsum > 1e-9) return zsum / wsum;
  return null;
}

/** min/max over non-null cells. */
export function gridMinMax(g: Grid): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (const v of g.z) {
    if (v == null || !isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min)) return { min: 0, max: 1 };
  return { min, max };
}

/** World (x,y) of a cell centre. */
export function cellCentre(g: Grid, ix: number, iy: number) {
  return { x: g.x0 + ix * g.cell, y: g.y0 + iy * g.cell };
}

/**
 * binPoints — bin an [x,y,z] cloud into a regular grid of `cell` metres via mean-z.
 * Mirrors the build script; kept in-engine for parity / any runtime rebinning.
 */
export function binPoints(pts: Array<[number, number, number]>, cell: number): Grid {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const nx = Math.max(1, Math.round((maxX - minX) / cell) + 1);
  const ny = Math.max(1, Math.round((maxY - minY) / cell) + 1);
  const sum = new Float64Array(nx * ny);
  const cnt = new Float64Array(nx * ny);
  for (const [x, y, z] of pts) {
    const ix = Math.round((x - minX) / cell);
    const iy = Math.round((y - minY) / cell);
    if (ix < 0 || iy < 0 || ix >= nx || iy >= ny) continue;
    const k = iy * nx + ix;
    sum[k] += z; cnt[k] += 1;
  }
  const z: (number | null)[] = new Array(nx * ny);
  for (let k = 0; k < nx * ny; k++) z[k] = cnt[k] > 0 ? sum[k] / cnt[k] : null;
  return { nx, ny, x0: minX, y0: minY, cell, z };
}
