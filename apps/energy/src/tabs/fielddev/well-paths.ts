// fielddev/well-paths.ts — turn ingested trajectories into map-ready wellbore paths.
//
// WHY THIS EXISTS. A depth structure map on its own says where the reservoir is.
// It says nothing about whether anyone reached it. Draping the wellbores over the
// same grid is what turns the picture into a development statement: you can see
// the crest, and you can see which holes were put through it.
//
// The two halves come from two different places, and neither is invented here:
//   • the PATH shape is the survey — dispNs/dispEw offsets, station by station,
//     out of the trajectory digest Data QC already ingested;
//   • the PATH ORIGIN is the wellhead easting/northing on the bundle's own well
//     master, in the projected CRS the bundle declares.
// Add them and you have projected coordinates; the caller reprojects to WGS84.
//
// A wellbore with no wellhead coordinate is DROPPED, not drawn at (0,0). A survey
// is meaningless without the slot it started from, and a well stacked on the
// origin would look like a real observation.

/** One survey station, as the bundle writes it. Offsets are metres from the wellhead. */
export interface PathStation { md?: number; tvd?: number; dispNs?: number; dispEw?: number }

/** A wellbore's surface slot, in the bundle's projected CRS. */
export interface PathWellhead { name: string; x?: number; y?: number; role?: string }

export type PathRole = 'producer' | 'injector' | 'other';

/** A wellbore path in PROJECTED coordinates — reprojection is the caller's job. */
export interface ProjectedPath {
  well: string;
  role: PathRole;
  /** [easting, northing] per station, surface → TD */
  points: Array<[number, number]>;
}

/**
 * Role, read from the same vocabulary the well inventory chips use.
 * `oil-producer` specifically: a WATER-producer is a supply well, not a producer
 * of the field, and colouring it green would overstate the flowing well count.
 */
export function pathRole(role: string | undefined): PathRole {
  const r = String(role ?? '').toLowerCase();
  if (/oil[-_ ]?produc/.test(r)) return 'producer';
  if (/inject/.test(r)) return 'injector';
  return 'other';
}

/** Wellbore names differ in punctuation between the well master and the trajectory
 *  digests ("15/9-F-11 A" vs "F-11 A" vs "f-11-a"). Compare on the stripped form. */
export function wellKey(name: string): string {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Join wellheads to surveys and emit projected paths.
 *
 * Stations are kept in the order given — the bundle writes them surface-first —
 * and only finite offsets survive. A survey that ends up with fewer than two
 * usable stations produces no line: one point is not a path.
 */
export function buildWellPaths(
  wellheads: PathWellhead[],
  surveys: Array<{ well: string; stations: PathStation[] }>,
): ProjectedPath[] {
  const heads = new Map<string, PathWellhead>();
  for (const w of wellheads) {
    if (!Number.isFinite(w.x) || !Number.isFinite(w.y)) continue;   // no slot ⇒ no path
    heads.set(wellKey(w.name), w);
  }

  const out: ProjectedPath[] = [];
  for (const s of surveys) {
    const head = heads.get(wellKey(s.well));
    if (!head) continue;
    const x0 = head.x as number, y0 = head.y as number;
    const points: Array<[number, number]> = [];
    for (const st of s.stations ?? []) {
      const ew = Number(st.dispEw), ns = Number(st.dispNs);
      if (!Number.isFinite(ew) || !Number.isFinite(ns)) continue;
      points.push([x0 + ew, y0 + ns]);
    }
    if (points.length < 2) continue;
    out.push({ well: head.name, role: pathRole(head.role), points });
  }
  return out;
}

/**
 * Where a well actually MEETS THE RESERVOIR, in map coordinates.
 *
 * ── WHY THE WELLHEAD IS THE WRONG ANSWER ────────────────────────────────────
 *
 * Volve is one platform. Every bore's surface slot is within a few metres of every
 * other, so placing wells in a flow model by their wellhead puts all 24 of them in the
 * same grid cell — even at 50 m resolution. The simulation then has one producer and
 * one injector at the same point, which is why a nine-well waterflood animated as a
 * single well: it WAS a single well.
 *
 * The producing location is where the trajectory crosses the reservoir. `targetTvdss`
 * is the depth to intersect; the survey is walked for the station pair that straddles
 * it and the position is interpolated between them. A well whose survey never reaches
 * that depth returns its DEEPEST station instead, flagged, because the deepest point of
 * a well that stops above the reservoir is still nearer the truth than its slot — but a
 * caller that wants to exclude it has to be able to tell.
 */
export interface EntryPoint {
  x: number; y: number;
  /** the depth actually used, which is `targetTvdss` only when the survey reached it */
  tvdss: number;
  /** true when the survey never reached the target and the deepest station was used */
  shallow: boolean;
}

export function reservoirEntry(
  head: { x: number; y: number },
  stations: Array<{ tvd?: number; dispEw?: number; dispNs?: number }>,
  targetTvdss: number,
): EntryPoint | null {
  if (!Number.isFinite(head.x) || !Number.isFinite(head.y)) return null;
  const pts = stations
    .map((s) => ({ z: Number(s.tvd), ew: Number(s.dispEw), ns: Number(s.dispNs) }))
    .filter((s) => Number.isFinite(s.z) && Number.isFinite(s.ew) && Number.isFinite(s.ns))
    .sort((a, b) => a.z - b.z);
  if (!pts.length) return null;

  const deepest = pts[pts.length - 1];
  if (!(deepest.z >= targetTvdss)) {
    return { x: head.x + deepest.ew, y: head.y + deepest.ns, tvdss: deepest.z, shallow: true };
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (b.z < targetTvdss) continue;
    const span = b.z - a.z;
    // linear between the straddling stations; a zero-thickness span takes the deeper one
    const t = span > 1e-9 ? (targetTvdss - a.z) / span : 1;
    return {
      x: head.x + a.ew + t * (b.ew - a.ew),
      y: head.y + a.ns + t * (b.ns - a.ns),
      tvdss: targetTvdss, shallow: false,
    };
  }
  return { x: head.x + deepest.ew, y: head.y + deepest.ns, tvdss: deepest.z, shallow: true };
}
