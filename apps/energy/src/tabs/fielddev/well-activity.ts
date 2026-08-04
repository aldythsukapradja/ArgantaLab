// well-activity.ts — how many wells were actually FLOWING each month.
//
// The Reservoir Management VRR chart answers "am I replacing voidage?" — a
// surveillance question about the reservoir. Field Development asks a different
// one of the same bars:
//
//     "Did production fall because the reservoir declined, or because I lost wells?"
//
// Rate alone cannot separate those. Overlaying the ACTIVE WELL COUNT can: rate
// falling while the count holds is decline; both falling together is well
// availability. So this replaces the VRR line on the FD copy of that chart.
//
// Pure — no fetch, no DOM. Node-testable against the real per-well series.
import type { ProdMonth } from '../../wb/types';

export interface WellSeries { well: string; monthly: ProdMonth[] }

export interface ActivityPoint {
  ym: string;
  /** wells with oil > 0 that month */
  producers: number;
  /** wells with water injection > 0 that month */
  injectors: number;
}

export interface ActivitySeries {
  points: ActivityPoint[];
  maxWells: number;
  /** peak simultaneous producers, and when — the development high-water mark */
  peakProducers: { ym: string; n: number } | null;
  peakInjectors: { ym: string; n: number } | null;
}

/**
 * Count flowing wells per month across a field's per-well production series.
 *
 * A well counts as ACTIVE in a month only if it moved fluid that month — not if
 * it merely exists, and not if it produced at some other time. A shut-in month
 * inside a producing well's life is genuinely a zero, and the whole point of the
 * overlay is that those zeros show up.
 *
 * `months` fixes the axis: the field-level series defines which months exist, so
 * a month where every well is down still appears (as 0) instead of vanishing
 * from the chart and silently closing the gap.
 */
export function buildActivity(months: string[], wells: WellSeries[]): ActivitySeries {
  const idx = new Map<string, number>();
  months.forEach((ym, i) => idx.set(ym, i));

  const producers = new Array<number>(months.length).fill(0);
  const injectors = new Array<number>(months.length).fill(0);

  for (const w of wells) {
    for (const m of w.monthly ?? []) {
      const i = idx.get(m.ym);
      if (i === undefined) continue;             // outside the field's own window
      if ((Number(m.oil) || 0) > 0) producers[i]++;
      if ((Number(m.wi) || 0) > 0) injectors[i]++;
    }
  }

  const points: ActivityPoint[] = months.map((ym, i) => ({
    ym, producers: producers[i], injectors: injectors[i],
  }));

  let peakProducers: ActivitySeries['peakProducers'] = null;
  let peakInjectors: ActivitySeries['peakInjectors'] = null;
  for (const p of points) {
    if (!peakProducers || p.producers > peakProducers.n) peakProducers = { ym: p.ym, n: p.producers };
    if (!peakInjectors || p.injectors > peakInjectors.n) peakInjectors = { ym: p.ym, n: p.injectors };
  }
  // a field that never flowed has no peak worth reporting
  if (peakProducers && peakProducers.n === 0) peakProducers = null;
  if (peakInjectors && peakInjectors.n === 0) peakInjectors = null;

  return {
    points,
    maxWells: Math.max(0, ...producers, ...injectors),
    peakProducers,
    peakInjectors,
  };
}
