// trajectory-math.ts — small in-house trajectory math for the Well Delivery
// proposal (see WELL-DELIVERY-PROPOSAL-SPEC.md §5): min-curvature dogleg severity
// + ISCWSA-style closest-approach simplified to straight 3D distance. Operates on
// the already-computed TrajStation[] (incl/azi/disp), so no full welleng port.
import type { TrajStation } from '../../wb/types';

export interface TrajStats {
  kopMd: number | null;
  tdMd: number;
  tdTvd: number;
  maxInclDeg: number;
  maxAziDeg: number;
  maxDlsDeg30m: number;
}

export interface OffsetCandidate {
  well: string;
  surfaceX: number;
  surfaceY: number;
  stations: TrajStation[];
}

const DEG = Math.PI / 180;

/** Min-curvature dogleg angle (radians) between two survey stations. */
function doglegRad(a: TrajStation, b: TrajStation): number {
  const i1 = a.incl * DEG, i2 = b.incl * DEG;
  const da = (b.azi - a.azi) * DEG;
  const cosB = Math.cos(i1) * Math.cos(i2) + Math.sin(i1) * Math.sin(i2) * Math.cos(da);
  return Math.acos(Math.max(-1, Math.min(1, cosB)));
}

/** KOP (kick-off point) MD, max inclination/azimuth, TD, and max DLS per 30 m. */
export function trajectoryStats(stations: TrajStation[]): TrajStats {
  if (!stations.length) {
    return { kopMd: null, tdMd: 0, tdTvd: 0, maxInclDeg: 0, maxAziDeg: 0, maxDlsDeg30m: 0 };
  }
  const last = stations[stations.length - 1];
  let kopMd: number | null = null;
  let maxIncl = 0, maxAzi = 0, maxDls = 0;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    if (kopMd == null && s.incl > 3) kopMd = s.md;
    if (s.incl > maxIncl) maxIncl = s.incl;
    if (s.azi > maxAzi) maxAzi = s.azi;
    if (i > 0) {
      const prev = stations[i - 1];
      const dmd = s.md - prev.md;
      if (dmd > 0) {
        const dls = (doglegRad(prev, s) / DEG) / dmd * 30; // deg per 30 m
        if (dls > maxDls) maxDls = dls;
      }
    }
  }
  return {
    kopMd,
    tdMd: last.md,
    tdTvd: last.tvd,
    maxInclDeg: Math.round(maxIncl * 10) / 10,
    maxAziDeg: Math.round(maxAzi * 10) / 10,
    maxDlsDeg30m: Math.round(maxDls * 100) / 100,
  };
}

/** 3D positions of a well's stations given its surface location (E=+x, N=+y, TVD down). */
function positions(surfaceX: number, surfaceY: number, stations: TrajStation[]): [number, number, number][] {
  return stations.map((s) => [surfaceX + s.dispEw, surfaceY + s.dispNs, s.tvd]);
}

/**
 * Closest approach of the subject well (at surfaceX/Y with `stations`) to any
 * offset candidate — simplified ISCWSA: minimum straight 3D distance between any
 * pair of survey stations. Returns the nearest well and separation, or null.
 */
export function closestApproach(
  surfaceX: number, surfaceY: number, stations: TrajStation[], offsets: OffsetCandidate[],
): { well: string; distM: number } | null {
  if (!offsets.length || !stations.length) return null;
  const self = positions(surfaceX, surfaceY, stations);
  let best: { well: string; distM: number } | null = null;
  for (const off of offsets) {
    const op = positions(off.surfaceX, off.surfaceY, off.stations);
    let minD = Infinity;
    for (const a of self) {
      for (const b of op) {
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d < minD) minD = d;
      }
    }
    if (!best || minD < best.distM) best = { well: off.well, distM: Math.round(minD * 10) / 10 };
  }
  return best;
}
