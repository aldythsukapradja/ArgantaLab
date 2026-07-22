// closure.ts — derive a trap-closure polygon from a top surface + a contact depth.
// Method (per V1-SPEC §3 / WORKBENCH-ARCHITECTURE.md):
//   1. mask cells at-or-above the contact (z <= contactZ; TVDSS increases down),
//   2. flood-fill the largest cluster that contains the crest (min-z) cell,
//   3. marching-squares (d3-contour @0.5) over that binary field → rings,
//   4. pick the largest ring, decimate.
// Result is labelled cls:'derived' by callers. Pure TS, no DOM.

import { contours as d3contours } from 'd3-contour';
import type { Grid } from './grid';

export interface ClosurePolygon {
  ring: Array<[number, number]>; // world coords, closed
  contactZ: number;
  cells: number;                 // cells inside the closure (for GRV later)
  crest: { x: number; y: number; z: number };
}

/** Flood-fill (4-connected) the above-contact cluster containing the crest. */
function crestCluster(g: Grid, contactZ: number): { mask: Uint8Array; crest: { x: number; y: number; z: number } } {
  const n = g.nx * g.ny;
  const below = new Uint8Array(n); // 1 = at/above contact (valid trap cell)
  let crestK = -1, crestZ = Infinity;
  for (let k = 0; k < n; k++) {
    const v = g.z[k];
    if (v == null || !isFinite(v)) continue;
    if (v <= contactZ) {
      below[k] = 1;
      if (v < crestZ) { crestZ = v; crestK = k; }
    }
  }
  const mask = new Uint8Array(n);
  if (crestK < 0) return { mask, crest: { x: g.x0, y: g.y0, z: crestZ } };

  // BFS from the crest over below-contact cells.
  const queue = [crestK];
  mask[crestK] = 1;
  while (queue.length) {
    const k = queue.pop()!;
    const ix = k % g.nx;
    const iy = (k / g.nx) | 0;
    const nbrs = [
      ix > 0 ? k - 1 : -1,
      ix < g.nx - 1 ? k + 1 : -1,
      iy > 0 ? k - g.nx : -1,
      iy < g.ny - 1 ? k + g.nx : -1,
    ];
    for (const nk of nbrs) {
      if (nk < 0 || mask[nk] || !below[nk]) continue;
      mask[nk] = 1;
      queue.push(nk);
    }
  }
  const cx = g.x0 + (crestK % g.nx) * g.cell;
  const cy = g.y0 + ((crestK / g.nx) | 0) * g.cell;
  return { mask, crest: { x: cx, y: cy, z: crestZ } };
}

function ringArea(ring: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  return Math.abs(a) / 2;
}

/** Douglas–Peucker-lite decimation by minimum vertex spacing. */
function decimate(ring: Array<[number, number]>, minDist: number): Array<[number, number]> {
  if (ring.length < 4) return ring;
  const out: Array<[number, number]> = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const [px, py] = out[out.length - 1];
    const [x, y] = ring[i];
    if (Math.hypot(x - px, y - py) >= minDist) out.push(ring[i]);
  }
  if (out.length < 3) return ring;
  out.push(out[0]);
  return out;
}

/**
 * contactPolygon — derive the closure ring for `grid` at `contactZ`.
 * Returns null if no cell sits above the contact (no trap at this depth).
 */
export function contactPolygon(grid: Grid, contactZ: number): ClosurePolygon | null {
  const { mask, crest } = crestCluster(grid, contactZ);
  let cells = 0;
  for (let k = 0; k < mask.length; k++) cells += mask[k];
  if (cells === 0) return null;

  const field = new Array<number>(mask.length);
  for (let k = 0; k < mask.length; k++) field[k] = mask[k];

  const gen = d3contours().size([grid.nx, grid.ny]).thresholds([0.5]).smooth(true);
  const polys = gen(field);
  let best: Array<[number, number]> | null = null;
  let bestArea = -1;
  for (const mp of polys) {
    for (const poly of mp.coordinates) {
      for (const ring of poly) {
        const world = ring.map(([gx, gy]) => [
          grid.x0 + (gx - 0.5) * grid.cell,
          grid.y0 + (gy - 0.5) * grid.cell,
        ] as [number, number]);
        const area = ringArea(world);
        if (area > bestArea) { bestArea = area; best = world; }
      }
    }
  }
  if (!best) return null;
  return { ring: decimate(best, grid.cell * 0.9), contactZ, cells, crest };
}
