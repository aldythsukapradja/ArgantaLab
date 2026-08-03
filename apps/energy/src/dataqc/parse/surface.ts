// parse/surface.ts — Petrel-compatible surface/grid readers. Pure + isomorphic.
// Supported: EarthVision grid ASCII · IRAP classic (ROXAR text) · ZMAP+ · XYZ(+attrs).
// All converge on DigestedSurface (row-major values + world geometry), which the
// ingest stage then compresses through engine/gvsurf.ts.
//
// Deterministic: an unreadable node becomes NaN (no data), never an interpolated guess.
import type { DigestedSurface } from '../types.ts';
import { parseEV, fitAffine } from '../../engine/gvsurf.ts';

export type SurfaceFormat = 'earthvision' | 'irap-ascii' | 'zmap' | 'xyz';

const numTokens = (line: string) => line.trim().split(/\s+/).map(Number);

/** IRAP classic (ROXAR ASCII) header:
 *    -996  nrow  xinc  yinc
 *    xmin  xmax  ymin  ymax
 *    ncol  rotation  x0  y0
 *    0 0 0 0 0 0 0
 *  then values row-major, 1e30 = undefined. */
export function parseIrapAscii(text: string): DigestedSurface {
  const toks: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    for (const t of line.trim().split(/\s+/)) { const v = Number(t); toks.push(Number.isFinite(v) ? v : NaN); }
  }
  if (toks.length < 19 || toks[0] !== -996) throw new Error('Not an IRAP classic ASCII grid (missing -996 magic).');
  const nrow = toks[1] | 0, dx = toks[2], dy = toks[3];
  const xmin = toks[4], ymin = toks[6];
  const ncol = toks[8] | 0, rotationDeg = toks[9];
  const values = new Float64Array(ncol * nrow).fill(NaN);
  const body = toks.slice(19);
  const n = Math.min(body.length, ncol * nrow);
  for (let i = 0; i < n; i++) { const v = body[i]; values[i] = (!Number.isFinite(v) || v >= 1e30) ? NaN : v; }
  return { name: 'irap', ncol, nrow, values, x0: xmin, y0: ymin, dx, dy, rotationDeg, zUnits: 'meters', nullValue: 1e30 };
}

/** ZMAP+ (`@grid, GRID, 5` header block, then column-major values). */
export function parseZmap(text: string): DigestedSurface {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !/^@/.test(lines[i].trim())) i++;
  if (i >= lines.length) throw new Error('Not a ZMAP+ grid (no @ header).');
  i++; // @grid, GRID, 5
  const l1 = numTokens(lines[i++] ?? '');           // width, nullValue, ...
  const nullValue = Number.isFinite(l1[1]) ? l1[1] : 1e30;
  const l2 = numTokens(lines[i++] ?? '');           // nrow ncol xmin xmax ymin ymax
  const nrow = l2[0] | 0, ncol = l2[1] | 0;
  const xmin = l2[2], xmax = l2[3], ymin = l2[4], ymax = l2[5];
  while (i < lines.length && !/^@/.test(lines[i].trim())) i++;
  i++; // closing @
  const vals: number[] = [];
  for (; i < lines.length; i++) {
    const t = lines[i].trim(); if (!t) continue;
    for (const s of t.split(/\s+/)) { const v = Number(s); vals.push(Number.isFinite(v) ? v : NaN); }
  }
  // ZMAP+ is column-major, top-down within each column
  const values = new Float64Array(ncol * nrow).fill(NaN);
  for (let c = 0; c < ncol; c++) {
    for (let r = 0; r < nrow; r++) {
      const v = vals[c * nrow + r];
      if (v === undefined) continue;
      values[(nrow - 1 - r) * ncol + c] = (!Number.isFinite(v) || Math.abs(v - nullValue) < 1e-6 || v >= 1e30) ? NaN : v;
    }
  }
  const dx = ncol > 1 ? (xmax - xmin) / (ncol - 1) : 1;
  const dy = nrow > 1 ? (ymax - ymin) / (nrow - 1) : 1;
  return { name: 'zmap', ncol, nrow, values, x0: xmin, y0: ymin, dx, dy, zUnits: 'meters', nullValue };
}

/** Scattered/gridded XYZ (+ optional trailing attribute columns).
 *  Snapped onto the inferred regular lattice. Truly scattered data (no consistent
 *  spacing) is reported by QC — we bin, we never krige here (engine/geostat owns that). */
