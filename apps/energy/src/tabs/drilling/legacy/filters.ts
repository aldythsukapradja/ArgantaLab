// filters.ts — the single-active-filter match logic shared by the Gantt (dimming)
// and the Dashboard panels. Filter string form: "type:value" (reference parity).
import type { ScheduleActivity, Reservoir } from './schedule-model';
import { pd } from './time-axis';

export type FilterKind = 'well' | 'res' | 'act' | 'basis' | 'welltype' | 'campaign' | 'pm' | 'nonfid';

export interface ParsedFilter { kind: FilterKind; value: string }

export function parseFilter(f: string | null): ParsedFilter | null {
  if (!f) return null;
  const i = f.indexOf(':');
  if (i < 0) return null;
  return { kind: f.slice(0, i) as FilterKind, value: f.slice(i + 1) };
}

/** Does an activity match the active filter? */
export function matchesFilter(a: ScheduleActivity, filter: string | null): boolean {
  const p = parseFilter(filter);
  if (!p) return true; // no filter → everything shows
  switch (p.kind) {
    case 'well': return a.well === p.value;
    case 'res': return a.reservoir === (p.value as Reservoir);
    case 'act': return a.kind === p.value;
    case 'basis': return String(a.basis) === p.value;
    case 'welltype': return a.wellType === p.value;
    case 'campaign': return a.rigId === p.value; // campaign keyed to rig lane
    case 'nonfid': return !!a.nonFid;
    case 'pm': {
      // "YEAR_Reservoir" — Dev/WO with TD in that year & reservoir
      const [yr, res] = p.value.split('_');
      return (a.kind === 'Dev' || a.kind === 'WO')
        && a.reservoir === (res as Reservoir)
        && pd(a.end).getFullYear() === Number(yr);
    }
    default: return true;
  }
}

/** Human label for the filter badge. */
export function filterLabel(f: string | null): string {
  const p = parseFilter(f);
  if (!p) return '';
  const nice: Record<FilterKind, string> = {
    well: 'Well', res: 'Reservoir', act: 'Activity', basis: 'Maturation',
    welltype: 'Type', campaign: 'Campaign', pm: 'Post-well', nonfid: 'Non-FID',
  };
  return `${nice[p.kind]}: ${p.value.replace('_', ' · ')}`;
}
