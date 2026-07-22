// explData.ts — the shared Exploration domain data, grounded in the REAL Volve
// petroleum system (Draupne source → Hugin reservoir → BCU seal, the 15/9-19
// discovery). Numbers are either measured/reported (wb assets, published Volve facts,
// cited) or explicit pre-drill SCENARIO (the risked prospect case, scored later
// against the known outcome). Nothing modelled is presented as measured.
// Sources: docs/arganta-energy/EXPLORATION-CONCEPT.md; public/wb/index.json; Sodir
// Factpages 15/9-19; Kieft/Milton (Volve Hugin); PEER Volve dynamic ≈22 MMSm³.
import type { DataNature } from '../../components/Provenance';
import type { GcosKey } from '../../engine/explore';
import type { McInput } from '../../engine/mc';

// ── Chronostratigraphy (the 16-surface bridge, PS roles) ─────────────────────────
export type PsRole = 'source' | 'reservoir' | 'seal' | 'overburden' | 'none';
export interface StratUnit {
  name: string; group: string;
  ageMa: [number, number];      // [top, base] Ma
  env: string;                  // depositional environment
  role: PsRole;                 // petroleum-system role
  roleNote?: string;
  nature: DataNature;
}

/** Jurassic–Recent column at the Volve/Sleipner area. Ages/roles [PEER Kieft/Milton;
 *  OFFICIAL Sodir lithostrat] — interpreted regional analogs, flagged. */
export const STRAT_COLUMN: StratUnit[] = [
  { name: 'Nordland Gp',  group: 'Nordland',  ageMa: [23, 0],    env: 'marine → glaciomarine', role: 'overburden', nature: 'interpreted' },
  { name: 'Utsira Fm',    group: 'Nordland',  ageMa: [15, 3],    env: 'shallow-marine sand', role: 'overburden', roleNote: 'regional aquifer', nature: 'interpreted' },
  { name: 'Hordaland Gp', group: 'Hordaland', ageMa: [34, 15],   env: 'marine mudstone', role: 'seal', roleNote: 'thick overburden seal', nature: 'interpreted' },
  { name: 'Shetland Gp',  group: 'Shetland',  ageMa: [100, 56],  env: 'marl / chalk', role: 'overburden', nature: 'interpreted' },
  { name: 'Ty Fm',        group: 'Rogaland',  ageMa: [61, 58],   env: 'submarine fan sst', role: 'reservoir', roleNote: 'secondary reservoir', nature: 'interpreted' },
  { name: 'BCU',          group: '—',         ageMa: [145, 145], env: 'unconformity', role: 'seal', roleNote: 'Base Cretaceous Unconformity — regional top-seal marker', nature: 'interpreted' },
  { name: 'Draupne Fm',   group: 'Viking',    ageMa: [157, 145], env: 'anoxic marine shale', role: 'source', roleNote: 'PRIMARY source + top seal (North Sea "hot shale")', nature: 'interpreted' },
  { name: 'Heather Fm',   group: 'Viking',    ageMa: [168, 150], env: 'offshore shale', role: 'source', roleNote: 'secondary source + seal', nature: 'interpreted' },
  { name: 'Hugin Fm',     group: 'Vestland',  ageMa: [168, 157], env: 'shallow-marine sst', role: 'reservoir', roleNote: 'PRIMARY reservoir (diachronous, younging S)', nature: 'interpreted' },
  { name: 'Sleipner Fm',  group: 'Vestland',  ageMa: [170, 165], env: 'fluvial', role: 'none', nature: 'interpreted' },
  { name: 'Skagerrak Fm', group: 'Hegre',     ageMa: [237, 201], env: 'fluvial redbeds', role: 'reservoir', roleNote: 'secondary reservoir', nature: 'interpreted' },
];

