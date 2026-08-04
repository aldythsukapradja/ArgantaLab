// SectionView — the section the user traced on the map, drawn as a section.
//
// The map answers "where"; the 3D view answers "how do the horizons stack". A
// cross-section answers the third question, which is the one a development
// argument is actually made in: along THIS line, where is each horizon, where is
// the contact, and which wells cut what.
//
// Everything is read from what is already loaded: the same decoded grids the map
// drapes and the 3D view meshes, the same impact points, the same published
// contact. The section adds no data — it re-cuts what exists along a line.
//
// THE THREE LIES A CROSS-SECTION CAN TELL, and what is done about them:
//
//   Interpolating across un-mapped ground. Horizon profiles BREAK at gaps
//   (splitAtGaps) rather than running a smooth line over ground nobody mapped,
//   and the key reports what fraction of the line each horizon actually covers.
//
//   Projecting distant wells as if they were on the line. Every well post shows
//   the perpendicular distance it was moved, and wells beyond the corridor are
//   not drawn at all.
//
//   Colouring fluid where there is no reservoir. Oil-above-contact green and
//   water-below-contact blue are painted ONLY inside the interval the contact
//   actually cuts — the rock between two mapped horizons. Tinting the whole
//   section either side of the contact would claim hydrocarbon in the
//   overburden, which is the most expensive kind of pretty picture.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, area as d3area, curveMonotoneX } from 'd3-shape';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { Maximize2, Minus, Plus } from 'lucide-react';
import type { DigestedSurface } from '../../dataqc/types';
import { depthConvention, rampRgb } from './StructureLayer';
import {
  sampleAlongPath, splitAtGaps, sampleRange, projectWells, pathLength,
  type SampleGrid, type P2, type SectionSample,
} from './xsection';
import type { InterpFeature } from './interpret';
import { ROLE_FILL, type ImpactMarker } from './ImpactMarkers';

export interface SectionSurface {
  id: string; name: string; short: string;
  grid: DigestedSurface;
  geo: { x0: number; y0: number; cell: number };
}

/** An impact point that knows WHICH horizon it belongs to, so a well can post a
 *  marker on each horizon it cuts rather than a single depth. */
export type SectionWell = ImpactMarker & {
  easting: number; northing: number; horizonId?: string;
};

export interface SectionViewProps {
  section: InterpFeature | null;
  toProjected: (lon: number, lat: number) => P2;
  surfaces: SectionSurface[];
  wells: SectionWell[];
  contactDepth?: number | null;
  contactLabel?: string;
  /** corridor half-width in metres — wells beyond it are not on this section */
  corridor?: number;
}

const PAD = { l: 54, r: 54, t: 30, b: 42 };
const SAMPLES = 320;

/** Neutral tints for the intervals BETWEEN horizons, so a stack of five reads as
 *  layered rock rather than five loose lines. Deliberately desaturated: the only
 *  saturated fill on this chart is fluid. */
const LAYER_TINT = ['#8ea3b8', '#7d93aa', '#6f8a9e', '#63798f', '#586d82'];

