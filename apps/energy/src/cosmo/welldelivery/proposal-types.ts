// proposal-types.ts — retained for the in-progress Drilling Sequence (sequence/*)
// build, which reads approved proposals to seed the schedule. The interactive Well
// Delivery workspace itself now lives in src/tabs/welldelivery (WdCandidate model);
// this lighter WellProposal shape is the schedule bridge only.

export type ProposalGate = 'SOR0' | 'SOR1' | 'SOR2' | 'BOD' | 'APPROVED';

export interface SourceTarget {
  well: string;
  x: number; y: number;
  formation: string | null;
  topMd: number | null;
  topTvdss: number | null;
}

export interface TrajectorySummary {
  surfaceX: number; surfaceY: number;
  kopMd: number | null;
  tdMd: number; tdTvd: number; tdTvdss: number | null;
  maxInclDeg: number; maxAziDeg: number;
  maxDlsDeg30m: number;
  closestOffset: { well: string; distM: number } | null;
  dataNature: 'measured' | 'interpreted';
}

export interface CasingMudRow { section: string; shoeMd: number; mudWeightSg: number }
export interface RiskRow { hazard: string; severity: 'low' | 'med' | 'high'; mitigation: string }
export interface CompletionIntent { type: string; intervals: string; sandControl: string; stimulation: string }
export interface AfeSummary { dryHoleUsd: number; completionUsd: number; totalUsd: number; p50Days: number }

export interface WellProposal {
  id: string;
  well: string;
  rev: number;
  gate: ProposalGate;
  createdAt: string;
  updatedAt: string;
  sourceTarget: SourceTarget;
  objective: string;
  successCriteria: string[];
  trajectory: TrajectorySummary;
  casingMud: CasingMudRow[];
  completion: CompletionIntent;
  dataAcquisition: string[];
  riskRegister: RiskRow[];
  afe: AfeSummary;
  dataNature: 'scenario';
}

export interface DrillingScheduleItem {
  proposalId: string;
  well: string;
  p50Days: number;
  earliestStart: string | null;
  dependencies: string[];
  emittedAt: string;
}

export const GATE_ORDER: ProposalGate[] = ['SOR0', 'SOR1', 'SOR2', 'BOD', 'APPROVED'];
export const GATE_LABEL: Record<ProposalGate, string> = {
  SOR0: 'SOR0 · Concept', SOR1: 'SOR1 · Maturing', SOR2: 'SOR2 · Ready for BOD',
  BOD: 'Basis of Design', APPROVED: 'Approved for Sequence',
};