// ── The 5 GCoS elements as evidence cards (aligned to engine GcosKey) ─────────────
export interface PsElementEvidence {
  key: GcosKey;
  assessment: string;             // one-line verdict
  evidence: string[];             // real Volve evidence
  nature: DataNature;
}
export const PS_EVIDENCE: Record<GcosKey, PsElementEvidence> = {
  reservoir: { key: 'reservoir', assessment: 'Hugin Fm proven — good shallow-marine sandstone.', nature: 'measured',
    evidence: ['Hugin penetrated by 15/9-19 & all Volve wells', 'φ ≈ 0.22, N/G ≈ 0.9 (LFP logs)', 'Hugin Top/Base depth grids mapped'] },
  trap: { key: 'trap', assessment: 'Faulted dome on the Sleipner Terrace — four-way + fault dependence.', nature: 'interpreted',
    evidence: ['Hugin Top structural closure above OWC 3200 m', 'BCU & Hugin depth surfaces', 'salt-influenced (Permian Zechstein)'] },
  seal: { key: 'seal', assessment: 'Heather/Draupne shales + BCU regional seal — retention proven.', nature: 'interpreted',
    evidence: ['Draupne/Heather shales directly overlie Hugin', 'BCU regional top-seal marker', 'oil column retained to 3200 m OWC'] },
  charge: { key: 'charge', assessment: 'Draupne early-mature locally → charge from the deep Viking Graben kitchen.', nature: 'derived',
    evidence: ['Draupne TOC ~1.7–9.6%, HI up to 531 (Type II) [PEER]', 'oil window Ro ≈0.62–0.88% at ~3.4–4.4 km in the graben', 'Volve depth 2.7–3.1 km → migrated charge, not local'] },
  timing: { key: 'timing', assessment: 'Late-Jurassic trap pre-dates Cenozoic charge — timing works.', nature: 'derived',
    evidence: ['main rifting/trap ~157–145 Ma', 'graben subsidence drives generation later', 'migration access along faults into the Hugin trap'] },
};

// ── Prospect inventory (the drill-ready register) ────────────────────────────────
export type ProspectStatus = 'discovery' | 'prospect' | 'lead';
export interface Prospect {
  id: string; name: string; play: string; status: ProspectStatus;
  /** default chance factors per GCoS element (0..1) — interpreted, user-editable. */
  gcos: Record<GcosKey, number>;
  /** pre-drill volumetric uncertainty — SCENARIO. */
  mc: { grv: McInput; ntg: McInput; phi: McInput; sw: McInput; rf: McInput; bo: number };
  econ: { npvSuccess: number; dryHoleCost: number }; // $ — scenario
  nature: DataNature;
  note: string;
}

const mcInput = (key: string, label: string, min: number, mode: number, max: number): McInput =>
  ({ key, label, dist: 'pert', min, mode, max });

/** The Volve prospect as it would have looked PRE-DRILL (1993), plus two scenario
 *  satellite leads. Volve's realised outcome lives in VOLVE_OUTCOME for scoring. */
