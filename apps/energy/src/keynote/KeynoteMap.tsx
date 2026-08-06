// The keynote's map layer — the REAL Cockpit renderer, not a stand-in.
//
// CockpitMap already carries Esri satellite imagery, the MapLibre v5 globe
// projection, field points and click-to-select. What it does NOT carry is a
// keynote look: its default sky is a pale daylight haze, and Indonesia's
// provinces render like every other province. Both are fixed here, on the live
// map instance, so the deck gets deep space and a glowing archipelago without
// forking the Cockpit.
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { CockpitMap, type CockpitSelection } from '../cosmo/CockpitMap';
import { prefersReducedMotion } from './timeline';
import { INDONESIA_CODES } from './data';
import { loadProvinceGeo, loadScopeFields, loadTowers } from '../tabs/exploration/data';

/** Indonesia, from the real province bbox: lon 95.1–146.5, lat −11.0–9.0. */
export const INDONESIA = { lon: 118.5, lat: -1.6, zoom: 3.6 };
/** Where the camera starts on slide 1 — far enough out to read as a planet. */
export const FROM_SPACE = { lon: 116, lat: 8, zoom: 0.85 };

export type MapVeil = 'left' | 'center' | 'vignette' | 'lower' | 'none';

/** A camera target. `pad` reserves viewport fractions the subject must avoid —
 *  `{bottom: .34}` lifts the archipelago clear of a lower-third title band. */
export interface MapTarget {
  lon: number; lat: number; zoom: number;
  pad?: { top?: number; bottom?: number; left?: number; right?: number };
}

/** Deep space, not daylight haze. This single call is the difference between
 *  "a map of the world" and "a planet seen from orbit". */
/** Black, and NO atmosphere.
 *
 *  The pale halo on the globe's limb is MapLibre's atmosphere, and the style
 *  spec's DEFAULT for `atmosphere-blend` is 0.8 — so leaving the sky alone
 *  guarantees a bright rim on a deck that is black everywhere else.
 *  `drawAtmosphere` returns early at exactly 0, which is why this is the only
 *  value that works; anything else merely tints it.
 *
 *  Two ways this silently reverts, both handled below:
 *    · `Style.setSky` VALIDATES and returns early on a bad value — no throw, no
 *      warning, just a sky that never changed.
 *    · CockpitMap owns a `[dark, theme]` effect that re-paints the background
 *      layer, so a single call at ready-time gets overwritten later.
 *
 *  It is re-applied on every `styledata` for that reason, and failures are
 *  reported rather than swallowed: an earlier version caught and discarded the
 *  error, which is exactly why the white rim survived several rounds of
 *  "fixing" it. */
function setSpaceSky(map: MapLibreMap) {
  let applying = false;
  const apply = () => {
    // setSky calls _update, which fires `styledata` again. Without this guard
    // the listener below re-enters forever and pegs the render loop.
    if (applying) return;
    applying = true;
    try {
      // MapLibre's OWN "no sky" preset — the object it falls back to when you
      // pass nothing. Fully transparent, atmosphere off. Transparent beats
      // black here: it kills the halo AND lets the deck's terrain show through
      // around the globe, which is the look this slide wants anyway.
      map.setSky({
        'sky-color': 'transparent',
        'horizon-color': 'transparent',
        'fog-color': 'transparent',
        'fog-ground-blend': 1,
        'atmosphere-blend': 0,
      });
      // The style's own background layer paints the whole canvas, including the
      // space around the globe. CockpitMap sets it to a THEME colour, and its
      // light value (#dcecea) is a pale mint — which is exactly what a stray
      // light-mode render puts behind the planet.
      for (const layer of map.getStyle()?.layers ?? []) {
        if (layer.type === 'background') {
          map.setPaintProperty(layer.id, 'background-color', 'rgba(0,0,0,0)');
        }
      }
      // Read it back. `Style.setSky` VALIDATES and returns early on a bad
      // value — no throw, no warning — so "I called it" is not evidence that
      // it took. Only the read-back is.
      const got = map.getSky?.();
      if (got && got['atmosphere-blend'] !== 0) {
        console.error('[keynote] sky did not take; atmosphere-blend =', got['atmosphere-blend']);
      }
    } catch (err) {
      // Loud on purpose. A silent catch here is exactly why the white rim
      // survived several rounds of being "fixed".
      console.error('[keynote] could not clear the sky', err);
    } finally {
      applying = false;
    }
  };
  apply();
  // CockpitMap owns a [dark, theme] effect that repaints the style after this
  // runs, so once at ready-time is not enough.
  map.on('style.load', apply);
  map.on('styledata', apply);
}

