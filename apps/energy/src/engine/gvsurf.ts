// gvsurf.ts (G0) — the lightweight surface format, ported from the founder's
// GeaVision-Studio pipeline. Turns a multi-MB EarthVision grid ASCII into a
// ~100–500 KB object via four compounding compressions:
//   1. affine (col,row)→(x,y)  — 6 numbers replace every coordinate
//   2. Int16 quantisation      — Float64→Int16 (4×), exact to ~range/60000
//   3. gzip (level 9) + base64 — typically 5–10×
//   4. optional ingest downsample (stride)
// Decode is O(1) per node; render-time LOD (§rebuild in the viewer) caps the mesh
// at ~180² regardless of source resolution. Decimation changes DISPLAY density
// only — the GVSURF stays the authoritative grid for calculations.
// Isomorphic (Node + browser); pako for gzip, atob/btoa for base64.
import pako from 'pako';

export const NULLV = -32768;   // Int16 sentinel for no-data (outside the ±30000 value range)

// ── EarthVision grid ASCII → parsed columns ────────────────────────────────────
// Lines are `x y z col row`; `#`-comments may carry `Z_units:`.
export interface ParsedEV { xs: number[]; ys: number[]; zs: number[]; cs: number[]; rs: number[]; ncol: number; nrow: number; meta: { z_units: string } }
export function parseEV(text: string): ParsedEV {
  let mc = 0, mr = 0; const xs: number[] = [], ys: number[] = [], zs: number[] = [], cs: number[] = [], rs: number[] = [];
  const meta = { z_units: 'feet' };
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    if (line[0] === '#') { if (line.includes('Z_units:')) meta.z_units = line.split(':')[1].trim(); continue; }
    const p = line.trim().split(/\s+/);
    if (p.length < 5) continue;
    const x = +p[0], y = +p[1], z = +p[2], c = +p[3] | 0, r = +p[4] | 0;
    if (!isFinite(x) || !isFinite(z)) continue;
    xs.push(x); ys.push(y); zs.push(z); cs.push(c); rs.push(r); if (c > mc) mc = c; if (r > mr) mr = r;
  }
  return { xs, ys, zs, cs, rs, ncol: mc, nrow: mr, meta };
}

// ── least-squares affine: value ≈ a + b·col + c·row (solve the 3×3 normal eqns) ─
function solve3(M: number[][], b: number[]): [number, number, number] {
  const A = M.map((r, i) => r.concat(b[i]));
  for (let i = 0; i < 3; i++) {
    let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
    [A[i], A[p]] = [A[p], A[i]];
    const d = A[i][i]; for (let j = i; j < 4; j++) A[i][j] /= d;
    for (let k = 0; k < 3; k++) if (k !== i) { const f = A[k][i]; for (let j = i; j < 4; j++) A[k][j] -= f * A[i][j]; }
  }
  return [A[0][3], A[1][3], A[2][3]];
}
export function fitAffine(cs: number[], rs: number[], vs: number[]): [number, number, number] {
  const S1 = cs.length; let Sc = 0, Sr = 0, Scc = 0, Scr = 0, Srr = 0, Sv = 0, Scv = 0, Srv = 0;
  for (let i = 0; i < cs.length; i++) { const c = cs[i], r = rs[i], v = vs[i]; Sc += c; Sr += r; Scc += c * c; Scr += c * r; Srr += r * r; Sv += v; Scv += c * v; Srv += r * v; }
  return solve3([[S1, Sc, Sr], [Sc, Scc, Scr], [Sr, Scr, Srr]], [Sv, Scv, Srv]);
}

// ── the GVSURF object + affine ─────────────────────────────────────────────────
export interface Affine { x0: number; xc: number; xr: number; y0: number; yc: number; yr: number }
export interface GvSurf {
  format: 'GVSURF'; version: 2; name: string; ncol: number; nrow: number; down: number;
  affine: Affine; z_units: string; xy_units: 'meters'; surface_type: string;
  z_offset: number; z_scale: number; z_null: number; encoding: 'int16-gzip-base64-rowmajor'; z: string;
}

