// gantt-geometry.ts — pure geometry + bar styling for the SVG Gantt. Mirrors the
// reference tool's gs()/dk()/tc()/bc() but keyed to Volve reservoirs and the COSMO
// palette. No React, no DOM — everything here is unit-testable.

import type { ScheduleActivity, Reservoir } from './schedule-model';
import { RESERVOIR_COLOR, BASIS_COLOR } from './schedule-model';
import { type Window, ppd, xOfDate, mi2d } from './time-axis';
import { pd } from './time-axis';

export const HEADER_H = 34;   // axis band at top of each lane
export const CAMPAIGN_H = 16; // campaign strip below the bars

/** Darken a #rrggbb hex by `amt` (0–255). */
export function dk(hex: string, amt = 34): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 255) - amt);
  const b = Math.max(0, (n & 255) - amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Relative luminance → readable text color on a fill. */
export function tc(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0f172a' : '#ffffff';
}

export interface BarStyle {
  fill: string;
  stroke: string;
  dash?: string;
  hatch?: Reservoir; // when set, fill with the injector hatch pattern for this reservoir
  textColor: string;
}

/** Resolve a bar's fill/stroke/dash/hatch, faithful to the reference's gs(). */
export function barStyle(a: ScheduleActivity): BarStyle {
  // Rig operations — grey; suspension = white dashed.
  if (a.kind === 'Rig') {
    if (/suspen/i.test(a.well)) return { fill: '#ffffff', stroke: '#94a3b8', dash: '5,3', textColor: '#475569' };
    return { fill: '#cbd5e1', stroke: '#94a3b8', textColor: '#334155' };
  }
  // Appraisal — amber.
  if (a.kind === 'App') return { fill: '#f59e0b', stroke: '#b45309', textColor: '#0f172a' };

  const resColor = a.reservoir ? RESERVOIR_COLOR[a.reservoir] : '#64748b';

  // Workover — 50% alpha reservoir + dashed.
  if (a.kind === 'WO') return { fill: resColor + '80', stroke: dk(resColor), dash: '4,2', textColor: dk(resColor) };

  // Development — reservoir color; injectors overlaid with a hatch pattern.
  if (a.wellType === 'WI') return { fill: resColor, stroke: dk(resColor), hatch: a.reservoir ?? 'Other', textColor: tc(resColor) };
  return { fill: resColor, stroke: dk(resColor), textColor: tc(resColor) };
}

/** Basis maturation dot color (SOR/BOD/APPROVED/ACTUAL). */
export function basisColor(a: ScheduleActivity): string {
  return BASIS_COLOR[a.basis] ?? '#94a3b8';
}

export interface LaneLayout {
  rowH: number;   // total height per rig lane
  barT: number;   // y of bar top within a lane
  barH: number;   // bar height
  campT: number;  // y of campaign strip within a lane
}

/** Split a lane's vertical budget into header / bar / campaign bands. */
export function laneLayout(totalH: number, laneCount: number): LaneLayout {
  const rowH = Math.floor(totalH / Math.max(1, laneCount));
  const barT = HEADER_H + 2;
  const barH = Math.max(14, rowH - HEADER_H - CAMPAIGN_H - 14);
  const campT = barT + barH + 6;
  return { rowH, barT, barH, campT };
}

export interface PositionedBar {
  a: ScheduleActivity;
  x: number; w: number;
  style: BarStyle;
}

/** Position a rig's activities inside the window; drop anything narrower than 1px or off-window. */
export function positionBars(acts: ScheduleActivity[], win: Window, availW: number): PositionedBar[] {
  const vs = mi2d(win.mL).getTime();
  const ve = mi2d(win.mR).getTime();
  const out: PositionedBar[] = [];
  for (const a of acts) {
    const s = pd(a.start).getTime(), e = pd(a.end).getTime();
    if (e < vs || s > ve) continue;
    const x = xOfDate(win, availW, pd(a.start));
    const w = Math.max(1, (Math.min(e, ve) - Math.max(s, vs)) / 86_400_000 * ppd(win, availW));
    if (w < 1) continue;
    out.push({ a, x: Math.max(0, x), w, style: barStyle(a) });
  }
  return out;
}

export interface AxisTick { x: number; label: string; major: boolean }

/** Year + month gridline ticks across the window. */
export function axisTicks(win: Window, availW: number): { years: AxisTick[]; months: AxisTick[] } {
  const years: AxisTick[] = [];
  const months: AxisTick[] = [];
  const startY = mi2d(win.mL).getFullYear();
  const endY = mi2d(win.mR).getFullYear();
  const spanMonths = win.mR - win.mL;
  for (let y = startY; y <= endY + 1; y++) {
    years.push({ x: xOfDate(win, availW, new Date(y, 0, 1)), label: String(y), major: true });
  }
  // Month ticks only when the window is short enough to be legible.
  if (spanMonths <= 72) {
    for (let m = win.mL; m <= win.mR; m++) {
      const d = mi2d(m);
      months.push({ x: xOfDate(win, availW, d), label: 'JFMAMJJASOND'[d.getMonth()], major: d.getMonth() === 0 });
    }
  }
  return { years, months };
}

/** Per-month histogram buckets: well-activity counts across the whole slider space. */
export function histogram(acts: ScheduleActivity[], totalMonths: number): number[] {
  const buckets = new Array(totalMonths).fill(0);
  for (const a of acts) {
    if (a.kind === 'Rig') continue;
    const s = pd(a.start), e = pd(a.end);
    const mS = (s.getFullYear() - 2007) * 12 + s.getMonth();
    const mE = (e.getFullYear() - 2007) * 12 + e.getMonth();
    for (let m = Math.max(0, mS); m <= Math.min(totalMonths - 1, mE); m++) buckets[m]++;
  }
  return buckets;
}
