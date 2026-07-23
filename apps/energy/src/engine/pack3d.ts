// pack3d.ts (G2) — pack a static 3D GridModel into a compact, transfer-friendly payload
// for GPU-scale rendering (GridVolume). Pure TS, no three/DOM — unit-testable.
//
// The GridModel is a regular Cartesian I/J grid with PROPORTIONAL layering, so:
//   • geometry collapses to TWO per-column surfaces (topZ, baseZ) + an active-column mask —
//     every cell's Z/thickness/bulk reconstructs exactly (thk = (base−top)/nz). That's
//     O(nx·ny) numbers instead of O(nx·ny·nz).
//   • properties (φ·NTG·Sw·facies·perm) pack to quantised typed arrays: Uint16 for the
//     volume-affecting continuous props (φ/NTG/Sw → HCPV stays exact to ~1e-4), Uint8 for
//     display props (perm) and raw categorical (facies 0/1).
// The worker rebuilds a single shell+slice BufferGeometry + a Data3DTexture from this.
//
// Index convention matches grid3d.ts: cell = (l·ny + k)·nx + i  (l=layer/z, k=row/y, i=col/x).
import type { GridModel } from './grid3d';

export type PropDtype = 'u8' | 'u16';
export interface PackedProp {
  name: string;
  dtype: PropDtype;
  categorical: boolean;         // facies: raw integer codes, no min/max normalisation
  min: number; max: number;     // dequant range (continuous props)
  data: Uint8Array | Uint16Array; // [ncol·nz], normalised 0..(2^bits−1) (or raw code if categorical)
}
export interface PackedGrid3D {
  nx: number; ny: number; nz: number;   // (possibly strided) cell counts
  dx: number; dy: number; x0: number; y0: number;
  stride: number;                       // LOD areal decimation (1 = full res)
  topZ: Float32Array;                   // [ncol] per-column top TVDSS (NaN = inactive)
  baseZ: Float32Array;                  // [ncol] per-column base TVDSS
  activeCol: Uint8Array;                // [ncol] 1 = column in model
  props: PackedProp[];
  bytes: number;                        // payload size (for LOD budget / logging)
}

const DTYPE_MAX = { u8: 255, u16: 65535 } as const;
const NaN32 = Number.NaN;

// which props to pack + their dtype (volume-affecting → u16 for HCPV fidelity)
const DEFAULT_PROPS: Array<{ name: keyof GridModel & string; dtype: PropDtype; categorical: boolean }> = [
  { name: 'phi', dtype: 'u16', categorical: false },
  { name: 'sw', dtype: 'u16', categorical: false },
  { name: 'ntg', dtype: 'u16', categorical: false },
  { name: 'facies', dtype: 'u8', categorical: true },
  { name: 'perm', dtype: 'u8', categorical: false },
];

export interface PackOpts {
  props?: Array<{ name: keyof GridModel & string; dtype?: PropDtype; categorical?: boolean }>;
  stride?: number; // areal LOD (1 default); >1 nearest-subsamples columns (overview only)
}

