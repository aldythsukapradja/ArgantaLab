// grid-build.ts — zone model → per-zone GridModel → ONE PackedGrid3D (S3).
//
// WHY ZONE BY ZONE. `grid3d.GridModel` is the naive representation: seven Float64
// arrays plus two Uint8, about 58 bytes per cell. `pack3d.PackedGrid3D` is 8. The
// truth-lock measures the ratio at 6.5×, and that ratio is the whole reason a
// 10-million-cell model is possible at all — 80 MB packed against 580 MB built.
//
// But you cannot pack what you have not built. Materialising the entire GridModel
// and then packing it means paying the 580 MB anyway, just briefly, which is exactly
// as impossible as paying it permanently. So each zone is built, packed, and
// released before the next one starts: peak memory becomes the largest single zone
// rather than the whole model.
//
// The zones are then stitched into one PackedGrid3D by concatenating in K, which
// works because every zone was resampled onto the SAME areal frame by zone-model.ts.
// That is what the common grid was for.
import { buildGrid, type GridModel } from '../../engine/grid3d.ts';
import { packGrid3D, type PackedGrid3D, type PackedProp } from '../../engine/pack3d.ts';
import { zoneToGridSpec, type ZoneModel, type ZoneSpec } from './zone-model.ts';

export interface BuildProgress {
  zone: number;
  zones: number;
  name: string;
  /** cells packed so far */
  cells: number;
  /** peak bytes held at once — the number the zone-by-zone strategy exists to keep down */
  peakBytes: number;
}

/** What a built model reports about itself. Measured, not estimated. */
export interface BuiltGrid {
  packed: PackedGrid3D;
  /**
   * Per-zone layer counts AND the zone's own bounding surfaces.
   *
   * The surfaces are NOT optional bookkeeping. `PackedGrid3D` carries one top and
   * one base per column — the shallowest and the deepest across the whole model —
   * so reconstructing the depth of layer k as `top + k·(base−top)/nz` assumes every
   * zone is equally thick. On Volve the zones run from 71 m (Hugin) to 1,193 m
   * (Seabed→Ty), and that assumption put the reservoir crest at 2,003 m instead of
   * ~2,750 m. Every consumer that needs a layer's true depth must use
   * `layerSpan()` below, which reads these.
   */
  zoneLayers: Array<{
    name: string; nz: number; k0: number;
    topZ: Float32Array; baseZ: Float32Array;
  }>;
  cells: number;
  activeCells: number;
  packedBytes: number;
  /** the largest single GridModel held during the build */
  peakBuildBytes: number;
  ms: number;
}

/** Bytes a GridModel of this many cells occupies — 7×Float64 + 2×Uint8 per cell. */
const gridModelBytes = (cells: number) => cells * (8 * 7 + 1 + 1);

/**
 * Fill a zone's properties with a constant. v1 has no facies/φ/k yet — those arrive
 * from S4/S6/S7 — and a grid with all-zero porosity would silently report zero HCPV
 * as though it had been computed. NTG 1 / φ 0 / Sw 1 is the honest empty state: a
 * geometric grid that has not been populated, and every volume it produces is zero
 * for a reason a reader can see.
 */
function fillGeometricOnly(g: GridModel): void {
  g.ntg.fill(1);
  g.phi.fill(0);
  g.sw.fill(1);
  g.perm.fill(0);
  g.facies.fill(0);
}

/**
 * Build and pack, one zone at a time.
 *
 * `onProgress` fires per zone so a long build reports rather than freezing. Yields
 * between zones so the UI can paint — this runs on the main thread for now; moving
 * it to a Worker is a transport change, not a logic change, because everything it
 * returns is already transferable typed arrays.
 */
export async function buildPackedGrid(
  model: ZoneModel,
  onProgress?: (p: BuildProgress) => void,
): Promise<BuiltGrid> {
  const t0 = Date.now();
  const { nx, ny, dx, dy, x0, y0 } = model.grid;
  const nCol = nx * ny;

  const packedZones: PackedGrid3D[] = [];
  const zoneLayers: BuiltGrid['zoneLayers'] = [];
  let peak = 0;
  let k0 = 0;

  for (let z = 0; z < model.zones.length; z++) {
    const zone: ZoneSpec = model.zones[z];
    const cells = nCol * zone.nz;
    peak = Math.max(peak, gridModelBytes(cells));

    const g = buildGrid(zoneToGridSpec(zone, model.grid));
    fillGeometricOnly(g);
    packedZones.push(packGrid3D(g));
    zoneLayers.push({
      name: zone.name, nz: zone.nz, k0,
      // the zone's OWN surfaces, kept so a layer's true depth stays recoverable
      topZ: Float32Array.from(zone.topZ),
      baseZ: Float32Array.from(zone.baseZ),
    });
    k0 += zone.nz;

    onProgress?.({
      zone: z + 1, zones: model.zones.length, name: zone.name,
      cells: packedZones.reduce((a, p) => a + p.nx * p.ny * p.nz, 0),
      peakBytes: peak,
    });
    // let the frame land — a build that blocks the canvas for four seconds looks
    // identical to one that crashed
    await new Promise((r) => setTimeout(r, 0));
  }

  const packed = stitchZones(packedZones, { nx, ny, dx, dy, x0, y0 });
  let activeCells = 0;
  for (let c = 0; c < packed.activeCol.length; c++) if (packed.activeCol[c]) activeCells += packed.nz;

  return {
    packed,
    zoneLayers,
    cells: packed.nx * packed.ny * packed.nz,
    activeCells,
    packedBytes: packed.bytes,
    peakBuildBytes: peak,
    ms: Date.now() - t0,
  };
}

