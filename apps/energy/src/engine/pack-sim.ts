// pack-sim.ts (G4) — pack a dynamic-simulation saturation sequence (from sim/fv.ts:
// FvResult.snapshots[].sw, areal [nx·ny] per frame) into a compact, GPU-friendly payload
// for the lightweight 3D HC-flow viewer. GVSURF-family: quantise Sw → Uint8 over the
// global [min,max]; store each frame ABSOLUTE (flat [nt·ncell] Uint8). Rationale: O(1)
// frame access for scrubbing (no delta accumulation), always-correct, and gzips well on
// the wire (fflate) for both smooth AND sharp fronts — delta-Int16 only wins for very
// slow fluid and loses on sharp fronts, so absolute is the robust default. Pure TS.
//
// The 3D viewer uploads one frame as a DataTexture (R = saturation, A = active) and drapes
// it on the reservoir surface / thin volume; scrubbing = one cheap texture upload, never a
// geometry rebuild → cheap at any cell count and buttery even at coarse dt.

export interface SimPack {
  nx: number; ny: number; nt: number;   // grid + frame count
  dt: number;                           // seconds (or PVI step) per frame — display only
  min: number; max: number;             // Sw dequant range
  data: Uint8Array;                     // [nt·ncell] absolute quantised saturation (row-major per frame)
  active: Uint8Array;                   // [ncell] 1 = live cell (phi>0)
  bytes: number;                        // raw payload size (pre-gzip)
}

const QMAX = 255;

/** Pack a sequence of areal Sw frames → SimPack (absolute Uint8 per frame). */
export function packSimFrames(
  frames: ReadonlyArray<ArrayLike<number>>,
  meta: { nx: number; ny: number; dt?: number; active?: ArrayLike<number>; min?: number; max?: number },
): SimPack {
  const { nx, ny } = meta;
  const ncell = nx * ny, nt = frames.length;
  if (nt === 0) throw new Error('packSimFrames: no frames');

  let min = meta.min ?? Infinity, max = meta.max ?? -Infinity;
  if (meta.min == null || meta.max == null) {
    for (const f of frames) for (let c = 0; c < ncell; c++) { const v = f[c]; if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; } }
    if (min > max) { min = 0; max = 1; }
  }
  const span = (max - min) || 1;
  const q = (v: number) => Math.max(0, Math.min(QMAX, Math.round(((v - min) / span) * QMAX)));

  const active = new Uint8Array(ncell);
  for (let c = 0; c < ncell; c++) active[c] = meta.active ? (meta.active[c] >= 0.5 ? 1 : 0) : 1;

  const data = new Uint8Array(nt * ncell);
  for (let t = 0; t < nt; t++) { const f = frames[t], off = t * ncell; for (let c = 0; c < ncell; c++) data[off + c] = active[c] ? q(f[c]) : 0; }

  return { nx, ny, nt, dt: meta.dt ?? 1, min, max, data, active, bytes: data.byteLength + active.byteLength };
}

const frameOffset = (p: SimPack, t: number) => Math.max(0, Math.min(p.nt - 1, t | 0)) * p.nx * p.ny;

/** The quantised (0..255) saturation for a frame — O(1), a view into the payload. */
export function quantFrame(p: SimPack, t: number): Uint8Array {
  const off = frameOffset(p, t), ncell = p.nx * p.ny;
  return p.data.subarray(off, off + ncell);
}

/** Physical Sw for a frame (inactive → NaN). */
export function dequantFrame(p: SimPack, t: number): Float32Array {
  const qf = quantFrame(p, t), span = (p.max - p.min) || 1, out = new Float32Array(qf.length);
  for (let c = 0; c < qf.length; c++) out[c] = p.active[c] ? p.min + (qf[c] / QMAX) * span : NaN;
  return out;
}

/** RGBA texture bytes for a frame (R = saturation 0..255, A = active) — upload per scrub. */
export function frameTexture(p: SimPack, t: number): Uint8Array {
  const qf = quantFrame(p, t), ncell = qf.length, out = new Uint8Array(ncell * 4);
  for (let c = 0; c < ncell; c++) { out[c * 4] = qf[c]; out[c * 4 + 3] = p.active[c] ? 255 : 0; }
  return out;
}
