// wdData.ts — Well Delivery candidate portfolio. Candidates are NEW wells /
// SIDETRACKS proposed off Field Development, anchored to REAL Volve wells (surface
// locations, TD, formation depths from public/wb). Design/hazard/cost numbers are
// scenario-grade (dataNature: scenario) — a well that isn't drilled yet cannot be
// measured. Persisted to localStorage; regenerated from real wb data on first run.
import { loadIndex, loadPicks } from '../../wb/load';
import type { WbIndex, PicksJson, WellRow } from '../../wb/types';
import type { WdCandidate, MudPoint } from './types';
import { gateIndex } from './types';

const KEY = 'energy_wd_candidates_v1';
const RM_KEY = 'energy_wd_rm_handover_v1';
const SEQ_KEY = 'energy_drilling_sequence_v1';

const D2R = Math.PI / 180;

/* ---------- deterministic synthesis (scenario) ---------- */

/** Build a plausible Volve-style mud window (Volve is close to normally pressured). */
export function synthMudWindow(tdTvd: number): MudPoint[] {
  const pts: MudPoint[] = [];
  const step = Math.max(120, tdTvd / 22);
  for (let md = 0; md <= tdTvd + 1; md += step) {
    const f = md / Math.max(tdTvd, 1);
    const poreSg = 1.03 + 0.12 * f;
    const collapseSg = poreSg + 0.03 + 0.05 * f;
    const fracSg = 1.45 + 0.30 * f;
    const mudSg = (collapseSg + fracSg) / 2;
    pts.push({ md, poreSg, collapseSg, fracSg, mudSg });
  }
  return pts;
}

/** Deterministic build-and-hold survey from surface to the target (for viz + anti-collision). */
export function candidateStations(c: WdCandidate) {
  const { surfaceX, surfaceY, kopMd, tdMd, maxInclDeg } = c.trajectory;
  const aziR = Math.atan2(c.target.x - surfaceX, c.target.y - surfaceY); // E-of-N bearing
  const azi = ((aziR / D2R) + 360) % 360;
  const inclOf = (md: number) => (md <= kopMd ? 0 : Math.min(maxInclDeg, maxInclDeg * (md - kopMd) / Math.max((tdMd - kopMd) * 0.55, 1)));
  const n = 44;
  let tvd = 0, north = 0, east = 0, prev = 0;
  const stations = [{ md: 0, tvd: 0, dispNs: 0, dispEw: 0, incl: 0, azi }];
  for (let i = 1; i <= n; i++) {
    const md = (tdMd * i) / n;
    const ds = md - prev;
    const incMid = inclOf((prev + md) / 2) * D2R;
    tvd += ds * Math.cos(incMid);
    const horiz = ds * Math.sin(incMid);
    north += horiz * Math.cos(aziR);
    east += horiz * Math.sin(aziR);
    stations.push({ md, tvd, dispNs: north, dispEw: east, incl: inclOf(md), azi });
    prev = md;
  }
  return stations;
}

/* ---------- build the portfolio from real anchors ---------- */

function pickDepth(picks: PicksJson, well: string, surface: RegExp): { md: number; tvdss: number } | null {
  const p = picks.picks.find((x) => (x.well === well || (x.source_well ?? '').endsWith('-' + well)) && surface.test(x.surface) && x.tvdss != null);
  return p ? { md: p.md, tvdss: p.tvdss as number } : null;
}

function nearest(wells: WellRow[], to: WellRow, pred: (w: WellRow) => boolean, k: number): WellRow[] {
  return wells.filter((w) => w.name !== to.name && pred(w))
    .map((w) => ({ w, d: Math.hypot(w.x - to.x, w.y - to.y) }))
    .sort((a, b) => a.d - b.d).slice(0, k).map((x) => x.w);
}

