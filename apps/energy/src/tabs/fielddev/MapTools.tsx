// MapTools — draw on the map: points, observations, proposed wells, lines,
// polygons and section traces.
//
// This is the first place in the Field Development suite where a user CREATES
// data rather than reading it, so the seam is drawn hard. Everything drawn here
// is stamped `origin: 'user'` with a timestamp, is styled in a deliberately
// different visual register from the observed layers (dashed, amber-violet, never
// the fluid colours), and is stored locally rather than published — see
// interpret.ts for why that matters.
//
// Interaction follows the reference tool palette exactly:
//   select / pan   the map behaves normally
//   point/obs/well one click commits a single-point feature
//   polyline/polygon/section  click to add vertices, DOUBLE-CLICK to finish
// Escape cancels a part-drawn shape, which is the one thing every drawing tool
// must have and the reference did not.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import {
  MousePointer2, Hand, MapPin, Eye, Drill, Spline, Pentagon, Columns3,
} from 'lucide-react';
import {
  type ToolKind, type FeatureKind, type LonLat,
  MULTI_POINT, isComplete, toGeoJson,
} from './interpret';
import { useInterp, interpNodeId } from './interp-store';
import { useScene, isVisible } from './scene';

const SRC = 'fds-interp-src';
const DRAFT_SRC = 'fds-interp-draft';

const TOOLS: Array<{ k: ToolKind; label: string; Icon: typeof MapPin; hint: string }> = [
  { k: 'select', label: 'select', Icon: MousePointer2, hint: 'Inspect — the map behaves normally' },
  { k: 'pan', label: 'pan', Icon: Hand, hint: 'Drag the map' },
  { k: 'point', label: 'point', Icon: MapPin, hint: 'Drop a labelled point' },
  { k: 'obs', label: 'obs', Icon: Eye, hint: 'Mark an observation' },
  { k: 'well', label: 'well', Icon: Drill, hint: 'Propose a well location' },
  { k: 'polyline', label: 'polyline', Icon: Spline, hint: 'Draw a line — double-click to finish' },
  { k: 'polygon', label: 'polygon', Icon: Pentagon, hint: 'Draw an area — double-click to finish' },
  { k: 'section', label: 'section', Icon: Columns3, hint: 'Trace a cross-section — double-click to finish' },
];

export interface MapToolsProps {
  map: MapLibreMap | null;
  fieldId: string;
  /** hide the whole palette when the map is not the active view */
  enabled?: boolean;
}

