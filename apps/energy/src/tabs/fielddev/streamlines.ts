// streamlines — a saved dynamic run, read as drainage.
//
// ── THE POINT OF A STREAMLINE MODEL ─────────────────────────────────────────
//
// A cell field says WHERE the water is. It cannot say WHOSE water it is. Streamlines
// answer the question a waterflood is actually managed on: which injector is
// supporting which producer, how much of each injector's water arrives somewhere
// useful, and how long it takes to get there.
//
// ── WHY IT MUST READ THE SAVED RUN, NOT RE-SOLVE ────────────────────────────
//
// Streamlines are traced through the SAME flux field the flow solve produced. A
// surface that re-ran the case would be tracing a different run — a different
// realisation of the same recipe — and its allocations would quietly disagree with the
// saturation animation next door. So this takes a `StoredRun` and nothing else.
//
// Pure, so the derivation is testable without a browser.
import type { StoredRun } from './run-store';
import type { StreamGeom, WellCell, StreamResult } from '../../engine/sim/streamline';

/** the geometry the tracer needs, from the run's own coarse flow grid */
export function geomOf(run: StoredRun): StreamGeom {
  return {
    nx: run.grid.nx, ny: run.grid.ny,
    dx: run.grid.dx, dy: run.grid.dy, dz: run.grid.dz,
    phi: run.grid.phi,
    x0: run.grid.x0, y0: run.grid.y0,
  };
}

/**
 * The wells, in the tracer's own vocabulary.
 *
 * The tracer classifies by `kind`, and only injectors seed streamlines — so a
 * misclassified well produces either no lines at all or lines from the wrong place,
 * and both look like a modelling result rather than a mapping error.
 */
export function wellCellsOf(run: StoredRun): WellCell[] {
  return run.placed.map((p) => ({
    i: p.i, j: p.j, name: p.name,
    kind: p.kind === 'injector' ? 'inj' : 'prod',
  }));
}

export interface AllocationRow {
  injector: string;
  producer: string;
  /** fraction of that injector's streamlines arriving here */
  fraction: number;
}

export interface Drainage {
  rows: AllocationRow[];
  /** per injector: how much of its water reaches ANY producer */
  captured: Array<{ injector: string; captured: number; lost: number }>;
  /** producers that no injector reaches */
  unsupported: string[];
  /** injectors whose water reaches nobody */
  orphaned: string[];
}

/**
 * Turn the tracer's flat allocation map into the table an engineer reads.
 *
 * ── WHAT THE LOST FRACTION MEANS ────────────────────────────────────────────
 *
 * A streamline that leaves an injector and never reaches a producer has gone into the
 * aquifer, out of the model, or into a stagnant region. That fraction is the single
 * most useful number here — it is injection that is not supporting anything — and it
 * is REPORTED rather than normalised away. Renormalising the allocations to sum to one
 * would hide exactly the water that is being wasted.
 */
export function drainage(res: StreamResult, wells: WellCell[]): Drainage {
  const rows: AllocationRow[] = [];
  for (const [key, fraction] of Object.entries(res.allocation)) {
    const [injector, producer] = key.split('→');
    if (!injector || !producer) continue;
    rows.push({ injector, producer, fraction });
  }
  rows.sort((a, b) => b.fraction - a.fraction || a.injector.localeCompare(b.injector));

  const injectors = wells.filter((w) => w.kind === 'inj').map((w) => w.name);
  const producers = wells.filter((w) => w.kind === 'prod').map((w) => w.name);

  const captured = injectors.map((injector) => {
    const c = rows.filter((r) => r.injector === injector).reduce((a, r) => a + r.fraction, 0);
    // clamped because a tracer rounding a fraction slightly over 1 should not report
    // negative loss, which reads as water appearing from nowhere
    const cc = Math.max(0, Math.min(1, c));
    return { injector, captured: cc, lost: 1 - cc };
  });

  const reached = new Set(rows.filter((r) => r.fraction > 0).map((r) => r.producer));
  return {
    rows,
    captured,
    unsupported: producers.filter((p) => !reached.has(p)),
    orphaned: captured.filter((c) => c.captured <= 1e-9).map((c) => c.injector),
  };
}

/**
 * Time-of-flight percentiles over the traced lines.
 *
 * The MEDIAN is the honest headline, not the mean: streamline TOF is strongly
 * right-skewed — a handful of lines that wander into a stagnant corner carry enormous
 * travel times — and a mean over them reports a sweep far slower than the one doing
 * the work.
 */
export function tofStats(res: StreamResult): {
  p10: number; p50: number; p90: number; max: number; n: number; unswept: number;
} {
  const t = res.lines
    .filter((l) => l.toWell)                       // only lines that ARRIVE have a travel time
    .map((l) => l.totalTof)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const unswept = res.lines.filter((l) => !l.toWell).length;
  if (!t.length) return { p10: NaN, p50: NaN, p90: NaN, max: NaN, n: 0, unswept };
  const at = (f: number) => t[Math.min(t.length - 1, Math.max(0, Math.floor(f * (t.length - 1))))];
  return { p10: at(0.1), p50: at(0.5), p90: at(0.9), max: t[t.length - 1], n: t.length, unswept };
}

/**
 * The lines, clipped to what a screen can carry.
 *
 * 24 streamlines per injector over nine injectors is 216 polylines of up to a few
 * hundred points; drawing all of them turns the map into a solid block and the
 * pattern — which is the whole point — disappears. Thinning is a DISPLAY decision, so
 * it returns the count it dropped and the caller says so.
 */
export function thin(res: StreamResult, max: number): { lines: StreamResult['lines']; dropped: number } {
  if (res.lines.length <= max) return { lines: res.lines, dropped: 0 };
  const stride = res.lines.length / max;
  const out: StreamResult['lines'] = [];
  for (let i = 0; i < max; i++) out.push(res.lines[Math.floor(i * stride)]);
  return { lines: out, dropped: res.lines.length - out.length };
}