function baseDesign(tdMd: number, tdTvd: number, role: 'producer' | 'injector', target: WdCandidate['target']): Pick<WdCandidate, 'trajectory' | 'casing' | 'mudWindow' | 'barriers' | 'risks' | 'afe' | 'dataAcq' | 'successCriteria' | 'objective'> {
  return {
    objective: `Deliver a ${role} into the ${target.formation} at the ${target.anchorWell} fault block, adding ${role === 'producer' ? 'reserves' : 'voidage-replacement support'} to the development.`,
    successCriteria: [
      `Land within ±3 m TVD of the ${target.formation} target`,
      'Reach planned TD inside the approved trajectory & mud-weight envelope',
      'Acquire the full data-acquisition programme across the reservoir',
      'Zero uncontrolled well-control or integrity event (NORSOK D-010)',
    ],
    trajectory: { surfaceX: target.x - 620, surfaceY: target.y - 380, kopMd: Math.round(tdTvd * 0.28), tdMd, tdTvd, maxInclDeg: 42, maxDlsDeg30m: 2.4, profile: 'Build-and-hold' },
    casing: [
      { section: 'Conductor', holeIn: 36, csgIn: 30, shoeMd: 150, mudSg: 1.03 },
      { section: 'Surface', holeIn: 26, csgIn: 20, shoeMd: 900, mudSg: 1.15 },
      { section: 'Intermediate', holeIn: 17.5, csgIn: 13.375, shoeMd: Math.round(tdMd * 0.62), mudSg: 1.35 },
      { section: 'Production', holeIn: 12.25, csgIn: 9.625, shoeMd: Math.round(tdMd), mudSg: 1.52 },
    ],
    mudWindow: synthMudWindow(tdTvd),
    barriers: [
      { name: 'Primary', elements: ['Fluid column (mud)', 'Casing cement', 'Production casing', 'Wellhead'], verified: role === 'producer' },
      { name: 'Secondary', elements: ['Surface casing cement', 'Casing', 'Wellhead', 'BOP / X-mas tree'], verified: false },
    ],
    risks: [
      { hazard: 'Shallow gas / shallow water flow', severity: 'high', likelihood: 'low', mitigation: 'Pilot-hole survey; monitor while drilling the surface section; diverter tested' },
      { hazard: 'Lost circulation (Utsira / Hordaland)', severity: 'med', likelihood: 'med', mitigation: 'Staged LCM pills; keep ECD inside the mud window; ready cement' },
      { hazard: 'Wellbore instability in reactive shale', severity: 'med', likelihood: 'med', mitigation: 'Offset-calibrated mud weight; minimise open-hole exposure time' },
      { hazard: 'Anti-collision at shared template', severity: 'high', likelihood: 'low', mitigation: 'MWD gyro; separation-factor watch > 1.5; slot-order review' },
    ],
    afe: { dryHoleUsd: 9_400_000, complUsd: 2_600_000, totalUsd: 12_000_000, p50Days: role === 'producer' ? 46 : 41 },
    dataAcq: ['LWD gamma / resistivity / density-neutron', 'Wireline triple-combo + sonic', 'MDT pressure points & fluid samples', 'Sidewall cores across the reservoir', 'Check-shot / VSP'],
  };
}