export const PROSPECTS: Prospect[] = [
  {
    id: 'volve', name: 'Volve (15/9-19 prospect)', play: 'Middle Jurassic Hugin, Sleipner Terrace', status: 'discovery',
    gcos: { reservoir: 0.90, trap: 0.78, seal: 0.82, charge: 0.72, timing: 0.85 },
    mc: {
      grv: mcInput('grv', 'GRV (m³)', 1.5e8, 2.6e8, 4.2e8),
      ntg: mcInput('ntg', 'Net-to-gross', 0.70, 0.88, 0.95),
      phi: mcInput('phi', 'Porosity', 0.18, 0.225, 0.26),
      sw:  mcInput('sw',  'Water saturation', 0.15, 0.20, 0.30),
      rf:  mcInput('rf',  'Recovery factor', 0.35, 0.50, 0.60),
      bo: 1.47,
    },
    econ: { npvSuccess: 320e6, dryHoleCost: 45e6 },
    nature: 'scenario',
    note: 'Pre-drill screening case near the proven Sleipner gas fairway. Scored against the real 15/9-19 oil discovery.',
  },
  {
    id: 'terrace-se', name: 'Sleipner Terrace SE lead', play: 'Hugin fault-dip closure', status: 'lead',
    gcos: { reservoir: 0.80, trap: 0.55, seal: 0.65, charge: 0.60, timing: 0.75 },
    mc: {
      grv: mcInput('grv', 'GRV (m³)', 0.6e8, 1.1e8, 2.0e8),
      ntg: mcInput('ntg', 'Net-to-gross', 0.55, 0.78, 0.90),
      phi: mcInput('phi', 'Porosity', 0.15, 0.20, 0.24),
      sw:  mcInput('sw',  'Water saturation', 0.20, 0.28, 0.40),
      rf:  mcInput('rf',  'Recovery factor', 0.28, 0.42, 0.55),
      bo: 1.47,
    },
    econ: { npvSuccess: 180e6, dryHoleCost: 42e6 },
    nature: 'scenario',
    note: 'Synthetic fault-dependent satellite lead — illustrates a marginal, higher-risk opportunity.',
  },
  {
    id: 'utsira-flank', name: 'Utsira High flank lead', play: 'Skagerrak/Hugin composite', status: 'lead',
    gcos: { reservoir: 0.65, trap: 0.45, seal: 0.55, charge: 0.50, timing: 0.70 },
    mc: {
      grv: mcInput('grv', 'GRV (m³)', 0.4e8, 0.8e8, 1.6e8),
      ntg: mcInput('ntg', 'Net-to-gross', 0.45, 0.65, 0.85),
      phi: mcInput('phi', 'Porosity', 0.12, 0.17, 0.22),
      sw:  mcInput('sw',  'Water saturation', 0.25, 0.35, 0.50),
      rf:  mcInput('rf',  'Recovery factor', 0.22, 0.35, 0.48),
      bo: 1.47,
    },
    econ: { npvSuccess: 120e6, dryHoleCost: 40e6 },
    nature: 'scenario',
    note: 'Synthetic frontier lead on the high flank — high risk, sub-economic EMV expected.',
  },
];

// ── The REAL Volve outcome (for prognosis-vs-actual / discovery scoring) ──────────
export interface VolveOutcome {
  discoveryWell: string; discoveryYear: number;
  reservoir: string; fluid: string;
  owcTvdss: number;
  inPlaceMMSm3: number;   // dynamic-model in-place [PEER]
  producedMMbbl: number;  // realised cumulative oil [OFFICIAL]
  producedYears: [number, number];
  nature: DataNature;
  refs: string[];
}
export const VOLVE_OUTCOME: VolveOutcome = {
  discoveryWell: '15/9-19 SR', discoveryYear: 1993,
  reservoir: 'Hugin Fm', fluid: 'undersaturated oil',
  owcTvdss: 3200,
  inPlaceMMSm3: 22,
  producedMMbbl: 63,
  producedYears: [2008, 2016],
  nature: 'reported',
  refs: ['Sodir Factpages 15/9-19', 'PEER Volve dynamic model ≈22 MMSm³', 'Equinor Volve open dataset'],
};

// ── Citations surfaced in-app ────────────────────────────────────────────────────
export const CITATIONS = {
  strat: 'PEER Kieft & Milton (Volve Hugin); OFFICIAL Sodir lithostrat',
  source: 'PEER — Draupne TOC/HI, Viking Graben oil window',
  thermal: 'PEER Slagstad/Pascal — Viking Graben heat flow ≈70 mW/m²',
  discovery: 'OFFICIAL Sodir Factpages · 15/9-19 SR, 1993',
  dynamic: 'PEER — Volve faulted dynamic model ≈22 MMSm³',
} as const;

/** MMSm³ ↔ MMbbl display helpers (oil). */
export const BBL_PER_SM3 = 6.2898;
export const toMMbbl = (sm3: number) => (sm3 / 1e6) * BBL_PER_SM3;