/** Pack a GridModel → PackedGrid3D (transfer-friendly typed arrays). */
export function packGrid3D(g: GridModel, opts: PackOpts = {}): PackedGrid3D {
  const stride = Math.max(1, Math.floor(opts.stride ?? 1));
  const nz = g.nz;
  const nx = Math.ceil(g.nx / stride), ny = Math.ceil(g.ny / stride);
  const ncol = nx * ny, ncell = ncol * nz;

  const topZ = new Float32Array(ncol);
  const baseZ = new Float32Array(ncol);
  const activeCol = new Uint8Array(ncol);
  // source column at strided (i,k) — nearest sample
  const srcCol = (i: number, k: number) => (k * stride) * g.nx + (i * stride);
  const srcCell = (i: number, k: number, l: number) => (l * g.ny + k * stride) * g.nx + (i * stride);

  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    const dc = k * nx + i, sc = srcCol(i, k);
    const t = g.topZ[sc], b = g.baseZ[sc];
    const ok = Number.isFinite(t) && Number.isFinite(b) && b > t && g.active[srcCell(i, k, 0)] >= 1;
    topZ[dc] = ok ? t : NaN32; baseZ[dc] = ok ? b : NaN32; activeCol[dc] = ok ? 1 : 0;
  }

  const propSpecs = (opts.props ?? DEFAULT_PROPS).map((p) => ({ dtype: p.dtype ?? 'u16', categorical: p.categorical ?? false, name: p.name }));
  const props: PackedProp[] = propSpecs.map((spec) => {
    const src = g[spec.name] as ArrayLike<number>;
    // min/max over ACTIVE cells (continuous); categorical keeps raw codes
    let min = Infinity, max = -Infinity;
    if (!spec.categorical) {
      for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
        if (!activeCol[k * nx + i]) continue;
        for (let l = 0; l < nz; l++) { const v = src[srcCell(i, k, l)]; if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; } }
      }
      if (min > max) { min = 0; max = 1; }
    } else { min = 0; max = 0; }
    const qmax = DTYPE_MAX[spec.dtype];
    const data = spec.dtype === 'u8' ? new Uint8Array(ncell) : new Uint16Array(ncell);
    const span = max - min || 1;
    for (let l = 0; l < nz; l++) for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
      const dci = (l * ny + k) * nx + i;
      if (!activeCol[k * nx + i]) { data[dci] = 0; continue; }
      const v = src[srcCell(i, k, l)];
      data[dci] = spec.categorical ? (Number.isFinite(v) ? Math.round(v) : 0)
        : Math.max(0, Math.min(qmax, Math.round(((v - min) / span) * qmax)));
    }
    return { name: spec.name, dtype: spec.dtype, categorical: spec.categorical, min, max, data };
  });

  const bytes = topZ.byteLength + baseZ.byteLength + activeCol.byteLength + props.reduce((a, p) => a + p.data.byteLength, 0);
  return { nx, ny, nz, dx: g.dx * stride, dy: g.dy * stride, x0: g.x0, y0: g.y0, stride, topZ, baseZ, activeCol, props, bytes };
}

/** Dequantise a packed property back to Float32 [ncol·nz] (inactive cells → NaN). */
export function dequantProp(p: PackedGrid3D, name: string): Float32Array {
  const prop = p.props.find((x) => x.name === name);
  if (!prop) throw new Error(`packed prop not found: ${name}`);
  const out = new Float32Array(prop.data.length);
  const qmax = DTYPE_MAX[prop.dtype], span = (prop.max - prop.min) || 1;
  const nx = p.nx, ny = p.ny;
  for (let l = 0; l < p.nz; l++) for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    const ci = (l * ny + k) * nx + i;
    if (!p.activeCol[k * nx + i]) { out[ci] = NaN32; continue; }
    out[ci] = prop.categorical ? prop.data[ci] : prop.min + (prop.data[ci] / qmax) * span;
  }
  return out;
}

/** Reconstruct per-cell bulk volume from the packed surfaces (proportional layering). */
export function reconstructBulk(p: PackedGrid3D): Float32Array {
  const { nx, ny, nz, dx, dy } = p;
  const out = new Float32Array(nx * ny * nz);
  const cellArea = dx * dy;
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    const col = k * nx + i;
    if (!p.activeCol[col]) continue;
    const thk = (p.baseZ[col] - p.topZ[col]) / nz;
    const bulk = cellArea * thk;
    for (let l = 0; l < nz; l++) out[(l * ny + k) * nx + i] = bulk;
  }
  return out;
}

/** HCPV from the packed payload — the round-trip gate vs grid3d.gridHcpv (must match). */
export function hcpvFromPacked(p: PackedGrid3D): number {
  const bulk = reconstructBulk(p);
  const phi = dequantProp(p, 'phi'), ntg = dequantProp(p, 'ntg'), sw = dequantProp(p, 'sw');
  let s = 0;
  for (let c = 0; c < bulk.length; c++) {
    const b = bulk[c]; if (!b) continue;
    if (Number.isFinite(phi[c]) && Number.isFinite(ntg[c]) && Number.isFinite(sw[c])) s += b * ntg[c] * phi[c] * (1 - sw[c]);
  }
  return s;
}
