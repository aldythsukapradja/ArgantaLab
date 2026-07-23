// world/load.ts — lazy, cached fetch of the USGS world-assessment assets from /world/.
// NEVER imported into the bundle; every asset is fetched at runtime and memoised.
// Mirrors wb/load.ts + nsr/load.ts. Assets are a one-time static extract (USGS 2012 is
// fixed) built by scripts/extract-usgs-world.py — committed under public/world/.

import type {
  GeoCollection, WorldManifest, WorldProvinceProps, WorldAUProps, WorldRegion, WorldCountry, GeoFeature,
} from './types';

const BASE = `${import.meta.env.BASE_URL || '/'}world`;
const cache = new Map<string, Promise<unknown>>();

function get<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${BASE}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`world fetch failed: ${path} (${r.status})`);
      return r.json() as Promise<T>;
    });
    cache.set(path, p as Promise<unknown>);
  }
  return p;
}

export const loadWorldManifest = () => get<WorldManifest>('index.json');
export const loadWorldProvinces = () => get<GeoCollection<WorldProvinceProps>>('provinces.geojson');
export const loadWorldAUs = () => get<GeoCollection<WorldAUProps>>('aus.geojson');
export const loadWorldRegions = () => get<WorldRegion[]>('regions.json');
export const loadWorldCountries = () => get<WorldCountry[]>('countries.json');

/** Volve's home assessment unit (Viking Graben, 40250101) — the "world → proof field" link. */
export async function loadVolveAU(): Promise<GeoFeature<WorldAUProps> | null> {
  const fc = await loadWorldAUs();
  return fc.features.find((f) => f.properties.auCode === '40250101') ?? null;
}

/** Volve's home province polygon (North Sea Graben, 4025). */
export async function loadVolveProvince(): Promise<GeoFeature<WorldProvinceProps> | null> {
  const fc = await loadWorldProvinces();
  return fc.features.find((f) => f.properties.prvCode === '4025') ?? null;
}
