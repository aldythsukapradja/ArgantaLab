// CockpitReserveTowers — Stream Sonnet/§10: the 3D reserve-tower deck.gl overlay. Attaches
// to the live MapLibre map instance (interleaved, so it depth-sorts correctly against the
// globe/terrain) and draws one stacked column per field with reported reserves: oil (green,
// base) → gas (red, middle) → condensate/NGL (amber, cap). Height is log10(1+MMBOE) clamped
// at the real p99 percentile (computed at build time over the full distribution, handoff §10
// "a few giant fields must not flatten the rest of the world") — never the raw value, and
// never fabricated for fields with no reserve data (those stay plain beacons on the point
// layer beneath). Colors + rule from handoff §10 exactly.
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, IControl } from 'maplibre-gl';
import type { MapboxOverlay } from '@deck.gl/mapbox';

const base = import.meta.env.BASE_URL || '/';

interface Tower { id: string; name: string; lon: number; lat: number; oil: number; gas: number; cap: number; total: number }
interface TowerFile {
  method: string; unit: string;
  percentiles: { p50: number; p90: number; p95: number; p99: number; max: number };
  count: number; towers: Tower[];
}

const OIL: [number, number, number] = [25, 211, 126];       // #19d37e
const GAS: [number, number, number] = [255, 93, 115];       // #ff5d73
const CAP: [number, number, number] = [246, 185, 75];       // #f6b94b
const SELECTED_HALO: [number, number, number] = [232, 255, 252]; // #e8fffc

// Visual scale: log10(1+MMBOE) clamped at p99 → [MIN_M, MAX_M] meters of real-world column
// height (interleaved deck.gl uses meters). Below p99 the log curve alone compresses a
// ~10,000× value spread into a ~4× height spread; the p99 clamp only guards the rare
// in-place/aggregate outlier from swallowing everything else (handoff §10).
const MIN_M = 3000, MAX_M = 140000;
function makeScale(p99: number) {
  const lo = Math.log10(2); // log10(1+1) — smallest possible nonzero reserve
  const hi = Math.log10(1 + Math.max(p99, 10));
  const span = Math.max(0.001, hi - lo);
  return (mmboe: number) => {
    const t = Math.min(1, Math.max(0, (Math.log10(1 + Math.max(0, mmboe)) - lo) / span));
    return MIN_M + t * (MAX_M - MIN_M);
  };
}

async function buildLayers(data: TowerFile, visible: boolean, selectedId: string | null | undefined) {
  if (!visible) return [];
  const { ColumnLayer } = await import('@deck.gl/layers');
  const scale = makeScale(data.percentiles.p99);
  const oilTop = (t: Tower) => scale(t.oil);
  const gasTop = (t: Tower) => scale(t.oil + t.gas);
  const capTop = (t: Tower) => scale(t.total);
  const radius = (t: Tower) => 900 + Math.min(2600, Math.log10(1 + t.total) * 700);
  const common = {
    diskResolution: 8, extruded: true, pickable: true, autoHighlight: true,
    highlightColor: [...SELECTED_HALO, 90] as [number, number, number, number],
    getPosition: (t: Tower) => [t.lon, t.lat] as [number, number], getRadius: radius,
  };
  const colorOf = (base: [number, number, number]) => (t: Tower) => (t.id === selectedId ? SELECTED_HALO : base);
  return [
    new ColumnLayer<Tower>({ id: 'reserve-oil', data: data.towers, ...common, getElevation: oilTop, getFillColor: colorOf(OIL) }),
    new ColumnLayer<Tower>({ id: 'reserve-gas', data: data.towers.filter((t) => t.gas > 0), ...common, getElevation: gasTop, getFillColor: colorOf(GAS) }),
    new ColumnLayer<Tower>({ id: 'reserve-cap', data: data.towers.filter((t) => t.cap > 0), ...common, getElevation: capTop, getFillColor: colorOf(CAP) }),
  ];
}

type Props = { map: MapLibreMap | null; visible: boolean; selectedId?: string | null };

export function CockpitReserveTowers({ map, visible, selectedId }: Props) {
  const [data, setData] = useState<TowerFile | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    let alive = true;
    fetch(`${base}osdu/cockpit-reserve-towers.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive) setData(j); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Attach the deck.gl overlay ONLY while towers are visible. When off (the default), NO
  // deck.gl is in the map at all — so the base map is 100% vanilla MapLibre and globe/zoom
  // are unaffected. OVERLAID mode (interleaved:false) renders deck in its own canvas synced
  // to the map camera and never touches MapLibre's WebGL/projection pipeline, so even when on
  // it cannot break map interaction (and a deck.gl failure is isolated by the try/catch).
  useEffect(() => {
    if (!map || !data || !visible) return;
    let disposed = false;
    let overlay: MapboxOverlay | null = null;
    void (async () => {
      try {
        const { MapboxOverlay: MB } = await import('@deck.gl/mapbox');
        const layers = await buildLayers(data, true, selectedRef.current);
        if (disposed) return;
        overlay = new MB({ interleaved: false, layers });
        map.addControl(overlay as unknown as IControl);
        overlayRef.current = overlay;
      } catch { /* deck.gl unavailable → towers just don't show; base map keeps working */ }
    })();
    return () => {
      disposed = true;
      if (overlay && map) { try { map.removeControl(overlay as unknown as IControl); } catch { /* map already torn down */ } }
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, data, visible]);

  // update layers on selection change without re-mounting the overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !data || !visible) return;
    void buildLayers(data, true, selectedId).then((layers) => overlay.setProps({ layers }));
  }, [selectedId, data, visible]);

  if (!visible || !data) return null;
  return (
    <div className="aeck-tower-legend" aria-label="Reserve tower legend">
      <div className="aeck-tl-title">Reported reserves · {data.count.toLocaleString()} fields</div>
      <div className="aeck-tl-row"><i style={{ background: '#19d37e' }} />Oil</div>
      <div className="aeck-tl-row"><i style={{ background: '#ff5d73' }} />Gas</div>
      <div className="aeck-tl-row"><i style={{ background: '#f6b94b' }} />Condensate / NGL</div>
      <div className="aeck-tl-note">Height = log₁₀(1+MMBOE), clamped at the p99 field (~{Math.round(data.percentiles.p99).toLocaleString()} MMBOE) so outliers can't flatten the rest of the world. Fields without reported reserves stay plain beacons.</div>
    </div>
  );
}
