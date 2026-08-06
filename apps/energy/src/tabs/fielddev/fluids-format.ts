// fluids-format.ts — the PURE half of the Fluids & Rock chart kit.
//
// Scales, tick/readout formatting, path builders and the card row's unit splitter.
// Split out of fluids-chart-kit.tsx for the same reason workspace-model.ts was split
// from workspace.ts: node can strip types from a .ts file but cannot parse JSX, so
// anything that needs a truth-lock has to live outside the .tsx. Everything here is a
// pure function over plain data — scripts/test-fluids-ui.mjs loads it directly.
import { scaleLinear, scaleLog, type ScaleContinuousNumeric } from 'd3-scale';
import { format as d3format } from 'd3-format';
import { line as d3line, area as d3area, curveMonotoneX, curveLinear } from 'd3-shape';

export type Scale = ScaleContinuousNumeric<number, number>;

export interface Margin { top: number; right: number; bottom: number; left: number }
export const M: Margin = { top: 14, right: 18, bottom: 42, left: 62 };
/** Wider right margin when a chart carries a second y axis. */
export const M2: Margin = { ...M, right: 62 };

// ── formatting ───────────────────────────────────────────────────────────────

const si = d3format('.3~s');
const fx = (d: number) => d3format(`.${d}~f`);

/** A tick label that stays readable across four decades without ever showing
 *  "0.0000001" or a 9-digit integer. */
export function tickText(v: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return d3format('.1~e')(v);
  if (a >= 1000) return si(v);
  if (a >= 100) return fx(0)(v);
  if (a >= 10) return fx(1)(v);
  if (a >= 1) return fx(2)(v);
  return fx(3)(v);
}

/** A readout value — more precision than a tick, still bounded. */
export function readText(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return d3format('.3~e')(v);
  if (a >= 100) return fx(1)(v);
  if (a >= 1) return fx(3)(v);
  return fx(4)(v);
}

// ── path builders ────────────────────────────────────────────────────────────

export interface Pt { x: number; y: number }

export const linePath = (pts: Pt[], x: Scale, y: Scale, smooth = false) =>
  d3line<Pt>().x((p) => x(p.x)).y((p) => y(p.y)).curve(smooth ? curveMonotoneX : curveLinear)(pts) ?? '';

export const areaPath = (pts: Pt[], x: Scale, y: Scale, y0: number, smooth = false) =>
  d3area<Pt>().x((p) => x(p.x)).y0(y(y0)).y1((p) => y(p.y)).curve(smooth ? curveMonotoneX : curveLinear)(pts) ?? '';


export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
  /** the series' own unit, shown in the hover readout */
  unit?: string;
  dash?: string;
  width?: number;
  /** which axis this series is measured against */
  axis?: 'y' | 'y2';
}

export interface AxisSpec {
  label: string;
  /** shown in parentheses after the label, and beside every hover value */
  unit?: string;
  scale: Scale;
  log?: boolean;
  ticks?: number;
  /** override the tick values entirely */
  tickValues?: number[];
  format?: (v: number) => string;
  color?: string;
}

/**
 * Value of every series at a hovered x, for the readout. Charts supply this rather
 * than the kit guessing, because "the value at x" means different things for a
 * sampled table, a closed-form curve and a scatter of measurements.
 */
export type Probe = (x: number) => Array<{ key: string; value: number | null }>;


/**
 * Build the x scale for a chart of this width. Range spans the plot area in absolute
 * pixels, so `x(value)` is directly usable as an SVG coordinate.
 */
export const xScale = (domain: [number, number], w: number, m: Margin = M) =>
  scaleLinear().domain(domain).range([m.left, Math.max(m.left + 10, w - m.right)]);

/** As `xScale`, downward: the first domain value sits at the TOP of the plot. */
export const yScale = (domain: [number, number], h: number, m: Margin = M) =>
  scaleLinear().domain(domain).range([Math.max(m.top + 10, h - m.bottom), m.top]);

/** Downward-increasing y, for depth axes where the domain grows toward the bottom. */
export const yScaleDown = (domain: [number, number], h: number, m: Margin = M) =>
  scaleLinear().domain(domain).range([m.top, Math.max(m.top + 10, h - m.bottom)]);

export const yScaleLog = (domain: [number, number], h: number, m: Margin = M) =>
  scaleLog().domain(domain).range([Math.max(m.top + 10, h - m.bottom), m.top]);


/** Nearest-sample probe for a sampled table — the common case. */
export function nearestProbe<T>(rows: T[], xOf: (r: T) => number, series: Array<{ key: string; yOf: (r: T) => number | null }>): Probe {
  const sorted = [...rows].sort((a, b) => xOf(a) - xOf(b));
  return (x: number) => {
    if (!sorted.length) return [];
    let lo = 0, hi = sorted.length - 1, best = 0, bd = Infinity;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const d = Math.abs(xOf(sorted[mid]) - x);
      if (d < bd) { bd = d; best = mid; }
      if (xOf(sorted[mid]) < x) lo = mid + 1; else hi = mid - 1;
    }
    const r = sorted[best];
    return series.map((s) => ({ key: s.key, value: s.yOf(r) }));
  };
}


// ── the card row's unit column ───────────────────────────────────────────────

/**
 * Split "337 bara" into a value and a unit so units line up in their own column.
 *
 * Deliberately strict: the value must be a single number and the unit must contain NO
 * digits. "0.15 / 0.25" and "3060 m · 337 bara" are composites, not value-plus-unit,
 * and are left whole rather than being torn at the first space and putting half a
 * value under the unit heading.
 */
export function splitUnit(text: string): { value: string; unit: string | null } {
  const m = /^(-?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?)\s+([^\d]+)$/i.exec(text.trim());
  return m ? { value: m[1], unit: m[2].trim() } : { value: text.trim(), unit: null };
}

export { scaleLinear, scaleLog };
