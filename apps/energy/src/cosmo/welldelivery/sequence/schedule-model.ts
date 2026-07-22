// schedule-model.ts — the Drilling Sequence data model + Volve-grounded seed.
//
// DATA DOCTRINE (see docs/arganta-energy/DRILLING-SEQUENCE-BUILD-PLAN.md §1):
//   - Well universe & geometry (x/y, TD, role, reservoir) → real Volve, tagged
//     measured/reported.
//   - Schedule TIMING & sequencing → scenario (Volve has NO drilling dates in the
//     repo). Sourced from approved Well Delivery proposals where present, else a
//     deterministic default development campaign so the Gantt is populated at
//     Volve scale. Historical bars anchored on real production first-oil months
//     are tagged 'interpreted' (duration inferred).
//   Every activity carries an honest dataNature. Never present timing as measured.

import { loadIndex, loadPicks, loadProd } from '../../../wb/load';
import type { WellRow, Pick } from '../../../wb/types';
import { listProposals, listScheduleItems } from '../proposal-store';
import type { ProposalGate } from '../proposal-types';
import { pd, addDays, addMonths, today } from './time-axis';

export type ActKind = 'Dev' | 'WO' | 'App' | 'Rig';
export type WellType = 'OP' | 'WI' | 'WD' | null;
export type Reservoir = 'Hugin' | 'Skagerrak' | 'Ty' | 'Other';
export type Basis = ProposalGate | 'ACTUAL';
export type DataNature = 'measured' | 'reported' | 'interpreted' | 'scenario';

export interface ScheduleActivity {
  id: string;
  rigId: string;
  start: string;         // "YYYY-MM-DD"
  end: string;           // "YYYY-MM-DD" (= TD date for Dev/WO)
  days: number;
  kind: ActKind;
  well: string;          // canonical well name, e.g. "F-12"
  wellType: WellType;
  reservoir: Reservoir | null;
  basis: Basis;
  dataNature: DataNature;
  nonFid?: boolean;
  proposalId?: string;   // back-link when sourced from an approved proposal
}

export interface Rig {
  id: string;
  name: string;
  color: string;
  acts: ScheduleActivity[];
}

export interface Campaign {
  rigId: string;
  start: string; end: string;
  label: string;
  color: string;
}

export interface Milestone {
  rigId?: string;
  label: string;
  date: string;
  kind: 'RFD' | 'RFSU' | 'FO';
  color: string;
}

export interface WellGeo {
  name: string;
  x: number; y: number;
  tdMd: number; tdTvd: number;
  role: WellRow['role'];
  wellType: WellType;
  reservoir: Reservoir | null;
  isExploration: boolean;
  firstProd: string | null;   // reported first-production "YYYY-MM" if any
}

export interface DrillingSchedule {
  rigs: Rig[];
  campaigns: Campaign[];
  milestones: Milestone[];
  wells: WellGeo[];
  meta: { anchor: string; proposals: number; generatedAt: string };
}

// ── Rig lanes (Volve field = Mærsk Inspirer; a second lane is a scenario slot) ──
export const RIGS: { id: string; name: string; color: string }[] = [
  { id: 'RIG1', name: 'Mærsk Inspirer', color: '#0FB5A6' },
  { id: 'RIG2', name: 'Scenario Rig B', color: '#2563eb' },
];

export const RESERVOIR_COLOR: Record<Reservoir, string> = {
  Hugin: '#0FB5A6',
  Skagerrak: '#f59e0b',
  Ty: '#7c3aed',
  Other: '#64748b',
};

export const KIND_LABEL: Record<ActKind, string> = {
  Dev: 'Development', WO: 'Workover', App: 'Appraisal', Rig: 'Rig Operation',
};
export const WELLTYPE_LABEL: Record<NonNullable<WellType>, string> = {
  OP: 'Producer', WI: 'Injector', WD: 'Disposal',
};

