// CockpitMap — the UNIFIED cockpit renderer (MapLibre GL v5). One engine for the 3D globe
// (v5 globe projection) and the 2D map, with scale-aware heatmap → cluster → field (§9),
// province/AU/OSDU overlays, sovereign basemap config (cockpit-providers), mandatory GOGET
// attribution, and search fly-to. Replaces the old three.js globe + Leaflet split. Loads the
// dedup'd cockpit-points (identity-resolved) and keeps alias lineage in properties.
import { useEffect, useRef } from 'react';
import type {
  FilterSpecification, GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature, StyleSpecification,
} from 'maplibre-gl';
import type { GeoCollection, GeoFeature, WorldProvinceProps } from '../world/types';
import { rasterProvider, DATA_ATTRIBUTION } from './cockpit-providers';
import 'maplibre-gl/dist/maplibre-gl.css';
import './cockpit-map.css';

export type CockpitSelection = {
  id: string;
  name: string;
  type: string;
  source: string;
  detail: Array<[string, string]>;
  /** Light render-time properties, straight off the GeoJSON feature. Present for Field
   *  selections so CockpitDossier can render the §7-8 lifecycle dossier; the heavier
   *  fuel/lifecycle/reserves/production attributes are fetched lazily by id via
   *  cockpit-field-detail.ts (kept out of this object to avoid holding it in map state). */
  raw?: Record<string, unknown>;
};

type Focus = { lon: number; lat: number; zoom: number } | null;
type CockpitMapProps = {
  dark: boolean;
  mode: '2d' | '3d';
  theme: 'satellite' | 'openmap';
  focus?: Focus;
  onSelect: (selection: CockpitSelection | null) => void;
  /** Exposes the live MapLibre instance so sibling overlays (e.g. CockpitReserveTowers'
   *  deck.gl MapboxOverlay) can attach via map.addControl — called with null on teardown. */
  onMapReady?: (map: MapLibreMap | null) => void;
};

const EMPTY_FILTER: FilterSpecification = ['==', ['get', '__none'], '__selected'];
const base = import.meta.env.BASE_URL || '/';

type Position = [number, number];
type PolygonCoordinates = Position[][];
const pointInRing = ([x, y]: Position, ring: Position[]) => {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi) inside = !inside;
  }
  return inside;
};
const polygonContains = (point: Position, polygon: PolygonCoordinates) => pointInRing(point, polygon[0])
  && !polygon.slice(1).some((hole) => pointInRing(point, hole));
const provinceContains = (feature: GeoFeature<WorldProvinceProps>, point: Position) => {
  if (!feature.geometry) return false;
  if (feature.geometry.type === 'Polygon') return polygonContains(point, feature.geometry.coordinates as PolygonCoordinates);
  if (feature.geometry.type === 'MultiPolygon') return (feature.geometry.coordinates as PolygonCoordinates[]).some((polygon) => polygonContains(point, polygon));
  return false;
};
const provinceSelection = (p: WorldProvinceProps): CockpitSelection => ({
  id: p.prvCode, name: p.prvName, type: 'Petroleum province', source: 'USGS World Petroleum Assessment',
  detail: [
    ['Code', p.prvCode],
    ['Oil mean', p.oilMean == null ? 'Not assessed' : `${p.oilMean.toLocaleString()} MMBO`],
    ['Gas mean', p.gasMean == null ? 'Not assessed' : `${p.gasMean.toLocaleString()} BCFG`],
    ['BOE mean', p.boeMean == null ? 'Not assessed' : `${p.boeMean.toLocaleString()} MMBOE`],
  ],
});

function selectionFrom(feature: MapGeoJSONFeature): CockpitSelection {
  const p = feature.properties ?? {};
  const type = p.type ?? (feature.layer.id.startsWith('au-') ? 'Assessment unit' : feature.layer.id.startsWith('province-') ? 'Petroleum province' : 'Spatial object');
  const detail: Array<[string, string]> = [];
  const add = (label: string, value: unknown) => { if (value !== undefined && value !== null && String(value).trim()) detail.push([label, String(value)]); };
  add('Code', p.auCode ?? p.prvCode);
  add('Province', p.prvName);
  add('Petroleum system', p.tps);
  add('Country', p.country);
  add('Basin', p.basin);
  add('Operator', p.operator);
  add('Status', p.status);
  add('Oil mean', p.oilMean != null ? `${Number(p.oilMean).toLocaleString()} MMBO` : '');
  add('Gas mean', p.gasMean != null ? `${Number(p.gasMean).toLocaleString()} BCFG` : '');
  add('BOE mean', p.boeMean != null ? `${Number(p.boeMean).toLocaleString()} MMBOE` : '');
  add('Location accuracy', p.accuracy);
  // identity-resolution lineage (Stream A): show that this field folds several sources
  const sources = typeof p.sources === 'string' ? (() => { try { return JSON.parse(p.sources); } catch { return null; } })() : p.sources;
  if (Array.isArray(sources) && sources.length > 1) add('Also in', sources.join(' · '));
  return {
    id: String(p.id ?? p.auCode ?? p.prvCode ?? feature.id ?? p.name),
    name: String(p.name ?? p.auName ?? p.prvName ?? 'Selected feature'),
    type: String(type),
    source: String(p.source ?? (p.auCode || p.prvCode ? 'USGS World Petroleum Assessment' : 'OSDU spatial spine')),
    detail,
    raw: type === 'Field' ? (p as Record<string, unknown>) : undefined,
  };
}

