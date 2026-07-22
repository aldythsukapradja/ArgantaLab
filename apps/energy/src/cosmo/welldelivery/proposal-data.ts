// proposal-data.ts — builds a WellProposal DRAFT from real wb data (index.json,
// traj-*.json, picks.json). Trajectory + sourceTarget are real (measured/
// interpreted); casingMud/completion/dataAcquisition/riskRegister/afe are
// synthesized starting points the user edits — all tagged dataNature: 'scenario'
// per WELL-DELIVERY-PROPOSAL-SPEC.md. Uses this well's own picks/trajectory as
// the analog reference (Volve has no "unspudded prospective well" registry).
import { loadIndex, loadPicks, loadTraj } from '../../wb/load';
import type { WellRow, Pick } from '../../wb/types';
import { trajectoryStats, closestApproach, type OffsetCandidate } from './trajectory-math';
import type { WellProposal } from './proposal-types';

function matchPicks(picks: Pick[], name: string): Pick[] {
  return picks.filter((p) => p.well === name || (p.source_well && p.source_well.endsWith('-' + name)));
}

function uid() {
  return 'wp-' + Math.random().toString(36).slice(2, 10);
}

/** Wells usable as offset candidates for the closest-approach calc — real traj + nearby surface loc. */
async function loadOffsetCandidates(wells: WellRow[], self: WellRow, limit = 6): Promise<OffsetCandidate[]> {
  const others = wells
    .filter((w) => w.name !== self.name && w.has.traj)
    .map((w) => ({ w, distXY: Math.hypot(w.x - self.x, w.y - self.y) }))
    .sort((a, b) => a.distXY - b.distXY)
    .slice(0, limit);
  const out: OffsetCandidate[] = [];
  for (const { w } of others) {
    try {
      const traj = await loadTraj(w.name);
      out.push({ well: w.name, surfaceX: w.x, surfaceY: w.y, stations: traj.stations });
    } catch { /* skip wells with a broken/missing traj file */ }
  }
  return out;
}

export async function draftProposalForWell(wellName: string): Promise<WellProposal> {
  const [index, picks] = await Promise.all([loadIndex(), loadPicks()]);
  const well = index.wells.find((w) => w.name === wellName);
  if (!well) throw new Error(`Unknown well: ${wellName}`);

  const myPicks = matchPicks(picks.picks, wellName).filter((p) => p.tvdss != null);
  const deepest = myPicks.reduce<Pick | null>((acc, p) => (!acc || p.md > acc.md ? p : acc), null);

  let trajBlock: WellProposal['trajectory'];
  if (well.has.traj) {
    const traj = await loadTraj(wellName);
    const stats = trajectoryStats(traj.stations);
    const offsets = await loadOffsetCandidates(index.wells, well);
    const closest = closestApproach(well.x, well.y, traj.stations, offsets);
    trajBlock = {
      surfaceX: well.x, surfaceY: well.y,
      kopMd: stats.kopMd, tdMd: stats.tdMd, tdTvd: stats.tdTvd, tdTvdss: deepest?.tvdss ?? null,
      maxInclDeg: stats.maxInclDeg, maxAziDeg: stats.maxAziDeg, maxDlsDeg30m: stats.maxDlsDeg30m,
      closestOffset: closest, dataNature: (traj.dataNature as 'measured' | 'interpreted') ?? 'measured',
    };
  } else {
    trajBlock = {
      surfaceX: well.x, surfaceY: well.y, kopMd: null,
      tdMd: well.td_md, tdTvd: well.td_tvd, tdTvdss: deepest?.tvdss ?? null,
      maxInclDeg: 0, maxAziDeg: 0, maxDlsDeg30m: 0, closestOffset: null, dataNature: 'interpreted',
    };
  }

  const now = new Date().toISOString();
  const proposal: WellProposal = {
    id: uid(), well: wellName, rev: 1, gate: 'SOR0', createdAt: now, updatedAt: now,
    sourceTarget: {
      well: wellName, x: well.x, y: well.y,
      formation: deepest?.surface ?? null, topMd: deepest?.md ?? null, topTvdss: deepest?.tvdss ?? null,
    },
    objective: `Deliver ${wellName} to its target interval${deepest ? ` (${deepest.surface})` : ''}, confirming reservoir presence and enabling ${well.role !== 'none' ? well.role : 'evaluation'}.`,
    successCriteria: [
      'Reach planned TD within the approved trajectory envelope',
      'Acquire the full data-acquisition matrix across the target interval',
      'No uncontrolled well-control or integrity event',
    ],
    trajectory: trajBlock,
    casingMud: [
      { section: 'Conductor', shoeMd: 150, mudWeightSg: 1.03 },
      { section: 'Surface', shoeMd: 900, mudWeightSg: 1.15 },
      { section: 'Intermediate', shoeMd: Math.round(trajBlock.tdMd * 0.6), mudWeightSg: 1.35 },
      { section: 'Production', shoeMd: Math.round(trajBlock.tdMd), mudWeightSg: 1.45 },
    ],
    completion: { type: 'Cased & perforated', intervals: 'TBD from post-drill logs', sandControl: 'None planned', stimulation: 'None planned' },
    dataAcquisition: ['LWD gamma/resistivity', 'Wireline triple-combo', 'MDT pressure points', 'Sidewall cores across target'],
    riskRegister: [
      { hazard: 'Shallow gas / shallow flow', severity: 'med', mitigation: 'Pilot hole + monitor while drilling surface section' },
      { hazard: 'Lost circulation in Utsira/Nordland', severity: 'med', mitigation: 'LCM pills staged, mud-weight window respected' },
      { hazard: 'Wellbore instability near target shale', severity: 'low', mitigation: 'Offset-calibrated mud weight, minimize open-hole exposure' },
    ],
    afe: { dryHoleUsd: 8_200_000, completionUsd: 2_100_000, totalUsd: 10_300_000, p50Days: 42 },
    dataNature: 'scenario',
  };
  return proposal;
}