// Maturation gates reused from the proposal spine (basis dots).
export const BASIS_COLOR: Record<Basis, string> = {
  SOR0: '#94a3b8', SOR1: '#94a3b8', SOR2: '#2563eb',
  BOD: '#10b981', APPROVED: '#0FB5A6', ACTUAL: '#475569',
};

// Deterministic pseudo-random from a string (stable seed placement, no Math.random).
function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function reservoirOf(deepestPick: Pick | null): Reservoir {
  const s = (deepestPick?.surface || '').toLowerCase();
  if (s.includes('skagerrak') || s.includes('ska') || s.includes('triassic')) return 'Skagerrak';
  if (s.includes('ty')) return 'Ty';
  if (s.includes('hugin') || s.includes('sleipner')) return 'Hugin';
  return 'Hugin'; // Volve's producing reservoir is the Hugin Fm by default
}

function wellTypeOf(role: WellRow['role']): WellType {
  if (role === 'injector') return 'WI';
  if (role === 'producer' || role === 'both') return 'OP';
  return 'OP';
}

/** Drilling-days estimate from TD (deeper = longer), deterministic. Scenario. */
function estDays(tdMd: number, exploration: boolean): number {
  const base = 22 + (tdMd / 4000) * 26; // ~22–50 days over 0–4000 m
  return Math.round(base + (exploration ? 10 : 0));
}

function matchDeepestPick(picks: Pick[], name: string): Pick | null {
  const mine = picks.filter(
    (p) => (p.well === name || (p.source_well && p.source_well.endsWith('-' + name))) && p.tvdss != null,
  );
  return mine.reduce<Pick | null>((acc, p) => (!acc || p.md > acc.md ? p : acc), null);
}

/**
 * Build the Volve-grounded drilling schedule.
 * @param includeHistorical also lay reported/interpreted historical bars anchored
 *        on production first-oil (off by default — planning horizon is the focus).
 */