const toB64 = (u8: Uint8Array): string => { let bin = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) bin += String.fromCharCode.apply(null, u8.subarray(i, i + CH) as unknown as number[]); return btoa(bin); };
const fromB64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** EarthVision text → GVSURF. `quant` = min Z resolution (m); `down` = ingest
 * stride; `kind` = 'depth' (Z negated, down is negative) or 'property'. */
export function evToGVSURF(name: string, text: string, quant = 0.1, down = 1, kind = 'depth'): GvSurf {
  const P = parseEV(text);
  const ax = fitAffine(P.cs, P.rs, P.xs), ay = fitAffine(P.cs, P.rs, P.ys);
  const ncol = Math.ceil(P.ncol / down), nrow = Math.ceil(P.nrow / down);
  const zvals = kind === 'depth' ? P.zs.map((z) => -Math.abs(z)) : P.zs.slice();
  let zmin = 1e18, zmax = -1e18; for (const z of zvals) { if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
  const offset = +(((zmin + zmax) / 2).toFixed(3)), scale = Math.max(quant, (zmax - zmin) / 60000);
  const grid = new Int16Array(ncol * nrow).fill(NULLV);
  for (let i = 0; i < zvals.length; i++) {
    const c = P.cs[i], r = P.rs[i];
    if (((c - 1) % down) || ((r - 1) % down)) continue;
    const cc = ((c - 1) / down) | 0, rr = ((r - 1) / down) | 0;
    if (cc >= ncol || rr >= nrow) continue;
    grid[rr * ncol + cc] = Math.round((zvals[i] - offset) / scale);
  }
  // affine folds the ingest stride so world coords reconstruct from the DOWNSAMPLED index
  const x0 = ax[0] + ax[1] + ax[2], xc = ax[1] * down, xr = ax[2] * down;
  const y0 = ay[0] + ay[1] + ay[2], yc = ay[1] * down, yr = ay[2] * down;
  const gz = pako.gzip(new Uint8Array(grid.buffer), { level: 9 });
  return {
    format: 'GVSURF', version: 2, name, ncol, nrow, down,
    affine: { x0: +x0.toFixed(4), xc: +xc.toFixed(6), xr: +xr.toFixed(6), y0: +y0.toFixed(4), yc: +yc.toFixed(6), yr: +yr.toFixed(6) },
    z_units: P.meta.z_units, xy_units: 'meters', surface_type: kind,
    z_offset: offset, z_scale: +scale.toFixed(5), z_null: NULLV, encoding: 'int16-gzip-base64-rowmajor', z: toB64(gz),
  };
}

// ── decode → O(1) node access + world coords via the affine ────────────────────
export interface DecodedSurface {
  z: Int16Array; ncol: number; nrow: number; affine: Affine;
  z_scale: number; z_offset: number; z_null: number; name: string;
  zmin: number; zmax: number; kind: string;
  depth: (c: number, r: number) => number;     // NaN at nulls
  worldXY: (c: number, r: number) => { x: number; y: number };
}
export function decodeSurface(o: GvSurf): DecodedSurface {
  const raw = pako.ungzip(fromB64(o.z));
  const z = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  const { ncol, nrow, affine: A } = o;
  const off = o.z_offset ?? 0;
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < z.length; i++) { if (z[i] === o.z_null) continue; const v = off + z[i] * o.z_scale; if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
  return {
    z, ncol, nrow, affine: A, z_scale: o.z_scale, z_offset: off, z_null: o.z_null, name: o.name,
    zmin, zmax, kind: o.surface_type || 'depth',
    depth: (c, r) => { const v = z[r * ncol + c]; return v === o.z_null ? NaN : off + v * o.z_scale; },
    worldXY: (c, r) => ({ x: A.x0 + A.xc * c + A.xr * r, y: A.y0 + A.yc * c + A.yr * r }),
  };
}
