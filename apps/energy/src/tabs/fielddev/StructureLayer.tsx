// StructureLayer — drapes an interpreted depth horizon over the cockpit map.
//
// This is a CONSUMER of Data QC, not a second pipeline. The surface was parsed,
// int16-quantised, gzipped and stored once at ingest; readSurfaceGrid() decodes
// that digest straight out of IndexedDB. Nothing is re-fetched or re-gridded, so
// the horizon a user QC'd is byte-for-byte the horizon they see on the map.
//
// Layer order matters and is deliberate: satellite basemap → basin boundary →
// GOGET fields → THIS → wellbores. A structure map on its own is a picture; a
// structure map inside its regional context, with the wells posted on it, is the
// working view — where the crest is, and which wells sit on it.
//
// Rendered as a MapLibre `image` source: the grid becomes a canvas, and the four
// reprojected corners place it. Corners rather than a bbox because ED50/UTM →
// WGS84 leaves the box very slightly rotated (~119 m of north-south drift across
// Volve's width) and an axis-aligned bbox would quietly shear it back.
import { useEffect, useMemo, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { DigestedSurface } from '../../dataqc/types';
import { gridCornersWgs84 } from '../../engine/proj';

const SRC = 'fds-structure-src';
const LYR = 'fds-structure-lyr';

/** Depth ramp: shallow warm → deep cool, the convention a structure map is read
 *  with. Stops are evenly spaced and interpolated in RGB. */
const RAMP: Array<[number, [number, number, number]]> = [
  [0.00, [176, 36, 24]],
  [0.22, [226, 98, 43]],
  [0.42, [239, 192, 58]],
  [0.60, [127, 191, 82]],
  [0.78, [61, 149, 196]],
  [1.00, [43, 62, 140]],
];

function rampAt(t: number): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) {
    if (u <= RAMP[i][0]) {
      const [p0, c0] = RAMP[i - 1], [p1, c1] = RAMP[i];
      const f = (u - p0) / (p1 - p0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/** Depth convention, resolved from the data rather than assumed.
 *
 *  The decoded grids store ELEVATION — negative below sea level (Top Hugin comes
 *  back as −3393…−2726). A structure map is read in DEPTH, positive downward and
 *  shallow-first, so the sign is normalised here. Getting this wrong inverts the
 *  colour ramp: the crest renders in the deep colour and the flanks in the
 *  shallow one, which is exactly backwards from how the map is read.
 *
 *  Detected, not hardcoded, because a shallow surface (seabed near shore) can
 *  legitimately straddle zero and must not be flipped by an absolute value. */
export function depthConvention(values: ArrayLike<number>): {
  toDepth: (v: number) => number; dmin: number; dmax: number;
} | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo) || hi <= lo) return null;
  // entirely at or below datum ⇒ elevation convention, flip to depth
  const flip = hi <= 0;
  const toDepth = (v: number) => (flip ? -v : v);
  const a = toDepth(lo), b = toDepth(hi);
  return { toDepth, dmin: Math.min(a, b), dmax: Math.max(a, b) };
}

/** Grid → RGBA canvas. A null node stays fully transparent: an interpreted grid
 *  has a real edge, and filling it would invent structure that was never mapped. */
