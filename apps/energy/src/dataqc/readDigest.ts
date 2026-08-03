// dataqc/readDigest.ts — read a stored digest back out for display.
// Stage 3 wrote gzipped JSON into IndexedDB; the viewers need it inflated.
// Cached per asset id so re-opening a viewer is instant.
import { gunzipSync } from 'fflate';
import { getBlob } from './db.ts';
import type { DigestedLog, DigestedSurface, IngestedAsset } from './types.ts';
import type { GvSurf } from '../engine/gvsurf.ts';

const cache = new Map<string, unknown>();

export async function readDigest<T = unknown>(asset: IngestedAsset): Promise<T | null> {
  if (!asset.digestKey) return null;
  const hit = cache.get(asset.id);
  if (hit !== undefined) return hit as T;
  const blob = await getBlob(asset.digestKey);
  if (!blob) return null;
  const buf = new Uint8Array(await blob.arrayBuffer());
  const json = JSON.parse(new TextDecoder().decode(gunzipSync(buf)));
  cache.set(asset.id, json);
  return json as T;
}

export const readLog = (a: IngestedAsset) => readDigest<DigestedLog>(a);
export const readSurface = (a: IngestedAsset) => readDigest<GvSurf>(a);

/** Surfaces are stored as GVSURF (int16 + gzip). Decode to a plain grid for drawing. */
export async function readSurfaceGrid(a: IngestedAsset): Promise<DigestedSurface | null> {
  const gv = await readSurface(a);
  if (!gv) return null;
  const { decodeSurface } = await import('../engine/gvsurf.ts');
  const d = decodeSurface(gv);
  const values = new Float64Array(d.ncol * d.nrow);
  for (let r = 0; r < d.nrow; r++) {
    for (let c = 0; c < d.ncol; c++) values[r * d.ncol + c] = d.depth(c, r);
  }
  return {
    name: d.name, ncol: d.ncol, nrow: d.nrow, values,
    x0: d.affine.x0, y0: d.affine.y0, dx: d.affine.xc || 1, dy: d.affine.yr || 1,
    zUnits: gv.z_units,
  };
}

/** Trajectories / picks / production keep their source JSON shape. */
export const readRecord = <T>(a: IngestedAsset) => readDigest<T>(a);
