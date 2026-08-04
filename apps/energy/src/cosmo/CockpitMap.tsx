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
  /** 'full' (default) = the global Cockpit's layered view: province/AU/OSDU-polygon
   *  fills, heatmap, clusters — unchanged for existing callers. 'minimal' = a single
   *  clean white boundary line with everything else hidden, for a focused single-scope
   *  view (e.g. the Basin Dossier) where three stacked translucent fills over satellite
   *  imagery read as an ugly whitish haze rather than three distinct colors. */
  overlay?: 'full' | 'minimal';
  /** Ring the one field this view is ABOUT.
   *
   *  Deliberately driven by an explicit coordinate rather than by filtering
   *  `osdu-points` on an id. Identity resolution collapses aliases, and not every
   *  catalogue field survives into the dedup'd point layer — Volve, for one, is
   *  absent from cockpit-points entirely. A filter would then highlight nothing
   *  and look like "no field selected" rather than "the point layer does not
   *  carry this field". Marking the coordinate the field's own record publishes
   *  works for every field and says exactly what it means. */
  highlight?: { lon: number; lat: number } | null;
  /** OSDU id of the field whose MAPPED OUTLINE should be drawn emphatically.
   *  That outline is the regulator's productive area — the closest thing to a
   *  hydrocarbon extent this catalogue publishes — so a single-field view needs
   *  it distinguishable from the neighbours' outlines around it. */
  focusPolygonId?: string | null;
};

const EMPTY_POINTS: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

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

function buildStyle(dark: boolean, theme: 'satellite' | 'openmap', mode: '2d' | '3d', overlay: 'full' | 'minimal' = 'full'): StyleSpecification {
  const sat = rasterProvider('satellite');
  const osm = rasterProvider('openmap');
  const minimal = overlay === 'minimal';
  // In minimal mode the three translucent fills (province/AU/OSDU-polygon) commonly
  // overlap the same geography — teal + blue + amber stacked at low opacity over a
  // bright satellite tile reads as a washed-out white haze, not three distinct colors.
  // So minimal drops every fill to near-zero (kept nonzero only so clicks still hit
  // the layer) and hides AU/OSDU-polygon/heatmap/cluster layers entirely, leaving one
  // clean white province outline as the only overlay.
  const hidden = minimal ? 'none' as const : 'visible' as const;
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
      'focus-field': { type: 'geojson', data: EMPTY_POINTS },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': dark ? '#06131f' : '#dcecea' } },
      { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: theme === 'satellite' ? 'visible' : 'none' }, paint: { 'raster-saturation': -0.08, 'raster-contrast': 0.05 } },
      { id: 'openmap', type: 'raster', source: 'openmap', layout: { visibility: theme === 'openmap' ? 'visible' : 'none' } },
      { id: 'province-fill', type: 'fill', source: 'provinces', paint: { 'fill-color': '#0fb5a6', 'fill-opacity': minimal ? 0.02 : 0.14 } },
      { id: 'province-line', type: 'line', source: 'provinces', paint: { 'line-color': minimal ? '#ffffff' : '#39e1cf', 'line-opacity': minimal ? 0.85 : 0.9, 'line-width': minimal ? 1.6 : 1.2 } },
      { id: 'au-fill', type: 'fill', source: 'aus', minzoom: 3, layout: { visibility: hidden }, paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.07 } },
      { id: 'au-line', type: 'line', source: 'aus', minzoom: 3, layout: { visibility: hidden }, paint: { 'line-color': '#7dd3fc', 'line-opacity': 0.5, 'line-width': 1 } },
      // The FILL is what made three stacked translucent layers read as white haze,
      // so minimal drops it. The OUTLINE is not haze — it is the neighbouring
      // field boundaries, which is exactly the context a single-field view wants:
      // in a graben like the Viking there are dozens of them around the subject,
      // and a field floating on bare imagery hides who its neighbours are.
      { id: 'osdu-poly-fill', type: 'fill', source: 'osdu-polygons', minzoom: 3, layout: { visibility: hidden }, paint: { 'fill-color': '#fbbf24', 'fill-opacity': 0.16 } },
      {
        id: 'osdu-poly-line', type: 'line', source: 'osdu-polygons', minzoom: minimal ? 5 : 3,
        paint: {
          'line-color': minimal ? '#f5c451' : '#fde68a',
          'line-opacity': minimal ? 0.72 : 0.75,
          'line-width': minimal ? ['interpolate', ['linear'], ['zoom'], 5, 0.6, 12, 1.6] : 1,
        },
      },
      // §9 scale-aware: heatmap (global) → clusters (regional) → field points (close)
      {
        id: 'osdu-heat', type: 'heatmap', source: 'osdu-points', maxzoom: 5, layout: { visibility: hidden },
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
        id: 'osdu-clusters', type: 'circle', source: 'osdu-points', filter: ['has', 'point_count'], layout: { visibility: hidden },
        paint: {
          'circle-color': '#0fb5a6',
          'circle-radius': ['step', ['get', 'point_count'], 12, 100, 17, 1000, 23],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 2.5, 0, 3.5, 0.88],
          'circle-stroke-color': '#dffcf8', 'circle-stroke-width': 1.4,
        },
      },
      {
        id: 'osdu-cluster-count', type: 'symbol', source: 'osdu-points', filter: ['has', 'point_count'], layout: { visibility: hidden, 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 10 },
        paint: { 'text-color': '#ffffff', 'text-opacity': ['interpolate', ['linear'], ['zoom'], 2.5, 0, 3.5, 1] },
      },
      {
        id: 'osdu-point', type: 'circle', source: 'osdu-points', filter: ['!', ['has', 'point_count']], minzoom: minimal ? 0 : 4,
        paint: { 'circle-color': minimal ? '#ffffff' : '#5eead4', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 6], 'circle-opacity': 0.92, 'circle-stroke-color': '#052e2b', 'circle-stroke-width': 1 },
      },
      { id: 'province-selected', type: 'line', source: 'provinces', filter: EMPTY_FILTER, paint: { 'line-color': '#ffffff', 'line-width': 3 } },
      { id: 'au-selected', type: 'line', source: 'aus', filter: EMPTY_FILTER, paint: { 'line-color': '#ffffff', 'line-width': 3 } },
      { id: 'osdu-poly-selected', type: 'line', source: 'osdu-polygons', filter: EMPTY_FILTER, paint: { 'line-color': '#ffffff', 'line-width': 3 } },
      // the subject field's own mapped outline, above its neighbours'
      {
        id: 'focus-poly-line', type: 'line', source: 'osdu-polygons', filter: EMPTY_FILTER,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffd166',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.4, 13, 3],
          'line-opacity': 0.95,
        },
      },
      // The field this view is about. Drawn last so it is never buried, and as a
      // hollow ring rather than a filled dot: at field zoom the structure grid and
      // the wellbores sit inside this marker, and a solid disc would hide them.
      {
        id: 'focus-field-glow', type: 'circle', source: 'focus-field',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 12, 9, 26, 13, 46],
          'circle-color': '#f5c451', 'circle-opacity': 0.16, 'circle-blur': 0.6,
        },
      },
      {
        id: 'focus-field-ring', type: 'circle', source: 'focus-field',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 9, 11, 13, 19],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': '#ffd166', 'circle-stroke-width': 2.2, 'circle-stroke-opacity': 0.95,
        },
      },
      {
        id: 'focus-field-dot', type: 'circle', source: 'focus-field',
        paint: { 'circle-radius': 3, 'circle-color': '#ffd166', 'circle-stroke-color': '#3a2a05', 'circle-stroke-width': 1 },
      },
    ],
  };
}

