// fluids-depth.ts — putting a pressure gauge on the initialization's depth axis.
//
// The PURE half of fluids-live.ts, split out for the same reason workspace-model.ts
// was split from workspace.ts: everything here is a function over plain data, so
// scripts/test-fluids.mjs can truth-lock it directly instead of trusting it.
//
// THE PROBLEM THIS SOLVES. A formation-pressure LAS records the gauge depth in
// MEASURED depth below the rig floor. The equilibration works in TVDSS. Between them
// sit two conversions that are easy to skip and impossible to spot afterwards:
//
//   MD → TVD    the well's own directional survey. On Volve's F-15 A the gauge sits
//               780 m of hole below its last survey station, so there IS no TVD for
//               it — and a point plotted at its MD would sit ~200 m too deep.
//   TVD → TVDSS the rig-floor elevation. 54.9 m on the Volve platform wells. Skip it
//               and every measured point sits 55 bar-metres off the modelled
//               gradient, which reads as a bad model rather than a bad datum.
//
// Both return null rather than a guess when the input cannot support them.

/** A directional survey station, as the delivery's trajectory records carry it. */
export interface SurveyStation { md?: number; tvd?: number }

/** One pressure test's measured summary, before it is placed on a depth axis. */
export interface RawStation {
  md: number;
  /** the stabilised buildup pressure, bara */
  pressure: number;
  temperature: number | null;
  /**
   * What the gauge actually resolved.
   *
   *   buildup   a distinct stable level BELOW the highest stable level in the record
   *             — the tool sealed against the formation and the pressure built back
   *             to a plateau. This is a formation pressure.
   *   column    only one stable level was reached. In overbalanced drilling that is
   *             the mud column, not the formation, and it must not be fitted as one.
   */
  quality: 'buildup' | 'column';
  /** the highest stable level in the record — the mud column, for reference */
  columnPressure: number;
  /** how many samples the chosen plateau held for */
  samples: number;
}

/** A stable stretch of the pressure record. */
export interface Plateau { pressure: number; samples: number }

interface PressCurveLike { values?: (number | null)[] }
interface PressRunLike { curves?: Record<string, PressCurveLike | undefined> }
export interface PressPayloadLike { well?: string; dataNature?: string; runs?: PressRunLike[] }

const finite = (c?: PressCurveLike): number[] =>
  (c?.values ?? []).filter((v): v is number => v != null && Number.isFinite(v));

/**
 * Interpolate TVD at a measured depth from a survey.
 *
 * Linear between the bracketing stations. Returns null OUTSIDE the survey rather than
 * extrapolating: a gauge set below the deepest surveyed station is a gap in the
 * delivery, and inventing a depth for it hides exactly what the initialization
 * exists to catch.
 */
export function tvdAtMd(stations: SurveyStation[], md: number): number | null {
  if (!Number.isFinite(md)) return null;
  const pts = (stations ?? [])
    .filter((s) => Number.isFinite(s?.md) && Number.isFinite(s?.tvd))
    .map((s) => ({ md: s.md as number, tvd: s.tvd as number }))
    .sort((a, b) => a.md - b.md);
  if (pts.length < 2) return null;
  if (md < pts[0].md || md > pts[pts.length - 1].md) return null;
  for (let i = 1; i < pts.length; i++) {
    const lo = pts[i - 1], hi = pts[i];
    if (md <= hi.md) {
      const span = hi.md - lo.md;
      return span <= 0 ? lo.tvd : lo.tvd + (hi.tvd - lo.tvd) * ((md - lo.md) / span);
    }
  }
  return null;
}

/**
 * Kelly-bushing elevation, m, from the master's own value — a number, or the string
 * form the delivery publishes ("54.90m"). Null when the master states none, which
 * makes every gauge on that bore unplaceable rather than silently sea-level.
 */
