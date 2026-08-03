// registry.ts — the Field Development Suite's 10-stage plan spine (D0 shell).
// Mirrors FIELD-DEVELOPMENT-SUITE-CONCEPT.md Part 6: left-to-right = the decision
// workflow = the FDP order. Each stage clones one industry tool and produces named
// artifacts once its engine lands (D1+); for now this is the shell's plan tree +
// header content only — no engine is wired.
export type StagePhase = 'Frame' | 'Reduce' | 'Design' | 'Predict' | 'Commit' | 'Decide';

/** Where a stage's artifacts stand — the plan tree IS the progress meter. */
export type StageStatus = 'untouched' | 'draft' | 'settled' | 'stale' | 'superseded';

export interface StageManifest {
  id: string;
  name: string;
  phase: StagePhase;
  clones: string;   // the industry tool this stage is a lightweight clone of
  produces: string; // named artifacts this stage will emit
  blurb: string;
  status: StageStatus; // D0: always 'untouched' — no engine wired yet
}

export const STAGES: StageManifest[] = [
  { id: 'asset', name: 'Asset', phase: 'Frame', clones: 'WoodMac · Rystad · IHS asset screen',
    produces: 'AssetFrame · AnalogCohort',
    blurb: 'Benchmark this field against its analog cohort before committing to a design.', status: 'untouched' },
  { id: 'subsurface', name: 'Subsurface Case', phase: 'Frame', clones: 'Petrel/RMS handoff review',
    produces: 'SubsurfaceCase',
    blurb: 'Seam A receiver — resolves Exploration’s handoff or synthesizes from the analog cohort.', status: 'untouched' },
  { id: 'appraisal', name: 'Appraisal & VOI', phase: 'Reduce', clones: 'GeoX · decision analysis',
    produces: 'AppraisalProgram',
    blurb: 'Which appraisal well kills the most uncertainty, and what it buys.', status: 'untouched' },
  { id: 'concept', name: 'Concept Select', phase: 'Design', clones: 'Merak · Aspen concept screening',
    produces: 'ConceptOption[] → Concept',
    blurb: 'Onshore/offshore, standalone/tieback/FPSO — the irreversible choice.', status: 'untouched' },
  { id: 'recovery', name: 'Recovery & Pattern', phase: 'Design', clones: 'Eclipse/IX + engineering judgment',
    produces: 'RecoveryScheme',
    blurb: 'Drive mechanism, pattern geometry, injector:producer ratio, expected sweep.', status: 'untouched' },
  { id: 'well', name: 'Well Design', phase: 'Design', clones: 'Petrel well design · drainage analysis',
    produces: 'WellDesign · PlannedWell[]',
    blurb: 'Well count, spacing, type and Joshi PI — the atom every downstream vertical reads.', status: 'untouched' },
  { id: 'facilities', name: 'Facilities & Drill Centres', phase: 'Design', clones: 'HYSYS-lite · facility sizing',
    produces: 'FacilityCase · DrillCentre[]',
    blurb: 'Plateau capacity, step-out reach, tieback vs new host.', status: 'untouched' },
  { id: 'forecast', name: 'Forecast', phase: 'Predict', clones: 'IX/Eclipse · Aries',
    produces: 'ProductionProfile',
    blurb: 'Build-up → plateau → decline, P10/P50/P90, per well and field.', status: 'untouched' },
  { id: 'schedule', name: 'Schedule & Phasing', phase: 'Commit', clones: 'Primavera P6-lite · Merak Peep',
    produces: 'DevelopmentSchedule · WellSequence',
    blurb: 'Seam B emitter — what Well Delivery and Drilling read next.', status: 'untouched' },
  { id: 'value', name: 'Value & FDP', phase: 'Decide', clones: 'Merak Peep · PlanningSpace',
    produces: 'EconomicCase · FDPDocument',
    blurb: 'NPV/IRR/payback, case compare, the FID gate.', status: 'untouched' },
];

// Maturity perspective (PRMS resource class) is a real, designed concept — see
// FIELD-DEVELOPMENT-SUITE-CONCEPT.md §1.3 — but it made the shell read as too
// complex too early. HIDDEN from the UI for now, not deleted: PERSPECTIVES/
// Perspective stay here, ready to re-attach a shell-wide control once the rest of
// the spine (scope store, cases) has settled. Nothing currently imports these.
export type Perspective = 'explore' | 'appraise' | 'develop' | 'produce' | 'rejuvenate' | 'retire';

export interface PerspectiveManifest {
  id: Perspective;
  label: string;
  prms: string;
  question: string;
}

export const PERSPECTIVES: PerspectiveManifest[] = [
  { id: 'explore', label: 'Explore', prms: 'prospective · 1U/2U/3U', question: 'Is there anything?' },
  { id: 'appraise', label: 'Appraise', prms: 'contingent · 1C/2C/3C', question: 'Is it commercial?' },
  { id: 'develop', label: 'Develop', prms: 'reserves · 1P/2P/3P', question: 'What do we build?' },
  { id: 'produce', label: 'Produce', prms: 'production', question: 'Are we on plan?' },
  { id: 'rejuvenate', label: 'Rejuvenate', prms: 'reserves + contingent', question: 'Infill, IOR, EOR?' },
  { id: 'retire', label: 'Retire', prms: 'unrecoverable', question: 'When to cease?' },
];

/** LOD scale router (concept doc Part 4/7.4) — now rendered inline with Scope,
 *  since "where am I" and "how zoomed in" are one navigation decision, not two. */
export type Lod = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export const LOD_OPTIONS: Array<{ id: Lod; label: string }> = [
  { id: 'L0', label: 'World' }, { id: 'L1', label: 'Basin' }, { id: 'L2', label: 'Field' },
  { id: 'L3', label: 'Structure' }, { id: 'L4', label: 'Well' },
];

/** Provenance ladder for the Plan Card's basis chips (Part 3.4 / 5.2). */
export type Basis = 'M' | 'R' | 'A' | 'U' | 'D';
export const BASIS_LABEL: Record<Basis, string> = {
  M: 'Measured', R: 'Regulator', A: 'Analog', U: 'User', D: 'Derived',
};

/** The 10 headline numbers on the Plan Card (Part 7.2). All pending in D0 — no
 *  engine is wired, so every metric shows its awaiting-stage state rather than a
 *  fabricated number. */
export interface PlanMetric {
  id: string;
  label: string;
  unit: string;
  awaits: string; // which stage id produces this
}
export const PLAN_METRICS: PlanMetric[] = [
  { id: 'wellCount', label: 'Well count', unit: '', awaits: 'well' },
  { id: 'spacing', label: 'Spacing', unit: 'm', awaits: 'well' },
  { id: 'wellType', label: 'Well type', unit: '', awaits: 'well' },
  { id: 'pattern', label: 'Pattern', unit: '', awaits: 'recovery' },
  { id: 'drillCentres', label: 'Drill centres', unit: '', awaits: 'facilities' },
  { id: 'plateau', label: 'Plateau rate', unit: 'kbd', awaits: 'forecast' },
  { id: 'firstOil', label: 'First oil', unit: '', awaits: 'schedule' },
  { id: 'recovery', label: 'Recovery factor', unit: '%', awaits: 'recovery' },
  { id: 'capex', label: 'Capex', unit: '$', awaits: 'facilities' },
  { id: 'npv10', label: 'NPV₁₀', unit: '$', awaits: 'value' },
];