export function SectionView({
  section, toProjected, surfaces, wells, contactDepth, contactLabel = 'OWC', corridor = 750,
}: SectionViewProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [zx, setZx] = useState(1);            // vertical exaggeration
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  /**
   * A callback ref, and it MUST be stable and MUST NOT set state unconditionally.
   * React re-runs a callback ref whenever its identity changes, so an inline arrow
   * re-runs every render; measuring there with a fresh object is always a state
   * change, which is another render — "Maximum update depth exceeded". Stable
   * identity plus a functional update that returns `prev` when nothing moved.
   */
  const attach = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => setSize((prev) => {
      const w = el.clientWidth, h = el.clientHeight;
      return prev.w === w && prev.h === h ? prev : { w, h };
    });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    roRef.current = ro;
    measure();
  }, []);

  // ── sample every surface along the traced line ─────────────────────────────
  const model = useMemo(() => {
    if (!section || section.pts.length < 2 || !surfaces.length) return null;
    const path: P2[] = section.pts.map((p) => toProjected(p.lon, p.lat));
    const total = pathLength(path);
    if (!(total > 0)) return null;

    const profiles = surfaces.map((s) => {
      const conv = depthConvention(s.grid.values);
      const flip = conv?.flip ?? true;
      // sample in DEPTH (positive down) so every surface shares one axis
      const grid: SampleGrid = {
        ncol: s.grid.ncol, nrow: s.grid.nrow,
        x0: s.geo.x0, y0: s.geo.y0, dx: s.geo.cell, dy: s.geo.cell,
        values: flip
          ? Float64Array.from({ length: s.grid.values.length }, (_, i) => -s.grid.values[i])
          : s.grid.values,
      };
      const samples = sampleAlongPath(grid, path, SAMPLES);
      const live = samples.filter((p) => p.depth != null).length;
      const mean = live
        ? samples.reduce((a, p) => a + (p.depth ?? 0), 0) / live
        : Number.POSITIVE_INFINITY;
      return { s, samples, live, mean };
    // shallowest first, so consecutive pairs bound a real interval
    }).sort((a, b) => a.mean - b.mean);

    const range = sampleRange(profiles.map((p) => p.samples));
    if (!range) return null;
    const dmin = Math.min(range.dmin, contactDepth ?? range.dmin);
    const dmax = Math.max(range.dmax, contactDepth ?? range.dmax);

    const posted = projectWells(path, wells, corridor);
    // one TRACK per well, with every pick it made on the shown horizons
    const tracks = new Map<string, { dist: number; offset: number; role: ImpactMarker['role']; picks: Array<{ depth: number; horizonId?: string }> }>();
    for (const p of posted) {
      const cur = tracks.get(p.item.well) ?? {
        dist: p.dist, offset: p.offset, role: p.item.role, picks: [],
      };
      if (p.item.tvdss != null) cur.picks.push({ depth: Math.abs(p.item.tvdss), horizonId: p.item.horizonId });
      // keep the SMALLEST offset: the same well may appear once per horizon
      if (p.offset < cur.offset) { cur.dist = p.dist; cur.offset = p.offset; }
      tracks.set(p.item.well, cur);
    }

    /**
     * Which interval the contact cuts. The fluid fill is painted only there —
     * between the horizon above it and the horizon below — because that is the
     * only rock the contact says anything about.
     */
    let fluidPair: [number, number] | null = null;
    if (contactDepth != null && Number.isFinite(contactDepth)) {
      for (let i = 0; i < profiles.length - 1; i++) {
        const above = profiles[i].mean, below = profiles[i + 1].mean;
        if (contactDepth >= above && contactDepth <= below) { fluidPair = [i, i + 1]; break; }
      }
    }

    return { path, total, profiles, dmin, dmax, tracks: [...tracks.entries()], fluidPair };
  }, [section, toProjected, surfaces, wells, contactDepth, corridor]);

  // ── zoom / pan ─────────────────────────────────────────────────────────────
  const zoomRef = useRef<ReturnType<typeof d3zoom<SVGSVGElement, unknown>> | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !model) return;
    const behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 60])
      .on('zoom', (e) => setT(e.transform));
    select(svg).call(behavior);
    // keep a handle so the buttons drive the SAME behaviour the mouse does —
    // setting the transform directly would desync d3's internal state and the
    // next wheel event would jump back
    zoomRef.current = behavior;
    return () => { select(svg).on('.zoom', null); };
  }, [model]);
  const zoomBy = (k: number) => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) select(svg).transition().duration(200).call(zoomRef.current.scaleBy, k);
  };
  const resetZoom = () => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) select(svg).transition().duration(250).call(zoomRef.current.transform, zoomIdentity);
  };

  if (!section) {
    return (
      <div className="fds-xs-empty">
        No section traced yet.<br />
        <span>Pick the <b>section</b> tool on the map, click along the line you want, then double-click to finish.</span>
      </div>
    );
  }
  if (!model) return <div className="fds-xs-empty">This section does not cross any decoded horizon.</div>;

  const iw = Math.max(10, size.w - PAD.l - PAD.r);
  const ih = Math.max(10, size.h - PAD.t - PAD.b);

  // base scales, then the zoom transform on top. Vertical exaggeration shrinks
  // the depth DOMAIN about its centre, which is what "×N" means on a section.
  const x0 = scaleLinear().domain([0, model.total]).range([PAD.l, PAD.l + iw]);
  const mid = (model.dmin + model.dmax) / 2;
  const half = Math.max(1, (model.dmax - model.dmin) / 2) / zx;
  const y0 = scaleLinear().domain([mid - half, mid + half]).range([PAD.t, PAD.t + ih]);
  const x = t.rescaleX(x0);
  const y = t.rescaleY(y0);

  const gen = d3line<SectionSample>().x((d) => x(d.dist)).y((d) => y(d.depth as number)).curve(curveMonotoneX);
  const between = d3area<{ dist: number; a: number; b: number }>()
    .x((d) => x(d.dist)).y0((d) => y(d.a)).y1((d) => y(d.b)).curve(curveMonotoneX);

  const colorOf = (s: SectionSurface) => {
    const conv = depthConvention(s.grid.values);
    if (!conv) return '#94a3b8';
    const m = (conv.dmin + conv.dmax) / 2;
    const [r, g, b] = rampRgb((m - model.dmin) / Math.max(1, model.dmax - model.dmin));
    return `rgb(${r},${g},${b})`;
  };

  /** Paired samples where BOTH horizons are mapped — the only places an interval
   *  between them is real. Split into runs so a gap in either breaks the fill. */
  const pairRuns = (ai: number, bi: number) => {
    const A = model.profiles[ai].samples, B = model.profiles[bi].samples;
    const runs: Array<Array<{ dist: number; a: number; b: number }>> = [];
    let run: Array<{ dist: number; a: number; b: number }> = [];
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      const a = A[i]?.depth, b = B[i]?.depth;
      if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
        if (run.length > 1) runs.push(run);
        run = [];
        continue;
      }
      run.push({ dist: A[i].dist, a, b });
    }
    if (run.length > 1) runs.push(run);
    return runs;
  };

  const cy = contactDepth != null && Number.isFinite(contactDepth) ? y(contactDepth) : null;
  const dTicks = y.ticks(Math.max(4, Math.round(ih / 46)));
  const xTicks = x.ticks(Math.max(3, Math.round(iw / 110)));
  const hoverD = hover ? x.invert(hover.x) : null;
  const hoverZ = hover ? y.invert(hover.y) : null;

  // a round distance that renders 60–160 px wide, for the Petrel-style scale bar
  const barM = [50, 100, 200, 500, 1000, 2000, 5000, 10_000]
    .find((m) => x(m) - x(0) > 60) ?? 10_000;
  const barPx = x(barM) - x(0);

  return (
    <div className="fds-xs" ref={attach}>
      {size.w > 40 && (
        <svg ref={svgRef} width={size.w} height={size.h} style={{ display: 'block', cursor: 'grab' }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - r.left, py = e.clientY - r.top;
            setHover(px >= PAD.l && px <= PAD.l + iw && py >= PAD.t && py <= PAD.t + ih ? { x: px, y: py } : null);
          }}
          onPointerLeave={() => setHover(null)}>
          <defs>
            <clipPath id="fds-xs-clip">
              <rect x={PAD.l} y={PAD.t} width={iw} height={ih} />
            </clipPath>
            <linearGradient id="fds-xs-oil" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0.30} />
            </linearGradient>
            <linearGradient id="fds-xs-wat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f6fd0" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#2f6fd0" stopOpacity={0.55} />
            </linearGradient>
          </defs>

          <rect x={PAD.l} y={PAD.t} width={iw} height={ih} fill="var(--panel3)" opacity={0.35} />

          <g clipPath="url(#fds-xs-clip)">
            {/* depth grid */}
            {dTicks.map((d) => (
              <line key={'g' + d} x1={PAD.l} y1={y(d)} x2={PAD.l + iw} y2={y(d)}
                stroke="var(--line)" opacity={0.22} />
            ))}
            {xTicks.map((d) => (
              <line key={'v' + d} x1={x(d)} y1={PAD.t} x2={x(d)} y2={PAD.t + ih}
                stroke="var(--line)" opacity={0.14} />
            ))}

            {/* ── rock intervals, shallowest pair first ── */}
            {model.profiles.slice(0, -1).map((_p, i) => {
              const isFluid = model.fluidPair && model.fluidPair[0] === i;
              return pairRuns(i, i + 1).map((run, k) => {
                if (!isFluid || cy == null || contactDepth == null) {
                  return (
                    <path key={`L${i}-${k}`} d={between(run) ?? ''}
                      fill={LAYER_TINT[i % LAYER_TINT.length]} opacity={0.16} />
                  );
                }
                // THE FLUID SPLIT. Inside the interval the contact cuts: the part
                // above it is oil, the part below is water. Clipped by the contact
                // depth rather than by a straight line across the panel, so a
                // horizon that dives below the contact stops being green exactly
                // where it should.
                const oil = run.map((d) => ({ dist: d.dist, a: d.a, b: Math.min(d.b, contactDepth) }))
                  .filter((d) => d.b > d.a);
                const wat = run.map((d) => ({ dist: d.dist, a: Math.max(d.a, contactDepth), b: d.b }))
                  .filter((d) => d.b > d.a);
                return (
                  <g key={`F${i}-${k}`}>
                    {oil.length > 1 && <path d={between(oil) ?? ''} fill="url(#fds-xs-oil)" />}
                    {wat.length > 1 && <path d={between(wat) ?? ''} fill="url(#fds-xs-wat)" />}
                  </g>
                );
              });
            })}

            {/* ── horizons ── */}
            {model.profiles.map(({ s, samples }) => (
              <g key={s.id}>
                {splitAtGaps(samples).map((run, i) => (
                  <path key={i} d={gen(run) ?? ''} fill="none" stroke={colorOf(s)}
                    strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </g>
            ))}

            {/* ── the contact: a plane, so a horizontal line ── */}
            {cy != null && (
              <line x1={PAD.l} y1={cy} x2={PAD.l + iw} y2={cy}
                stroke="#2f9bff" strokeWidth={1.8} strokeDasharray="7 4" />
            )}

            {/* ── wells ── */}
            {model.tracks.map(([well, tr]) => {
              const px = x(tr.dist);
              if (px < PAD.l - 40 || px > PAD.l + iw + 40) return null;
              const deepest = tr.picks.length ? Math.max(...tr.picks.map((p) => p.depth)) : null;
              return (
                <g key={well}>
                  <line x1={px} y1={PAD.t} x2={px} y2={deepest != null ? y(deepest) + 14 : PAD.t + ih}
                    stroke={ROLE_FILL[tr.role]} strokeWidth={1.6}
                    opacity={tr.offset > corridor / 2 ? 0.4 : 0.75} />
                  {tr.picks.map((p, i) => (
                    <g key={i}>
                      <line x1={px - 6} y1={y(p.depth)} x2={px + 6} y2={y(p.depth)}
                        stroke={ROLE_FILL[tr.role]} strokeWidth={2.4} />
                      <circle cx={px} cy={y(p.depth)} r={2.6} fill={ROLE_FILL[tr.role]} />
                    </g>
                  ))}
                </g>
              );
            })}

            {hover && (
              <g pointerEvents="none">
                <line x1={hover.x} y1={PAD.t} x2={hover.x} y2={PAD.t + ih} stroke="var(--muted)" opacity={0.45} />
                <line x1={PAD.l} y1={hover.y} x2={PAD.l + iw} y2={hover.y} stroke="var(--muted)" opacity={0.45} />
              </g>
            )}
          </g>

          {/* ── well labels, outside the clip so they are never cut ── */}
          {model.tracks.map(([well, tr]) => {
            const px = x(tr.dist);
            if (px < PAD.l - 10 || px > PAD.l + iw + 10) return null;
            return (
              <g key={'lbl' + well}>
                <text x={px} y={PAD.t - 14} textAnchor="middle" fontSize={8}
                  fill="var(--ink)" fontFamily="var(--mono)">{well}</text>
                <text x={px} y={PAD.t - 5} textAnchor="middle" fontSize={6.5}
                  fill="var(--ink3)" fontFamily="var(--mono)">{Math.round(tr.offset)} m off</text>
              </g>
            );
          })}

          {/* ── axes ── */}
          <rect x={PAD.l} y={PAD.t} width={iw} height={ih} fill="none" stroke="var(--line)" />
          {dTicks.map((d) => (
            <g key={'t' + d}>
              <text x={PAD.l - 7} y={y(d) + 3} textAnchor="end" fontSize={8.5}
                fill="var(--ink3)" fontFamily="var(--mono)">{Math.round(d)}</text>
              <text x={PAD.l + iw + 7} y={y(d) + 3} fontSize={8.5}
                fill="var(--ink3)" fontFamily="var(--mono)">{Math.round(d)}</text>
            </g>
          ))}
          {xTicks.map((d) => (
            <text key={'x' + d} x={x(d)} y={PAD.t + ih + 13} textAnchor="middle" fontSize={8}
              fill="var(--ink3)" fontFamily="var(--mono)">{Math.round(d)}</text>
          ))}
          <text x={PAD.l - 7} y={PAD.t - 8} textAnchor="end" fontSize={7}
            fill="var(--ink3)" fontFamily="var(--mono)">m TVDSS</text>

          {cy != null && cy > PAD.t && cy < PAD.t + ih && (
            <text x={PAD.l + iw + 7} y={cy - 4} fontSize={7.5} fill="#2f9bff" fontFamily="var(--mono)">
              {contactLabel} {Math.round(contactDepth as number)}
            </text>
          )}

          {/* A→A′ and a real scale bar, which is what makes a section measurable
              rather than merely suggestive. */}
          <text x={PAD.l} y={PAD.t - 18} fontSize={10} fontWeight={700} fill="var(--ink)">A</text>
          <text x={PAD.l + iw} y={PAD.t - 18} textAnchor="end" fontSize={10} fontWeight={700} fill="var(--ink)">A′</text>
          <g transform={`translate(${PAD.l + 6},${size.h - 12})`}>
            <line x1={0} y1={0} x2={barPx} y2={0} stroke="var(--ink2)" strokeWidth={2} />
            <line x1={0} y1={-3} x2={0} y2={3} stroke="var(--ink2)" strokeWidth={2} />
            <line x1={barPx} y1={-3} x2={barPx} y2={3} stroke="var(--ink2)" strokeWidth={2} />
            <text x={barPx / 2} y={-5} textAnchor="middle" fontSize={7.5}
              fill="var(--ink2)" fontFamily="var(--mono)">
              {barM >= 1000 ? `${barM / 1000} km` : `${barM} m`}
            </text>
          </g>
          <text x={size.w - PAD.r} y={size.h - 12} textAnchor="end" fontSize={7.5}
            fill="var(--ink3)" fontFamily="var(--mono)">
            {(model.total / 1000).toFixed(2)} km · ×{(zx * t.k).toFixed(1)} vertical
            {hoverD != null && hoverZ != null ? ` · ${Math.round(hoverD)} m, ${Math.round(hoverZ)} m` : ''}
          </text>
        </svg>
      )}

      <div className="fds-xs-ctl">
        <button onClick={() => zoomBy(1.4)} title="Zoom in"><Plus size={11} /></button>
        <button onClick={() => zoomBy(1 / 1.4)} title="Zoom out"><Minus size={11} /></button>
        <button onClick={resetZoom} title="Reset zoom and pan"><Maximize2 size={11} /></button>
        <label title="vertical exaggeration — a 7 km section with 600 m of relief is flat at ×1">
          ×{zx}
          <input type="range" min={1} max={20} step={1} value={zx}
            onChange={(e) => setZx(Number(e.target.value))} />
        </label>
      </div>

      <div className="fds-xs-key">
        {model.profiles.map(({ s, samples, live }) => (
          <span key={s.id} title={`${live}/${samples.length} of the section crosses mapped ${s.name}`}>
            <i style={{ background: colorOf(s) }} />{s.short}
            {live < samples.length && <em> {Math.round((live / samples.length) * 100)}%</em>}
          </span>
        ))}
        {model.fluidPair && (
          <>
            <span title="oil leg — inside the interval the contact cuts, above the contact"><i className="sw" style={{ background: '#16a34a' }} />oil</span>
            <span title="water leg — the same interval, below the contact"><i className="sw" style={{ background: '#2f6fd0' }} />water</span>
          </>
        )}
        {contactDepth != null && !model.fluidPair && (
          <em title="The contact is drawn, but no shown interval contains it — fluid is not painted where no reservoir is displayed.">
            contact outside the shown interval
          </em>
        )}
        <em title={`Wells further than ${corridor} m from the line are not shown — a section is a claim about a plane.`}>
          {model.tracks.length} well{model.tracks.length === 1 ? '' : 's'} ≤{corridor} m
        </em>
      </div>
    </div>
  );
}