async function buildPortfolio(index: WbIndex, picks: PicksJson): Promise<WdCandidate[]> {
  const producers = index.wells.filter((w) => w.role === 'producer');
  const anchorA = producers[0] ?? index.wells[0];
  const anchorB = producers[1] ?? anchorA;
  const injAnchor = index.wells.find((w) => w.role === 'injector') ?? anchorA;
  const now = new Date().toISOString();

  const huginA = pickDepth(picks, anchorA.name, /Hugin/i) ?? { md: anchorA.td_md - 260, tvdss: -(anchorA.td_tvd - 240) };
  const midX = (anchorA.x + anchorB.x) / 2, midY = (anchorA.y + anchorB.y) / 2;

  // A — new infill producer, ready for sanction (full proposal)
  const tA = { formation: 'Hugin Fm.', anchorWell: anchorA.name, x: midX, y: midY, tvdss: huginA.tvdss, md: huginA.md };
  const dA = baseDesign(Math.round(anchorA.td_md * 1.02), Math.round(anchorA.td_tvd), 'producer', tA);
  const A: WdCandidate = {
    id: 'wd-infill-a', name: `${anchorA.name.split(' ')[0]}-IF1`, kind: 'new', role: 'producer', gate: 'sanction',
    target: tA, offsets: nearest(index.wells, anchorA, (w) => w.has.traj, 5).map((w) => w.name), ...dA,
    handover: undefined, updatedAt: now,
  };

  // B — sidetrack off a real producer, currently drilling (steering + as-drilled)
  const tB = { formation: 'Hugin Fm.', anchorWell: anchorA.name, x: anchorA.x + 420, y: anchorA.y - 260, tvdss: huginA.tvdss + 18, md: huginA.md + 40 };
  const dB = baseDesign(Math.round(anchorA.td_md * 1.05), Math.round(anchorA.td_tvd), 'producer', tB);
  const B: WdCandidate = {
    id: 'wd-sidetrack-b', name: `${anchorA.name} ST1`, kind: 'sidetrack', role: 'producer', parentWell: anchorA.name, gate: 'execute',
    target: tB, offsets: nearest(index.wells, anchorA, (w) => w.has.traj, 5).map((w) => w.name), ...dB,
    steering: { typeWell: anchorA.name, zoneThicknessM: 26, stations: [] },
    asDrilled: {
      tops: [
        { name: 'Nordland Gp Top', prognosedMd: 560, actualMd: 548 },
        { name: 'Hordaland Gp Top', prognosedMd: 1040, actualMd: 1057 },
        { name: 'Shetland Gp Top', prognosedMd: 2610, actualMd: 2634 },
        { name: 'Hugin Fm Top', prognosedMd: dB.trajectory.tdMd - 210, actualMd: dB.trajectory.tdMd - 188 },
      ],
      npt: [
        { section: 'Surface 26"', hours: 14, cause: 'Weather standby' },
        { section: 'Intermediate 17.5"', hours: 22, cause: 'Losses — LCM remediation' },
        { section: 'Production 12.25"', hours: 9, cause: 'BHA / MWD tool failure' },
      ],
      daysPlan: dB.afe.p50Days, daysActual: dB.afe.p50Days + 6,
      costPlanUsd: dB.afe.totalUsd, costActualUsd: Math.round(dB.afe.totalUsd * 1.11),
      inZonePct: 88,
    },
    updatedAt: now,
  };

  // C — new water injector on the flank, in detailed design
  const tC = { formation: 'Hugin Fm.', anchorWell: injAnchor.name, x: injAnchor.x - 300, y: injAnchor.y + 520, tvdss: huginA.tvdss - 30, md: huginA.md + 60 };
  const dC = baseDesign(Math.round(injAnchor.td_md * 1.0), Math.round(injAnchor.td_tvd), 'injector', tC);
  const C: WdCandidate = {
    id: 'wd-injector-c', name: `${injAnchor.name.split(' ')[0]}-WI1`, kind: 'new', role: 'injector', gate: 'define',
    target: tC, offsets: nearest(index.wells, injAnchor, (w) => w.has.traj, 5).map((w) => w.name), ...dC, updatedAt: now,
  };

  // D — step-out producer, freshly framed (assess)
  const tD = { formation: 'Hugin Fm.', anchorWell: anchorB.name, x: anchorB.x + 1200, y: anchorB.y + 900, tvdss: huginA.tvdss + 60, md: huginA.md + 120 };
  const dD = baseDesign(Math.round(anchorB.td_md * 1.08), Math.round(anchorB.td_tvd + 40), 'producer', tD);
  const D: WdCandidate = {
    id: 'wd-stepout-d', name: `${anchorB.name.split(' ')[0]}-SO1`, kind: 'new', role: 'producer', gate: 'assess',
    target: tD, offsets: nearest(index.wells, anchorB, (w) => w.has.traj, 4).map((w) => w.name), ...dD, updatedAt: now,
  };

  return [A, B, C, D];
}

/* ---------- store ---------- */

function read(): WdCandidate[] | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as WdCandidate[]) : null; } catch { return null; }
}
function write(list: WdCandidate[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }

export async function loadCandidates(): Promise<WdCandidate[]> {
  const cached = read();
  if (cached && cached.length) return cached;
  const [index, picks] = await Promise.all([loadIndex(), loadPicks()]);
  const built = await buildPortfolio(index, picks);
  write(built);
  return built;
}

export function saveCandidate(c: WdCandidate): WdCandidate[] {
  const list = read() ?? [];
  const i = list.findIndex((x) => x.id === c.id);
  const next = { ...c, updatedAt: new Date().toISOString() };
  if (i >= 0) list[i] = next; else list.push(next);
  write(list);
  return list;
}

/** Sanction (FID) → also register the well in the Drilling Sequence lifecycle. */
export function emitToDrillingSequence(c: WdCandidate) {
  try {
    const raw = localStorage.getItem(SEQ_KEY);
    const items = raw ? JSON.parse(raw) : [];
    const item = { proposalId: c.id, well: c.name, role: c.role, p50Days: c.afe.p50Days, emittedAt: new Date().toISOString() };
    const i = items.findIndex((x: { proposalId: string }) => x.proposalId === c.id);
    if (i >= 0) items[i] = item; else items.push(item);
    localStorage.setItem(SEQ_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

/** Handover → deliver the as-drilled package to Reservoir Management. */
export function emitToReservoirMgmt(c: WdCandidate) {
  try {
    const raw = localStorage.getItem(RM_KEY);
    const items = raw ? JSON.parse(raw) : [];
    const item = { well: c.name, role: c.role, formation: c.target.formation, tdTvd: c.trajectory.tdTvd, receivedAt: new Date().toISOString() };
    const i = items.findIndex((x: { well: string }) => x.well === c.name);
    if (i >= 0) items[i] = item; else items.push(item);
    localStorage.setItem(RM_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

export function isGateReached(c: WdCandidate, gate: WdCandidate['gate']): boolean {
  return gateIndex(c.gate) >= gateIndex(gate);
}
