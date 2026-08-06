// PetroCorrelationPanel — the wells side by side, on OUR interpretation.
//
// It opens on PHIE · net · Sw and the INPUT TREE decides the rest: tick a curve
// family and it becomes a column, tick a bore and it becomes a well, tick a well
// top and it becomes a tie line. The vocabulary of drawable tracks lives in
// petro-tracks and covers every family the delivery carries — a tree row that
// cannot change the panel is a tree that is not connected to it.
//
// DEPTH IS TVDSS BY DEFAULT. Volve's bores are deviated by hundreds of metres;
// on measured depth two wells' beds do not line up even when they ARE the same
// bed, which is the one thing this panel exists to show. MD stays one click away
// because it is the depth the log was recorded at. The conversion is each bore's
// OWN dual-recorded picks (petro-contact) — no KB, no survey, and a bore that
// cannot be converted is DROPPED from the TVDSS view and named, never drawn at
// its MD under a TVDSS axis.
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
import { scaleLinear, scaleLog } from 'd3-scale';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { useCumulativeOil, panelSequence } from './petro-luping';
import {
  Columns3, AlertTriangle, ArrowUpDown, Plus, Minus, Maximize2, X, Eraser,
} from 'lucide-react';
import type { Workspace } from './workspace';
import type { PetroParams } from './petro-compute';
import { useFieldCurves, type BoreCurveSet } from './petro-curves';
import { resolveTracks, trackLayout, type TrackSpec } from './petro-tracks';
import { ROLE_FILL } from './ImpactMarkers';
import { pathRole } from './well-paths';
import { useScene } from './scene';
import { fitMdTvd, contactMd, tvdssFromMd, tvdssSign, primaryContact } from './petro-contact';