export function kbElevation(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const m = String(raw ?? '').match(/-?\d+(\.\d+)?/);
  const v = m ? Number(m[0]) : NaN;
  return Number.isFinite(v) ? v : null;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * The stable stretches of a pressure record.
 *
 * A stretch is stable while its full range stays inside `tol`. Short stretches are
 * discarded: a gauge passing through a pressure on its way somewhere else is not a
 * measurement of it. Returned sorted by pressure, ascending.
 */
export function stablePlateaus(values: number[], tol = 0.5, minSamples = 200): Plateau[] {
  const out: Plateau[] = [];
  const n = values.length;
  let i = 0;
  while (i < n) {
    let j = i + 1, lo = values[i], hi = values[i];
    while (j < n) {
      const l = Math.min(lo, values[j]), h = Math.max(hi, values[j]);
      if (h - l > tol) break;
      lo = l; hi = h; j++;
    }
    if (j - i >= minSamples) out.push({ pressure: median(values.slice(i, j)), samples: j - i });
    i = j > i + 1 ? j : i + 1;
  }
  return out.sort((a, b) => a.pressure - b.pressure);
}

/**
 * The formation pressure a single pretest resolved.
 *
 * WHY NOT THE LAST SAMPLE. An MWD/wireline pretest record runs: mud column → the
 * tool sets and draws down → the pressure builds back to a plateau → the tool
 * retracts and the gauge returns to the mud column, or to atmospheric. The LAST
 * sample is therefore usually the mud column, and on Volve's F-15 C taking it would
 * report 412 bar where the formation is at 313. Every station in this delivery would
 * have been ~100 bar too high, and the "measured" gradient would have been the mud
 * weight.
 *
 * So the formation pressure is the LOWEST stable plateau that is still physically a
 * formation — above a floor of half a seawater hydrostatic column, which rejects the
 * retracted-tool readings near atmospheric. If no plateau below the top one survives,
 * the test never produced a formation reading and says so (`column`) rather than
 * contributing a mud-weight point to a fluid gradient.
 *
 * `tvdssHint` only sets the physical floor. It never changes the pressure returned.
 */
export function formationPressure(values: number[], tvdssHint: number | null):
  { pressure: number; quality: RawStation['quality']; columnPressure: number; samples: number } | null {
  const plateaus = stablePlateaus(values);
  if (!plateaus.length) return null;
  const columnPressure = plateaus[plateaus.length - 1].pressure;
  // half a seawater hydrostatic column at this depth — below it, the gauge is not
  // reading a formation at all (a retracted tool sits near atmospheric)
  const floor = tvdssHint != null && tvdssHint > 0 ? 0.5 * 0.098 * tvdssHint : 0;
  const real = plateaus.filter((p) => p.pressure >= floor);
  if (!real.length) return null;
  const pick = real[0];
  // "distinctly below the column" — 5 bar, comfortably outside gauge noise and the
  // plateau tolerance, and far inside the ~100 bar overbalance a real pretest shows
  const quality = columnPressure - pick.pressure > 5 ? 'buildup' : 'column';
  return { pressure: pick.pressure, quality, columnPressure, samples: pick.samples };
}

/**
 * One station per pressure test — where the gauge sat, and what formation pressure
 * it resolved there.
 *
 * `tvdssHint` is the station's approximate depth, used only for the physical floor in
 * `formationPressure`; pass null and the floor is simply not applied. A run with no
 * pressure curve, no depth curve, or no stable plateau yields no station.
 */
export function stationsOf(press: PressPayloadLike, tvdssHint?: (md: number) => number | null): RawStation[] {
  const out: RawStation[] = [];
  for (const run of press?.runs ?? []) {
    const p = finite(run?.curves?.PQUARTZ);
    const d = finite(run?.curves?.DEPTH);
    const t = finite(run?.curves?.TQUARTZ);
    if (!p.length || !d.length) continue;
    const md = d[d.length - 1];
    const resolved = formationPressure(p, tvdssHint ? tvdssHint(md) : null);
    if (!resolved) continue;
    out.push({
      md,
      pressure: resolved.pressure,
      temperature: t.length ? t[t.length - 1] : null,
      quality: resolved.quality,
      columnPressure: resolved.columnPressure,
      samples: resolved.samples,
    });
  }
  return out;
}

/** TVDSS, positive down, from a survey TVD below the rig floor. */
export const tvdssOf = (tvdBelowKb: number, kb: number) => tvdBelowKb - kb;