/** Ignite the thirteen Indonesian provinces: a warm fill, a bright edge and a
 *  wide soft halo underneath so they read as lit rather than merely coloured. */
function addArchipelagoGlow(map: MapLibreMap) {
  const src = 'kn-idn';
  if (map.getSource(src)) return;
  const codes = [...INDONESIA_CODES];

  loadProvinceGeo()
    .then((geo) => {
      if (!map.getStyle()) return;
      const only = {
        type: 'FeatureCollection',
        features: geo.features.filter((f) =>
          codes.includes(String((f.properties as { prvCode?: string })?.prvCode) as never)),
      } as GeoJSON.FeatureCollection;
      if (map.getSource(src)) return;
      map.addSource(src, { type: 'geojson', data: only });

      // Halo first, so the edge sits on top of its own bloom.
      map.addLayer({
        id: 'kn-idn-halo', type: 'line', source: src,
        paint: {
          'line-color': '#D8B15A', 'line-width': 22, 'line-blur': 22, 'line-opacity': 0,
        },
      });
      map.addLayer({
        id: 'kn-idn-fill', type: 'fill', source: src,
        paint: { 'fill-color': '#D8B15A', 'fill-opacity': 0 },
      });
      map.addLayer({
        id: 'kn-idn-edge', type: 'line', source: src,
        paint: {
          'line-color': '#F5DFA0', 'line-width': 1.6, 'line-opacity': 0,
          'line-blur': 0.4,
        },
      });

      // West → east ignition. Done on the map's own clock so it survives the
      // camera move rather than fighting it.
      const reduced = prefersReducedMotion();
      const start = performance.now();
      const RUN = reduced ? 1 : 2600;
      const tick = () => {
        if (!map.getLayer('kn-idn-edge')) return;
        const t = Math.min(1, (performance.now() - start) / RUN);
        const e = 1 - (1 - t) ** 3;
        map.setPaintProperty('kn-idn-halo', 'line-opacity', 0.5 * e);
        map.setPaintProperty('kn-idn-fill', 'fill-opacity', 0.2 * e);
        map.setPaintProperty('kn-idn-edge', 'line-opacity', 0.95 * e);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })
    .catch(() => undefined);
}

/** The GOGET fields inside the thirteen provinces, breathing.
 *
 *  Each point carries a random `phase`, and the pulse expression reads it, so
 *  the archipelago twinkles instead of strobing in unison — the difference
 *  between "a data layer" and "a coastline at night". Radius also scales with
 *  recoverable volume, so the big Kutei and Sumatra fields read as bigger.
 *
 *  The time term is re-baked into the paint expression on a ~24fps clock rather
 *  than every frame: `setPaintProperty` forces a full re-evaluation, and 60Hz of
 *  that alongside a globe fly is a visible stutter for motion nobody can see. */
function addFieldPulse(map: MapLibreMap) {
  if (map.getSource('kn-fields')) return;
  const codes = [...INDONESIA_CODES];

  Promise.all([loadScopeFields(), loadTowers()])
    .then(([scope, towers]) => {
      if (!map.getStyle() || map.getSource('kn-fields')) return;
      const size = new Map(towers.map((t) => [t.id, t.total ?? 0]));
      const features: GeoJSON.Feature[] = [];
      for (const code of codes) {
        for (const f of scope.provinces[code] ?? []) {
          if (!f.fly) continue;
          const total = size.get(f.id) ?? 0;
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [f.fly.lon, f.fly.lat] },
            properties: {
              name: f.name,
              phase: Math.random(),
              // sqrt, not linear: a 400 MMBOE field is 20× a 1 MMBOE field by
              // area at that scaling, not 400×, which would swallow the map.
              weight: Math.min(1, Math.sqrt(total) / 26),
            },
          });
        }
      }
      if (!features.length) return;
      map.addSource('kn-fields', { type: 'geojson', data: { type: 'FeatureCollection', features } });

      map.addLayer({
        id: 'kn-fields-sonar', type: 'circle', source: 'kn-fields',
        paint: {
          'circle-color': '#69D6FF', 'circle-blur': 1, 'circle-opacity': 0,
          'circle-radius': 3,
        },
      });
      map.addLayer({
        id: 'kn-fields-core', type: 'circle', source: 'kn-fields',
        paint: {
          'circle-color': '#EAF7FF', 'circle-blur': 0.35, 'circle-opacity': 0,
          'circle-radius': ['+', 1.6, ['*', 2.2, ['get', 'weight']]],
          'circle-stroke-color': '#69D6FF', 'circle-stroke-width': 0.8, 'circle-stroke-opacity': 0,
        },
      });

      const born = performance.now();
      const reduced = prefersReducedMotion();
      let last = 0;
      const tick = (now: number) => {
        if (!map.getLayer('kn-fields-core')) return;
        // Fade the whole layer up over the first 1.8s so the fields arrive
        // after the coastline, not with it.
        const born01 = Math.min(1, (now - born) / 1800);
        if (reduced) {
          map.setPaintProperty('kn-fields-core', 'circle-opacity', 0.95);
          map.setPaintProperty('kn-fields-core', 'circle-stroke-opacity', 0.7);
          map.setPaintProperty('kn-fields-sonar', 'circle-opacity', 0.22);
          map.setPaintProperty('kn-fields-sonar', 'circle-radius', 7);
          return;
        }
        if (now - last > 42) {                       // ~24fps
          last = now;
          const t = (now - born) / 1000;
          // 0→1 sawtooth per point, offset by its phase: the ring grows and
          // fades, then restarts. Expressed in MapLibre's own expression
          // language so the GPU does the per-point work, not JS.
          const cycle: unknown = ['%', ['+', t / 3.4, ['get', 'phase']], 1];
          map.setPaintProperty('kn-fields-sonar', 'circle-radius',
            ['+', 3, ['*', ['+', 14, ['*', 16, ['get', 'weight']]], cycle]] as never);
          map.setPaintProperty('kn-fields-sonar', 'circle-opacity',
            ['*', born01 * 0.34, ['-', 1, cycle]] as never);
          map.setPaintProperty('kn-fields-core', 'circle-opacity', born01 * 0.95);
          map.setPaintProperty('kn-fields-core', 'circle-stroke-opacity', born01 * 0.7);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })
    .catch(() => undefined);
}

