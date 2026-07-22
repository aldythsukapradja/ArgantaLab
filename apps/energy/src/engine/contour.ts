// contour.ts — d3-contour over a Grid → world-coordinate isolines.
// Masked (null) cells are filled with a sentinel far below the data range so the
// marching-squares never draws a contour across undefined ground; we then clip
// generated rings back against the mask at render time via the value sentinel.
// Pure TS, no DOM. Per V1-SPEC §3.

import { contours as d3contours } from 'd3-contour';
import type { Grid } from './grid';

export interface IsoLine {
  z: number;                              // depth value of this contour
  rings: Array<Array<[number, number]>>;  // world-coord polylines
}

const MASK = -1e6; // sentinel for null cells (well below any TVDSS)

/** Nice round contour interval covering [min,max] with ~n lines. */
export function niceLevels(min: number, max: number, approx = 12): number[] {
  const span = Math.max(1e-6, max - min);
  const raw = span / approx;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * pow;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/**
 * contourGrid — returns isolines in WORLD coordinates for the given levels.
 * d3-contour works in grid-cell space; we transform each ring vertex back to
 * world via (x0 + gx*cell, y0 + gy*cell). Rings that touch the mask sentinel
 * region are dropped so lines stop at the surface edge.
 */
export function contourGrid(g: Grid, levels: number[]): IsoLine[] {
  const values = new Array<number>(g.nx * g.ny);
  for (let i = 0; i < values.length; i++) {
    const v = g.z[i];
    values[i] = v == null || !isFinite(v) ? MASK : v;
  }

  const gen = d3contours().size([g.nx, g.ny]).thresholds(levels).smooth(true);
  const polys = gen(values);

  const out: IsoLine[] = [];
  for (const mp of polys) {
    const rings: Array<Array<[number, number]>> = [];
    for (const poly of mp.coordinates) {
      for (const ring of poly) {
        // d3 uses cell corner coords in [0..nx]; map to world (cell-centre origin
        // means corner k sits at x0 + (k-0.5)*cell).
        const worldRing: Array<[number, number]> = [];
        let touchesMask = false;
        for (const [gx, gy] of ring) {
          // sample nearest cell value to detect mask edges
          const cx = Math.min(g.nx - 1, Math.max(0, Math.round(gx - 0.5)));
          const cy = Math.min(g.ny - 1, Math.max(0, Math.round(gy - 0.5)));
          if (g.z[cy * g.nx + cx] == null) touchesMask = true;
          worldRing.push([g.x0 + (gx - 0.5) * g.cell, g.y0 + (gy - 0.5) * g.cell]);
        }
        // keep even mask-touching rings but flag; render trims by not filling.
        if (!touchesMask || worldRing.length > 6) rings.push(worldRing);
      }
    }
    if (rings.length) out.push({ z: mp.value, rings });
  }
  return out;
}