function buildStyle(dark: boolean, theme: 'satellite' | 'openmap', mode: '2d' | '3d'): StyleSpecification {
  const sat = rasterProvider('satellite');
  const osm = rasterProvider('openmap');
  return {
    version: 8,
    // Born-correct projection: the map renders in the right projection from the FIRST frame.
    // (Calling setProjection after 'load' left the raster basemap in mercator while vectors
    // projected to globe — a split render. Declaring it in the style avoids that entirely.)
    projection: { type: mode === '3d' ? 'globe' : 'mercator' },
    sources: {
      satellite: { type: 'raster', tiles: sat.tiles, tileSize: sat.tileSize, maxzoom: sat.maxzoom, attribution: sat.attribution },
      openmap: { type: 'raster', tiles: osm.tiles, tileSize: osm.tileSize, maxzoom: osm.maxzoom, attribution: osm.attribution },
      provinces: { type: 'geojson', data: `${base}world/provinces.geojson`, attribution: DATA_ATTRIBUTION },
      aus: { type: 'geojson', data: `${base}world/aus.geojson` },
      'osdu-points': { type: 'geojson', data: `${base}osdu/cockpit-points.geojson`, cluster: true, clusterRadius: 50, clusterMaxZoom: 6 },
      'osdu-polygons': { type: 'geojson', data: `${base}osdu/cockpit-polygons.geojson` },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': dark ? '#06131f' : '#dcecea' } },
      { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: theme === 'satellite' ? 'visible' : 'none' }, paint: { 'raster-saturation': -0.08, 'raster-contrast': 0.05 } },
      { id: 'openmap', type: 'raster', source: 'openmap', layout: { visibility: theme === 'openmap' ? 'visible' : 'none' } },
      { id: 'province-fill', type: 'fill', source: 'provinces', paint: { 'fill-color': '#0fb5a6', 'fill-opacity': 0.14 } },
      { id: 'province-line', type: 'line', source: 'provinces', paint: { 'line-color': '#39e1cf', 'line-opacity': 0.9, 'line-width': 1.2 } },
      { id: 'au-fill', type: 'fill', source: 'aus', minzoom: 3, paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.07 } },
      { id: 'au-line', type: 'line', source: 'aus', minzoom: 3, paint: { 'line-color': '#7dd3fc', 'line-opacity': 0.5, 'line-width': 1 } },
      { id: 'osdu-poly-fill', type: 'fill', source: 'osdu-polygons', minzoom: 3, paint: { 'fill-color': '#fbbf24', 'fill-opacity': 0.16 } },
      { id: 'osdu-poly-line', type: 'line', source: 'osdu-polygons', minzoom: 3, paint: { 'line-color': '#fde68a', 'line-opacity': 0.75, 'line-width': 1 } },
      // §9 scale-aware: heatmap (global) → clusters (regional) → field points (close)
      {
        id: 'osdu-heat', type: 'heatmap', source: 'osdu-points', maxzoom: 5,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1], 1, 0.2, 60, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 4, 1.4],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 14, 4, 30],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.85, 5, 0],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(6,19,31,0)', 0.2, '#0b3b3a', 0.45, '#0fb5a6', 0.7, '#5eead4', 1, '#eafff9'],
        },
      },
      {
        id: 'osdu-clusters', type: 'circle', source: 'osdu-points', filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0fb5a6',
          'circle-radius': ['step', ['get', 'point_count'], 12, 100, 17, 1000, 23],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 2.5, 0, 3.5, 0.88],
          'circle-stroke-color': '#dffcf8', 'circle-stroke-width': 1.4,
        },
      },
      {
        id: 'osdu-cluster-count', type: 'symbol', source: 'osdu-points', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 10 },
        paint: { 'text-color': '#ffffff', 'text-opacity': ['interpolate', ['linear'], ['zoom'], 2.5, 0, 3.5, 1] },
      },
      {
        id: 'osdu-point', type: 'circle', source: 'osdu-points', filter: ['!', ['has', 'point_count']], minzoom: 4,
        paint: { 'circle-color': '#5eead4', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 6], 'circle-opacity': 0.92, 'circle-stroke-color': '#052e2b', 'circle-stroke-width': 1 },
      },
      { id: 'province-selected', type: 'line', source: 'provinces', filter: EMPTY_FILTER, paint: { 'line-color': '#ffffff', 'line-width': 3 } },
      { id: 'au-selected', type: 'line', source: 'aus', filter: EMPTY_FILTER, paint: { 'line-color': '#ffffff', 'line-width': 3 } },
      { id: 'osdu-poly-selected', type: 'line', source: 'osdu-polygons', filter: EMPTY_FILTER, paint: { 'line-color': '#ffffff', 'line-width': 3 } },
    ],
  };
}

