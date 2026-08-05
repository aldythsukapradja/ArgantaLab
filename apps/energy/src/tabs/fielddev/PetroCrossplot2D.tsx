// PetroCrossplot2D — the analytics crossplots, drawn from the real delivery.
//
// Four templates, each chosen because it ANSWERS something and because this
// delivery can support it (petro-xplot counts that per template, and a template
// the data cannot carry renders its reason instead of an empty cloud):
//
//   Density–neutron   lithology, and the gas crossover. 20 of 24 Volve bores.
//   Pickett           Archie on log–log: m is the slope, and points above the
//                     Sw=1 line are the hydrocarbon indication.
//   Buckles           PHIE vs Sw. Constant BVW hyperbolae — points on one are at
//                     irreducible water, points above it will produce water.
//   Saturation-height BVW vs height above the free-water level, fitted by the
//                     SAME fitCuddy the dynamic initialization uses.
//
// The cloud is CANVAS and the overlay is SVG. 170,000 points is past what SVG
// can carry, but the template lines and axes must stay crisp and selectable —
// so the points are rasterised and everything a reader measures against is not.
import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear, scaleLog } from 'd3-scale';
import {
  densityNeutron, pickett, pickettLines, saturationHeight, cuddyBvw,
  type BoreCurves, type XPoint, type Availability,
} from './petro-xplot';

export type Template = 'denneu' | 'pickett' | 'buckles' | 'shf';

export const TEMPLATES: Array<{ id: Template; label: string; hint: string }> = [
  { id: 'denneu', label: 'Density–neutron', hint: 'Lithology and the gas crossover' },
  { id: 'pickett', label: 'Pickett', hint: 'Archie on log–log — slope is m, and above Sw=1 is hydrocarbon' },
  { id: 'buckles', label: 'Buckles', hint: 'PHIE vs Sw — constant bulk-volume-water hyperbolae' },
  { id: 'shf', label: 'Saturation height', hint: 'BVW against height above the free-water level' },
];

export interface PetroCrossplot2DProps {
  bores: BoreCurves[];
  /** free water level, m TVDSS positive down — the SHF template needs it */
  contactDepth?: number | null;
  /** Archie parameters, from the interpretation bench so the Pickett overlay and
   *  the computed Sw are the same model rather than two opinions */
  archie?: { a: number; m: number; n: number; rw: number };
  template: Template;
  onTemplate?: (t: Template) => void;
}

const PAD = { l: 48, r: 14, t: 14, b: 34 };

/** Distinct-enough hues for per-well colouring. A cloud that cannot be taken
 *  apart by well is a picture, not evidence. */
const WELL_HUES = [200, 12, 140, 45, 275, 175, 330, 95, 235, 25];

