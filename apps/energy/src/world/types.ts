// world/types.ts — USGS 2012 World Assessment (DDS-69) reference schema. The global
// ENDOWMENT layer of the "world petroleum brain": undiscovered oil/gas by geology, with
// province/AU boundary polygons for the choropleth globe. PUBLIC DOMAIN (US Geological
// Survey) → shippable. Built by scripts/extract-usgs-world.py → /world/*. Geometry WGS84.
// Volve's context lives at Region 4 (Europe) → Province 4025 (North Sea Graben) → AU
// 40250101 (Viking Graben). Do NOT inline these assets — fetch via world/load.ts.

export interface GeoFeature<P> {
  type: 'Feature';
  properties: P;
  geometry: { type: string; coordinates: unknown } | null;
}
export interface GeoCollection<P> { type: 'FeatureCollection'; features: Array<GeoFeature<P>> }

/** Undiscovered-resource means (USGS Monte-Carlo). Oil MMBO · gas BCFG · BOE MMBOE @6:1. */
export interface Resource { oilMean: number | null; gasMean: number | null; boeMean: number | null }

export interface WorldProvinceProps extends Resource { prvCode: string; prvName: string }
export interface WorldAUProps extends Resource {
  auCode: string; auName: string; tps: string | null;
  prvCode: string; prvName: string; regCode: string | null; regName: string;
}
export interface WorldRegion extends Resource { code: string | null; name: string }
export interface WorldCountry extends Resource { code: string | null; name: string }

export interface WorldManifest {
  version: string; source: string; licence: string; crs: string;
  counts: { regions: number; countries: number; provinces: number; aus: number };
  volveContext: {
    region: string; province: string; au: string;
    provinceResource: WorldProvinceProps | null;
  };
}