export async function buildSchedule(includeHistorical = false): Promise<DrillingSchedule> {
  const [index, picks] = await Promise.all([loadIndex(), loadPicks()]);
  const wellRows = index.wells;

  // First-production month for wells that have production (real, reported).
  const firstProd = new Map<string, string>();
  await Promise.all(
    wellRows.filter((w) => w.has.production).map(async (w) => {
      try {
        const prod = await loadProd(w.name);
        const first = prod.monthly.find((m) => (m.oil || 0) + (m.gas || 0) + (m.wi || 0) > 0) ?? prod.monthly[0];
        if (first) firstProd.set(w.name, first.ym);
      } catch { /* skip missing prod */ }
    }),
  );

  const wells: WellGeo[] = wellRows.map((w) => {
    const dp = matchDeepestPick(picks.picks, w.name);
    return {
      name: w.name, x: w.x, y: w.y, tdMd: w.td_md, tdTvd: w.td_tvd,
      role: w.role, wellType: wellTypeOf(w.role),
      reservoir: reservoirOf(dp),
      isExploration: !!w.is_exploration,
      firstProd: firstProd.get(w.name) ?? null,
    };
  });

  const rigs: Rig[] = RIGS.map((r) => ({ ...r, acts: [] }));
  const rigOf = (i: number) => rigs[i % rigs.length];

  // ── 1. Approved proposals → real scenario bars (p50Days), sequenced first ──
  const approved = listProposals().filter((p) => p.gate === 'APPROVED');
  const emitted = listScheduleItems();
  const anchor = today();
  const cursor: Record<string, Date> = { RIG1: new Date(anchor), RIG2: addMonths(anchor, 3) };
  const scheduledWells = new Set<string>();

  const emit = (
    rigId: string, w: WellGeo, days: number, kind: ActKind, basis: Basis,
    dataNature: DataNature, proposalId?: string, nonFid?: boolean,
  ) => {
    const start = new Date(cursor[rigId]);
    const end = addDays(start, days);
    rigs.find((r) => r.id === rigId)!.acts.push({
      id: `${rigId}-${w.name}-${kind}`,
      rigId, start: iso(start), end: iso(end), days, kind,
      well: w.name, wellType: kind === 'App' ? null : w.wellType,
      reservoir: w.reservoir, basis, dataNature, nonFid, proposalId,
    });
    // gap between activities on a rig: 6–14 days move/rig-up (scenario)
    cursor[rigId] = addDays(end, 6 + (hash(w.name) % 9));
    scheduledWells.add(w.name);
  };

  approved.forEach((p, i) => {
    const w = wells.find((x) => x.name === p.well);
    if (!w) return;
    const item = emitted.find((e) => e.proposalId === p.id);
    const days = item?.p50Days ?? p.afe.p50Days ?? estDays(w.tdMd, w.isExploration);
    emit(rigOf(i).id, w, days, w.isExploration ? 'App' : 'Dev', 'APPROVED', 'scenario', p.id);
  });

  // ── 2. Default development campaign from remaining real wells (scenario) ──
  // Injectors first (pressure support drilled early), then grouped by reservoir,
  // then TD, so lanes read as coherent campaigns. Alternate rigs. Basis descends
  // SOR2→SOR1→SOR0 down the queue to show maturation spread.
  const remaining = wells
    .filter((w) => !scheduledWells.has(w.name))
    .sort((a, b) => {
      const ai = a.wellType === 'WI' ? 0 : 1, bi = b.wellType === 'WI' ? 0 : 1;
      if (ai !== bi) return ai - bi;
      if (a.reservoir !== b.reservoir) return a.reservoir! < b.reservoir! ? -1 : 1;
      return a.tdMd - b.tdMd;
    });

  const gates: Basis[] = ['SOR2', 'SOR1', 'SOR0'];
  remaining.forEach((w, i) => {
    const rig = rigOf(approved.length + i);
    const kind: ActKind = w.isExploration ? 'App' : 'Dev';
    const basis = gates[Math.min(gates.length - 1, Math.floor(i / Math.ceil(remaining.length / 3)))];
    const nonFid = basis === 'SOR0' && (hash(w.name) % 3 === 0);
    emit(rig.id, w, estDays(w.tdMd, w.isExploration), kind, basis, 'scenario', undefined, nonFid);
  });

  // A couple of scenario workovers on producers to exercise the WO styling.
  wells.filter((w) => w.role === 'producer').slice(0, 2).forEach((w, i) => {
    const rig = rigOf(i);
    emit(rig.id, w, 12 + (hash(w.name + 'wo') % 8), 'WO', 'BOD', 'scenario');
  });

  // ── 3. Optional historical backdrop from real first-oil (interpreted) ──
  if (includeHistorical) {
    wells.filter((w) => w.firstProd).forEach((w, i) => {
      const fo = pd(w.firstProd! + '-01');
      const days = estDays(w.tdMd, w.isExploration);
      const start = addDays(fo, -days - 20); // TD ≈ 20d before first oil, spud = TD − duration
      const end = addDays(fo, -20);
      rigOf(i).acts.push({
        id: `HIST-${w.name}`, rigId: rigOf(i).id,
        start: iso(start), end: iso(end), days, kind: w.isExploration ? 'App' : 'Dev',
        well: w.name, wellType: w.wellType, reservoir: w.reservoir,
        basis: 'ACTUAL', dataNature: 'interpreted',
      });
    });
  }

  // ── Campaign bands (scenario planning phases) per rig, spanning their acts ──
  const campaigns: Campaign[] = rigs
    .filter((r) => r.acts.length)
    .map((r) => {
      const scen = r.acts.filter((a) => a.dataNature === 'scenario');
      if (!scen.length) return null;
      const starts = scen.map((a) => pd(a.start).getTime());
      const ends = scen.map((a) => pd(a.end).getTime());
      return {
        rigId: r.id,
        start: iso(new Date(Math.min(...starts))),
        end: iso(new Date(Math.max(...ends))),
        label: r.id === 'RIG1' ? 'Volve Infill Campaign' : 'Scenario Development',
        color: r.color,
      };
    })
    .filter(Boolean) as Campaign[];

  // ── Milestones: RFSU ≈ 45d after each rig's last scenario TD; a field FO marker ──
  const milestones: Milestone[] = [];
  rigs.forEach((r) => {
    const scen = r.acts.filter((a) => a.dataNature === 'scenario' && a.kind !== 'Rig');
    if (!scen.length) return;
    const lastEnd = scen.reduce((mx, a) => Math.max(mx, pd(a.end).getTime()), 0);
    milestones.push({
      rigId: r.id, kind: 'RFSU', color: '#e11d74',
      date: iso(addDays(new Date(lastEnd), 45)),
      label: `${r.id === 'RIG1' ? 'A' : 'B'} RFSU`,
    });
  });

  return {
    rigs, campaigns, milestones, wells,
    meta: { anchor: iso(anchor), proposals: approved.length, generatedAt: iso(anchor) },
  };
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Derived selectors (pure) ──────────────────────────────────────────────────

export function allActivities(s: DrillingSchedule): ScheduleActivity[] {
  return s.rigs.flatMap((r) => r.acts);
}

/** Post-well review list: Dev/WO with a reservoir and TD ≥ the given year. PM due = TD + 6 months. */
export function pmList(s: DrillingSchedule, minYear = 2026): Array<{ well: string; res: Reservoir; td: string; pmDate: string; rigId: string }> {
  return allActivities(s)
    .filter((a) => (a.kind === 'Dev' || a.kind === 'WO') && a.reservoir && pd(a.end).getFullYear() >= minYear)
    .map((a) => ({ well: a.well, res: a.reservoir as Reservoir, td: a.end, rigId: a.rigId, pmDate: iso(addMonths(pd(a.end), 6)) }));
}

/** Wells with any activity overlapping the [vs, ve] date window. */
export function wellsInWindow(s: DrillingSchedule, vsIso: string, veIso: string): Set<string> {
  const vs = pd(vsIso).getTime(), ve = pd(veIso).getTime();
  const out = new Set<string>();
  for (const a of allActivities(s)) {
    if (pd(a.start).getTime() <= ve && pd(a.end).getTime() >= vs) out.add(a.well);
  }
  return out;
}

/** Well-count pivot by year × type from scenario/actual Dev+App activities (TD year). */
export function wellCountByYear(s: DrillingSchedule): Array<{ year: number; OP: number; WI: number; App: number; total: number }> {
  const by = new Map<number, { OP: number; WI: number; App: number }>();
  for (const a of allActivities(s)) {
    if (a.kind === 'WO' || a.kind === 'Rig') continue;
    const y = pd(a.end).getFullYear();
    const row = by.get(y) ?? { OP: 0, WI: 0, App: 0 };
    if (a.kind === 'App') row.App++;
    else if (a.wellType === 'WI') row.WI++;
    else row.OP++;
    by.set(y, row);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, r]) => ({ year, ...r, total: r.OP + r.WI + r.App }));
}

/** Rig utilization: on-bar days ÷ span days within the window. */
export function rigUtilization(s: DrillingSchedule, vsIso: string, veIso: string): Array<{ rig: Rig; busyDays: number; spanDays: number; pct: number; count: number }> {
  const vs = pd(vsIso).getTime(), ve = pd(veIso).getTime();
  const spanDays = Math.max(1, (ve - vs) / 86_400_000);
  return s.rigs.map((rig) => {
    let busy = 0, count = 0;
    for (const a of rig.acts) {
      const as = Math.max(vs, pd(a.start).getTime());
      const ae = Math.min(ve, pd(a.end).getTime());
      if (ae > as) { busy += (ae - as) / 86_400_000; count++; }
    }
    return { rig, busyDays: Math.round(busy), spanDays: Math.round(spanDays), pct: Math.min(100, Math.round((busy / spanDays) * 100)), count };
  });
}