export function PetroCrossplot2D({
  bores, contactDepth, archie = { a: 1, m: 2, n: 2, rw: 0.03 }, template, onTemplate,
}: PetroCrossplot2DProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverWell, setHoverWell] = useState<string | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  // stable callback ref; see SectionView for why an inline one loops
  const attach = (el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => setSize((p) => {
      const w = el.clientWidth, h = el.clientHeight;
      return p.w === w && p.h === h ? p : { w, h };
    });
    const ro = new ResizeObserver(measure);
    ro.observe(el); roRef.current = ro; measure();
  };

  const model = useMemo(() => {
    if (template === 'denneu') {
      const r = densityNeutron(bores);
      return {
        availability: r.availability,
        points: r.points as XPoint[],
        // density INCREASES downward on a den-neu plot, which is why the y axis
        // is inverted — reading it the other way puts shale at the top
        xLabel: 'NPHI  v/v', yLabel: 'RHOB  g/cm³',
        xLog: false, yLog: false, yInvert: true,
        xDomain: [-0.05, 0.6] as [number, number],
        yDomain: [1.9, 2.9] as [number, number],
        note: `${r.points.filter((p) => p.gasEffect).length.toLocaleString('en-US')} samples flagged gas-affected`
          + ' (NPHI−PHID ≤ −0.06 — a display threshold, not a measurement)',
      };
    }
    if (template === 'pickett') {
      const r = pickett(bores);
      return {
        availability: r.availability, points: r.points,
        xLabel: 'PHIE  v/v', yLabel: 'RT  Ω·m',
        xLog: true, yLog: true, yInvert: false,
        xDomain: [0.01, 0.5] as [number, number],
        yDomain: [0.1, 1000] as [number, number],
        note: `Archie a=${archie.a} m=${archie.m} n=${archie.n} Rw=${archie.rw} — above the Sw=1 line is more resistive than wet rock`,
      };
    }
    if (template === 'buckles') {
      const r = pickett(bores);            // same PHIE availability
      const sh = saturationHeight(bores, contactDepth ?? NaN);
      return {
        availability: sh.availability.blocked ? sh.availability : r.availability,
        points: sh.points.map((p) => ({ well: p.well, x: p.bvw / p.sw, y: p.sw })) as XPoint[],
        xLabel: 'PHIE  v/v', yLabel: 'Sw  v/v',
        xLog: false, yLog: false, yInvert: false,
        xDomain: [0, 0.4] as [number, number],
        yDomain: [0, 1] as [number, number],
        note: 'hyperbolae are constant bulk volume water — a cloud lying on one is at irreducible saturation',
      };
    }
    const r = saturationHeight(bores, contactDepth ?? NaN);
    return {
      availability: r.availability,
      points: r.points.map((p) => ({ well: p.well, x: p.height, y: p.bvw })) as XPoint[],
      cuddy: r.cuddy,
      xLabel: 'height above FWL  m', yLabel: 'BVW  v/v',
      xLog: true, yLog: true, yInvert: false,
      xDomain: [1, 400] as [number, number],
      yDomain: [0.001, 0.4] as [number, number],
      note: r.cuddy
        ? `BVW = ${r.cuddy.a.toFixed(4)}·H^${r.cuddy.b.toFixed(3)} · r²=${r.cuddy.r2.toFixed(2)} · n=${r.cuddy.n}`
          + ` · fitted over ${Math.round(r.cuddy.hMin)}–${Math.round(r.cuddy.hMax)} m`
        : 'no fit — fitCuddy needs 20 surviving samples, the same guard the initialization uses',
    };
  }, [bores, template, contactDepth, archie]);

  const wells = useMemo(
    () => [...new Set(model.points.map((p) => p.well))].sort(),
    [model.points],
  );

  const iw = Math.max(10, size.w - PAD.l - PAD.r);
  const ih = Math.max(10, size.h - PAD.t - PAD.b);
  const mk = (log: boolean, dom: [number, number], range: [number, number]) => (log
    ? scaleLog().domain(dom).range(range).clamp(true)
    : scaleLinear().domain(dom).range(range).clamp(true));
  const x = mk(model.xLog, model.xDomain, [PAD.l, PAD.l + iw]);
  const y = mk(model.yLog, model.yDomain,
    model.yInvert ? [PAD.t, PAD.t + ih] : [PAD.t + ih, PAD.t]);

  // ── the cloud ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || iw < 20 || ih < 20) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);
    if (model.availability.blocked) return;

    const hue = new Map(wells.map((w, i) => [w, WELL_HUES[i % WELL_HUES.length]]));
    // one pass, low alpha: overlapping samples build density rather than the last
    // one winning, which is the whole point of looking at a cloud
    for (const p of model.points) {
      if (!(p.x > 0) && model.xLog) continue;
      if (!(p.y > 0) && model.yLog) continue;
      const dim = hoverWell != null && p.well !== hoverWell;
      g.fillStyle = `hsla(${hue.get(p.well) ?? 210},70%,52%,${dim ? 0.05 : 0.28})`;
      g.fillRect(x(p.x) - 0.75, y(p.y) - 0.75, 1.5, 1.5);
    }
  }, [model, size, x, y, wells, hoverWell, iw, ih]);

  const blocked = model.availability.blocked;

  return (
    <div className="ppx" ref={attach}>
      <div className="ppx-tabs">
        {TEMPLATES.map((t) => (
          <button key={t.id} className={template === t.id ? 'on' : ''} title={t.hint}
            onClick={() => onTemplate?.(t.id)}>{t.label}</button>
        ))}
        <em>{model.availability.wells}/{model.availability.ofWells} bores</em>
      </div>

      {blocked ? (
        <div className="ppx-blocked">
          <b>This delivery cannot support {TEMPLATES.find((t) => t.id === template)?.label}</b>
          <span>{blocked}</span>
          <span className="ppx-needs">needs {model.availability.needs.join(' + ')}</span>
        </div>
      ) : (
        <div className="ppx-plot">
          <canvas ref={cvRef} style={{ width: size.w, height: size.h, position: 'absolute', inset: 0 }} />
          <svg width={size.w} height={size.h} style={{ position: 'absolute', inset: 0 }}>
            {/* axes */}
            <rect x={PAD.l} y={PAD.t} width={iw} height={ih} fill="none" stroke="var(--line)" />
            {x.ticks(6).map((t) => (
              <g key={'x' + t}>
                <line x1={x(t)} y1={PAD.t} x2={x(t)} y2={PAD.t + ih} stroke="var(--line)" opacity={0.22} />
                <text x={x(t)} y={PAD.t + ih + 12} textAnchor="middle" fontSize={8}
                  fill="var(--ink3)" fontFamily="var(--mono)">{fmtTick(t)}</text>
              </g>
            ))}
            {y.ticks(6).map((t) => (
              <g key={'y' + t}>
                <line x1={PAD.l} y1={y(t)} x2={PAD.l + iw} y2={y(t)} stroke="var(--line)" opacity={0.22} />
                <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize={8}
                  fill="var(--ink3)" fontFamily="var(--mono)">{fmtTick(t)}</text>
              </g>
            ))}

            {/* ── template overlays: the part that carries the meaning ── */}
            {template === 'denneu' && MATRIX_LINES.map((m) => (
              <g key={m.name}>
                <line x1={x(m.x0)} y1={y(m.y0)} x2={x(m.x1)} y2={y(m.y1)}
                  stroke={m.color} strokeWidth={1.4} strokeDasharray={m.name === 'Sandstone' ? '' : '4 3'} />
                <text x={x(m.x1) + 3} y={y(m.y1)} fontSize={7} fill={m.color} fontFamily="var(--mono)">{m.name}</text>
              </g>
            ))}
            {template === 'pickett' && pickettLines(
              [model.xDomain[0], model.xDomain[1]], archie.rw, archie.a, archie.m, archie.n,
            ).map((l) => (
              <g key={l.sw}>
                <line x1={x(l.points[0][0])} y1={y(l.points[0][1])}
                  x2={x(l.points[1][0])} y2={y(l.points[1][1])}
                  stroke={l.sw === 1 ? '#2f9bff' : 'var(--ink3)'}
                  strokeWidth={l.sw === 1 ? 1.8 : 1} strokeDasharray={l.sw === 1 ? '' : '3 3'} />
                <text x={x(l.points[1][0]) - 4} y={y(l.points[1][1]) - 3} textAnchor="end"
                  fontSize={7} fill={l.sw === 1 ? '#2f9bff' : 'var(--ink3)'} fontFamily="var(--mono)">
                  Sw {l.sw}
                </text>
              </g>
            ))}
            {template === 'buckles' && [0.02, 0.04, 0.06, 0.09].map((bvw) => (
              <path key={bvw} fill="none" stroke="var(--ink3)" strokeWidth={1} strokeDasharray="3 3"
                d={buckleHyperbola(bvw, model.xDomain, x, y)} />
            ))}
            {template === 'shf' && model.cuddy && (
              <path fill="none" stroke="#2f9bff" strokeWidth={1.8}
                d={cuddyPath(model.cuddy, model.xDomain, x, y)} />
            )}
          </svg>

          <span className="ppx-ylab">{model.yLabel}</span>
          <span className="ppx-xlab">{model.xLabel}</span>
        </div>
      )}

      <div className="ppx-key">
        {wells.slice(0, 10).map((w, i) => (
          <span key={w} className={hoverWell === w ? 'on' : ''}
            onPointerEnter={() => setHoverWell(w)} onPointerLeave={() => setHoverWell(null)}>
            <i style={{ background: `hsl(${WELL_HUES[i % WELL_HUES.length]},70%,52%)` }} />{w}
          </span>
        ))}
        {wells.length > 10 && <em>+{wells.length - 10} more</em>}
        {!blocked && <em className="ppx-note">{model.note}</em>}
      </div>
    </div>
  );
}

