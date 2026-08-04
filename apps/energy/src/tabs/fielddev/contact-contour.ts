// fielddev/contact-contour.ts — trace a fluid contact across a depth grid.
//
// A contact is a horizontal plane. Where that plane cuts the reservoir horizon is
// a line on the map, and that line is the single most consequential contour on a
// development map: inside it the horizon is above the contact, outside it is not.
// Everything about well placement is argued across it.
//
// This traces the intersection directly from the grid — an isoline at the contact
// depth — rather than drawing a circle at a radius, because the horizon is not a
// cone and the contact does not close where the mapped area runs out.
//
// TWO honesty rules are enforced here:
//
//  1. NULL NODES ARE NOT DATA. An interpreted grid has a real edge. Marching over
//     it produces a segment that follows the edge of the SURVEY, not the contact,
//     and a reader would take that line for structure. Any segment whose supporting
//     cell touches a null node is dropped, so an open contact stays open.
//
//  2. THE CONTACT IS AN INTERPRETATION. This module traces whatever depth it is
//     handed; it does not decide that a field has a contact, or where. The caller
//     passes a published contact and carries its provenance to the UI.
import { contours } from 'd3-contour';

/** A traced polyline in GRID space: [column, row], row 0 = the grid's first row. */
export type GridPolyline = Array<[number, number]>;

/** Sentinel for a null node. Any real elevation/depth is far inside this. */
const VOID = -1e9;

/**
 * @param values   row-major grid, `ncol * nrow`, in the grid's own z convention
 * @param level    the contact in the SAME convention as `values` (so an elevation
 *                 grid takes −3200 for a contact at 3200 m below datum)
 * @param minPoints drop trace fragments shorter than this — a two-vertex stub left
 *                 behind after edge trimming is noise, not a contact
 */
export function contactTrace(
  values: ArrayLike<number>, ncol: number, nrow: number, level: number, minPoints = 4,
): GridPolyline[] {
  if (!ncol || !nrow || values.length < ncol * nrow) return [];

  const grid = new Float64Array(ncol * nrow);
  let live = 0;
  for (let i = 0; i < ncol * nrow; i++) {
    const v = values[i];
    if (Number.isFinite(v)) { grid[i] = v; live++; } else { grid[i] = VOID; }
  }
  if (!live) return [];

  // d3-contour returns rings enclosing values ABOVE the threshold. On an elevation
  // grid that is the shallower-than-contact region, whose boundary is the contact.
  let multi;
  try {
    multi = contours().size([ncol, nrow]).thresholds([level])(Array.from(grid));
  } catch { return []; }

  const nodeOk = (c: number, r: number) => {
    if (c < 0 || r < 0 || c >= ncol || r >= nrow) return false;
    return grid[r * ncol + c] !== VOID;
  };
  // A contour vertex sits between nodes. It is trustworthy only if the four nodes
  // of the cell it falls in are all real.
  const vertexOk = ([x, y]: [number, number]) => {
    const c = Math.floor(x - 0.5), r = Math.floor(y - 0.5);
    return nodeOk(c, r) && nodeOk(c + 1, r) && nodeOk(c, r + 1) && nodeOk(c + 1, r + 1);
  };

  const out: GridPolyline[] = [];
  for (const poly of multi ?? []) {
    for (const ring of poly.coordinates ?? []) {
      for (const path of ring) {
        // split the closed ring wherever it leaves supported ground
        let run: GridPolyline = [];
        for (const pt of path as Array<[number, number]>) {
          if (vertexOk(pt)) { run.push([pt[0], pt[1]]); continue; }
          if (run.length >= minPoints) out.push(run);
          run = [];
        }
        if (run.length >= minPoints) out.push(run);
      }
    }
  }
  return out;
}

/** Grid space → projected space, using the grid's own origin and cell size.
 *  d3-contour's x is the column axis and y the row axis, and the grid's row 0 is
 *  its first row — the same indexing `values` uses — so no flip belongs here. */
export function traceToProjected(
  lines: GridPolyline[], x0: number, y0: number, cell: number,
): Array<Array<[number, number]>> {
  return lines.map((l) => l.map(([c, r]) => [x0 + c * cell, y0 + r * cell] as [number, number]));
}