export function parseXyz(text: string): DigestedSurface & { attributes: string[] } {
  const xs: number[] = [], ys: number[] = [], zs: number[] = [];
  let attrCount = 0;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('!')) continue;
    const p = t.split(/[\s,;]+/).map(Number);
    if (p.length < 3 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    xs.push(p[0]); ys.push(p[1]); zs.push(Number.isFinite(p[2]) ? p[2] : NaN);
    attrCount = Math.max(attrCount, Math.max(0, p.length - 3));
  }
  if (!xs.length) throw new Error('No XYZ rows found.');
  const ux = [...new Set(xs)].sort((a, b) => a - b);
  const uy = [...new Set(ys)].sort((a, b) => a - b);
  const dx = ux.length > 1 ? median(diffs(ux)) : 1;
  const dy = uy.length > 1 ? median(diffs(uy)) : 1;
  const x0 = ux[0], y0 = uy[0];
  const ncol = Math.max(1, Math.round((ux[ux.length - 1] - x0) / dx) + 1);
  const nrow = Math.max(1, Math.round((uy[uy.length - 1] - y0) / dy) + 1);
  const values = new Float64Array(ncol * nrow).fill(NaN);
  for (let i = 0; i < xs.length; i++) {
    const c = Math.round((xs[i] - x0) / dx), r = Math.round((ys[i] - y0) / dy);
    if (c < 0 || r < 0 || c >= ncol || r >= nrow) continue;
    values[r * ncol + c] = zs[i];
  }
  return {
    name: 'xyz', ncol, nrow, values, x0, y0, dx, dy, zUnits: 'meters',
    attributes: Array.from({ length: attrCount }, (_, i) => `attr${i + 1}`),
  };
}

const diffs = (a: number[]) => a.slice(1).map((v, i) => v - a[i]).filter((d) => d > 0);
const median = (a: number[]) => { if (!a.length) return 1; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

/** EarthVision grid ASCII (`x y z col row`) — reuses the shipped, truth-locked parser.
 *  Note: EarthVision carries no dims header, so the grid is the extent of the
 *  indices actually present. An all-null trailing row/column simply isn't in the
 *  file and is not recoverable (it also carries no information).
 *  Origin/spacing come from a least-squares affine over ALL nodes rather than the
 *  first line, so a file that doesn't start at col/row 1 still anchors correctly. */
export function parseEarthVision(text: string): DigestedSurface {
  const P = parseEV(text);
  if (!P.ncol || !P.nrow) throw new Error('EarthVision grid has no col/row indices.');
  const values = new Float64Array(P.ncol * P.nrow).fill(NaN);
  for (let i = 0; i < P.zs.length; i++) {
    const c = P.cs[i] - 1, r = P.rs[i] - 1;
    if (c < 0 || r < 0 || c >= P.ncol || r >= P.nrow) continue;
    values[r * P.ncol + c] = P.zs[i];
  }
  // x ≈ ax0 + ax1·col + ax2·row  → node (col=1,row=1) is the grid origin
  const ax = fitAffine(P.cs, P.rs, P.xs);
  const ay = fitAffine(P.cs, P.rs, P.ys);
  const x0 = ax[0] + ax[1] + ax[2];
  const y0 = ay[0] + ay[1] + ay[2];
  const dx = ax[1] || 1;
  const dy = ay[2] || 1;
  return { name: 'earthvision', ncol: P.ncol, nrow: P.nrow, values, x0, y0, dx, dy, zUnits: P.meta.z_units };
}

/** Format sniffing by content, not extension — clients rename files. */
export function detectSurfaceFormat(text: string, fileName = ''): SurfaceFormat | null {
  const head = text.slice(0, 4000);
  if (/^\s*-996\b/m.test(head)) return 'irap-ascii';
  if (/^@.*GRID/im.test(head)) return 'zmap';
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  // EarthVision: 5 numeric columns where cols 4/5 are small positive integers
  const sample = head.split(/\r?\n/).filter((l) => l.trim() && !l.trimStart().startsWith('#')).slice(0, 12);
  if (sample.length) {
    const five = sample.filter((l) => {
      const p = l.trim().split(/\s+/);
      return p.length >= 5 && p.every((t) => Number.isFinite(Number(t)))
        && Number.isInteger(Number(p[3])) && Number.isInteger(Number(p[4]))
        && Number(p[3]) > 0 && Number(p[4]) > 0;
    }).length;
    if (five >= Math.max(2, sample.length * 0.6)) return 'earthvision';
    const three = sample.filter((l) => l.trim().split(/[\s,;]+/).filter(Boolean).length >= 3).length;
    if (three >= Math.max(2, sample.length * 0.6)) return 'xyz';
  }
  if (ext === 'irap' || ext === 'gri') return 'irap-ascii';
  if (ext === 'xyz' || ext === 'dat') return 'xyz';
  return null;
}

export function parseSurface(text: string, format: SurfaceFormat): DigestedSurface {
  if (format === 'irap-ascii') return parseIrapAscii(text);
  if (format === 'zmap') return parseZmap(text);
  if (format === 'earthvision') return parseEarthVision(text);
  return parseXyz(text);
}