// ── overlay geometry ─────────────────────────────────────────────────────────

/** Matrix lines at zero porosity → 40 p.u., limestone-scale neutron. Sandstone
 *  reads slightly negative at zero porosity, which is why the sand line does not
 *  start at the origin — and why a sand cloud sits LEFT of the limestone line. */
const MATRIX_LINES = [
  { name: 'Sandstone', x0: -0.035, y0: 2.65, x1: 0.33, y1: 2.0, color: '#d19a2f' },
  { name: 'Limestone', x0: 0, y0: 2.71, x1: 0.4, y1: 2.0, color: '#5aa9d6' },
  { name: 'Dolomite', x0: 0.02, y0: 2.87, x1: 0.42, y1: 2.05, color: '#8f8fd6' },
];

const fmtTick = (t: number) => (Math.abs(t) >= 1000 || (Math.abs(t) < 0.01 && t !== 0)
  ? t.toExponential(0) : String(Math.round(t * 1000) / 1000));

/** Sw = BVW / PHIE, sampled across the porosity axis. */
function buckleHyperbola(
  bvw: number, dom: [number, number], x: (v: number) => number, y: (v: number) => number,
): string {
  const pts: string[] = [];
  const lo = Math.max(bvw, dom[0] + 1e-4);
  for (let i = 0; i <= 40; i++) {
    const phi = lo + ((dom[1] - lo) * i) / 40;
    const sw = bvw / phi;
    if (sw > 1) continue;
    pts.push(`${pts.length ? 'L' : 'M'}${x(phi).toFixed(1)},${y(sw).toFixed(1)}`);
  }
  return pts.join('');
}

/** The fitted BVW = a·H^b, drawn only across the heights it was FITTED over —
 *  extending a power law past its calibration range is the commonest way a
 *  saturation-height function ends up asserting saturations nobody measured. */
function cuddyPath(
  fit: { a: number; b: number; hMin: number; hMax: number },
  dom: [number, number], x: (v: number) => number, y: (v: number) => number,
): string {
  const lo = Math.max(fit.hMin, dom[0]);
  const hi = Math.min(fit.hMax, dom[1]);
  if (!(hi > lo)) return '';
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const h = lo * (hi / lo) ** (i / 60);
    pts.push(`${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(cuddyBvw(fit, h)).toFixed(1)}`);
  }
  return pts.join('');
}

export type { Availability };
