// time-axis.ts — pure month-index / date / pixel math for the Drilling Sequence
// Gantt. Mirrors the reference tool's mi2d/d2mi/db/ppd helpers but epoch-anchored
// to the Volve planning horizon rather than the NOC 2017 epoch. No React, no DOM.

/** Month-index epoch. Month 0 = Jan 2007 — covers Volve's real drilling campaign
 *  (2007–2016, reconstructed from production) plus the forward planning horizon. */
export const EPOCH_YEAR = 2007;
/** Total months in the slider space: Jan 2007 → Jan 2033 (26 years). */
export const TOTAL_MONTHS = 26 * 12; // 312

export const MONTH_LETTERS = 'JFMAMJJASOND';
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Month index → first-of-month Date. */
export function mi2d(m: number): Date {
  return new Date(EPOCH_YEAR, m, 1);
}

/** Date → month index (floored to its month). */
export function d2mi(d: Date): number {
  return (d.getFullYear() - EPOCH_YEAR) * 12 + d.getMonth();
}

/** Parse an ISO-ish "YYYY-MM-DD" (or "YYYY-MM") date string to a local Date. */
export function pd(s: string): Date {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

/** Whole days between two dates (b - a). */
export function db(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

/** Add whole days to a date, returning a new Date. */
export function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + Math.round(days));
  return n;
}

/** Add whole months to a date, returning a new Date. */
export function addMonths(d: Date, months: number): Date {
  const n = new Date(d);
  n.setMonth(n.getMonth() + months);
  return n;
}

/** Format a date as "Mon YYYY" (e.g. "Jun 2026"). */
export function fmtMonthYear(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format a date as "DD Mon YYYY". */
export function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** The visible window as month indices, clamped and min-2-months apart. */
export interface Window {
  mL: number;
  mR: number;
}

export function clampWindow(mL: number, mR: number): Window {
  let l = Math.max(0, Math.min(TOTAL_MONTHS - 1, Math.round(mL)));
  let r = Math.max(0, Math.min(TOTAL_MONTHS - 1, Math.round(mR)));
  if (l > r - 2) l = r - 2;            // enforce a 2-month minimum span
  if (l < 0) { l = 0; r = Math.max(2, r); }
  return { mL: l, mR: r };
}

/** Pixels-per-day for a window across an available pixel width (floor 0.3 like the reference). */
export function ppd(win: Window, availW: number): number {
  const vs = mi2d(win.mL);
  const ve = mi2d(win.mR);
  const totalDays = Math.max(1, db(vs, ve));
  return Math.max(0.3, availW / totalDays);
}

/** x-position (px) of a date within the window's pixel space. */
export function xOfDate(win: Window, availW: number, date: Date): number {
  const vs = mi2d(win.mL);
  return db(vs, date) * ppd(win, availW);
}

/** "Today" for the app's world — single source of truth (reference had 3 inconsistent values). */
export function today(): Date {
  return new Date(2026, 6, 22); // 2026-07-22, the app's canonical present
}
