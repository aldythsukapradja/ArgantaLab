// cockpit-providers.ts — sovereign basemap provider SEAM (handoff §3).
// Provider URLs are CONFIGURATION, never embedded in the renderer. Production swaps these
// for a contracted provider or operator-hosted raster/vector tiles WITHOUT editing the map
// component. Override at deploy time via Vite env (VITE_COCKPIT_*_TILES / _ATTR) so a
// sovereign deployment never ships the public demo endpoints.
//
// Attribution is mandatory and travels with the source (GOGET is CC BY 4.0 → its credit must
// stay visible on every view that renders GEM-derived fields — handoff §14 / licence).

type RasterProvider = { id: string; tiles: string[]; tileSize: number; maxzoom: number; attribution: string };

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
const or = (key: string, fallback: string) => (env[key] && env[key]!.trim()) || fallback;

/** Satellite / imagery basemap. Local demo default = Esri World Imagery; override for prod. */
export const SATELLITE: RasterProvider = {
  id: 'satellite',
  tiles: [or('VITE_COCKPIT_SATELLITE_TILES', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')],
  tileSize: 256,
  maxzoom: 19,
  attribution: or('VITE_COCKPIT_SATELLITE_ATTR', 'Imagery © Esri'),
};

/** Open street basemap. Local demo default = OSM; override for prod (OSM tile policy forbids heavy commercial use). */
export const OPENMAP: RasterProvider = {
  id: 'openmap',
  tiles: [or('VITE_COCKPIT_OPENMAP_TILES', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')],
  tileSize: 256,
  maxzoom: 19,
  attribution: or('VITE_COCKPIT_OPENMAP_ATTR', '© OpenStreetMap contributors'),
};

/** Data-source attribution that must stay visible wherever these datasets render. */
export const DATA_ATTRIBUTION = [
  'GOGET © Global Energy Monitor (CC BY 4.0)',
  'USGS World Petroleum Assessment (public domain)',
  'Sodir / NSTA · ANP · Equinor Volve',
].join(' · ');

export const rasterProvider = (theme: 'satellite' | 'openmap'): RasterProvider => (theme === 'openmap' ? OPENMAP : SATELLITE);
