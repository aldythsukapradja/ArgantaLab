// schedule-store.ts — named revision snapshots of the drilling schedule, enabling
// the Revisions tab's git-like diff. Same offline-first localStorage pattern as
// proposal-store. Snapshots are lightweight (well → {rigId,start,days} rows).
import type { DrillingSchedule } from './schedule-model';
import { allActivities } from './schedule-model';

const REV_KEY = 'energy_drilling_revisions_v1';

export interface RevRow { well: string; rigId: string; start: string; days: number; kind: string; }
export interface Revision { id: string; label: string; savedAt: string; rows: RevRow[]; }

function read(): Revision[] {
  try { const r = localStorage.getItem(REV_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function write(v: Revision[]) {
  try { localStorage.setItem(REV_KEY, JSON.stringify(v)); } catch { /* no-op */ }
}

export function listRevisions(): Revision[] { return read(); }

export function snapshot(schedule: DrillingSchedule): RevRow[] {
  return allActivities(schedule)
    .filter((a) => a.kind !== 'Rig')
    .map((a) => ({ well: a.well, rigId: a.rigId, start: a.start, days: a.days, kind: a.kind }));
}

export function saveRevision(schedule: DrillingSchedule, label: string, id: string, savedAt: string): Revision {
  const rev: Revision = { id, label, savedAt, rows: snapshot(schedule) };
  const all = read();
  all.push(rev);
  write(all);
  return rev;
}

export type DiffKind = 'add' | 'rem' | 'mov';
export interface DiffRow { kind: DiffKind; well: string; detail: string; }

/** Diff current schedule against a prior revision's snapshot. */
export function diff(prev: RevRow[], current: RevRow[]): DiffRow[] {
  const pByWell = new Map(prev.map((r) => [r.well + r.kind, r]));
  const cByWell = new Map(current.map((r) => [r.well + r.kind, r]));
  const out: DiffRow[] = [];
  for (const [key, c] of cByWell) {
    const p = pByWell.get(key);
    if (!p) { out.push({ kind: 'add', well: c.well, detail: `added on ${c.rigId} · ${c.start} · ${c.days}d` }); continue; }
    if (p.rigId !== c.rigId || p.start !== c.start || p.days !== c.days) {
      const parts: string[] = [];
      if (p.rigId !== c.rigId) parts.push(`rig ${p.rigId}→${c.rigId}`);
      if (p.start !== c.start) parts.push(`start ${p.start}→${c.start}`);
      if (p.days !== c.days) parts.push(`${p.days}→${c.days}d`);
      out.push({ kind: 'mov', well: c.well, detail: parts.join(' · ') });
    }
  }
  for (const [key, p] of pByWell) {
    if (!cByWell.has(key)) out.push({ kind: 'rem', well: p.well, detail: `removed from ${p.rigId}` });
  }
  return out;
}
