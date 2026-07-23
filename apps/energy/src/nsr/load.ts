// nsr/load.ts — lazy, cached fetch of the North Sea Reference assets from /nsr/.
// NEVER imported into the bundle; every asset is fetched at runtime and memoised.
// Mirrors wb/load.ts. Assets are built by scripts/build-northsea.mjs (npm run data:nsr).

import type {
  NsrCollection, NsrManifest, NsrQuadrant, NsrBlock, NsrLicence,
  NsrField, NsrDiscovery, NsrWellbore, NsrFeature,
} from './types';

const BASE = `${import.meta.env.BASE_URL || '/'}nsr`;
const cache = new Map<string, Promise<unknown>>();

function get<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${BASE}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`nsr fetch failed: ${path} (${r.status}) — run "npm run data:nsr"`);
      return r.json() as Promise<T>;
    });
    cache.set(path, p as Promise<unknown>);
  }
  return p;
}

export const loadNsrManifest = () => get<NsrManifest>('index.json');
export const loadQuadrants = () => get<NsrCollection<NsrQuadrant>>('nsr-quadrants.json');
export const loadBlocks = () => get<NsrCollection<NsrBlock>>('nsr-blocks.json');
export const loadLicences = () => get<NsrCollection<NsrLicence>>('nsr-licences.json');
export const loadFields = () => get<NsrCollection<NsrField>>('nsr-fields.json');
export const loadDiscoveries = () => get<NsrCollection<NsrDiscovery>>('nsr-discoveries.json');
export const loadWellbores = () => get<NsrCollection<NsrWellbore>>('nsr-wellbores.json');

/** The Volve field polygon + authority record (Sodir, NPDID 3420717). */
export async function loadVolveField(): Promise<NsrFeature<NsrField> | null> {
  const fc = await loadFields();
  return fc.features.find((f) => /^volve$/i.test(f.properties.name)) ?? null;
}

/** Crosswalk a `wb` well display name ("F-12", "15/9-19 A") to its Sodir wellbore record.
 *  wb names are block-stripped; Sodir carries the full "15/9-" prefix. */
export async function crosswalkWell(wbName: string): Promise<NsrFeature<NsrWellbore> | null> {
  const fc = await loadWellbores();
  const want = wbName.trim().toUpperCase();
  const full = `15/9-${want}`.toUpperCase();
  return fc.features.find((w) => {
    const n = (w.properties.name || '').toUpperCase();
    return n === want || n === full || n === `15/9-F-${want}`;
  }) ?? null;
}