export function MapTools({ map, fieldId, enabled = true }: MapToolsProps) {
  const [tool, setTool] = useState<ToolKind>('select');
  const [draft, setDraft] = useState<LonLat[]>([]);
  const addedRef = useRef(false);

  // The features live in the shared store, not here — the Input tree lists the
  // same objects and its eye toggles have to reach this canvas.
  const features = useInterp((s) => s.features);
  const addFeature = useInterp((s) => s.add);
  const setInterpField = useInterp((s) => s.setField);
  const vis = useScene((s) => s.vis);

  // handlers are re-created every render; refs keep the map listeners stable
  const toolRef = useRef(tool); toolRef.current = tool;
  const draftRef = useRef(draft); draftRef.current = draft;

  useEffect(() => { setInterpField(fieldId); setDraft([]); }, [fieldId, setInterpField]);

  const commit = useCallback((kind: FeatureKind, pts: LonLat[]) => {
    if (!isComplete(kind, pts.length)) return;
    addFeature(kind, pts);
  }, [addFeature]);

  /** Hidden in the tree ⇒ gone from the canvas. The tree is the authority on what
   *  is shown, exactly as it is for the delivered layers. */
  const shown = useMemo(
    () => features.filter((f) => isVisible(vis, interpNodeId(f))),
    [features, vis],
  );

  // ── map interaction ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const onClick = (e: MapMouseEvent) => {
      const t = toolRef.current;
      if (t === 'select' || t === 'pan') return;
      const p: LonLat = { lon: e.lngLat.lng, lat: e.lngLat.lat };
      if (MULTI_POINT.includes(t as FeatureKind)) { setDraft((d) => [...d, p]); return; }
      commit(t as FeatureKind, [p]);
    };
    const onDbl = () => {
      const t = toolRef.current;
      if (!MULTI_POINT.includes(t as FeatureKind)) return;
      const d = draftRef.current;
      if (isComplete(t as FeatureKind, d.length)) commit(t as FeatureKind, d);
      setDraft([]);
      setTool('select');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // cancel the shape first, THEN the tool — two escapes, two intents
      if (draftRef.current.length) setDraft([]);
      else setTool('select');
    };
    map.on('click', onClick);
    map.on('dblclick', onDbl);
    window.addEventListener('keydown', onKey);
    return () => {
      map.off('click', onClick);
      map.off('dblclick', onDbl);
      window.removeEventListener('keydown', onKey);
    };
  }, [map, commit]);

  // a double-click must FINISH the shape, not zoom the map
  useEffect(() => {
    if (!map) return;
    const drawing = MULTI_POINT.includes(tool as FeatureKind);
    try { if (drawing) map.doubleClickZoom.disable(); else map.doubleClickZoom.enable(); } catch { /* pre-load */ }
    try { map.getCanvas().style.cursor = tool === 'select' || tool === 'pan' ? '' : 'crosshair'; } catch { /* no canvas yet */ }
  }, [map, tool]);

  // ── layers ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const data = toGeoJson(shown);
    try {
      const src = map.getSource(SRC) as { setData?: (d: unknown) => void } | undefined;
      if (src?.setData) { src.setData(data); return; }
      map.addSource(SRC, { type: 'geojson', data });
      map.addSource(DRAFT_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      // Interpretation reads in a different register from observation: violet,
      // dashed outlines, hollow markers. A reader should never have to check a
      // legend to know which lines somebody drew.
      map.addLayer({
        id: 'fds-interp-fill', type: 'fill', source: SRC,
        filter: ['==', ['get', 'kind'], 'polygon'],
        paint: { 'fill-color': '#a78bfa', 'fill-opacity': 0.14 },
      });
      map.addLayer({
        id: 'fds-interp-line', type: 'line', source: SRC,
        paint: {
          'line-color': ['match', ['get', 'kind'], 'section', '#f472b6', '#a78bfa'],
          'line-width': ['match', ['get', 'kind'], 'section', 2.4, 1.8],
          'line-dasharray': [2.5, 1.5],
        },
      });
      map.addLayer({
        id: 'fds-interp-pt', type: 'circle', source: SRC,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 5, 'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': '#a78bfa', 'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'fds-interp-draft-line', type: 'line', source: DRAFT_SRC,
        paint: { 'line-color': '#f472b6', 'line-width': 1.6, 'line-dasharray': [1, 1.5] },
      });
      map.addLayer({
        id: 'fds-interp-draft-pt', type: 'circle', source: DRAFT_SRC,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 3.4, 'circle-color': '#f472b6' },
      });
      addedRef.current = true;
    } catch { /* style mid-swap; the next render re-adds */ }

    return () => {
      if (!map || !addedRef.current) return;
      try {
        for (const id of ['fds-interp-draft-pt', 'fds-interp-draft-line', 'fds-interp-pt', 'fds-interp-line', 'fds-interp-fill']) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        for (const id of [DRAFT_SRC, SRC]) if (map.getSource(id)) map.removeSource(id);
      } catch { /* already gone */ }
      addedRef.current = false;
    };
  }, [map, shown]);

  // the in-progress shape, redrawn on every click
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(DRAFT_SRC) as { setData?: (d: unknown) => void } | undefined;
    if (!src?.setData) return;
    const coords = draft.map((p) => [p.lon, p.lat] as [number, number]);
    src.setData({
      type: 'FeatureCollection',
      features: [
        ...coords.map((c) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: c } })),
        ...(coords.length > 1
          ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } }]
          : []),
      ],
    });
  }, [map, draft]);

  if (!enabled) return null;
  const drawing = MULTI_POINT.includes(tool as FeatureKind);

  return (
    <>
      <div className="fds-tools" role="toolbar" aria-label="Map interpretation tools">
        {TOOLS.map(({ k, label, Icon, hint }) => (
          <button key={k} className={'fds-tool' + (tool === k ? ' on' : '')} title={hint}
            onClick={() => { setTool(k); setDraft([]); }}>
            <Icon size={12} /><span>{label}</span>
          </button>
        ))}
        {features.length > 0 && (
          /* the count is a pointer to the Input tree, which is where drawn
             objects are listed, renamed, hidden and deleted — not a second list */
          <span className="fds-tool fds-tool-count" title="Drawn objects appear in the Input tree on the left">
            {features.length}
          </span>
        )}
      </div>

      {drawing && (
        <div className="fds-tools-hint">
          {draft.length
            ? `${draft.length} point${draft.length === 1 ? '' : 's'} — double-click to finish, Esc to cancel`
            : `click to start the ${tool}`}
        </div>
      )}

    </>
  );
}
