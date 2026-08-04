import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import type { KnowledgeContext } from './field-knowledge';
import { rasterProvider } from '../../cosmo/cockpit-providers';
import 'maplibre-gl/dist/maplibre-gl.css';

const base = import.meta.env.BASE_URL || '/';

/** `fill` = occupy the whole parent panel (the Asset Dossier's map column) instead of the
 *  legacy 250 px square thumbnail. */
export function KnowledgeMap({ field, context, fill = false, onMapReady }: {
  field: SearchEntry; context: KnowledgeContext | null; fill?: boolean;
  /** Hands the live MapLibre instance up so callers can drape their own layers
   *  on it (the Asset Dossier adds the interpreted depth structure). Called with
   *  null on teardown so a consumer never holds a removed map. */
  onMapReady?: (map: MapLibreMap | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const provider = rasterProvider('openmap');

  useEffect(() => {
    if (!hostRef.current || !field.fly) return;
    let disposed = false;
    let map: MapLibreMap | null = null;
    const boot = async () => {
      const maplibre = await import('maplibre-gl');
      if (disposed || !hostRef.current || !field.fly) return;
      const provinceCode = context?.province?.prvCode ?? '__none';
      const auCode = context?.au?.auCode ?? '__none';
      const style: StyleSpecification = {
        version: 8,
        sources: {
          basemap: { type: 'raster', tiles: provider.tiles, tileSize: provider.tileSize, maxzoom: provider.maxzoom, attribution: provider.attribution },
          provinces: { type: 'geojson', data: `${base}world/provinces.geojson` },
          aus: { type: 'geojson', data: `${base}world/aus.geojson` },
          field: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [field.fly.lon, field.fly.lat] } } },
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-saturation': -0.8, 'raster-opacity': 0.72 } },
          { id: 'province', type: 'fill', source: 'provinces', filter: ['==', ['get', 'prvCode'], provinceCode], paint: { 'fill-color': '#0fb5a6', 'fill-opacity': 0.2 } },
          { id: 'province-line', type: 'line', source: 'provinces', filter: ['==', ['get', 'prvCode'], provinceCode], paint: { 'line-color': '#0b8f84', 'line-width': 2 } },
          { id: 'au', type: 'line', source: 'aus', filter: ['==', ['get', 'auCode'], auCode], paint: { 'line-color': '#38bdf8', 'line-width': 2.3, 'line-dasharray': [2, 1] } },
          { id: 'field-halo', type: 'circle', source: 'field', paint: { 'circle-radius': 11, 'circle-color': '#0fb5a6', 'circle-opacity': 0.22 } },
          { id: 'field-dot', type: 'circle', source: 'field', paint: { 'circle-radius': 5, 'circle-color': '#063c38', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
        ],
      };
      map = new maplibre.Map({
        container: hostRef.current, style, center: [field.fly.lon, field.fly.lat], zoom: context?.au ? 4.25 : 4.1,
        // The dossier map is a real map, like the Cockpit's — pan/zoom, not a picture.
        interactive: fill, attributionControl: false, renderWorldCopies: false,
      });
      if (fill) {
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        map.scrollZoom.enable();
      }
      mapRef.current = map;
      // announce only once the style is live — addSource/addLayer throw before that
      if (map.isStyleLoaded()) onMapReady?.(map);
      else map.once('load', () => { if (!disposed) onMapReady?.(mapRef.current); });

      // THE SQUASH FIX. MapLibre sizes its canvas once, at construction. This map lives in
      // a CSS-grid panel whose final size is not known until the grid settles (and changes
      // again on every window/pane resize), so without this the canvas keeps its first
      // aspect ratio and the basemap renders stretched. Observe the host and resize.
      const ro = new ResizeObserver(() => { mapRef.current?.resize(); });
      ro.observe(hostRef.current);
      resizeObsRef.current = ro;
      // one more after first paint, for the initial grid settle
      requestAnimationFrame(() => mapRef.current?.resize());
      map.once('load', () => mapRef.current?.resize());
    };
    void boot().catch((error: unknown) => {
      if (hostRef.current) hostRef.current.textContent = error instanceof Error ? error.message : 'Map unavailable';
    });
    return () => {
      disposed = true;
      resizeObsRef.current?.disconnect(); resizeObsRef.current = null;
      onMapReady?.(null);
      map?.remove(); mapRef.current = null;
    };
  }, [context, field, fill, onMapReady]);

  if (!field.fly) return <div className={'fds-kmap-missing' + (fill ? ' fill' : '')}>Location not reported</div>;
  return (
    <div className={'fds-kmap-wrap' + (fill ? ' fill' : '')}>
      <div ref={hostRef} className="fds-kmap" aria-label={`${field.name} location map`} />
      <div className="fds-kmap-pin"><b>{field.name}</b><span>{field.fly.lat.toFixed(3)}°, {field.fly.lon.toFixed(3)}°</span></div>
      <div className="fds-kmap-credit">OSM · GOGET / USGS spatial alignment</div>
    </div>
  );
}
