// ImpactMarkers — the wells, posted at the point they cut the selected horizon.
//
// Rendered as HTML markers rather than MapLibre symbol layers on purpose: the
// cockpit style ships no `glyphs` URL, so any `text-field` renders nothing at all
// (the existing cluster-count layer is already silently blank for this reason).
// HTML also buys the exact symbology asked for — a filled dot for a producer, the
// injector cross for an injector, and a coloured name chip — with no sprite sheet.
//
// SYMBOLOGY, and what it is claiming:
//   ● filled green   oil producer, FLOWING in the reference month
//   ⊕ blue cross     water injector, INJECTING in the reference month
//   ○ hollow grey    everything else — shut-in, appraisal, observation, water supply
// "Active" is measured from the monthly record, not read off the published role.
// A well typed OIL_PRODUCER that has not made a barrel in two years is grey here,
// because the map is reporting what the field is doing, not what it was designed
// to do. That distinction is the whole point of colouring only the live wells.
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

type Look = { kind: 'producer' | 'injector' | 'idle'; chip: string };

/** Colour is earned by FLOWING, not by role. `observed` is what the reference
 *  month measured; role only breaks the tie for a well with no series at all. */
function lookOf(m: ImpactMarker): Look {
  const obs = m.stats?.observed;
  if (obs === 'oil') return { kind: 'producer', chip: 'oil' };
  if (obs === 'water-injection') return { kind: 'injector', chip: 'wat' };
  return { kind: 'idle', chip: 'idle' };
}

const fmt = (v: number | null | undefined, unit = '') => (v == null || !Number.isFinite(v)
  ? '—'
  : `${Math.round(v).toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`);
const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`);

function hoverCard(m: ImpactMarker, unit: string): string {
  const s = m.stats;
  const rows: Array<[string, string]> = [];
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
    rows.push(['Status', s.active ? 'flowing in the reference month' : 'not flowing in the reference month']);
  }
  // Reserves and recovery factor are field-level facts in this bundle. Saying so
  // is the honest answer; dividing a bore's cumulative by a field STOIIP would
  // produce something that looks like a well RF and is not one.
  rows.push(['Reserves · RF', 'not published per wellbore']);

  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  return `<div class="fds-imp-card"><b>${esc(m.well)}</b>${rows
    .map(([k, v]) => `<div><span>${esc(k)}</span><em>${esc(v)}</em></div>`).join('')}</div>`;
}

function buildElement(m: ImpactMarker, unit: string): HTMLElement {
  const look = lookOf(m);
  const el = document.createElement('div');
  el.className = `fds-imp is-${look.kind}`;
  // symbol + name chip; the chip carries the colour so it reads at a glance
  el.innerHTML = `<i class="fds-imp-sym"></i><span class="fds-imp-name tone-${look.chip}">${
    m.well.replace(/[&<>"]/g, '')}</span>`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${m.well}, ${look.kind === 'idle' ? 'not flowing' : look.kind}`);

  const card = document.createElement('div');
  card.className = 'fds-imp-pop';
  card.innerHTML = hoverCard(m, unit);
  el.appendChild(card);
  return el;
}

/** Imperative marker set. Renders nothing itself; MapLibre owns the DOM nodes. */
export function ImpactMarkers({ map, points, volumeUnit = '', visible = true }: ImpactMarkersProps) {
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!map) return;
    let disposed = false;
    const created: Marker[] = [];

    void (async () => {
      const maplibre = await import('maplibre-gl');
      if (disposed) return;
      for (const p of visible ? points : []) {
        if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
        const mk = new maplibre.Marker({ element: buildElement(p, volumeUnit), anchor: 'center' })
          .setLngLat([p.lon, p.lat])
          .addTo(map);
        created.push(mk);
      }
      markersRef.current = created;
    })();

    return () => {
      disposed = true;
      for (const mk of created) mk.remove();
      for (const mk of markersRef.current) mk.remove();
      markersRef.current = [];
    };
  }, [map, points, visible, volumeUnit]);

  return null;
}