export function KeynoteMap({
  dark = true, flyTo, veil = 'vignette', overlay = 'minimal',
  interactive = true, glow = true, onPick,
}: {
  dark?: boolean;
  flyTo?: MapTarget;
  veil?: MapVeil;
  overlay?: 'full' | 'minimal';
  interactive?: boolean;
  /** Ignite the archipelago. Off for scenes where the map is just a backdrop. */
  glow?: boolean;
  onPick?: (s: CockpitSelection | null) => void;
}) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !flyTo) return;
    // `pad` keeps the archipelago out from under the typography. Expressed as
    // a pixel OFFSET of the target from the container centre, not as camera
    // `padding`: MapLibre's globe projection does not carry padding through its
    // fly path and throws reading `padding.top`. An offset is the same geometry
    // — reserving the bottom third means shifting the subject up by half of it.
    const w = map.getContainer().clientWidth, h = map.getContainer().clientHeight;
    const p = flyTo.pad;
    const offset: [number, number] = p
      ? [((p.left ?? 0) - (p.right ?? 0)) * w / 2, ((p.top ?? 0) - (p.bottom ?? 0)) * h / 2]
      : [0, 0];
    if (prefersReducedMotion()) {
      // easeTo, not jumpTo: `offset` is an animation option and jumpTo does not
      // accept it. Duration 0 makes it a cut that still honours the framing.
      map.easeTo({ center: [flyTo.lon, flyTo.lat], zoom: flyTo.zoom, offset, duration: 0 });
      return;
    }
    // Slow and high-curve: mass falling toward a planet, not a map panning.
    map.flyTo({
      center: [flyTo.lon, flyTo.lat], zoom: flyTo.zoom, offset,
      speed: 0.3, curve: 1.6, essential: true,
    });
  }, [flyTo, ready]);

  return (
    <div className="kn-map" style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
      <CockpitMap
        dark={dark}
        mode="3d"
        theme="satellite"
        overlay={overlay}
        onSelect={(s) => onPick?.(s)}
        onMapReady={(m) => {
          mapRef.current = m;
          // Dev handle: camera framing bugs are invisible in a screenshot but
          // trivial to check by projecting the archipelago bbox to screen.
          if (!m) { setReady(false); return; }
          if (import.meta.env.DEV) {
            (window as unknown as Record<string, unknown>).__knmap = m;
          }
          m.jumpTo({ center: [FROM_SPACE.lon, FROM_SPACE.lat], zoom: FROM_SPACE.zoom });
          setSpaceSky(m);
          if (glow) { addArchipelagoGlow(m); addFieldPulse(m); }
          // A stray scroll mid-keynote is a disaster; the deck owns the camera.
          m.scrollZoom.disable();
          m.doubleClickZoom.disable();
          if (!interactive) { m.dragPan.disable(); m.dragRotate.disable(); }
          setReady(true);
        }}
      />
      {veil !== 'none' && <div className={`kn-veil ${veil}`} />}
    </div>
  );
}
