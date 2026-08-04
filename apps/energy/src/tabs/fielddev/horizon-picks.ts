// fielddev/horizon-picks.ts — correlate FORMATION TOPS with a MAPPED SURFACE.
//
// WHY THIS EXISTS. A depth grid says where the interpreter thinks the horizon is.
// A formation pick says where a bit actually went through it. Drawing the pick on
// the grid is the single most useful thing the dossier map can do, because it is
// the only place the two independent readings of the same horizon meet: the
// seismic interpretation and the hole.
//
// So the wellbore is NOT drawn as a whole path here. When a horizon is selected the
// map shows one IMPACT POINT per well — the position where that well's pick for
// THIS surface sits — and nothing else. That is the correlation, not a decoration.
//
// Three independent files have to agree for a point to exist:
//   • picks.json  — the pick: well, surface name, measured depth
//   • traj-*.json — the survey: what MD means in metres north and east
//   • index.json  — the well master: where the survey's origin (the slot) is
// If any one is missing the point is NOT drawn. A pick with no survey has a depth
// but no position, and putting it at the wellhead would place a 4 km step-out on
// top of the platform.
import { stripEdgeSuffix } from '../../dataqc/surface-context.ts';
import { wellKey, pathRole, type PathRole, type PathStation, type PathWellhead } from './well-paths.ts';

export interface FormationPick {
  well: string | null;
  surface: string;
  md: number | null;
  tvdss?: number | null;
}

export interface ImpactPoint {
  well: string;
  role: PathRole;
  /** projected position of the pick, in the bundle's CRS */
  easting: number;
  northing: number;
  /** the pick's own depths, carried through unchanged */
  md: number;
  tvdss: number | null;
  /** true when the pick's MD sits beyond the last survey station and the position
   *  is the survey's own end point rather than an interpolation */
  extrapolated: boolean;
}

/** Unit-identity key, the same normalisation surface-context uses so that the
 *  mapped-surface style ("Hugin Fm Top") and the raw pick style ("Hugin Fm.
 *  VOLVE Top", "SHETLAND GP. Top") resolve to one unit. */
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * INTERPRETED name equivalences, listed explicitly because they are geological
 * judgements rather than string facts, and a reader deserves to see which ones
 * are in play.
 *
 * BCU — the Base Cretaceous Unconformity is a surface, not a formation, so it is
 * never picked under that name. In this bundle the youngest preserved Jurassic
 * unit beneath it is the Draupne, whose top the interpreters DID pick, and the
 * two are coincident where Draupne is present. That is standard North Sea
 * practice; it is still an equivalence, so callers are told when one was used.
 */
export const PICK_ALIASES: ReadonlyArray<{ surface: string; pick: string; why: string }> = [
  { surface: 'bcu', pick: 'draupnefmtop', why: 'BCU is not picked by name; Draupne Fm Top is the coincident Jurassic top beneath it' },
];

export interface PickMatch {
  picks: FormationPick[];
  /** set when the match came through PICK_ALIASES rather than the name itself */
  interpreted: { pickName: string; why: string } | null;
}

/**
 * Find the picks that belong to a mapped surface.
 *
 * Exact unit key first, then the longest pick-unit key that this surface's key
 * PREFIXES — which folds a field/member qualifier back onto its formation
 * ("huginfm" ⊂ "huginfmvolve") without ever reaching a different formation. The
 * Top/Base edge must agree: "Hugin Fm Top" must not collect Hugin Fm Base picks,
 * which are a different horizon entirely.
 */
export function matchPicks(surfaceName: string, picks: FormationPick[]): PickMatch {
  const want = stripEdgeSuffix(surfaceName);
  const wantKey = key(want.base);

  const edgeOf = (name: string) => stripEdgeSuffix(name);
  const sameEdge = (p: FormationPick) => {
    const e = edgeOf(p.surface);
    return e.isTop === want.isTop && e.isBase === want.isBase;
  };

  const direct = picks.filter((p) => {
    if (!sameEdge(p)) return false;
    const pk = key(edgeOf(p.surface).base);
    return pk === wantKey || (wantKey.length > 2 && pk.startsWith(wantKey));
  });
  if (direct.length) return { picks: direct, interpreted: null };

  const alias = PICK_ALIASES.find((a) => a.surface === wantKey);
  if (alias) {
    const hit = picks.filter((p) => key(p.surface) === alias.pick);
    if (hit.length) return { picks: hit, interpreted: { pickName: hit[0].surface, why: alias.why } };
  }
  return { picks: [], interpreted: null };
}

/**
 * Position along a survey at a measured depth.
 *
 * Linear between the bracketing stations. Beyond the last station the survey's
 * end point is returned and flagged `extrapolated` — continuing the last tangent
 * would invent hole that was never surveyed, and silently dropping the pick would
 * hide a real correlation. Before the first station is impossible in practice
 * (surveys start at MD 0) but is handled the same way.
 */
export function positionAtMd(stations: PathStation[], md: number): { ew: number; ns: number; extrapolated: boolean } | null {
  const st = (stations ?? []).filter((s) => Number.isFinite(s.md) && Number.isFinite(s.dispEw) && Number.isFinite(s.dispNs));
  if (!st.length) return null;
  if (md <= (st[0].md as number)) {
    return { ew: st[0].dispEw as number, ns: st[0].dispNs as number, extrapolated: md < (st[0].md as number) };
  }
  const last = st[st.length - 1];
  if (md >= (last.md as number)) {
    return { ew: last.dispEw as number, ns: last.dispNs as number, extrapolated: md > (last.md as number) };
  }
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1], b = st[i];
    if (md > (b.md as number)) continue;
    const span = (b.md as number) - (a.md as number);
    const f = span > 0 ? (md - (a.md as number)) / span : 0;
    return {
      ew: (a.dispEw as number) + ((b.dispEw as number) - (a.dispEw as number)) * f,
      ns: (a.dispNs as number) + ((b.dispNs as number) - (a.dispNs as number)) * f,
      extrapolated: false,
    };
  }
  return null;
}

/** Join matched picks to surveys and slots. Wells appear at most once: a bore with
 *  two picks for the same horizon keeps the shallowest, which is the entry point. */
export function buildImpacts(
  matched: FormationPick[],
  wellheads: PathWellhead[],
  surveys: Array<{ well: string; stations: PathStation[] }>,
): ImpactPoint[] {
  const heads = new Map<string, PathWellhead>();
  for (const w of wellheads) {
    if (!Number.isFinite(w.x) || !Number.isFinite(w.y)) continue;
    heads.set(wellKey(w.name), w);
  }
  const survey = new Map<string, PathStation[]>();
  for (const s of surveys) survey.set(wellKey(s.well), s.stations ?? []);

  const best = new Map<string, ImpactPoint>();
  for (const p of matched) {
    if (!p.well || !Number.isFinite(p.md)) continue;
    const k = wellKey(p.well);
    const head = heads.get(k); const st = survey.get(k);
    if (!head || !st) continue;                       // no position ⇒ no point
    const at = positionAtMd(st, p.md as number);
    if (!at) continue;
    const point: ImpactPoint = {
      well: head.name, role: pathRole(head.role),
      easting: (head.x as number) + at.ew,
      northing: (head.y as number) + at.ns,
      md: p.md as number,
      tvdss: Number.isFinite(p.tvdss) ? (p.tvdss as number) : null,
      extrapolated: at.extrapolated,
    };
    const prev = best.get(k);
    if (!prev || point.md < prev.md) best.set(k, point);
  }
  return [...best.values()];
}