/**
 * Concatenate zone-packed grids along K into one PackedGrid3D.
 *
 * Valid only because every zone shares the areal frame. The stitched model's top is
 * the shallowest zone's top and its base is the deepest zone's base; a column is
 * active if ANY zone has it, because a column that exists in the reservoir zone but
 * not in the overburden is still a column of the model.
 */
export function stitchZones(
  zones: PackedGrid3D[],
  frame: { nx: number; ny: number; dx: number; dy: number; x0: number; y0: number },
): PackedGrid3D {
  if (zones.length === 1) return zones[0];
  const { nx, ny, dx, dy, x0, y0 } = frame;
  const nCol = nx * ny;
  const nz = zones.reduce((a, z) => a + z.nz, 0);

  const topZ = new Float32Array(nCol).fill(NaN);
  const baseZ = new Float32Array(nCol).fill(NaN);
  const activeCol = new Uint8Array(nCol);
  for (const z of zones) {
    for (let c = 0; c < nCol; c++) {
      if (!z.activeCol[c]) continue;
      activeCol[c] = 1;
      if (!Number.isFinite(topZ[c]) || z.topZ[c] < topZ[c]) topZ[c] = z.topZ[c];
      if (!Number.isFinite(baseZ[c]) || z.baseZ[c] > baseZ[c]) baseZ[c] = z.baseZ[c];
    }
  }

  // property arrays are [ncol · nz] with K major — concatenating zone slabs in K
  // order is a straight append per zone
  const names = zones[0].props.map((p) => p.name);
  const props: PackedProp[] = names.map((name) => {
    const first = zones[0].props.find((p) => p.name === name)!;
    const total = nCol * nz;
    const data = first.dtype === 'u16' ? new Uint16Array(total) : new Uint8Array(total);
    let min = Infinity, max = -Infinity;
    let off = 0;
    for (const z of zones) {
      const src = z.props.find((p) => p.name === name);
      if (src) {
        data.set(src.data as never, off);
        if (!src.categorical) { min = Math.min(min, src.min); max = Math.max(max, src.max); }
      }
      off += nCol * z.nz;
    }
    return {
      name, dtype: first.dtype, categorical: first.categorical,
      min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 1,
      data,
    };
  });

  const bytes = props.reduce((a, p) => a + p.data.byteLength, 0)
    + topZ.byteLength + baseZ.byteLength + activeCol.byteLength;

  return { nx, ny, nz, dx, dy, x0, y0, stride: zones[0].stride, topZ, baseZ, activeCol, props, bytes };
}

/**
 * The true depth span of layer `k` in column `c`.
 *
 * Layers are proportional WITHIN their zone, so the span comes from that zone's own
 * top and base — never from the model-wide top/base, which span the whole section.
 * Returns null when the column is not in that zone.
 */
export function layerSpan(built: BuiltGrid, c: number, k: number): { top: number; base: number } | null {
  const zone = built.zoneLayers.find((z) => k >= z.k0 && k < z.k0 + z.nz);
  if (!zone) return null;
  const t = zone.topZ[c], b = zone.baseZ[c];
  if (!Number.isFinite(t) || !Number.isFinite(b) || b <= t) return null;
  const thk = (b - t) / zone.nz;
  const local = k - zone.k0;
  return { top: t + local * thk, base: t + (local + 1) * thk };
}

/** The zone a layer belongs to. */
export const zoneOfLayer = (built: BuiltGrid, k: number): string | null =>
  built.zoneLayers.find((z) => k >= z.k0 && k < z.k0 + z.nz)?.name ?? null;

/** A named zone's own bounding surfaces — what a closure is made of. */
export function zoneSurfaces(built: BuiltGrid, name: string): { topZ: Float32Array; baseZ: Float32Array } | null {
  const z = built.zoneLayers.find((x) => x.name === name);
  return z ? { topZ: z.topZ, baseZ: z.baseZ } : null;
}
