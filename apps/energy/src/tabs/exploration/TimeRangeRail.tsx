// TimeRangeRail — the shared time-window control for the two geology charts.
//
// Per dataviz interaction rules this is ONE control row sitting ABOVE the charts it
// scopes, built from ordinary buttons rather than chart marks, and it scopes BOTH
// charts so their axes always agree. It is not duplicated per chart.
//
// Drill model: era → period → epoch. Clicking a chip zooms to it and reveals its
// children; SHIFT-clicking a second chip of the same tier selects the inclusive span
// (this is what answers "the Oligocene–Miocene section" or "Lower to Upper
// Cretaceous"). The breadcrumb walks back out.
import { ChevronRight, RotateCcw, ZoomIn } from 'lucide-react';
import { childrenOf, spanOf, unitsOfRank, type GeoUnit } from './geo-time';

export interface TimeRangeRailProps {
  units: GeoUnit[];
  /** null = full column. */
  range: [number, number] | null;
  onRange: (r: [number, number] | null) => void;
  /** Chip the user drilled into, so children can be offered. */
  focus: GeoUnit | null;
  onFocus: (u: GeoUnit | null) => void;
  /** First half of a shift-click span, if one is pending. */
  anchor: GeoUnit | null;
  onAnchor: (u: GeoUnit | null) => void;
  label: string;
}

export function TimeRangeRail({
  units, range, onRange, focus, onFocus, anchor, onAnchor, label,
}: TimeRangeRailProps) {
  const byAge = (a: GeoUnit, b: GeoUnit) => b.from - a.from;
  // Offer the children of whatever we're focused on; at the top that's the eras.
  const direct = focus ? childrenOf(units, focus.name).sort(byAge) : unitsOfRank(units, 'era').sort(byAge);
  // At ERA level also surface the epoch tier (grandchildren). Exploration questions are
  // routinely posed across period boundaries — "the Oligocene–Miocene section" spans
  // Paleogene and Neogene — and a shift-click span only works within one rank, so both
  // ranks have to be reachable from the same rail.
  const grandkids = focus?.rank === 'era'
    ? direct.flatMap((p) => childrenOf(units, p.name)).sort(byAge)
    : [];
  // A leaf (period with no epochs) keeps showing its siblings rather than an empty rail.
  const shown = direct.length ? direct
    : (focus?.parent ? childrenOf(units, focus.parent).sort(byAge) : []);

  const pick = (u: GeoUnit, shift: boolean) => {
    if (shift && anchor && anchor.rank === u.rank) {
      onRange(spanOf(anchor, u));
      onAnchor(null);
      return;
    }
    onAnchor(u);
    onRange([u.from, u.to]);
    if (childrenOf(units, u.name).length) onFocus(u);
  };

  const crumbs: GeoUnit[] = [];
  for (let u: GeoUnit | undefined = focus ?? undefined; u;) {
    crumbs.unshift(u);
    u = units.find((p) => p.name === u!.parent);
  }

  const active = (u: GeoUnit) =>
    !!range && Math.abs(range[0] - u.from) < 0.01 && Math.abs(range[1] - u.to) < 0.01;

  return (
    <div className="exs-trange">
      <div className="exs-trange-head">
        <ZoomIn size={12} />
        <b>{label}</b>
        <div className="exs-trange-crumbs">
          <button className={'exs-crumb-btn' + (focus ? '' : ' on')}
            onClick={() => { onFocus(null); onAnchor(null); onRange(null); }}>All</button>
          {crumbs.map((c, i) => (
            <span key={c.id}>
              <ChevronRight size={9} />
              <button className={'exs-crumb-btn' + (i === crumbs.length - 1 ? ' on' : '')}
                onClick={() => { onFocus(c); onRange([c.from, c.to]); onAnchor(null); }}>{c.name}</button>
            </span>
          ))}
        </div>
        {range && (
          <button className="exs-trange-reset" onClick={() => { onRange(null); onFocus(null); onAnchor(null); }}
            title="Back to the full column"><RotateCcw size={10} />Reset</button>
        )}
      </div>
      <div className="exs-trange-chips">
        {shown.map((u) => (
          <button key={u.id}
            className={'exs-trange-chip' + (active(u) ? ' on' : '') + (anchor?.id === u.id ? ' anchor' : '')}
            onClick={(e) => pick(u, e.shiftKey)}
            title={`${u.name} · ${u.from}–${u.to} Ma${u.source === 'ics-fallback' ? ' · ICS reference tier (not yet in the workbook)' : ''} — click to zoom, shift-click for a span`}>
            {u.name}
            {u.source === 'ics-fallback' && <i title="ICS reference tier, not from the workbook">*</i>}
          </button>
        ))}
        {grandkids.length > 0 && (
          <>
            <span className="exs-trange-sep" />
            {grandkids.map((u) => (
              <button key={u.id}
                className={'exs-trange-chip fine' + (active(u) ? ' on' : '') + (anchor?.id === u.id ? ' anchor' : '')}
                onClick={(e) => pick(u, e.shiftKey)}
                title={`${u.name} · ${u.from}–${u.to} Ma${u.source === 'ics-fallback' ? ' · ICS reference tier (not yet in the workbook)' : ''} — click to zoom, shift-click for a span`}>
                {u.name}
                {u.source === 'ics-fallback' && <i>*</i>}
              </button>
            ))}
          </>
        )}
        {anchor && <span className="exs-trange-hint">shift-click another to span from <b>{anchor.name}</b></span>}
      </div>
    </div>
  );
}
