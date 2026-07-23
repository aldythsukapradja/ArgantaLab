// nsr/types.ts — canonical "North Sea Reference" (NSR) schema. One shape for BOTH
// sectors (Norway · Sodir / UK · NSTA), normalised by scripts/build-northsea.mjs and
// served from /nsr/*.json as GeoJSON FeatureCollections. Geometry is WGS84 (EPSG:4326);
// reproject to the app's ED50/UTM31N display frame on the client. Every record keeps its
// native datum + regulator id so provenance is never lost. Licences/attribution: see
// docs/arganta-energy/DATA-LICENSES.md. Do NOT inline these assets — fetch via nsr/load.ts.

export type Sector = 'NO' | 'UK';
/** canonical id = `{sector}:{type}:{nativeId}` — e.g. "NO:field:3420717", "NO:block:15/9". */
export type NsrId = string;

export type GeoGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: 'Point'; coordinates: number[] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: string; coordinates: unknown };

export interface NsrFeature<P> { type: 'Feature'; properties: P; geometry: GeoGeometry | null }
export interface NsrCollection<P> { type: 'FeatureCollection'; features: Array<NsrFeature<P>> }

interface NsrBase {
  id: NsrId; sector: Sector; name: string;
  source: 'Sodir' | 'NSTA'; licence: string;
}

export interface NsrQuadrant extends NsrBase { native?: Record<string, unknown> }
export interface NsrBlock extends NsrBase { quadrant?: string; npdid?: number; licenceRef?: string; status?: string }
export interface NsrLicence extends NsrBase {
  operator?: string; status?: string; round?: string | number; type?: string; npdid?: number;
}
export interface NsrField extends NsrBase {
  operator?: string; status?: string; hcType?: string;
  discoveryYear?: number; discoveryWellbore?: string; npdid?: number; nativeNo?: string;
}
export interface NsrDiscovery extends NsrBase { year?: number; field?: string; npdid?: number }
export interface NsrWellbore extends NsrBase {
  parentWell?: string; quadrant?: string | null; block?: string | null;
  operator?: string; purpose?: string; status?: string; content?: string;
  licenceRef?: string; field?: string; completion?: number | string;
  tdMd?: number; waterDepth?: number; utmZone?: number; datum?: string; npdid?: number;
}

export interface NsrManifest {
  version: string; generatedAt: string; crs: string;
  aoiPolygons: { xmin: number; ymin: number; xmax: number; ymax: number };
  aoiWellbores: { xmin: number; ymin: number; xmax: number; ymax: number };
  sources: Record<Sector, { name: string; licence: string; attribution: string }>;
  counts: Record<string, { NO: number; UK: number }>;
  volveAnchor: { found: boolean; npdid?: number; operator?: string; status?: string;
    discoveryYear?: number; discoveryWellbore?: string; note?: string };
}
