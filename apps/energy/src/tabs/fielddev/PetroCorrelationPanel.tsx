// PetroCorrelationPanel — the wells side by side, on OUR interpretation.
//
// Four tracks per bore, in the order a correlation is read:
//
//   GR            what the rock is — the shale/sand discriminator
//   PHIE          how much of it can hold fluid
//   fluid flag    the net ribbon, BETWEEN porosity and saturation, because it is
//                 the join between them: net is where PHIE passes the cutoff AND
//                 Sw says it is hydrocarbon-bearing
//   Sw            what is in the pore space
//
// CURVES ARE OURS, and that is the point. The delivery ships PHIE/SWE/VSH in
// three of twenty-four bores, so a panel of delivered curves is three columns of
// logs and twenty-one blanks. Every column here is the same interpretation under
// the same parameters, which is the only version that can be correlated — and it
// is labelled `computed`, with the delivered curve overlaid dashed wherever a
// bore has one, so ours and theirs are comparable and never merged.
//
// FLATTENING is the reason this view exists. Hung on MD, a thickness change and a
// structural dip look identical. Flattened on a shared pick, structure is removed
// and what is left is stratigraphy. A bore with no pick for the flattening
// surface CANNOT be flattened onto it — it is drawn unflattened and marked,
// rather than shifted by a guessed offset.
import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { useCumulativeOil, orderByProduction } from './petro-luping';
import { Columns3, AlertTriangle, ArrowUpDown, Plus, Minus, Maximize2, X } from 'lucide-react';
import type { Workspace } from './workspace';
import type { PetroParams } from './petro-compute';
import { useFieldCurves, hangShift, type BoreCurveSet, type HangMode } from './petro-curves';
import { ROLE_FILL } from './ImpactMarkers';
import { pathRole } from './well-paths';
import { useScene } from './scene';

const TRACK_W = 46;      // per track, px
const GUTTER = 16;       // between bores
const HEAD = 34;         // column header
const PAD = { l: 46, t: 10, b: 18 };

/**
 * The four tracks, left to right. `net` sits between PHIE and Sw deliberately.
 *
 * `fams` is how a tree click reaches a track. The tree lists what the DELIVERY
 * shipped, keyed by curve family (GR, PHIE, SW, VSH — see las.ts's FAMILY map);
 * this panel draws what we COMPUTED. They are not the same names, so each track
 * declares the delivered families that select it. `net` answers to VSH because
 * that is the delivered curve nearest to the shale/net decision — there is no
 * delivered net flag to point at.
 */
const TRACKS = [
  { id: 'gr', label: 'GR', lo: 0, hi: 150, color: '#7a8b3f', fams: ['GR'] },
  { id: 'phie', label: 'PHIE', lo: 0.4, hi: 0, color: '#2f9bff', fams: ['PHIE', 'PHIT'] },
  { id: 'net', label: 'net', lo: 0, hi: 1, color: '#10b981', fams: ['VSH'] },
  { id: 'sw', label: 'Sw', lo: 1, hi: 0, color: '#c2582c', fams: ['SW'] },
] as const;

