// ImpactMarkers — the wells, posted at the point they cut the selected horizon.
//
// SYMBOLS ARE A NATIVE MAPLIBRE LAYER, NOT HTML MARKERS. The first cut of this
// drew both symbol and label as one HTML marker anchored 'center'. That is wrong
// twice over: the element is [symbol][name chip] laid out horizontally, so
// anchoring its CENTRE puts the data point between them and shifts every symbol
// west by half the element width — and because names differ in length, the shift
// differs per well, which shears the whole pattern instead of merely offsetting
// it. A native layer is projected by the same code that projects the contact
// contour, so the symbols cannot drift from the structure they sit on.
//
// Icons are drawn to a canvas and registered with map.addImage(). Icons need no
// glyphs; TEXT does, and the cockpit style ships no `glyphs` URL (the existing
// cluster-count layer is already silently blank for exactly this reason). So the
// name chips stay HTML — anchored 'left' with a pixel offset, which is
// width-independent and therefore cannot shear.
//
// SYMBOLOGY IS BY WELL TYPE, from the published role:
//   ● filled green   oil producer
//   ⊕ blue cross     water injector
//   ○ hollow grey    appraisal / exploration / observation / water supply
// Colour reports what a well IS. An earlier cut coloured by whether the bore
// flowed in the field's last month, which on a ceased field like Volve — shut in
// since 2016-12 — rendered every single well grey. Whether a well is currently
// flowing is a fact about a month; what it is, is a fact about the well. The
// hover card still carries the measured performance, including whether it flowed.
import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { PathRole } from './well-paths';
import type { WellStats } from './well-stats';

export interface ImpactMarker {
  well: string;
  role: PathRole;
  lon: number;
  lat: number;
  /** the pick this marker IS — depth of the horizon in this bore */
  md: number;
  tvdss: number | null;
  /** true when the pick sits below the last surveyed station, so the position is
   *  the survey's end rather than an interpolation */
  extrapolated: boolean;
  /** the bore's own measured performance; null when it publishes no monthly series */
  stats: WellStats | null;
}

export interface ImpactMarkersProps {
  map: MapLibreMap | null;
  points: ImpactMarker[];
  /** unit label for the cumulative volumes, straight off the source series */
  volumeUnit?: string;
  visible?: boolean;
}

const SRC = 'fds-impact-src';
const LYR = 'fds-impact-lyr';

export const ROLE_FILL: Record<PathRole, string> = {
  producer: '#10b981',
  injector: '#2f9bff',
  other: '#9aa6b4',
};

/** Icon sizes are in device pixels; the layer scales them back down by DPR. */
const ICON_PX = 44;

/** Producer: filled disc. Injector: the injector cross in a ring. Other: hollow
 *  ring. Drawn to canvas rather than shipped as a sprite sheet so the symbology
 *  and the CSS legend are defined in one place and cannot drift. */
function iconCanvas(role: PathRole): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = ICON_PX; cv.height = ICON_PX;
  const g = cv.getContext('2d');
  if (!g) return cv;
  const c = ICON_PX / 2, r = ICON_PX * 0.3;
  const color = ROLE_FILL[role];

  // dark halo so every symbol survives both the warm crest and the cool flanks
  g.beginPath(); g.arc(c, c, r + 3, 0, Math.PI * 2);
  g.fillStyle = 'rgba(4,16,26,.72)'; g.fill();

  if (role === 'producer') {
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2);
    g.fillStyle = color; g.fill();
    g.lineWidth = 3; g.strokeStyle = '#eafff6'; g.stroke();
    return cv;
  }

  g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2);
  g.lineWidth = role === 'injector' ? 4 : 3;
  g.strokeStyle = color; g.stroke();

  if (role === 'injector') {
    g.beginPath();
    g.moveTo(c, c - r - 2); g.lineTo(c, c + r + 2);
    g.moveTo(c - r - 2, c); g.lineTo(c + r + 2, c);
    g.lineWidth = 3.4; g.strokeStyle = color; g.stroke();
  }
  return cv;
}

const fmt = (v: number | null | undefined, unit = '') => (v == null || !Number.isFinite(v)
  ? '—'
  : `${Math.round(v).toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`);
