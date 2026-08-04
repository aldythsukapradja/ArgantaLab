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
// THE TWO LIES A CROSS-SECTION CAN TELL, and what is done about them:
//
//   Interpolating across un-mapped ground. Horizon profiles BREAK at gaps
//   (splitAtGaps) rather than running a smooth line over ground nobody mapped.
//
//   Projecting distant wells as if they were on the line. Every well post shows
//   the perpendicular distance it was moved, and wells beyond the corridor are
//   not drawn at all. A section that silently gathers wells from 3 km away looks
//   far better constrained than it is.
import { useCallback, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveMonotoneX } from 'd3-shape';
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

export interface SectionViewProps {
  /** the traced section, in lon/lat */
  section: InterpFeature | null;
  /** projector for the section trace into the grids' frame */
  toProjected: (lon: number, lat: number) => P2;
  surfaces: SectionSurface[];
  wells: Array<ImpactMarker & { easting: number; northing: number }>;
  contactDepth?: number | null;
  contactLabel?: string;
  /** corridor half-width in metres — wells beyond it are not on this section */
  corridor?: number;
}

const PAD = { l: 52, r: 14, t: 16, b: 30 };
const SAMPLES = 260;

export function SectionView({
  section, toProjected, surfaces, wells, contactDepth, contactLabel, corridor = 750,
}: SectionViewProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);

  const roRef = useRef<ResizeObserver | null>(null);
  /**
   * A callback ref, and it MUST be stable and MUST NOT set state unconditionally.
   *
   * React re-runs a callback ref whenever its identity changes — so an inline
   * arrow re-runs on every render. Measuring there with `setSize({w, h})` hands
   * back a fresh object every time, which is always a state change, which is
   * another render, which re-runs the ref: "Maximum update depth exceeded". Both
   * halves of the fix are load-bearing — useCallback([]) keeps the identity
   * stable, and the functional update returns `prev` unchanged when the box has
   * not actually resized, so a spurious measure cannot start a loop either.
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
      return { s, samples: sampleAlongPath(grid, path, SAMPLES) };
    });

    const range = sampleRange(profiles.map((p) => p.samples));
    if (!range) return null;
    // give the contact room even when it sits outside the horizons' own range
    const dmin = Math.min(range.dmin, contactDepth ?? range.dmin);
    const dmax = Math.max(range.dmax, contactDepth ?? range.dmax);

    const posted = projectWells(path, wells, corridor);
    return { path, total, profiles, dmin, dmax, posted };
  }, [section, toProjected, surfaces, wells, contactDepth, corridor]);

  if (!section) {
    return (
      <div className="fds-xs-empty">
        No section traced yet.<br />
        <span>Pick the <b>section</b> tool on the map, click along the line you want, then double-click to finish.</span>
      </div>
    );
  }
  if (!model) {
    return <div className="fds-xs-empty">This section does not cross any decoded horizon.</div>;
  }

  const iw = Math.max(10, size.w - PAD.l - PAD.r);
  const ih = Math.max(10, size.h - PAD.t - PAD.b);
  const x = scaleLinear().domain([0, model.total]).range([PAD.l, PAD.l + iw]);
  // depth increases downward — the only orientation a section is ever read in
  const y = scaleLinear().domain([model.dmin, model.dmax]).nice().range([PAD.t, PAD.t + ih]);
  const gen = d3line<SectionSample>().x((d) => x(d.dist)).y((d) => y(d.depth as number)).curve(curveMonotoneX);

  const colorOf = (s: SectionSurface) => {
    const conv = depthConvention(s.grid.values);
    if (!conv) return '#94a3b8';
    const mid = (conv.dmin + conv.dmax) / 2;
    const [r, g, b] = rampRgb((mid - model.dmin) / Math.max(1, model.dmax - model.dmin));
    return `rgb(${r},${g},${b})`;
  };

  const hoverDist = hover != null ? x.invert(hover) : null;

  return (
    <div className="fds-xs" ref={attach}>
      {size.w > 40 && (
        <svg width={size.w} height={size.h} style={{ display: 'block' }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - r.left;
            setHover(px >= PAD.l && px <= PAD.l + iw ? px : null);
          }}
          onPointerLeave={() => setHover(null)}>

          {y.ticks(6).map((t) => (
            <g key={t}>
              <line x1={PAD.l} y1={y(t)} x2={PAD.l + iw} y2={y(t)} stroke="var(--line)" opacity={0.3} />
              <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize={8.5}
                fill="var(--ink3)" fontFamily="var(--mono)">{Math.round(t)}</text>
            </g>
          ))}

          {/* the contact: a horizontal plane, so a horizontal line */}
          {contactDepth != null && Number.isFinite(contactDepth)
            && contactDepth >= model.dmin && contactDepth <= model.dmax && (
            <g>
              <line x1={PAD.l} y1={y(contactDepth)} x2={PAD.l + iw} y2={y(contactDepth)}
                stroke="#2f9bff" strokeWidth={1.6} strokeDasharray="6 3" />
              <text x={PAD.l + iw - 2} y={y(contactDepth) - 4} textAnchor="end" fontSize={8}
                fill="#2f9bff" fontFamily="var(--mono)">
                {contactLabel ?? 'contact'} {Math.round(contactDepth)} m
              </text>
            </g>
          )}

          {/* horizons — one path per unbroken run, so gaps stay gaps */}
          {model.profiles.map(({ s, samples }) => (
            <g key={s.id}>
              {splitAtGaps(samples).map((run, i) => (
                <path key={i} d={gen(run) ?? ''} fill="none" stroke={colorOf(s)}
                  strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </g>
          ))}

          {/* wells, posted at their distance along the line */}
          {model.posted.map(({ item, dist, offset }) => {
            const px = x(dist);
            const depth = item.tvdss != null ? Math.abs(item.tvdss) : null;
            const py = depth != null && depth >= model.dmin && depth <= model.dmax ? y(depth) : null;
            return (
              <g key={item.well}>
                <line x1={px} y1={PAD.t} x2={px} y2={PAD.t + ih}
                  stroke={ROLE_FILL[item.role]} strokeWidth={1} opacity={offset > corridor / 2 ? 0.35 : 0.62} />
                {py != null && (
                  <circle cx={px} cy={py} r={3.4} fill={ROLE_FILL[item.role]}
                    stroke="var(--panel)" strokeWidth={1.2} />
                )}
                <text x={px} y={PAD.t - 5} textAnchor="middle" fontSize={7.5}
                  fill="var(--ink2)" fontFamily="var(--mono)">{item.well}</text>
                {/* how far this well was moved to reach the line — the number that
                    says how much its position here can be trusted */}
                <text x={px} y={PAD.t + ih + 10} textAnchor="middle" fontSize={6.5}
                  fill="var(--ink3)" fontFamily="var(--mono)">{Math.round(offset)}m</text>
              </g>
            );
          })}

          {hover != null && <line x1={hover} y1={PAD.t} x2={hover} y2={PAD.t + ih} stroke="var(--muted)" opacity={0.4} />}

          <text x={PAD.l} y={size.h - 6} fontSize={8} fill="var(--ink3)" fontFamily="var(--mono)">A</text>
          <text x={PAD.l + iw} y={size.h - 6} textAnchor="end" fontSize={8} fill="var(--ink3)" fontFamily="var(--mono)">A′</text>
          <text x={PAD.l + iw / 2} y={size.h - 6} textAnchor="middle" fontSize={7.5}
            fill="var(--ink3)" fontFamily="var(--mono)">
            {(model.total / 1000).toFixed(2)} km{hoverDist != null ? ` · ${Math.round(hoverDist)} m` : ''}
          </text>
        </svg>
      )}

      <div className="fds-xs-key">
        {model.profiles.map(({ s, samples }) => {
          const live = samples.filter((p) => p.depth != null).length;
          return (
            <span key={s.id} title={`${live}/${samples.length} of the section crosses mapped ${s.name}`}>
              <i style={{ background: colorOf(s) }} />{s.short}
              {live < samples.length && <em> {Math.round((live / samples.length) * 100)}%</em>}
            </span>
          );
        })}
        <em title={`Wells further than ${corridor} m from the line are not shown — a section is a claim about a plane.`}>
          {model.posted.length} well{model.posted.length === 1 ? '' : 's'} within {corridor} m
        </em>
      </div>
    </div>
  );
}
