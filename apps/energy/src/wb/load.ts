// wb/load.ts — lazy, cached fetch of the wb data assets from /wb/.
// NEVER imported into the bundle; every asset is fetched at runtime and memoised.

import type { WbIndex, LogsJson, TrajJson, PicksJson, ProdJson } from './types';
import type { SurfaceJson } from '../engine/grid';

const BASE = `${import.meta.env.BASE_URL || '/'}wb`;
const cache = new Map<string, Promise<unknown>>();

function get<T>(path: string): Promise<T> {
  const key = path;
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${BASE}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`wb fetch failed: ${path} (${r.status})`);
      return r.json() as Promise<T>;
    });
    cache.set(key, p as Promise<unknown>);
  }
  return p;
}

/** Slug a well display name to its wb file token (e.g. "F-15 D" → "f-15-d"). */
export function wellSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export const loadIndex = () => get<WbIndex>('index.json');
export const loadSurface = (id: string) => get<SurfaceJson>(`surface-${id}.json`);
export const loadLogs = (well: string) => get<LogsJson>(`logs-${wellSlug(well)}.json`);
export const loadTraj = (well: string) => get<TrajJson>(`traj-${wellSlug(well)}.json`);
export const loadPicks = () => get<PicksJson>('picks.json');
export const loadProd = (well: string) => get<ProdJson>(`prod-${wellSlug(well)}.json`);
export const loadProdField = () => get<ProdJson>('prod-field.json');
