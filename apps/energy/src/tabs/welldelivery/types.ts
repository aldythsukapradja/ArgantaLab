// Well Delivery — domain types. A "candidate" is a NEW well or SIDETRACK proposed
// by Field Development (never an existing well), matured through the Capital Value
// Process gates. Model grounded in the researched Well Delivery Process (WDP):
// SOR/BoD → program → execute/geosteer → Final Well Report → handover to RM.
// See docs/arganta-energy/WELL-DELIVERY-PROPOSAL-SPEC.md.

export type Gate = 'assess' | 'select' | 'define' | 'sanction' | 'execute' | 'handover';

export const GATES: { id: Gate; label: string; dg: string; blurb: string }[] = [
  { id: 'assess', label: 'Assess', dg: 'DG1', blurb: 'Is there a well? Opportunity framed from the FDP / infill screen.' },
  { id: 'select', label: 'Select', dg: 'DG2', blurb: 'Concept chosen — target, well type, trajectory. SOR & Basis of Design.' },
  { id: 'define', label: 'Define', dg: 'DG3', blurb: 'Detailed design — casing, mud, program, hazards cleared.' },
  { id: 'sanction', label: 'Sanction', dg: 'FID', blurb: 'Ready to drill — the proposal case goes to the investment decision.' },
  { id: 'execute', label: 'Execute', dg: 'DG4', blurb: 'Drilling & geosteering; plan vs actual on bottom.' },
  { id: 'handover', label: 'Handover', dg: 'DG5', blurb: 'As-drilled package delivered to Reservoir Management.' },
];
export const gateIndex = (g: Gate) => GATES.findIndex((x) => x.id === g);

export type Severity = 'low' | 'med' | 'high';

export interface CasingRow { section: string; holeIn: number; csgIn: number; shoeMd: number; mudSg: number }
export interface MudPoint { md: number; poreSg: number; collapseSg: number; fracSg: number; mudSg: number }
export interface RiskRow { hazard: string; severity: Severity; likelihood: Severity; mitigation: string }
export interface BarrierEnvelope { name: 'Primary' | 'Secondary'; elements: string[]; verified: boolean }
export interface TopRow { name: string; prognosedMd: number; actualMd: number | null }
export interface NptRow { section: string; hours: number; cause: string }
export interface SteerStation { md: number; tvt: number; distToBoundary: number; inZone: boolean }
export interface ChecklistItem { item: string; done: boolean; owner: string }

export interface AsDrilled {
  tops: TopRow[];
  npt: NptRow[];
  daysPlan: number; daysActual: number;
  costPlanUsd: number; costActualUsd: number;
  inZonePct: number;
}

export interface WdCandidate {
  id: string;
  name: string;                    // e.g. "F-16" (infill producer)
  kind: 'new' | 'sidetrack';
  role: 'producer' | 'injector';
  parentWell?: string;             // sidetrack parent (real Volve well)
  gate: Gate;
  // subsurface origin — the FD target this well chases (real picks/anchors)
  target: { formation: string; anchorWell: string; x: number; y: number; tvdss: number; md: number };
  objective: string;
  successCriteria: string[];
  offsets: string[];               // real Volve wells used as offsets/analogs
  // design
  trajectory: { surfaceX: number; surfaceY: number; kopMd: number; tdMd: number; tdTvd: number; maxInclDeg: number; maxDlsDeg30m: number; profile: string };
  casing: CasingRow[];
  mudWindow: MudPoint[];
  barriers: BarrierEnvelope[];
  risks: RiskRow[];
  afe: { dryHoleUsd: number; complUsd: number; totalUsd: number; p50Days: number };
  dataAcq: string[];
  // execution / closeout (present once the well is on bottom)
  steering?: { typeWell: string; zoneThicknessM: number; stations: SteerStation[] };
  asDrilled?: AsDrilled;
  handover?: { checklist: ChecklistItem[]; sentToRm: boolean; sentAt: string | null };
  updatedAt: string;
}