export function PetroCorrelationPanel({ ws, params }: { ws: Workspace; params: PetroParams }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const curves = useFieldCurves(ws, params, true);

  /**
   * THE DATUM COMES FROM THE TREE. Clicking a surface under Well tops sets it;
   * clicking it again clears it back to measured depth. The panel deliberately
   * owns no picker — a datum is a thing in the delivery you point at, and having
   * it in two places is how the tree and the canvas start disagreeing.
   */
  const flattenOn = useScene((st) => st.datum);
  const hang: HangMode = flattenOn ? 'flatten' : 'md';
  const panelWells = useScene((st) => st.panelWells);
  const panelCurves = useScene((st) => st.panelCurves);
  const panelOrder = useScene((st) => st.panelOrder);
  const setPanelOrder = useScene((st) => st.setPanelOrder);

  const [sortOpen, setSortOpen] = useState(false);
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const svgRef = useRef<SVGSVGElement | null>(null);

  /** Tracks the panel draws. An empty filter is the ABSENCE of one, so nothing
   *  ticked shows the default four rather than an empty column. */
  const tracks = useMemo(() => {
    if (!panelCurves.length) return TRACKS.slice();
    const hit = TRACKS.filter((x) => x.fams.some((f) => panelCurves.includes(f)));
    // A tick on a curve this panel doesn't draw (RHOB, CALI, ROP…) must not blank
    // the panel — it just isn't a correlation track.
    return hit.length ? hit : TRACKS.slice();
  }, [panelCurves]);

  /** Column pitch follows the track count, so filtering narrows the columns
   *  instead of leaving four-track-wide gaps. */
  const colW = tracks.length * TRACK_W + GUTTER;

  const cumWells = useMemo(() => curves.bores.map((b) => b.well), [curves.bores]);
  const { cum } = useCumulativeOil(cumWells);

  /** Surfaces ordered by how many of the SHOWN bores carry them — the widest
   *  correlatable datum first, because that is the one worth flattening on. */
  const surfaces = useMemo(() => {
    const n = new Map<string, number>();
    for (const b of curves.bores) for (const p of b.picks) n.set(p.surface, (n.get(p.surface) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }, [curves.bores]);

  const model = useMemo(() => {
    let bores = panelWells.length
      ? curves.bores.filter((b) => panelWells.includes(b.well))
      : curves.bores;
    if (!bores.length) return null;

    // Explicit sequence wins; anything not named keeps its production order after
    // the named ones, so a partial reorder never silently drops a bore.
    if (panelOrder.length) {
      const rank = new Map(panelOrder.map((w, i) => [w, i]));
      bores = bores.slice().sort((a, b) => (rank.get(a.well) ?? 999) - (rank.get(b.well) ?? 999));
    } else {
      const order = orderByProduction(bores.map((b) => b.well), cum);
      const rank = new Map(order.map((w, i) => [w, i]));
      bores = bores.slice().sort((a, b) => (rank.get(a.well) ?? 999) - (rank.get(b.well) ?? 999));
    }

    const shifts = new Map(bores.map((b) => [b.well, hangShift(b, hang, flattenOn)]));
    // Depth window across every bore that CAN be placed. A bore that cannot be
    // flattened is excluded from the range rather than stretching it to nothing.
    let lo = Infinity, hi = -Infinity;
    for (const b of bores) {
      const s = shifts.get(b.well);
      if (s == null || !b.md.length) continue;
      lo = Math.min(lo, b.md[0] + s);
      hi = Math.max(hi, b.md[b.md.length - 1] + s);
    }
    if (!Number.isFinite(lo) || hi <= lo) return null;

    // correlation lines: a surface, and the y each bore puts it at
    const lines = surfaces.slice(0, 8).map(([surface]) => ({
      surface,
      at: bores.map((b) => {
        const s = shifts.get(b.well);
        const p = b.picks.find((q) => q.surface === surface);
        return s != null && p ? p.md + s : null;
      }),
    }));

    return { bores, shifts, lo, hi, lines };
  }, [curves.bores, hang, flattenOn, surfaces, panelWells, panelOrder, cum]);

  const unflattenable = useMemo(
    () => (hang === 'flatten' && flattenOn
      ? curves.bores.filter((b) => !b.picks.some((p) => p.surface === flattenOn)).map((b) => b.well)
      : []),
    [curves.bores, hang, flattenOn],
  );

  const height = 460;
  const y0 = model ? scaleLinear().domain([model.lo, model.hi]).range([PAD.t + HEAD, height - PAD.b]) : null;
  // DEPTH-ONLY zoom. Scaling x as well would change the column pitch, and a
  // correlation panel's columns are wells — their spacing carries no information
  // and stretching it just pushes bores off screen.
  const y = y0 ? t.rescaleY(y0) : null;

  const zoomRef = useRef<ReturnType<typeof d3zoom<SVGSVGElement, unknown>> | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !model) return;
    const b = d3zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 40])
      .on('zoom', (e) => setT(e.transform));
    select(svg).call(b);
    zoomRef.current = b;
    return () => { select(svg).on('.zoom', null); };
  }, [model]);
  const zoomBy = (k: number) => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) select(svg).transition().duration(180).call(zoomRef.current.scaleBy, k);
  };
  const resetZoom = () => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) select(svg).transition().duration(220).call(zoomRef.current.transform, zoomIdentity);
  };

  return (
    <section className="pps-region live pcp" style={{ gridArea: 'main' }}>
      <header className="pcp-head">
        <Columns3 size={12} /> <b>Correlation</b>
        <span className="pcp-hang">
          {flattenOn ? (
            <em className="pcp-datum" title="Set from the Well tops folder in the Input tree — click it again there to clear">
              flattened on <b>{flattenOn}</b>
              <i>{surfaces.find(([sf]) => sf === flattenOn)?.[1] ?? 0} bores</i>
            </em>
          ) : (
            <em className="pcp-datum none" title="Pick a surface under Well tops in the Input tree to flatten on it">
              hung on measured depth — pick a <b>Well top</b> on the left to flatten
            </em>
          )}
        </span>
        <span className="pcp-tools">
          <button onClick={() => zoomBy(1.4)} title="Zoom in (depth)"><Plus size={11} /></button>
          <button onClick={() => zoomBy(1 / 1.4)} title="Zoom out (depth)"><Minus size={11} /></button>
          <button onClick={resetZoom} title="Reset depth zoom"><Maximize2 size={11} /></button>
          <button className={sortOpen ? 'on' : ''} onClick={() => setSortOpen((v) => !v)}
            title="Set the left-to-right display sequence"><ArrowUpDown size={11} /></button>
        </span>
        <em>
          {curves.running
            ? `interpreting ${curves.done}/${curves.total} bores…`
            : `${model?.bores.length ?? 0}${panelWells.length ? `/${curves.bores.length}` : ''} bores`
              + ` · ${tracks.length} track${tracks.length === 1 ? '' : 's'} · computed`}
        </em>
      </header>

      {sortOpen && model && (
        <div className="pcp-sort" role="dialog">
          <header>
            <b>Display sequence</b>
            <button onClick={() => { setPanelOrder([]); }} title="Back to cumulative-oil order">reset</button>
            <button onClick={() => setSortOpen(false)} aria-label="Close"><X size={11} /></button>
          </header>
          {/* Default order is by cumulative oil — the bores that made the field
              first. Dragging is overkill for a list this size; the arrows are
              unambiguous and keyboard-reachable. */}
          <ol>
            {model.bores.map((b, i) => (
              <li key={b.well}>
                <span className="n">{i + 1}</span>
                <b>{b.well}</b>
                <i>{(() => { const c = cum.get(b.well); return c == null ? 'no prod record' : `${(c / 1e6).toFixed(2)}M`; })()}</i>
                <button disabled={i === 0} title="Move left"
                  onClick={() => setPanelOrder(swap(model.bores.map((x) => x.well), i, i - 1))}>↑</button>
                <button disabled={i === model.bores.length - 1} title="Move right"
                  onClick={() => setPanelOrder(swap(model.bores.map((x) => x.well), i, i + 1))}>↓</button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {curves.running && (
        <div className="pcp-bar"><i style={{ width: `${curves.total ? (curves.done / curves.total) * 100 : 0}%` }} /></div>
      )}

      <div className="pcp-scroll" ref={wrapRef}>
        {model && y ? (
          <svg ref={svgRef} width={PAD.l + model.bores.length * colW + 20} height={height}
            style={{ cursor: 'ns-resize' }}>
            {/* Everything depth-bearing is CLIPPED to the track window. Zooming
                rescales the depth axis, so without this the curves ride up over
                the column headers and out of the panel. */}
            <defs>
              <clipPath id="pcp-clip">
                <rect x={0} y={PAD.t + HEAD} width={PAD.l + model.bores.length * colW + 20}
                  height={height - PAD.b - PAD.t - HEAD} />
              </clipPath>
            </defs>

            {/* column headers and track frames — fixed, outside the clip */}
            {model.bores.map((b, i) => {
              const x0 = PAD.l + i * colW;
              return (
                <g key={b.well}>
                  <text x={x0 + 2} y={PAD.t + 9} fontSize={8.5} fontWeight={600}
                    fill={ROLE_FILL[pathRole(b.role)]} fontFamily="var(--mono)">{b.well}</text>
                  {model.shifts.get(b.well) == null && (
                    <text x={x0 + 2} y={PAD.t + 19} fontSize={6.5} fill="var(--orange,#f59e0b)"
                      fontFamily="var(--mono)">no {flattenOn} pick — not flattened</text>
                  )}
                  {tracks.map((tk, ti) => (
                    <g key={tk.id}>
                      <text x={x0 + ti * TRACK_W + 2} y={PAD.t + HEAD - 4} fontSize={6.5}
                        fill="var(--ink3)" fontFamily="var(--mono)">{tk.label}</text>
                      <rect x={x0 + ti * TRACK_W} y={PAD.t + HEAD} width={TRACK_W - 2}
                        height={height - PAD.b - PAD.t - HEAD} fill="none" stroke="var(--line2)" />
                    </g>
                  ))}
                </g>
              );
            })}

            <g clipPath="url(#pcp-clip)">
              {/* depth axis */}
              {y.ticks(10).map((d) => (
                <g key={d}>
                  <line x1={PAD.l - 4} y1={y(d)} x2={PAD.l + model.bores.length * colW} y2={y(d)}
                    stroke="var(--line)" opacity={0.18} />
                  <text x={PAD.l - 8} y={y(d) + 3} textAnchor="end" fontSize={7.5}
                    fill="var(--ink3)" fontFamily="var(--mono)">{Math.round(d)}</text>
                </g>
              ))}

              {/* correlation lines — drawn UNDER the tracks so curves stay readable */}
              {model.lines.map((l, li) => {
                const pts: Array<[number, number]> = [];
                model.bores.forEach((_b, i) => {
                  const at = l.at[i];
                  if (at == null) return;
                  pts.push([PAD.l + i * colW + (tracks.length * TRACK_W) / 2, y(at)]);
                });
                if (pts.length < 2) return null;
                const hue = (li * 47) % 360;
                return (
                  <g key={l.surface}>
                    <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none"
                      stroke={`hsl(${hue},60%,55%)`} strokeWidth={1.2} strokeDasharray="5 3" opacity={0.85} />
                    <text x={PAD.l + 2} y={pts[0][1] - 3} fontSize={7}
                      fill={`hsl(${hue},60%,45%)`} fontFamily="var(--mono)">{l.surface}</text>
                  </g>
                );
              })}

              {model.bores.map((b, i) => {
                const shift = model.shifts.get(b.well);
                if (shift == null) return null;
                const x0 = PAD.l + i * colW;
                return (
                  <g key={b.well}>
                    {tracks.map((tk, ti) => (
                      <TrackPath key={tk.id} bore={b} track={tk}
                        x0={x0 + ti * TRACK_W} shift={shift} y={y} />
                    ))}
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="pcp-empty">
            {curves.running ? 'interpreting the delivery…' : 'No bore produced curves to correlate.'}
          </div>
        )}
      </div>

      <footer className="pcp-foot">
        <span className="pcp-prov">curves are OURS — computed under the current parameters, not the delivery's</span>
        {unflattenable.length > 0 && (
          <span className="pcp-warn">
            <AlertTriangle size={10} />
            {unflattenable.length} bore{unflattenable.length === 1 ? '' : 's'} have no “{flattenOn}” pick and are not flattened:
            {' '}{unflattenable.slice(0, 5).join(' · ')}{unflattenable.length > 5 ? ' …' : ''}
          </span>
        )}
        {curves.skipped.length > 0 && (
          <span className="pcp-warn">{curves.skipped.length} bore(s) produced no curves</span>
        )}
      </footer>
    </section>
  );
}

/** Reorder helper — returns a NEW sequence rather than mutating the model's. */
function swap(list: string[], a: number, b: number): string[] {
  const out = list.slice();
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}

/** One curve inside one track. Decimated to roughly one point per pixel — a
 *  7,000-sample log into a 400 px track is 17 samples per pixel, and drawing all
 *  of them costs time to render a line nobody can see. */
function TrackPath({ bore, track, x0, shift, y }: {
  bore: BoreCurveSet;
  track: typeof TRACKS[number];
  x0: number; shift: number;
  y: (d: number) => number;
}) {
  const d = useMemo(() => {
    const vals: (number | null)[] = track.id === 'gr' ? (bore.gr ?? [])
      : track.id === 'phie' ? bore.phie
        : track.id === 'sw' ? bore.sw
          : bore.net.map((n) => (n === true ? 1 : n === false ? 0 : null));
    if (!vals.length) return '';
    const sx = scaleLinear().domain([track.lo, track.hi]).range([x0 + 1, x0 + TRACK_W - 3]).clamp(true);
    const step = Math.max(1, Math.floor(bore.md.length / 600));
    const out: string[] = [];
    let pen = false;
    for (let i = 0; i < bore.md.length; i += step) {
      const v = vals[i];
      // a gap must BREAK the line rather than bridge two readings across a
      // hundred metres of no data
      if (v == null || !Number.isFinite(v)) { pen = false; continue; }
      const px = sx(v), py = y(bore.md[i] + shift);
      out.push(`${pen ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`);
      pen = true;
    }
    return out.join('');
  }, [bore, track, x0, shift, y]);

  if (!d) return null;
  // the net ribbon reads as a FILL, not a wiggle — it is a flag, not a measurement
  if (track.id === 'net') {
    return <path d={d} fill="none" stroke={track.color} strokeWidth={2.4} opacity={0.75} />;
  }
  return <path d={d} fill="none" stroke={track.color} strokeWidth={0.9} />;
}