export function CockpitMap({
  dark, mode, theme, focus, onSelect, onMapReady, overlay = 'full', highlight, focusPolygonId,
}: CockpitMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const mapReadyRef = useRef(onMapReady);
  mapReadyRef.current = onMapReady;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

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
        style: buildStyle(dark, theme, modeRef.current, overlayRef.current),
      });
      const active = map;
      // projection is set by the style (born-correct) — no post-load setProjection needed here.
      // Top-right: bottom-right collides with the Arganta orb and the legend rail.
      active.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      active.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: DATA_ATTRIBUTION }), 'bottom-left');
      // MapLibre renders the compact attribution as a <details> element. On touch
      // browsers it can retain an `open` state across the control's first layout,
      // leaving the full credit strip over the map. Always start closed; the native
      // summary button still toggles it open and closed on demand.
      const attribution = hostRef.current.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
      attribution?.removeAttribute('open');
      attribution?.classList.remove('maplibregl-compact-show');

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

  // the focused field marker. The map boots asynchronously, so a highlight set
  // before the style is live is applied on 'load' instead of dropped.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const data: GeoJSON.FeatureCollection = highlight
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [highlight.lon, highlight.lat] } }] }
      : EMPTY_POINTS;
    const apply = () => {
      const source = map.getSource('focus-field') as GeoJSONSource | undefined;
      source?.setData(data);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [highlight]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      try {
        if (!map.getLayer('focus-poly-line')) return;
        map.setFilter('focus-poly-line', focusPolygonId
          ? ['==', ['get', 'id'], focusPolygonId]
          : EMPTY_FILTER);
      } catch { /* style mid-swap */ }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [focusPolygonId]);

  // search fly-to (P1-1 partial: search → geometry flight)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom, duration: 1400, essential: true });
  }, [focus]);

  return <div ref={hostRef} className={`aeck-maplibre mode-${mode}`} aria-label={`${mode === '3d' ? '3D globe' : '2D map'} with OSDU spatial data`} />;
}
