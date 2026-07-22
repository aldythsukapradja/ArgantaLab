// volumetrics.ts — GRV (closure / polygon / well drainage) + STOIIP / GIIP.
// 1:1 port of the reference grvClosure/stoiip in scripts/test-engine.mjs, extended
// with polygon-clip and well-drainage scopes and the gas + solution-gas cases from
// the founder spec. Pure TS, no DOM.

import type { Grid } from './grid';

/** m³ → bbl (STOIIP) and Sm³ → scf (gas). */
export const BBL_PER_SM3 = 6.2898;
export const SCF_PER_SM3 = 35.3147;

/** GRV between top/base grids inside a blanket contact, crest-connected closure. */
export function grvClosure(top: Grid, base: Grid, owc: number, cell: number): { grv: number; cells: number; crestZ: number } {
  const { nx, ny } = top;
  const inCl = new Uint8Array(nx * ny);
  let crest = -1, cz = Infinity;
  for (let i = 0; i < nx * ny; i++) { const z = top.z[i]; if (z != null && z < cz) { cz = z; crest = i; } }
  if (crest < 0) return { grv: 0, cells: 0, crestZ: cz };
  const st = [crest]; inCl[crest] = 1;
  while (st.length) {
    const idx = st.pop()!;
    const i = idx % nx, k = (idx / nx) | 0;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nk = k + dk;
      if (ni < 0 || nk < 0 || ni >= nx || nk >= ny) continue;
      const n = nk * nx + ni;
      if (inCl[n]) continue;
      const z = top.z[n];
      if (z != null && z < owc) { inCl[n] = 1; st.push(n); }
    }
  }
  return grvOverMask(top, base, owc, cell, inCl);
}

/** Shared GRV accumulation over a boolean cell mask (Uint8Array over top grid). */
function grvOverMask(top: Grid, base: Grid, owc: number, cell: number, inCl: Uint8Array): { grv: number; cells: number; crestZ: number } {
  const { nx, ny } = top;
  let grv = 0, cells = 0, crestZ = Infinity;
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    const idx = k * nx + i;
    if (!inCl[idx]) continue;
    const zt = top.z[idx];
    if (zt == null) continue;
    if (zt < crestZ) crestZ = zt;
    const x = top.x0 + i * cell, y = top.y0 + k * cell;
    const bi = Math.round((x - base.x0) / cell), bk = Math.round((y - base.y0) / cell);
    if (bi < 0 || bk < 0 || bi >= base.nx || bk >= base.ny) continue;
    const zb = base.z[bk * base.nx + bi];
    if (zb == null) continue;
    const h = Math.max(0, Math.min(zb, owc) - zt);
    if (h > 0) { grv += h * cell * cell; cells++; }
  }
  return { grv, cells, crestZ };
}

function pointInPolygon(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** GRV inside a custom polygon (world coords) ∩ crest-connected closure. */
export function grvPolygon(top: Grid, base: Grid, owc: number, cell: number, poly: Array<[number, number]>): { grv: number; cells: number; crestZ: number } {
  const { nx, ny } = top;
  const inCl = new Uint8Array(nx * ny);
  // start from crest-connected closure, then intersect with the polygon
  const cl = grvClosureMask(top, owc);
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    const idx = k * nx + i;
    if (!cl[idx]) continue;
    const x = top.x0 + i * cell, y = top.y0 + k * cell;
    if (pointInPolygon(x, y, poly)) inCl[idx] = 1;
  }
  return grvOverMask(top, base, owc, cell, inCl);
}

/** GRV inside a well drainage circle (world centre + radius m) ∩ closure. */
export function grvWell(top: Grid, base: Grid, owc: number, cell: number, x0: number, y0: number, radius: number): { grv: number; cells: number; crestZ: number } {
  const { nx, ny } = top;
  const inCl = new Uint8Array(nx * ny);
  const cl = grvClosureMask(top, owc);
  const r2 = radius * radius;
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    const idx = k * nx + i;
    if (!cl[idx]) continue;
    const x = top.x0 + i * cell, y = top.y0 + k * cell;
    if ((x - x0) * (x - x0) + (y - y0) * (y - y0) <= r2) inCl[idx] = 1;
  }
  return grvOverMask(top, base, owc, cell, inCl);
}

/** Crest-connected closure mask (shared by polygon/well scopes). */
function grvClosureMask(top: Grid, owc: number): Uint8Array {
  const { nx, ny } = top;
  const inCl = new Uint8Array(nx * ny);
  let crest = -1, cz = Infinity;
  for (let i = 0; i < nx * ny; i++) { const z = top.z[i]; if (z != null && z < cz) { cz = z; crest = i; } }
  if (crest < 0) return inCl;
  const st = [crest]; inCl[crest] = 1;
  while (st.length) {
    const idx = st.pop()!;
    const i = idx % nx, k = (idx / nx) | 0;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nk = k + dk;
      if (ni < 0 || nk < 0 || ni >= nx || nk >= ny) continue;
      const n = nk * nx + ni;
      if (inCl[n]) continue;
      const z = top.z[n];
      if (z != null && z < owc) { inCl[n] = 1; st.push(n); }
    }
  }
  return inCl;
}

/** STOIIP (Sm³) = GRV·NTG·φ·(1−Sw)/Bo. */
export const stoiip = (grv: number, ntg: number, phi: number, sw: number, bo: number): number =>
  (grv * ntg * phi * (1 - sw)) / bo;

/** GIIP (Sm³) = GRV·NTG·φ·(1−Sw)/Bg — gas "what-if" scenario. Bg≈0.0040 rm³/Sm³. */
export const giip = (grv: number, ntg: number, phi: number, sw: number, bg: number): number =>
  (grv * ntg * phi * (1 - sw)) / bg;

/** Associated / solution gas (Sm³) = STOIIP·Rs. */
export const solutionGas = (stoiipSm3: number, rs: number): number => stoiipSm3 * rs;
