// trajectory-math.ts — helpers over real wb trajectory stations (public/wb/traj-*
// .json: md/tvd/incl/azi/dispNs/dispEw). Dogleg severity = standard station-to-
// station formula; closest approach = simplified straight 3D distance (NOT a full
// ISCWSA ellipse/SF — flagged as a scope simplification in the Clearance tab).
import type { TrajStation } from '../../wb/types';

const D2R = Math.PI / 180;

export function dls(a: TrajStation, b: TrajStation): number {
  const dMd = b.md - a.md;
  if (dMd <= 0) return 0;
  const i1 = a.incl * D2R, i2 = b.incl * D2R, dAz = (b.azi - a.azi) * D2R;
  const cosDog = Math.cos(i1) * Math.cos(i2) + Math.sin(i1) * Math.sin(i2) * Math.cos(dAz);
  const dogRad = Math.acos(Math.max(-1, Math.min(1, cosDog)));
  return (dogRad / D2R) * (30 / dMd);
}

export interface OffsetCandidate { well: string; surfaceX: number; surfaceY: number; stations: TrajStation[] }

function xyz(surfaceX: number, surfaceY: number, s: TrajStation) {
  return { x: surfaceX + s.dispEw, y: surfaceY + s.dispNs, z: s.tvd };
}

/** Minimum 3D distance between one path and each offset path (simplified anti-collision). */
export function closestApproaches(
  surfaceX: number, surfaceY: number, stations: { md: number; tvd: number; dispNs: number; dispEw: number }[],
  offsets: OffsetCandidate[],
): { well: string; minDistM: number; atMd: number }[] {
  const mine = stations.map((s) => ({ ...xyz(surfaceX, surfaceY, s as TrajStation), md: s.md }));
  return offsets.map((off) => {
    const theirs = off.stations.map((s) => xyz(off.surfaceX, off.surfaceY, s));
    let best = Infinity, atMd = 0;
    for (let i = 0; i < mine.length; i += 2) {
      for (let j = 0; j < theirs.length; j += 2) {
        const dx = mine[i].x - theirs[j].x, dy = mine[i].y - theirs[j].y, dz = mine[i].z - theirs[j].z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < best) { best = d; atMd = mine[i].md; }
      }
    }
    return { well: off.well, minDistM: best, atMd };
  }).sort((a, b) => a.minDistM - b.minDistM);
}

/**
 * Simplified ISCWSA-style separation factor: distance / combined positional
 * uncertainty. Uncertainty grows with depth (~1.5% of MD here). SF < 1.2 = alert,
 * SF < 4 = watch (industry scan thresholds). Deliberately not the full covariance model.
 */
export function separationFactor(minDistM: number, atMd: number): number {
  const combinedUncertaintyM = 5 + 0.015 * atMd; // simplified positional error envelope
  return minDistM / combinedUncertaintyM;
}