const GUTTER = 26;       // between bores — wide enough for the column band to read
const HEAD = 34;         // column header
const PAD = { l: 46, t: 10, b: 18 };

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
  const depthMode = useScene((st) => st.depthMode);
  const setDepthMode = useScene((st) => st.setDepthMode);
  const clearPanel = useScene((st) => st.clearPanel);
  const panelWells = useScene((st) => st.panelWells);
  const panelCurves = useScene((st) => st.panelCurves);
  const panelOrder = useScene((st) => st.panelOrder);
  const panelTops = useScene((st) => st.panelTops);
  const setPanelOrder = useScene((st) => st.setPanelOrder);

  const [sortOpen, setSortOpen] = useState(false);
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const svgRef = useRef<SVGSVGElement | null>(null);

  /** Tracks the panel draws — resolved from the tree's tick set. An empty filter
   *  is the ABSENCE of one, so nothing ticked opens on the default three. */
  const tracks = useMemo(() => resolveTracks(panelCurves), [panelCurves]);

  /** Track x-offsets within a column, and the column pitch. Widths differ per
   *  track, so this cannot be an index times a constant. */
  const lay = useMemo(() => {
    const l = trackLayout(tracks);
    return { ...l, colW: l.inner + GUTTER };
  }, [tracks]);
  const colW = lay.colW;

  /**
   * Which way TVDSS runs in THIS delivery, read from its own picks.
   *
   * Negative downwards in most, positive in some. A panel that assumes puts the
   * reservoir at the top of the screen for half the world's data.
   */
  const zSign = useMemo(
    () => tvdssSign(ws.picks.map((p) => p.tvdss)),
    [ws.picks],
  );

  const cumWells = useMemo(() => curves.bores.map((b) => b.well), [curves.bores]);
  const { cum } = useCumulativeOil(cumWells);

  /** The fluid contact this panel draws, from the well master. */
  const contact = useMemo(() => primaryContact(ws.contacts), [ws.contacts]);

  /** Surfaces ordered by how many of the SHOWN bores carry them — the widest
   *  correlatable datum first, because that is the one worth flattening on. */
  const surfaces = useMemo(() => {
    const n = new Map<string, number>();
    for (const b of curves.bores) for (const p of b.picks) n.set(p.surface, (n.get(p.surface) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }, [curves.bores]);

  const model = useMemo(() => {
    // The SAME rule the correlation map draws its line from — see panelSequence.
    const seq = panelSequence(curves.bores.map((b) => b.well), panelWells, panelOrder, cum);
    const byName = new Map(curves.bores.map((b) => [b.well, b]));
    const picked = seq.map((w) => byName.get(w)).filter((b): b is BoreCurveSet => !!b);
    if (!picked.length) return null;

    /**
     * DISPLAY DEPTH: one number per bore per sample, always increasing downward.
     *
     * In MD it is the measured depth. In TVDSS it is the bore's own md↔tvdss fit
     * applied to every sample and multiplied by the delivery's sign convention,
     * so "deeper" is "further down the screen" whichever way the delivery signs
     * its true vertical depths.
     *
     * A bore with no fit CANNOT be placed on a TVDSS axis. It is dropped and
     * named — drawing it at its MD under an axis labelled TVDSS would be a
     * silent lie of several hundred metres on a deviated well.
     */
    const noFit: string[] = [];
    const placed = picked.map((b) => {
      const fit = fitMdTvd(b.picks);
      if (depthMode === 'md') {
        return { b, fit, toDisp: (md: number) => md };
      }
      if (!fit) { noFit.push(b.well); return null; }
      return { b, fit, toDisp: (md: number) => zSign * (tvdssFromMd(fit, md) as number) };
    }).filter((e): e is { b: BoreCurveSet; fit: ReturnType<typeof fitMdTvd>; toDisp: (md: number) => number } => !!e);
    if (!placed.length) return null;

    // FLATTENING happens in display space, so it means the same thing on either
    // axis: put every bore's datum pick on one line. A bore with no pick for the
    // datum keeps its own depth and is marked, rather than shifted by a guess.
    const flattening = !!flattenOn;
    const entries = placed.map((e) => {
      const pick = flattenOn ? e.b.picks.find((p) => p.surface === flattenOn) : null;
      const shift = !flattening ? 0 : pick ? -e.toDisp(pick.md) : null;
      // depths are precomputed per bore: the tracks, the tie lines and the
      // contact all read the same array, so they cannot disagree by a rounding
      const dep = shift == null ? [] : e.b.md.map((m) => e.toDisp(m) + shift);
      return { ...e, well: e.b.well, shift, dep };
    });

    let lo = Infinity, hi = -Infinity;
    for (const e of entries) {
      if (e.shift == null || !e.dep.length) continue;
      lo = Math.min(lo, e.dep[0]); hi = Math.max(hi, e.dep[e.dep.length - 1]);
    }
    if (!Number.isFinite(lo) || hi <= lo) return null;

    // WHICH surfaces are tied. Ticked ones win; with nothing ticked the panel
    // falls back to the widest few, because a panel that draws no lines until you
    // choose some is a worse default than one that shows the obvious ones.
    const chosen = panelTops.length
      ? surfaces.filter(([sf]) => panelTops.includes(sf))
      : surfaces.slice(0, 8);

    const lines = chosen.map(([surface]) => ({
      surface,
      at: entries.map((e) => {
        const p = e.b.picks.find((q) => q.surface === surface);
        return e.shift != null && p ? e.toDisp(p.md) + e.shift : null;
      }),
    }));

    /**
     * THE CONTACT. On a TVDSS axis it needs no conversion at all — it is already
     * a TVDSS depth, and that is the strongest argument for TVDSS being the
     * default. On MD it goes through each bore's own fit and is flagged where
     * that fit is being extrapolated.
     */
    const contactAt = new Map<string, { at: number; extrapolated: boolean } | null>();
    if (contact?.tvdss != null) {
      for (const e of entries) {
        if (e.shift == null) { contactAt.set(e.well, null); continue; }
        if (depthMode === 'tvdss') {
          contactAt.set(e.well, { at: zSign * contact.tvdss + e.shift, extrapolated: false });
        } else {
          const c = contactMd(e.fit, contact.tvdss);
          contactAt.set(e.well, c ? { at: c.md + e.shift, extrapolated: c.extrapolated } : null);
        }
      }
    }

    return { entries, lo, hi, lines, contactAt, noFit };
  }, [curves.bores, depthMode, zSign, flattenOn, surfaces, panelWells, panelOrder, panelTops, cum, contact]);

  const unflattenable = useMemo(
    () => (flattenOn
      ? curves.bores.filter((b) => !b.picks.some((p) => p.surface === flattenOn)).map((b) => b.well)
      : []),
    [curves.bores, flattenOn],
  );

  /**
   * The canvas fills its pane. A fixed height left the logs stopping short of the
   * bottom with dead space under them — and worse, it made the visible depth range
   * a property of a constant rather than of the window you gave it.
   *
   * Measured with a ResizeObserver and committed through a functional update that
   * returns the PREVIOUS state when nothing moved. That is not defensive style: an
   * observer that setStates unconditionally re-renders, which resizes, which fires
   * the observer — the "Maximum update depth exceeded" loop this pane has already
   * been bitten by once.
   */
  const [height, setHeight] = useState(460);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = Math.max(320, Math.round(el.clientHeight) - 2);
      setHeight((prev) => (Math.abs(prev - h) < 2 ? prev : h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
        {/* THE DEPTH AXIS, and it is the panel's most load-bearing control.
            TVDSS first because that is the space beds correlate in. */}
        <span className="pcp-depth">
          <button className={depthMode === 'tvdss' ? 'on' : ''} onClick={() => setDepthMode('tvdss')}
            title="True vertical depth subsea — beds line up across deviated bores. Converted per bore from its own dual-recorded picks.">TVDSS</button>
          <button className={depthMode === 'md' ? 'on' : ''} onClick={() => setDepthMode('md')}
            title="Measured depth — the depth the log was recorded at, and the depth you read back to the driller.">MD</button>
        </span>
        <span className="pcp-hang">
          {flattenOn ? (
            <em className="pcp-datum" title="Set from the Well tops folder in the Input tree — click it again there to clear">
              flattened on <b>{flattenOn}</b>
              <i>{surfaces.find(([sf]) => sf === flattenOn)?.[1] ?? 0} bores</i>
            </em>
          ) : (
            <em className="pcp-datum none" title="Pick a surface under Well tops in the Input tree to flatten on it">
              hung on {depthMode === 'tvdss' ? 'TVDSS' : 'measured depth'} — pin a <b>Well top</b> on the left to flatten
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
        {/* WHAT THE TREE IS DOING TO THIS PANEL, said out loud. A filter you
            cannot see is indistinguishable from a control that does not work —
            which is exactly how this pane read before. */}
        {(panelWells.length > 0 || panelCurves.length > 0 || panelTops.length > 0 || panelOrder.length > 0) && (
          <button className="pcp-filter" onClick={clearPanel}
            title="Clear every Input-tree filter on this panel">
            <Eraser size={10} />
            {[
              panelWells.length ? `${panelWells.length} bore${panelWells.length === 1 ? '' : 's'}` : null,
              panelCurves.length ? `${panelCurves.length} curve${panelCurves.length === 1 ? '' : 's'}` : null,
              panelTops.length ? `${panelTops.length} top${panelTops.length === 1 ? '' : 's'}` : null,
              panelOrder.length ? 'custom order' : null,
            ].filter(Boolean).join(' · ')}
            <i>from tree — clear</i>
          </button>
        )}
        <em>
          {curves.running
            ? `interpreting ${curves.done}/${curves.total} bores…`
            : `${model?.entries.length ?? 0}${panelWells.length ? `/${curves.bores.length}` : ''} bores`
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
            {model.entries.map((e, i) => (
              <li key={e.well}>
                <span className="n">{i + 1}</span>
                <b>{e.well}</b>
                <i>{(() => { const c = cum.get(e.well); return c == null ? 'no prod record' : `${(c / 1e6).toFixed(2)}M`; })()}</i>
                <button disabled={i === 0} title="Move left"
                  onClick={() => setPanelOrder(swap(model.entries.map((x) => x.well), i, i - 1))}>↑</button>
                <button disabled={i === model.entries.length - 1} title="Move right"
                  onClick={() => setPanelOrder(swap(model.entries.map((x) => x.well), i, i + 1))}>↓</button>
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
          <svg ref={svgRef} width={PAD.l + model.entries.length * colW + 20} height={height}
            style={{ cursor: 'ns-resize' }}>
            {/* Everything depth-bearing is CLIPPED to the track window. Zooming
                rescales the depth axis, so without this the curves ride up over
                the column headers and out of the panel. */}
            <defs>
              <clipPath id="pcp-clip">
                <rect x={0} y={PAD.t + HEAD} width={PAD.l + model.entries.length * colW + 20}
                  height={height - PAD.b - PAD.t - HEAD} />
              </clipPath>
            </defs>

            {/* COLUMN BANDS. Wells were reading as one continuous smear of tracks;
                a translucent panel behind alternate bores makes the boundary a
                surface rather than a gap, which is what "different well" is. */}
            {model.entries.map((e, i) => (
              <rect key={'band' + e.well} x={PAD.l + i * colW - GUTTER / 2 + 2} y={PAD.t}
                width={lay.inner + GUTTER - 4} height={height - PAD.b - PAD.t} rx={5}
                className={'pcp-band' + (i % 2 ? ' alt' : '')} />
            ))}

            {/* column headers and track frames — fixed, outside the clip */}
            {model.entries.map((e, i) => {
              const x0 = PAD.l + i * colW;
              return (
                <g key={e.well}>
                  <text x={x0 + 2} y={PAD.t + 9} fontSize={8.5} fontWeight={600}
                    fill={ROLE_FILL[pathRole(e.b.role)]} fontFamily="var(--mono)">{e.well}</text>
                  {e.shift == null && (
                    <text x={x0 + 2} y={PAD.t + 19} fontSize={6.5} fill="var(--orange,#f59e0b)"
                      fontFamily="var(--mono)">no {flattenOn} pick — not flattened</text>
                  )}
                  {tracks.map((tk, ti) => (
                    <g key={tk.id}>
                      <text x={x0 + lay.offs[ti] + 2} y={PAD.t + HEAD - 4} fontSize={6.5}
                        fill="var(--ink3)" fontFamily="var(--mono)">{tk.label}</text>
                      <rect x={x0 + lay.offs[ti]} y={PAD.t + HEAD} width={tk.w - 2}
                        height={height - PAD.b - PAD.t - HEAD} className="pcp-track" />
                    </g>
                  ))}
                </g>
              );
            })}

            <g clipPath="url(#pcp-clip)">
              {/* depth axis — ticks are labelled in the delivery's own numbers, so
                  a negative-down TVDSS reads negative rather than being quietly
                  flipped into something that looks like a depth below rotary */}
              {y.ticks(10).map((d) => (
                <g key={d}>
                  <line x1={PAD.l - 4} y1={y(d)} x2={PAD.l + model.entries.length * colW} y2={y(d)}
                    stroke="var(--line)" opacity={0.18} />
                  <text x={PAD.l - 8} y={y(d) + 3} textAnchor="end" fontSize={7.5}
                    fill="var(--ink3)" fontFamily="var(--mono)">
                    {Math.round(depthMode === 'tvdss' ? d * zSign : d)}
                  </text>
                </g>
              ))}

              {/* correlation lines — drawn UNDER the tracks so curves stay readable.
                  Each vertex is that bore's OWN pick for the surface: the line is
                  tied at the impact points, not interpolated across the panel. */}
              {model.lines.map((l, li) => {
                const pts: Array<[number, number]> = [];
                model.entries.forEach((_e, i) => {
                  const at = l.at[i];
                  if (at == null) return;
                  pts.push([PAD.l + i * colW + lay.inner / 2, y(at)]);
                });
                if (pts.length < 2) return null;
                const hue = (li * 47) % 360;
                const isDatum = l.surface === flattenOn;
                return (
                  <g key={l.surface}>
                    {pts.map((p, pi) => (
                      <circle key={pi} cx={p[0]} cy={p[1]} r={1.9}
                        fill={`hsl(${hue},62%,52%)`} stroke="var(--panel)" strokeWidth={0.7} />
                    ))}
                    <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none"
                      stroke={`hsl(${hue},60%,55%)`} strokeWidth={isDatum ? 1.8 : 1.1}
                      strokeDasharray={isDatum ? undefined : '5 3'} opacity={0.9} />
                    <text x={PAD.l + 2} y={pts[0][1] - 3} fontSize={7}
                      fill={`hsl(${hue},60%,45%)`} fontFamily="var(--mono)"
                      fontWeight={isDatum ? 600 : 400}>
                      {l.surface}{isDatum ? ' · datum' : ''}
                    </text>
                  </g>
                );
              })}

              {/* THE CONTACT. On TVDSS it needs no conversion — it already IS a
                  TVDSS depth. On MD it goes through each bore's own fit, dashed
                  where that fit is extrapolated past the deepest pick. */}
              {contact && model.entries.map((e, i) => {
                const c = model.contactAt.get(e.well);
                if (!c) return null;
                const x0 = PAD.l + i * colW;
                return (
                  <g key={'c' + e.well}>
                    <line x1={x0 - 3} y1={y(c.at)} x2={x0 + lay.inner} y2={y(c.at)}
                      stroke="#2f9bff" strokeWidth={1.6}
                      strokeDasharray={c.extrapolated ? '3 2' : undefined} opacity={0.95} />
                    {i === 0 && (
                      <text x={x0 + 2} y={y(c.at) - 3} fontSize={6.6}
                        fill="#2f9bff" fontFamily="var(--mono)">
                        {contact.kind.toUpperCase()} {contact.tvdss} m TVDSS
                      </text>
                    )}
                  </g>
                );
              })}

              {model.entries.map((e, i) => {
                if (e.shift == null) return null;
                const x0 = PAD.l + i * colW;
                return (
                  <g key={e.well}>
                    {tracks.map((tk, ti) => (
                      <TrackPath key={tk.id} bore={e.b} track={tk} dep={e.dep}
                        x0={x0 + lay.offs[ti]} y={y} />
                    ))}
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="pcp-empty">
            {curves.running ? 'interpreting the delivery…'
              : depthMode === 'tvdss'
                ? 'No bore can be placed on a TVDSS axis — that needs two picks recorded '
                  + 'in both MD and TVDSS. Switch to MD above.'
                : 'No bore produced curves to correlate.'}
          </div>
        )}
      </div>

      <footer className="pcp-foot">
        <span className="pcp-prov">curves are OURS — computed under the current parameters, not the delivery's</span>
        {/* The contact is the one line here that required a CONVERSION, so it says
            what the conversion rested on and where it could not be made. */}
        {contact && model && (() => {
          const placed = model.entries.filter((e) => model.contactAt.get(e.well));
          const extra = placed.filter((e) => model.contactAt.get(e.well)?.extrapolated);
          const all = model.entries.length;
          return (
            <span className={placed.length === all ? '' : 'pcp-warn'}>
              {placed.length === 0 ? <AlertTriangle size={10} /> : null}
              {contact.kind.toUpperCase()} on {placed.length}/{all} bores
              {depthMode === 'tvdss'
                ? ' — no conversion needed on a TVDSS axis'
                : " via each bore's own md↔tvdss picks"}
              {extra.length > 0 && ` · ${extra.length} extrapolated below the deepest pick (dashed)`}
              {placed.length < all && ` · ${all - placed.length} lack two dual-recorded picks`}
            </span>
          );
        })()}
        {/* Bores the TVDSS view cannot place are NAMED. Silently showing fewer
            wells than the tree says exist is how a panel loses trust. */}
        {model && model.noFit.length > 0 && (
          <span className="pcp-warn">
            <AlertTriangle size={10} />
            {model.noFit.length} bore{model.noFit.length === 1 ? '' : 's'} cannot be placed on TVDSS —
            {' '}fewer than two picks recorded in both MD and TVDSS:
            {' '}{model.noFit.slice(0, 5).join(' · ')}{model.noFit.length > 5 ? ' …' : ''}
          </span>
        )}
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

/**
 * One track of one bore.
 *
 * Two rendering modes, because there are two kinds of thing here. A measurement
 * is a WIGGLE — its value at every depth carries meaning. The net flag is not:
 * it has one bit per sample, and drawn as a line it becomes a square wave whose
 * vertical strokes are pure artefact. So net is drawn as DISCRETE BLOCKS — the
 * intervals where the flag is true — which is also what an engineer reads off
 * it: how much, and where.
 *
 * `dep` is the bore's DISPLAY depth per sample, already in MD or TVDSS and
 * already shifted by the flattening. Passing the finished array rather than a
 * conversion function means every element of the column — tracks, tie lines,
 * contact — is reading the same numbers, and the depth transform is applied
 * exactly once per bore instead of once per track.
 *
 * Wiggles are decimated to roughly one point per pixel. The net blocks are built
 * from the FULL array first, though — thinning a flag drops thin beds, and a
 * missed thin bed is the one error this track exists to prevent.
 */
function TrackPath({ bore, track, dep, x0, y }: {
  bore: BoreCurveSet;
  track: TrackSpec;
  dep: number[];
  x0: number;
  y: (d: number) => number;
}) {
  /** Where this track's samples come from — ours, or a delivered family. */
  const vals = useMemo((): (number | null)[] | undefined => {
    if (track.src.kind === 'raw') return bore.raw[track.src.family];
    switch (track.src.key) {
      case 'phie': return bore.phie;
      case 'sw': return bore.sw;
      case 'vsh': return bore.vsh;
      case 'gr': return bore.gr;
      case 'net': return null as unknown as undefined;   // handled as blocks
    }
  }, [bore, track]);

  const blocks = useMemo(() => {
    if (track.src.kind !== 'ours' || track.src.key !== 'net') return null;
    const out: Array<[number, number]> = [];
    let start: number | null = null;
    const n = Math.min(dep.length, bore.net.length);
    for (let i = 0; i < n; i++) {
      const on = bore.net[i] === true;
      if (on && start == null) start = dep[i];
      if (!on && start != null) { out.push([start, dep[i]]); start = null; }
    }
    if (start != null && n) out.push([start, dep[n - 1]]);
    return out;
  }, [track, bore, dep]);

  const d = useMemo(() => {
    if (blocks || !vals?.length || !dep.length) return '';
    // A track with no declared scale takes one from its own data — used for a
    // curve family we have no convention for. It is labelled `auto` so nobody
    // reads it as a standard scale.
    let { lo, hi } = track;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (v == null || !Number.isFinite(v) || (v <= -999 && v >= -9999.99)) continue;
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
      if (!(mx > mn)) return '';
      lo = mn; hi = mx;
    }
    const sx = track.log
      ? scaleLog().domain([Math.max(lo, 1e-6), Math.max(hi, 1e-6)]).range([x0 + 1, x0 + track.w - 3]).clamp(true)
      : scaleLinear().domain([lo, hi]).range([x0 + 1, x0 + track.w - 3]).clamp(true);

    const n = Math.min(dep.length, vals.length);
    const step = Math.max(1, Math.floor(n / 600));
    const out: string[] = [];
    let pen = false;
    for (let i = 0; i < n; i += step) {
      const v = vals[i];
      // a gap must BREAK the line rather than bridge two readings across a
      // hundred metres of no data. −999.25 is finite and is a gap.
      if (v == null || !Number.isFinite(v) || (v <= -999 && v >= -9999.99)
        || (track.log && v <= 0)) { pen = false; continue; }
      const px = sx(v), py = y(dep[i]);
      out.push(`${pen ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`);
      pen = true;
    }
    return out.join('');
  }, [blocks, vals, dep, track, x0, y]);

  if (blocks) {
    if (!blocks.length) return null;
    return (
      <g>
        {blocks.map(([top, base], i) => {
          const yt = y(top), yb = y(base);
          // a bed thinner than a pixel still has to be visible — it is a bed
          const h = Math.max(0.8, yb - yt);
          return (
            <rect key={i} x={x0 + 1} y={yt} width={track.w - 4} height={h}
              fill={track.color} opacity={0.85} />
          );
        })}
      </g>
    );
  }

  if (!d) return null;
  return <path d={d} fill="none" stroke={track.color} strokeWidth={0.9} />;
}