const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`);
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const ROLE_WORD: Record<PathRole, string> = {
  producer: 'oil producer', injector: 'water injector', other: 'appraisal / exploration',
};

function hoverCard(m: ImpactMarker, unit: string): string {
  const s = m.stats;
  const rows: Array<[string, string]> = [];
  rows.push(['Type', ROLE_WORD[m.role]]);
  rows.push(['Horizon pick', `${Math.round(m.md).toLocaleString('en-US')} m MD${m.tvdss != null ? ` · ${Math.round(Math.abs(m.tvdss)).toLocaleString('en-US')} m TVDSS` : ''}`]);
  if (m.extrapolated) rows.push(['⚠ position', 'pick is below the last survey station']);
  if (!s) {
    rows.push(['Production', 'no monthly series published for this bore']);
  } else {
    rows.push(['Cum oil', fmt(s.cumOil, unit)]);
    rows.push(['Cum gas', fmt(s.cumGas, unit)]);
    rows.push(['Cum water', fmt(s.cumWater, unit)]);
    if (s.cumWi > 0) rows.push(['Cum injected', fmt(s.cumWi, unit)]);
    rows.push(['Water cut · life', pct(s.wct)]);
    rows.push(['Water cut · recent', pct(s.wctRecent)]);
    rows.push(['Flowed', s.firstFlow ? `${s.firstFlow} → ${s.lastFlow}` : 'never']);
    rows.push(['Status', s.active ? 'flowing in the last field month' : 'not flowing in the last field month']);
  }
  // Reserves and recovery factor are field-level facts in this bundle. Saying so
  // is the honest answer; dividing a bore's cumulative by a field STOIIP would
  // produce something that looks like a well RF and is not one.
  rows.push(['Reserves · RF', 'not published per wellbore']);

  return `<div class="fds-imp-card"><b>${esc(m.well)}</b>${rows
    .map(([k, v]) => `<div><span>${esc(k)}</span><em>${esc(v)}</em></div>`).join('')}</div>`;
}

/** The name chip only. Anchored 'left' by the caller, so its width never moves
 *  the point it belongs to. Chip colour follows the well type, like the symbol. */
function labelElement(m: ImpactMarker, unit: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `fds-imp is-${m.role}`;
  el.setAttribute('aria-label', `${m.well}, ${ROLE_WORD[m.role]}`);
  const chip = document.createElement('span');
  chip.className = `fds-imp-name tone-${m.role}`;
  chip.textContent = m.well;
  // the card lives INSIDE the chip: the marker root must carry no `position`
  // (MapLibre owns that), so the chip is the popup's containing block
  const card = document.createElement('div');
  card.className = 'fds-imp-pop';
  card.innerHTML = hoverCard(m, unit);
  chip.appendChild(card);
  el.appendChild(chip);
  return el;
}

/** Imperative layer + label set. Renders nothing itself. */
export function ImpactMarkers({ map, points, volumeUnit = '', visible = true }: ImpactMarkersProps) {
  const labelsRef = useRef<Marker[]>([]);
  const addedRef = useRef(false);

  // ── symbols: native layer, projected by the map itself ─────────────────────
  useEffect(() => {
    if (!map) return;
    const shown = visible ? points : [];
    const data = {
      type: 'FeatureCollection' as const,
      features: shown
        .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
        .map((p) => ({
          type: 'Feature' as const,
          properties: { well: p.well, icon: `fds-imp-${p.role}` },
          geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        })),
    };

    try {
      const existing = map.getSource(SRC) as { setData?: (d: unknown) => void } | undefined;
      if (existing?.setData) { existing.setData(data); return; }
      if (!data.features.length) return;

      for (const role of ['producer', 'injector', 'other'] as PathRole[]) {
        const id = `fds-imp-${role}`;
        if (!map.hasImage(id)) {
          const cv = iconCanvas(role);
          const ctx = cv.getContext('2d');
          if (ctx) map.addImage(id, ctx.getImageData(0, 0, cv.width, cv.height), { pixelRatio: 3 });
        }
      }
      map.addSource(SRC, { type: 'geojson', data });
      map.addLayer({
        id: LYR, type: 'symbol', source: SRC,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 14, 1.15],
          // wells sit on top of each other on a platform; never drop one silently
          'icon-allow-overlap': true, 'icon-ignore-placement': true,
        },
      });
      addedRef.current = true;
    } catch { /* style mid-swap; the next render re-adds */ }

    return () => {
      if (!map || !addedRef.current) return;
      try {
        if (map.getLayer(LYR)) map.removeLayer(LYR);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch { /* already gone */ }
      addedRef.current = false;
    };
  }, [map, points, visible]);

  // ── labels: HTML, because text needs glyphs the style does not ship ────────
  useEffect(() => {
    if (!map) return;
    let disposed = false;
    const created: Marker[] = [];

    void (async () => {
      const maplibre = await import('maplibre-gl');
      if (disposed) return;
      for (const p of visible ? points : []) {
        if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
        created.push(new maplibre.Marker({
          element: labelElement(p, volumeUnit),
          // 'left' pins the element's left edge to the point, so a long well name
          // grows rightwards instead of dragging the anchor west
          anchor: 'left', offset: [9, 0],
        }).setLngLat([p.lon, p.lat]).addTo(map));
      }
      labelsRef.current = created;
    })();

    return () => {
      disposed = true;
      for (const mk of created) mk.remove();
      for (const mk of labelsRef.current) mk.remove();
      labelsRef.current = [];
    };
  }, [map, points, visible, volumeUnit]);

  return null;
}