export function CockpitMap({ dark, mode, theme, focus, onSelect, onMapReady }: CockpitMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const mapReadyRef = useRef(onMapReady);
  mapReadyRef.current = onMapReady;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    let disposed = false;
    let map: MapLibreMap | null = null;
    const boot = async () => {
      const [maplibregl, provinceResponse] = await Promise.all([
        import('maplibre-gl'),
        fetch(`${base}world/provinces.geojson`),
      ]);
      const provinceData = await provinceResponse.json() as GeoCollection<WorldProvinceProps>;
      if (disposed || !hostRef.current) return;
      map = new maplibregl.Map({
        container: hostRef.current,
        center: [12, 20], zoom: 1.3, pitch: 0, bearing: 0,
        attributionControl: false, renderWorldCopies: false, maxPitch: 70,
        style: buildStyle(dark, theme, modeRef.current),
      });
      const active = map;
      // projection is set by the style (born-correct) — no post-load setProjection needed here.
      active.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
      active.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: DATA_ATTRIBUTION }), 'bottom-left');

      const interactive = ['osdu-point', 'osdu-poly-fill', 'au-fill', 'province-fill'];
      active.on('click', (event) => {
        const cluster = active.queryRenderedFeatures(event.point, { layers: ['osdu-clusters'] })[0];
        if (cluster) {
          const source = active.getSource('osdu-points') as GeoJSONSource;
          const coordinates = (cluster.geometry as GeoJSON.Point).coordinates as [number, number];
          source.getClusterExpansionZoom(Number(cluster.properties?.cluster_id)).then((zoom) => {
            if (zoom != null) active.easeTo({ center: coordinates, zoom });
          }).catch(() => {});
          return;
        }
        const feature = active.queryRenderedFeatures(event.point, { layers: interactive })[0];
        if (feature) { selectRef.current(selectionFrom(feature)); return; }
        const location = active.unproject(event.point);
        const province = provinceData.features.find((item) => provinceContains(item, [location.lng, location.lat]));
        selectRef.current(province ? provinceSelection(province.properties) : null);
      });
      active.on('mousemove', (event) => {
        active.getCanvas().style.cursor = active.queryRenderedFeatures(event.point, { layers: [...interactive, 'osdu-clusters'] }).length ? 'pointer' : '';
      });
      mapRef.current = active;
      // once the style/WebGL context is fully ready: set the projection for the current mode
      // (2D initial state needs mercator; 3D uses the style's globe) and expose the instance to
      // sibling overlays (deck.gl's MapboxOverlay needs a loaded map before it attaches).
      active.once('load', () => { if (!disposed) mapReadyRef.current?.(active); });
    };
    void boot().catch((error: unknown) => {
      if (!hostRef.current) return;
      hostRef.current.dataset.error = error instanceof Error ? error.message : 'Map renderer could not start';
      hostRef.current.textContent = `Spatial renderer unavailable: ${hostRef.current.dataset.error}`;
    });
    return () => { disposed = true; map?.remove(); mapRef.current = null; mapReadyRef.current?.(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3D globe ↔ 2D mercator (only once the style is loaded — see boot 'load' handler for initial)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (typeof map.setProjection === 'function') map.setProjection({ type: mode === '3d' ? 'globe' : 'mercator' });
    map.easeTo({ zoom: mode === '3d' ? 1.4 : 1.6, pitch: 0, bearing: 0, duration: 600 });
  }, [mode]);

  // basemap + theme
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    map.setLayoutProperty('satellite', 'visibility', theme === 'satellite' ? 'visible' : 'none');
    map.setLayoutProperty('openmap', 'visibility', theme === 'openmap' ? 'visible' : 'none');
    map.setPaintProperty('background', 'background-color', dark ? '#06131f' : '#e9f2f1');
  }, [dark, theme]);

  // search fly-to (P1-1 partial: search → geometry flight)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom, duration: 1400, essential: true });
  }, [focus]);

  return <div ref={hostRef} className={`aeck-maplibre mode-${mode}`} aria-label={`${mode === '3d' ? '3D globe' : '2D map'} with OSDU spatial data`} />;
}