function gridToCanvas(s: DigestedSurface): HTMLCanvasElement | null {
  const { ncol, nrow, values } = s;
  if (!ncol || !nrow) return null;

  const conv = depthConvention(values);
  if (!conv) return null;
  const { toDepth, dmin, dmax } = conv;

  const cv = document.createElement('canvas');
  cv.width = ncol; cv.height = nrow;
  const g = cv.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(ncol, nrow);

  for (let r = 0; r < nrow; r++) {
    for (let c = 0; c < ncol; c++) {
      const v = values[r * ncol + c];
      // the grid's first row is its SOUTH edge; canvas y runs downward, so the
      // image is written bottom-up or the horizon appears mirrored in latitude
      const o = ((nrow - 1 - r) * ncol + c) * 4;
      if (!Number.isFinite(v)) { img.data[o + 3] = 0; continue; }
      // shallow (dmin) → warm, deep (dmax) → cool: the reading convention
      const [rr, gg, bb] = rampAt((toDepth(v) - dmin) / (dmax - dmin));
      img.data[o] = rr; img.data[o + 1] = gg; img.data[o + 2] = bb; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/** One wellbore's path, already in WGS84, ready to draw over the structure. */
export interface TrajectoryLine {
  well: string;
  role: 'producer' | 'injector' | 'other';
  /** surface → TD, lon/lat */
  path: Array<[number, number]>;
}

export interface StructureLayerProps {
  map: MapLibreMap | null;
  surface: DigestedSurface | null;
  /** projected grid origin + spacing, from the bundle's own surface header */
  geo: { x0: number; y0: number; cell: number; zone?: number } | null;
  opacity?: number;
  visible?: boolean;
  /** id of the first wellbore/label layer, so structure is drawn BENEATH it */
  beforeId?: string;
  /** wellbore paths drawn ON the structure — the point of draping it at all */
  trajectories?: TrajectoryLine[];
  /** fly to the horizon's footprint when it is first draped */
  autoZoom?: boolean;
}

const TRAJ_SRC = 'fds-traj-src';
const TRAJ_LINE = 'fds-traj-line';
const TRAJ_HEAD = 'fds-traj-head';
const TRAJ_TD = 'fds-traj-td';

const ROLE_COLOR: Record<TrajectoryLine['role'], string> = {
  producer: '#10b981', injector: '#26c6da', other: '#94a3b8',
};

/** Imperative MapLibre layer, driven by React state. Renders nothing itself. */
export function StructureLayer({
  map, surface, geo, opacity = 0.82, visible = true, beforeId,
  trajectories = [], autoZoom = true,
}: StructureLayerProps) {
  const addedRef = useRef(false);
  const trajAddedRef = useRef(false);
  // fly once per horizon, not on every opacity tweak or re-render
  const flownRef = useRef<string | null>(null);

  const canvas = useMemo(() => (surface ? gridToCanvas(surface) : null), [surface]);
  const corners = useMemo(() => {
    if (!surface || !geo) return null;
    return gridCornersWgs84(geo.x0, geo.y0, surface.ncol, surface.nrow, geo.cell, geo.zone ?? 31);
  }, [surface, geo]);

  useEffect(() => {
    if (!map || !canvas || !corners) return;
    // a style reload drops every custom source; bail rather than throw
    if (!map.isStyleLoaded()) {
      const onLoad = () => { addedRef.current = false; };
      map.once('styledata', onLoad);
    }

    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      corners.nw, corners.ne, corners.se, corners.sw,   // MapLibre wants TL,TR,BR,BL
    ];

    try {
      const existing = map.getSource(SRC) as { updateImage?: (o: unknown) => void } | undefined;
      if (existing?.updateImage) {
        existing.updateImage({ url: canvas.toDataURL(), coordinates });
      } else {
        map.addSource(SRC, { type: 'image', url: canvas.toDataURL(), coordinates });
        map.addLayer({
          id: LYR, type: 'raster', source: SRC,
          paint: { 'raster-opacity': opacity, 'raster-fade-duration': 180, 'raster-resampling': 'linear' },
          // MapLibre THROWS on an unknown beforeId. Resolve it against the live
          // style so a caller naming a layer this basemap does not have gets the
          // raster on top rather than no raster at all.
        }, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
        addedRef.current = true;
      }
    } catch { /* the style was mid-swap; the next render re-adds it */ }

    return () => {
      if (!map || !addedRef.current) return;
      try {
        if (map.getLayer(LYR)) map.removeLayer(LYR);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch { /* map already torn down */ }
      addedRef.current = false;
    };
  }, [map, canvas, corners, beforeId, opacity]);

  // opacity / visibility without rebuilding the image
  useEffect(() => {
    if (!map) return;
    try {
      if (map.getLayer(LYR)) {
        map.setPaintProperty(LYR, 'raster-opacity', visible ? opacity : 0);
        map.setLayoutProperty(LYR, 'visibility', visible ? 'visible' : 'none');
      }
    } catch { /* layer not mounted yet */ }
  }, [map, opacity, visible]);

  // ── fly to the horizon's footprint ─────────────────────────────────────────
  // The dossier map opens at basin zoom, where a 7 km field is a dot. Draping a
  // horizon is a statement of intent — "look at the structure" — so the camera
  // follows it there. Once per horizon: re-flying on every opacity change would
  // fight the user's own pan.
  useEffect(() => {
    if (!map || !corners || !visible || !autoZoom) return;
    const key = `${corners.sw.join()}|${corners.ne.join()}`;
    if (flownRef.current === key) return;
    flownRef.current = key;
    const lons = [corners.sw[0], corners.se[0], corners.ne[0], corners.nw[0]];
    const lats = [corners.sw[1], corners.se[1], corners.ne[1], corners.nw[1]];
    try {
      map.fitBounds(
        [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
        {
          padding: 34, duration: 1400, essential: true,
          // eases in and settles rather than snapping — the motion is what tells
          // the user the map re-scoped, not just re-coloured
          easing: (t) => 1 - Math.pow(1 - t, 3),
        },
      );
    } catch { /* map torn down mid-flight */ }
  }, [map, corners, visible, autoZoom]);

  // reset the fly-once latch when the overlay is switched off entirely
  useEffect(() => { if (!visible) flownRef.current = null; }, [visible]);

  // ── wellbore paths, drawn ON the structure ─────────────────────────────────
  // Coloured by the same roles the inventory chips use, so the map and the chips
  // are one reading. Surface location gets a hollow ring, TD a solid dot: on a
  // deviated well those are hundreds of metres apart and the difference matters.
  useEffect(() => {
    if (!map) return;
    const data = {
      type: 'FeatureCollection' as const,
      features: trajectories.filter((t) => t.path.length > 1).map((t) => ({
        type: 'Feature' as const,
        properties: { well: t.well, color: ROLE_COLOR[t.role] },
        geometry: { type: 'LineString' as const, coordinates: t.path },
      })),
    };
    try {
      const src = map.getSource(TRAJ_SRC) as { setData?: (d: unknown) => void } | undefined;
      if (src?.setData) { src.setData(data); return; }
      if (!data.features.length) return;
      map.addSource(TRAJ_SRC, { type: 'geojson', data });
      map.addLayer({
        id: TRAJ_LINE, type: 'line', source: TRAJ_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 13, 2.6],
          'line-opacity': 0.95,
        },
      });
      map.addLayer({
        id: TRAJ_HEAD, type: 'circle', source: TRAJ_SRC,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 13, 4.5],
          'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 1.6,
        },
      });
      trajAddedRef.current = true;
    } catch { /* style mid-swap; next render re-adds */ }

    return () => {
      if (!map || !trajAddedRef.current) return;
      try {
        for (const id of [TRAJ_TD, TRAJ_HEAD, TRAJ_LINE]) if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(TRAJ_SRC)) map.removeSource(TRAJ_SRC);
      } catch { /* already gone */ }
      trajAddedRef.current = false;
    };
  }, [map, trajectories]);

  return null;
}

/** Depth range for the legend, in the SAME convention the raster is coloured with
 *  — positive down, shallow first — so the key can never disagree with the map. */
export function surfaceRange(s: DigestedSurface | null): { zmin: number; zmax: number } | null {
  if (!s) return null;
  const conv = depthConvention(s.values);
  return conv ? { zmin: conv.dmin, zmax: conv.dmax } : null;
}

/** CSS gradient matching the ramp, so the legend cannot drift from the raster. */
export const RAMP_CSS = `linear-gradient(90deg,${RAMP
  .map(([p, c]) => `rgb(${c[0]},${c[1]},${c[2]}) ${(p * 100).toFixed(0)}%`)
  .join(',')})`;
