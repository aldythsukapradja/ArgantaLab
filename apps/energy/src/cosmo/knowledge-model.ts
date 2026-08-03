// knowledge-model.ts — the ArgantaEnergy Knowledge Base graph model. CDF-style connected
// twin (data ↔ knowledge = one graph; FK = wikilink). SCALABLE to any number of fields:
// buildGraph(fields: FieldSeed[]) is field-agnostic; volveSeed(idx) adapts the real wb
// index. Content is hardened to industry-standard depth (SPE-PRMS · stage-gate · RGS/RM
// practice), rebranded (no Cosmo / Al Shaheen / vendor-agent names). Every note carries
// Obsidian frontmatter (aliases · tags · provenance · source · relations) and rich,
// densely-wikilinked bodies — export via note-export.ts drops into Obsidian plug-and-play.
import type { WbIndex } from '../wb/types';
import { SEED_ANALOGS } from '../engine/analog';
import { STRAT_COLUMN } from '../tabs/exploration/legacy/explData';
import { attributionFor, figuresForGeodynamics } from '../tabs/exploration/basin-figures';

export type KType =
  | 'field' | 'reservoir' | 'formation' | 'well' | 'petrophysics'
  | 'domain' | 'lifecycle' | 'output' | 'standard' | 'analog' | 'concept' | 'decision'
  | 'basin' | 'basin-cycle';
export type EdgeKind = 'contextualizes' | 'consumes' | 'produces' | 'covers' | 'evidences' | 'relates' | 'decides' | 'applies';
export type DataNature = 'measured' | 'interpreted' | 'derived' | 'reference';

export interface KNode {
  id: string; type: KType; title: string; field?: string; folder: string;
  tags: string[]; body: string; meta?: string;
  aliases?: string[]; provenance?: DataNature; source?: string;
  fm?: Record<string, string | string[]>; // extra frontmatter (wikilink relations etc.)
}
export interface KEdge { from: string; to: string; kind: EdgeKind }
export interface KGraph { nodes: KNode[]; edges: KEdge[] }

export const TYPE_COLOR: Record<KType, string> = {
  field: '#0FB5A6', reservoir: '#7c3aed', formation: '#8b5cf6', well: '#e11d74',
  petrophysics: '#22d3ee', domain: '#10b981', lifecycle: '#f59e0b', output: '#2563eb',
  standard: '#0a8a7f', analog: '#06b6d4', concept: '#64748b', decision: '#dc2626',
  basin: '#b45309', 'basin-cycle': '#ca8a04',
};
export const TYPE_LABEL: Record<KType, string> = {
  field: 'Field', reservoir: 'Reservoir', formation: 'Formation', well: 'Well',
  petrophysics: 'Petrophysics', domain: 'Data domain', lifecycle: 'Lifecycle', output: 'Output',
  standard: 'Standard', analog: 'Analog', concept: 'Concept', decision: 'Decision',
  basin: 'Basin', 'basin-cycle': 'Basin cycle',
};

const wl = (t: string) => `[[${t}]]`;
const wls = (ts: string[]) => ts.map(wl);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── the 7 data domains — hardened (columns · units · join · method · provenance) ──
type DomainDetail = {
  id: string; title: string; table: string; covers: string; provenance: DataNature; concept?: string;
  desc: string; columns: Array<[string, string]>; join: string; method: string;
};
export const DOMAINS: DomainDetail[] = [
  {
    id: 'logs', title: 'Logs', table: 'Well Logs', covers: 'well', provenance: 'measured', concept: 'Archie',
    desc: 'Depth-registered wireline & LWD curves — the primary rock-and-fluid measurement.',
    columns: [['Well', 'FK → Wells'], ['MD', 'm'], ['GR', 'gAPI'], ['RHOB', 'g/cc'], ['NPHI', 'v/v'], ['RT', 'ohm·m'], ['PHIE', 'v/v'], ['SWE', 'v/v'], ['VSH', 'v/v'], ['DT', 'µs/ft'], ['CALI', 'in']],
    join: 'Well → Wells.Well (1 well : N samples)', method: 'Environmentally-corrected curves; PHIE/SWE from density-neutron + Archie; Vsh from GR.',
  },
  {
    id: 'production', title: 'Production', table: 'Production', covers: 'well', provenance: 'measured', concept: 'Decline Curve Analysis',
    desc: 'Monthly allocated oil/gas/water production and water injection per well.',
    columns: [['Well', 'FK → Wells'], ['YearMonth', 'date'], ['Oil', 'Sm³'], ['Gas', 'Sm³'], ['Water', 'Sm³'], ['WaterInj', 'Sm³']],
    join: 'Well → Wells.Well (1 well : N months)', method: 'Allocated from test rates & uptime; latest-record-only for rate snapshots.',
  },
  {
    id: 'formation-tops', title: 'Reservoir · Formation Tops', table: 'Formation Tops', covers: 'formation', provenance: 'interpreted',
    desc: 'Stratigraphic marker picks per well, MD-ordered and tied to structure surfaces.',
    columns: [['Well', 'FK → Wells'], ['Surface', 'FK → Structure Surfaces'], ['MD', 'm'], ['TVDSS', 'm']],
    join: 'Well → Wells.Well · Surface → Structure Surfaces.Surface', method: 'Log-correlated picks; drives the structural framework & zonation.',
  },
  {
    id: 'structure-surfaces', title: 'Seismic · Structure Surfaces', table: 'Structure Surfaces', covers: 'formation', provenance: 'interpreted',
    desc: 'Gridded depth surfaces from seismic interpretation — the structural backbone.',
    columns: [['Surface', 'PK'], ['nx', '—'], ['ny', '—'], ['cell', 'm'], ['Zmin', 'm TVDSS'], ['Zmax', 'm TVDSS'], ['Points', '—']],
    join: 'Referenced by Formation Tops.Surface', method: 'Depth-converted seismic horizons; gridded for volumetrics & well planning.',
  },
  {
    id: 'petrophysics', title: 'Petrophysics · Defaults', table: 'Petro Defaults', covers: 'field', provenance: 'reference', concept: 'Archie',
    desc: 'Reservoir-wide petrophysical defaults & Archie parameters used where log detail is absent.',
    columns: [['Phi', 'v/v'], ['NTG', 'v/v'], ['Sw', 'v/v'], ['Archie_a', '—'], ['Archie_m', '—'], ['Archie_n', '—'], ['RF', 'fraction']],
    join: 'Field-level constant', method: 'Cut-offs & averages from core-calibrated logs; a/m/n from CCAL.',
  },
  {
    id: 'dynamic-pvt', title: 'Dynamic Param · PVT', table: 'PVT', covers: 'field', provenance: 'reference', concept: 'Volumetrics (STOIIP)',
    desc: 'Black-oil fluid properties at datum — the reservoir\'s dynamic fingerprint.',
    columns: [['Bo', 'rb/stb'], ['Rs', 'scf/stb'], ['Pi', 'bara'], ['Pb', 'bara'], ['T', '°C'], ['Datum', 'm TVDSS']],
    join: 'Field-level (PVT region)', method: 'Lab PVT (CCE/DL) matched to an EoS; undersaturated when Pi > Pb.',
  },
  {
    id: 'contacts', title: 'Contacts', table: 'Fluid Contacts', covers: 'field', provenance: 'interpreted',
    desc: 'Fluid contacts (OWC/GOC/GWC) that close the trap and set the hydrocarbon column.',
    columns: [['Kind', 'PK'], ['TVDSS', 'm'], ['DataNature', '—']],
    join: 'Field / reservoir level', method: 'From pressure gradients (WFT), logs, and the equilibration model.',
  },
];

// ── the 5 lifecycles — WORLD-CLASS DEEP (stage-gate · methods · decisions · KPIs) ──
type LC = {
  id: string; title: string; tag: string; mission: string;
  stages: Array<[string, string]>;  // [gate/stage, purpose]
  methods: string[]; decisions: string[]; kpis: string[]; roles: string[];
  standards: string[]; concepts: string[]; consumes: string[]; outputs: string[];
  handoffIn?: string; handoffOut: string;
};
export const LIFECYCLES: LC[] = [
  {
    id: 'exploration', title: 'Exploration', tag: 'find & assess',
    mission: 'Mature leads into drill-ready prospects, test them, and assess discovered volumes and risk — the front of the funnel that feeds the portfolio.',
    stages: [['G0 · Lead identification', 'Screen basin/play for leads on seismic + regional data'], ['G1 · Prospect maturation', 'Mature a lead to a risked, drillable prospect (petroleum-system complete)'], ['G2 · Drill-or-drop', 'Commit to drill, farm-in/out, or drop'], ['G3 · Post-well evaluation', 'Calibrate the model against the well result; book discovered resources']],
    methods: ['Seismic interpretation & attribute analysis', 'Play-fairway & petroleum-system modelling (source·reservoir·seal·trap·timing)', 'Geological Chance of Success (GCoS) risking', 'Prospect volumetrics (GRV·NTG·φ·Sh·1/Bo)', 'Monte-Carlo resource ranges (P90/P50/P10)'],
    decisions: ['Drill / drop / farm', 'Appraisal need & well count', 'Play-level portfolio ranking'],
    kpis: ['Prospects matured', 'Drill-ready inventory', 'Average GCoS %', 'Discovered / prospective resources', 'Finding cost'],
    roles: ['Explorationist', 'Geophysicist', 'Petroleum-systems analyst'],
    standards: ['Opportunity Maturation Process', 'Reserves & Resources Standard (PRMS)'],
    concepts: ['GCoS', 'Volumetrics (STOIIP)', 'PRMS'],
    consumes: ['structure-surfaces', 'logs', 'formation-tops'],
    outputs: ['Exploration Well Report', 'Appraisal Well Report', 'Prospect Evaluation', 'Play & Basin Assessment', 'Seismic Interpretation', 'Exploration Portfolio Review'],
    handoffOut: 'Field Development',
  },
  {
    id: 'field-development', title: 'Field Development', tag: 'model & plan',
    mission: 'Turn a discovery into a sanctioned development: build the static + dynamic model, quantify volumes and reserves, choose a concept, place the wells, and prove the economics.',
    stages: [['G1 · Appraise', 'Reduce subsurface uncertainty; static model + volumetrics'], ['G2 · Select', 'Screen concepts; recommend the value-optimal development'], ['G3 · Define / FID', 'Freeze the FDP; book reserves; sanction the investment'], ['Handover · Execute', 'Pass sanctioned well stock to Well Delivery & Drilling']],
    methods: ['Structural framework from surfaces + faults', 'Facies & property modelling (SIS / SGS)', 'Petrophysical evaluation (Vsh · φ · Sw-Archie · net pay)', 'Volumetrics — STOIIP = GRV·NTG·φ·(1−Sw)/Bo, P90/P50/P10', 'Dynamic simulation & history match', 'Well placement & drainage', 'Recovery factor from analogs', 'NPV / break-even economics'],
    decisions: ['Concept select', 'Final Investment Decision (FID)', 'Well count & placement', 'Plateau rate & offtake'],
    kpis: ['STOIIP / GIIP', '2P reserves', 'Recovery factor %', 'Wells sanctioned', 'Break-even', 'NPV'],
    roles: ['Reservoir engineer', 'Geomodeller', 'Petrophysicist', 'Development geologist'],
    standards: ['Reserves & Resources Standard (PRMS)', 'Static Modelling Guideline', 'Petrophysical Evaluation Standard'],
    concepts: ['Volumetrics (STOIIP)', 'Recovery Factor', 'Archie', 'PRMS', 'Stage-Gate'],
    consumes: ['structure-surfaces', 'formation-tops', 'logs', 'contacts', 'dynamic-pvt', 'petrophysics'],
    outputs: ['Field Development Plan (FDP)', 'Static Geological Model', 'Petrophysical Evaluation', 'Dynamic Simulation & History Match', 'Reserves & Volumetrics (PRMS)', 'FID Future Wells Register', 'Concept Select & Economics'],
    handoffIn: 'Exploration', handoffOut: 'Well Delivery',
  },
  {
    id: 'well-delivery', title: 'Well Delivery', tag: 'drill & complete',
    mission: 'Safely deliver each well to its reservoir target on time and cost, with a fit-for-purpose completion, and capture the lessons.',
    stages: [['G0 · SOR', 'Statement of Requirements — the well objective'], ['G1 · Well planning / BOD', 'Trajectory, casing, mud & completion design (Basis of Design)'], ['G2 · Program approval', 'Approve drilling & completion programs'], ['Execute · Drill → Complete', 'Drill, geosteer, run casing, complete & stimulate'], ['G3 · EOWR / Post-mortem', 'End-of-Well Report; predicted-vs-actual review']],
    methods: ['Trajectory design & anti-collision', 'Casing & mud-weight design', 'Pore-pressure / geomechanics', 'Landing & geosteering vs the model', 'Completion & stimulation design', 'Loss & NPT management'],
    decisions: ['Well type & trajectory', 'Casing points', 'Completion type', 'Sidetrack / bypass'],
    kpis: ['Days / 1000 ft', 'NPT %', 'Cost vs AFE', 'Target accuracy', 'Completion skin'],
    roles: ['Drilling engineer', 'Operations geologist', 'Completion engineer'],
    standards: ['Well Delivery Process', 'Completion & Stimulation Standard', 'Bean-Up Procedure'],
    concepts: ['Stage-Gate'],
    consumes: ['formation-tops'],
    outputs: ['Statement of Requirements (SOR)', 'Drilling Proposal', 'Basis of Design (BOD)', 'Drilling Program', 'Completion Program', 'End of Well Report (EOWR)', 'Daily Drilling Report'],
    handoffIn: 'Field Development', handoffOut: 'Reservoir Management',
  },
  {
    id: 'reservoir-management', title: 'Reservoir Management', tag: 'operate & optimize',
    mission: 'Maximise recovery and value from producing wells through continuous surveillance, voidage balance, forecasting, and opportunity maturation.',
    stages: [['Monitor', 'Acquire surveillance data per the plan (rates · pressures · 4D)'], ['Interpret', 'Well & pattern review; diagnose performance vs potential'], ['Forecast', 'Rolling forecast (RoFo) & reservoir potential'], ['Optimize', 'Bean-up/back, VRR balance, infill & workover opportunities'], ['Book', 'Update reserves & reconcile']],
    methods: ['Production / injection surveillance', 'Well testing & PVT sampling', 'Pressure & VRR analysis (VRR = ΣInj/ΣProd voidage)', '4D seismic monitoring', 'Decline-curve analysis & rolling forecast', 'Reservoir potential estimation (FPOT)', 'Opportunity maturation', 'Waterflood management'],
    decisions: ['Bean-up / bean-back', 'Infill & workover candidates', 'VRR target & offtake balance', 'Reserves re-booking'],
    kpis: ['Oil rate vs potential (FPOT)', 'Watercut %', 'VRR (~1.0 balanced)', 'Uptime %', 'Reserves replacement ratio', 'Forecast accuracy'],
    roles: ['Reservoir engineer (RGS)', 'Production technologist', 'Surveillance geoscientist'],
    standards: ['Reservoir Management Plan (RMP)', 'Reservoir Surveillance Plan', 'Rolling Forecast (RoFo) Guideline', 'Wells & Pattern Review', 'Reservoir Potential Estimation', 'Post-Mortem Standard', '4D Reservoir Management', 'Bean-Up Procedure'],
    concepts: ['VRR', 'Decline Curve Analysis', 'Reservoir Potential (FPOT)', 'Waterflood', 'History Match'],
    consumes: ['production', 'logs', 'contacts', 'dynamic-pvt'],
    outputs: ['Reservoir Management Plan (RMP)', 'Reservoir Surveillance Plan', 'Well Test & PVT', 'Pressure & VRR Review', 'Rolling Forecast & Potential', 'Daily Reservoir Performance', 'Well & Pattern Review', 'Well Post-Mortem'],
    handoffIn: 'Well Delivery', handoffOut: 'Drilling',
  },
  {
    id: 'drilling-sequence', title: 'Drilling', tag: 'schedule & sequence',
    mission: 'Convert the sanctioned well stock into a rig-by-time execution plan and manage its revisions under change control.',
    stages: [['G0 · Basis', 'Agree the scheduling basis (well stock, rigs, constraints)'], ['G1 · Schedule build', 'Phase wells by year; set RFSU/RFD milestones'], ['G2 · Rig program', 'Allocate rigs; multi-year utilisation plan'], ['Revision control', 'Version and log every sequence change']],
    methods: ['Rig scheduling & utilisation', 'Well-count phasing', 'RFSU / RFD milestone planning', 'Sequence-change control', 'Dependency management'],
    decisions: ['Drilling order', 'Rig allocation', 'Sequence changes', 'Milestone dates'],
    kpis: ['Wells / year', 'Rig utilisation %', 'Schedule adherence', 'Sequence-change count'],
    roles: ['Drilling scheduler', 'Development planner'],
    standards: ['Drilling Schedule Basis Standard'],
    concepts: ['Stage-Gate'],
    consumes: [],
    outputs: ['Drilling Schedule Basis', 'Rig Program', 'Drilling Schedule (Rev)', 'Sequence Change Log'],
    handoffIn: 'Field Development', handoffOut: 'Well Delivery',
  },
];

// ── company standards (rebranded from real subsurface SOP set) ──────────────────
type Std = { id: string; title: string; ref: string; desc: string; sections: string[]; appliesTo: string[] };
export const STANDARDS: Std[] = [
  { id: 'rmp', title: 'Reservoir Management Plan (RMP)', ref: 'STD-RES-002', desc: 'The master reservoir-management strategy per field — objectives, drive mechanism, depletion plan, surveillance and reserves.', sections: ['Objectives & KPIs', 'Drive mechanism & depletion strategy', 'Well & pattern strategy', 'Surveillance & data plan', 'Forecast & reserves', 'Review cadence'], appliesTo: ['reservoir-management', 'field-development'] },
  { id: 'surveillance', title: 'Reservoir Surveillance Plan', ref: 'STD-RES-003', desc: 'What data to acquire, at what frequency, to keep the model live and support decisions.', sections: ['Data types & frequency', 'Well test schedule', 'Pressure & PLT program', '4D acquisition', 'QA/QC & storage'], appliesTo: ['reservoir-management'] },
  { id: 'rofo', title: 'Rolling Forecast (RoFo) Guideline', ref: 'STD-RES-004', desc: 'The unconstrained rolling-forecast workflow — decline analysis, potential and reconciliation.', sections: ['Unconstrained potential', 'Decline models', 'Constraints & uptime', 'Reconciliation vs actuals'], appliesTo: ['reservoir-management'] },
  { id: 'wp-review', title: 'Wells & Pattern Review', ref: 'STD-RES-005', desc: 'Periodic well- and pattern-level performance review, offtake balance and actions.', sections: ['Well performance vs potential', 'Pattern VRR & connectivity', 'Actions register'], appliesTo: ['reservoir-management'] },
  { id: 'potential', title: 'Reservoir Potential Estimation', ref: 'STD-RES-006', desc: 'How First-Point-of-Time (FPOT) potential is estimated per well and rolled up.', sections: ['Well FPOT method', 'Roll-up & constraints', 'Uncertainty'], appliesTo: ['reservoir-management'] },
  { id: 'postmortem', title: 'Post-Mortem Standard', ref: 'STD-RMO-002', desc: 'Structured predicted-vs-actual review across disciplines after a well or project.', sections: ['Predicted vs actual', 'Discipline learnings', 'Model update actions'], appliesTo: ['reservoir-management', 'well-delivery'] },
  { id: '4d-rm', title: '4D Reservoir Management', ref: 'STD-RMO-001', desc: 'Using 4D (time-lapse) seismic to monitor sweep, pressure and saturation change.', sections: ['4D acquisition & processing', 'Softening / hardening interpretation', 'Model calibration'], appliesTo: ['reservoir-management'] },
  { id: 'opportunity', title: 'Opportunity Maturation Process', ref: 'STD-RGS-012', desc: 'The lead → opportunity → matured → executed funnel with stage gates.', sections: ['Funnel stages & gates', 'Screening criteria', 'Maturation deliverables'], appliesTo: ['exploration', 'reservoir-management'] },
  { id: 'completion', title: 'Completion & Stimulation Standard', ref: 'STD-WD-012', desc: 'Completion architecture and stimulation design for deliverability and sand control.', sections: ['Completion types', 'Stimulation design', 'Sand control', 'Skin management'], appliesTo: ['well-delivery'] },
  { id: 'beanup', title: 'Bean-Up Procedure', ref: 'STD-WP-003', desc: 'Controlled choke-management (bean-up/back) for producers and injectors to protect the reservoir.', sections: ['OP bean-up', 'WI bean-up', 'GI bean-up', 'Drawdown limits'], appliesTo: ['reservoir-management', 'well-delivery'] },
  { id: 'prms-std', title: 'Reserves & Resources Standard (PRMS)', ref: 'STD-RES-001', desc: 'SPE-PRMS classification of reserves (1P/2P/3P) and resources with reconciliation.', sections: ['PRMS classes', '1P/2P/3P definitions', 'Reconciliation & RRR', 'Governance'], appliesTo: ['field-development', 'reservoir-management', 'exploration'] },
  { id: 'data-standard', title: 'Subsurface Data Standard', ref: 'STD-DATA-001', desc: 'Minimum data model, provenance classes and evidence-native citation rules.', sections: ['Data model & join spine', 'Provenance classes', 'Citation & QA rules', 'Sovereignty'], appliesTo: ['field-development', 'reservoir-management', 'well-delivery', 'exploration', 'drilling-sequence'] },
  { id: 'charter', title: 'Subsurface Operating Charter', ref: 'CHTR-999', desc: 'The governance charter — roles, decision rights, approval rules and audit.', sections: ['Roles & decision rights', 'Approval rules', 'No self-approval', 'Audit'], appliesTo: ['field-development', 'reservoir-management', 'well-delivery', 'exploration', 'drilling-sequence'] },
  { id: 'static-model', title: 'Static Modelling Guideline', ref: 'STD-FD-002', desc: 'Structural framework, zonation, facies & property modelling standards.', sections: ['Framework & faults', 'Zonation', 'Facies (SIS)', 'Property (SGS) & upscaling'], appliesTo: ['field-development'] },
  { id: 'petro-eval', title: 'Petrophysical Evaluation Standard', ref: 'STD-FD-003', desc: 'Log QC, shale volume, porosity, saturation (Archie) and net-pay cut-offs.', sections: ['Log QC & environmental corrections', 'Vsh & porosity', 'Sw (Archie)', 'Net-pay cut-offs'], appliesTo: ['field-development'] },
  { id: 'well-delivery-proc', title: 'Well Delivery Process', ref: 'STD-WD-001', desc: 'The stage-gated well-delivery process from SOR to EOWR.', sections: ['SOR → BOD → Program', 'Execution & geosteering', 'EOWR & handover'], appliesTo: ['well-delivery'] },
  { id: 'schedule-basis', title: 'Drilling Schedule Basis Standard', ref: 'STD-DS-001', desc: 'The basis, constraints and change-control for the drilling sequence.', sections: ['Well stock & rigs', 'Constraints', 'Milestones', 'Change control'], appliesTo: ['drilling-sequence'] },
];

// ── concepts (fuller definitions) ──────────────────────────────────────────────
type Concept = { id: string; title: string; desc: string; body: string };
export const CONCEPTS: Concept[] = [
  { id: 'prms', title: 'PRMS', desc: 'Petroleum Resources Management System — the SPE reserves/resources classification.', body: 'Classifies recoverable volumes by commercial maturity and uncertainty: **Reserves** (commercial — 1P proved, 2P proved+probable, 3P +possible), **Contingent Resources** (discovered, sub-commercial) and **Prospective Resources** (undiscovered). Governs how volumes are booked and reconciled.' },
  { id: 'volumetrics-stoiip', title: 'Volumetrics (STOIIP)', desc: 'Stock-tank oil initially in place.', body: 'STOIIP = **GRV · NTG · φ · (1−Sw) / Boi**. GRV from structure & contacts; NTG·φ·Sw from petrophysics; Boi from PVT. Recoverable = STOIIP · **Recovery Factor**. Reported as P90/P50/P10 from the property realisations.' },
  { id: 'recovery-factor', title: 'Recovery Factor', desc: 'Fraction of in-place hydrocarbon ultimately produced.', body: 'RF depends on drive mechanism, rock quality and development. Estimated from **analogs**, material balance and dynamic simulation. Waterflooded sandstones typically 30–55%.' },
  { id: 'archie', title: 'Archie', desc: 'Water saturation from resistivity.', body: 'Sw = ((a · Rw) / (φ^m · Rt))^(1/n). Parameters a/m/n are calibrated from **CCAL** core. The core equation behind PHIE/SWE in the **Logs** domain.' },
  { id: 'vrr', title: 'VRR', desc: 'Voidage Replacement Ratio.', body: 'VRR = Σ(injection reservoir voidage) / Σ(production reservoir voidage). ≈1.0 balanced, <0.95 under-injecting (pressure decline risk), >1.10 over-injecting. The key **waterflood** surveillance metric.' },
  { id: 'dca', title: 'Decline Curve Analysis', desc: 'Empirical production forecasting.', body: 'Fits Arps (exponential/hyperbolic/harmonic) declines to rate-time history to forecast EUR. Feeds the **Rolling Forecast (RoFo) Guideline**.' },
  { id: 'fpot', title: 'Reservoir Potential (FPOT)', desc: 'First-Point-of-Time unconstrained potential.', body: 'The rate a well/field could produce with no surface constraint — the benchmark for measuring deferment and surveillance actions.' },
  { id: 'gcos', title: 'GCoS', desc: 'Geological Chance of Success.', body: 'Product of the independent petroleum-system risk factors (source · reservoir · seal · trap · timing). Multiplies prospect volumetrics to give risked resources in **Exploration**.' },
  { id: 'stage-gate', title: 'Stage-Gate', desc: 'Decision-gated project maturation.', body: 'Projects advance through gates (G0…G3) where evidence is reviewed and a fund/hold/kill decision is taken. Used across every lifecycle to control risk and spend.' },
  { id: 'history-match', title: 'History Match', desc: 'Calibrating the dynamic model to observed data.', body: 'Adjusts uncertain parameters until the simulation reproduces measured pressures and production, improving forecast confidence.' },
  { id: 'waterflood', title: 'Waterflood', desc: 'Secondary recovery by water injection.', body: 'Water injection maintains reservoir pressure and sweeps oil to producers. Managed by **VRR** balance and pattern reviews.' },
  { id: 'provenance', title: 'Provenance', desc: 'The data-truth ladder.', body: 'Every value carries a class — **measured · interpreted · derived · reference** — so a reader always knows whether a number was observed, interpreted, computed, or assumed. The heart of evidence-native.' },
  { id: 'evidence-native', title: 'Evidence-native', desc: 'Every claim cites its source.', body: 'No value appears without a source table and a **provenance** class. Missing data is flagged, never faked. The design principle of this knowledge base.' },
];

// ── basin & basin-cycle tier — the tectonostratigraphic comparability layer ─────
// A field's stratigraphy is grouped into named basin cycles (pre-rift/extensional/
// sag/compressional stages) — the unit Harry Doust's "Dissecting Sedimentary
// Basins" argues is more comparable across basins than the basin as a whole. Doust
// himself compiles from others (basin types after Kingston et al. 1983; facies
// associations after Walker & James 1992) — cited here ONLY for what is genuinely
// his: the cycle-as-comparable-unit thesis, his six grouping criteria, and his two
// papers (see concept:basin-cycle-framework below). Licence on the source PDF is
// UNRESOLVED — this is our own synthesis + citation, never the book's text/figures.
export type CycleGeodynamics = 'pre-rift' | 'extensional' | 'sag' | 'compressional';
export interface BasinCycleSeed {
  id: string; title: string; ageMa: [number, number]; env: string;
  geodynamics: CycleGeodynamics; stage: string; fill: 'marine' | 'non-marine' | 'mixed';
  lithology: string; role?: 'source' | 'reservoir' | 'seal' | 'overburden' | 'mixed';
  units: string[]; // formation/group names grouped into this cycle (from STRAT_COLUMN)
}
export interface BasinSeed {
  id: string; name: string; setting: string;
  usgsProvince?: { code: string; name: string };
  usgsTps?: { code: string; name: string };
  usgsAu?: { code: string; name: string };
  cycles: BasinCycleSeed[];
}

/** Published type sections for a cycle's geodynamic class, drawn from the basin-type
 *  figure library. Every entry carries its attribution inline — that credit is the
 *  condition the organization's clearance for this material rests on, so it travels
 *  with the note wherever the note is exported. */
function typeSections(geodynamics: CycleGeodynamics): string {
  const figures = figuresForGeodynamics(geodynamics);
  if (!figures.length) return '';
  return `## Published type sections\nComparable ${geodynamics} cycles described in the literature — use these to sanity-check this cycle's stacking pattern against basins elsewhere.\n\n`
    + figures.map((x) => `- **Fig. ${x.fig}** (p${x.page}) — ${x.caption}. *${attributionFor(x)}*`).join('\n')
    + `\n\nImages are held locally at \`public/doust-figures/\` and are cleared for internal scientific/educational use with attribution; they are not cleared for public redistribution.\n\n`;
}

/** Derive a cycle's age envelope/environment from the real STRAT_COLUMN units it
 *  groups — never re-typed ages, so this can't drift from the Exploration tab. */
function cycleFromUnits(
  id: string, title: string, stage: string, geodynamics: CycleGeodynamics,
  fill: BasinCycleSeed['fill'], lithology: string, role: BasinCycleSeed['role'], unitNames: string[],
): BasinCycleSeed {
  const units = STRAT_COLUMN.filter((u) => unitNames.includes(u.name));
  const tops = units.map((u) => u.ageMa[0]);
  const bases = units.map((u) => u.ageMa[1]);
  const env = Array.from(new Set(units.map((u) => u.env))).join(' / ');
  return { id, title, ageMa: [Math.max(...tops), Math.min(...bases)], env, geodynamics, stage, fill, lithology, role, units: unitNames };
}

/** Volve's stratigraphy grouped into 4 real tectonostratigraphic cycles. */
export const VOLVE_CYCLES: BasinCycleSeed[] = [
  cycleFromUnits('pre-rift', 'Pre-rift basin fill (Triassic)', 'pre-rift / early basin fill', 'pre-rift', 'non-marine', 'clastic (fluvial redbeds)', 'reservoir', ['Skagerrak Fm']),
  cycleFromUnits('early-climax-synrift', 'Early–climax syn-rift (Middle Jurassic)', 'early–climax syn-rift', 'extensional', 'mixed', 'clastic (sandstone)', 'reservoir', ['Sleipner Fm', 'Hugin Fm']),
  cycleFromUnits('late-synrift', 'Late syn-rift (Late Jurassic)', 'late syn-rift', 'extensional', 'marine', 'mudstone / shale', 'source', ['Heather Fm', 'Draupne Fm']),
  cycleFromUnits('postrift-sag', 'Post-rift sag (Cretaceous–Recent)', 'post-rift sag', 'sag', 'marine', 'mixed (mudstone / chalk / sandstone)', 'mixed', ['Shetland Gp', 'Ty Fm', 'Hordaland Gp', 'Utsira Fm', 'Nordland Gp']),
];

/** Viking Graben, grounded in the ATLAS spine's already-shipped USGS DDS-69 chain
 *  (src/atlas/volve.ts: province 4025 → TPS 402501 → AU 40250101). NOTE: that spine
 *  currently types the province itself as `'basin'` and names the AU "Viking
 *  Graben" — a naming shorthand from earlier work. This KB introduces the
 *  geodynamic Basin→BasinCycle tier that verified USGS research (2026-08-02) shows
 *  is genuinely missing (province = container, not a basin; TPS/AU = sparse,
 *  on-demand analytical layers) — see the basin node's own body for the reconciliation
 *  note. Reconciling the ATLAS spine's tier names is a separate, not-yet-done refactor.
 */
export const VOLVE_BASIN: BasinSeed = {
  id: 'viking-graben', name: 'Viking Graben', setting: 'failed-rift graben, Norwegian North Sea',
  usgsProvince: { code: '4025', name: 'North Sea Graben' },
  usgsTps: { code: '402501', name: 'Kimmeridgian Shales' },
  usgsAu: { code: '40250101', name: 'Viking Graben' },
  cycles: VOLVE_CYCLES,
};

// ── field ingestion contract (scalable) ─────────────────────────────────────────
export interface FieldSeed {
  id: string; name: string; crs: string; datum: string; basin?: string; operator?: string; aliases?: string[];
  basinModel?: BasinSeed; // optional geodynamic basin/cycle tier (see above)
  reservoir: string; reservoirAge?: string; reservoirLith?: string; drive?: string;
  formations: string[];
  contact?: { kind: string; tvdss: number; nature: string; prov?: string };
  pvt?: { Bo: number; Rs: number; Pi: number; Pb: number; T?: number; datum?: number };
  petro?: { phi: number; ntg: number; sw: number; a: number; m: number; n: number; rf?: number };
  wells: Array<{ name: string; role: string; isExploration?: boolean; aliases?: string[]; has: { logs: boolean; traj: boolean; production: boolean; picks: boolean } }>;
  analogRefs?: string[];
}

export function volveSeed(idx: WbIndex): FieldSeed {
  const c = idx.contacts[0];
  return {
    id: 'volve', name: 'Volve', crs: idx.crs, datum: idx.datum, basin: 'Sleipner area · Norwegian North Sea · block 15/9', operator: 'Equinor (open data)', aliases: ['15/9 Volve'],
    basinModel: VOLVE_BASIN,
    reservoir: 'Hugin Fm', reservoirAge: 'Middle Jurassic', reservoirLith: 'shallow-marine sandstone', drive: 'waterflood',
    formations: idx.surfaces.map((s) => s.name),
    contact: c ? { kind: c.kind, tvdss: c.tvdss, nature: c.dataNature, prov: c.prov } : undefined,
    pvt: { Bo: idx.pvt.Bo, Rs: idx.pvt.Rs, Pi: idx.pvt.Pi, Pb: idx.pvt.Pb, T: idx.pvt.T, datum: (idx.pvt as { datum_tvdss?: number }).datum_tvdss },
    petro: { phi: idx.defaults.phi, ntg: idx.defaults.ntg, sw: idx.defaults.sw, a: idx.defaults.archie.a, m: idx.defaults.archie.m, n: idx.defaults.archie.n, rf: idx.defaults.rf?.[1] },
    wells: idx.wells.map((w) => ({ name: w.name, role: w.role, isExploration: w.is_exploration, has: w.has })),
    analogRefs: ['Volve (published)', 'Waterflood · sandstone (typical)', 'Water drive · sandstone (strong)'],
  };
}

// ── the generator (field-agnostic; scales to N fields) ──────────────────────────
export function buildGraph(fields: FieldSeed[]): KGraph {
  const nodes: KNode[] = [];
  const edges: KEdge[] = [];
  const add = (n: KNode) => { nodes.push(n); return n.id; };
  const link = (from: string, to: string, kind: EdgeKind) => edges.push({ from, to, kind });

  // ---- shared: data domains ----
  DOMAINS.forEach((d) => {
    add({
      id: 'domain:' + d.id, type: 'domain', title: d.title, folder: '05_Data', tags: ['data', 'domain', d.id],
      aliases: [d.table], // the Data-tab table name resolves to this domain note ([[Well Logs]] → Logs)
      meta: d.table, provenance: d.provenance, source: 'ArgantaEnergy data model',
      fm: { table: wl(d.table), ...(d.concept ? { concept: wl(d.concept) } : {}) },
      body: `# ${d.title}\n\n> Data domain — table ${wl(d.table)} · provenance **${d.provenance}**.\n\n${d.desc}\n\n## Schema\n| Column | Unit / role |\n|---|---|\n${d.columns.map(([c, u]) => `| \`${c}\` | ${u} |`).join('\n')}\n\n## Join\n${d.join}\n\n## Method\n${d.method}\n\n## Context\nCovers each field's **${d.covers}** entities; a foreign key resolves to the individual well or formation note — a key **is** a wikilink.${d.concept ? `\n\nSee ${wl(d.concept)}.` : ''}\n\n## Evidence\nSource: the ${d.title} table · class *${d.provenance}*.`,
    });
    if (d.concept) link('domain:' + d.id, 'concept:' + slugConcept(d.concept), 'relates');
  });

  // ---- shared: concepts ----
  CONCEPTS.forEach((c) => add({ id: 'concept:' + c.id, type: 'concept', title: c.title, folder: '09_Concepts', tags: ['concept'], provenance: 'reference', source: 'Industry doctrine (SPE / RGS)', meta: c.desc, body: `# ${c.title}\n\n> ${c.desc}\n\n${c.body}` }));

  // ---- shared: basin-cycle framework (cite the parent, not the compiler) ----
  add({
    id: 'concept:basin-cycle-framework', type: 'concept', title: 'Basin-cycle framework', folder: '09_Concepts',
    tags: ['concept', 'reference', 'citation-ladder'], provenance: 'reference',
    source: 'Doust 2003 First Break 21(9); Beglinger, Corver, Doust, Cloetingh & Thurmond 2012 AAPG Bull 96(6); USGS DDS-060/ScienceBase (verified 2026-08-02)',
    meta: 'The classification approach behind every basin’s cycle stack',
    body: `# Basin-cycle framework

> Reference concept · provenance **reference** · the classification approach behind ${wl('Viking Graben')}'s basin cycles.

## Thesis (cite: Doust)
Sedimentary basins are unique composites, but their tectonostratigraphic **cycles** recur across basins with comparable character — the cycle, not the whole basin, is the more useful unit for comparison and analogue-building. This comparability argument, and the six grouping criteria below, are due to **Harry Doust** (emeritus professor of Regional Geology, VU Amsterdam), *"Dissecting Sedimentary Basins"*. Licence on that specific PDF is **unresolved** — this note encodes the idea and cites the primaries, never the book's text or figures.

## Grouping criteria (Doust)
A cycle is classified by: basin-cycle geometry · marine vs non-marine fill · proximal vs distal (if marine) · climate (tropical / arid / continental / temperate) · clastic vs carbonate · whether the depositional environment changed within the cycle.

## Doust's own cited work (his genuinely original contribution)
- Doust, H. 2003. *Placing petroleum systems and plays in their basin history context.* First Break 21(9): 73–83.
- Beglinger, S.E., Corver, M.P., Doust, H., Cloetingh, S. & Thurmond, A.K. 2012. *A new approach to relating petroleum system and play development to basin evolution.* AAPG Bulletin 96(6): 953–982.

## USGS grounding (independently verified 2026-08-02, high confidence)
The Province → Total Petroleum System → Assessment Unit hierarchy is itself a real precedent for treating the geodynamic entity (TPS: source + essential elements + generation-migration-accumulation-trap processes, "a naturally occurring, mappable hydrocarbon-fluid system") as distinct from the spatial container (Province: lithology/age/structural-style — *"[s]ome provinces include multiple genetically-related basins"*). Sources: USGS ScienceBase \`60ad2fd7d34e4043c850edb3\` / \`60ad2fa1d34e4043c850ed98\`; USGS DDS-060 \`PS.pdf\`/\`IN.pdf\` (public domain).

## What is NOT verified
The other basin-classification schemes sometimes compared to Doust's (Kingston et al. 1983 basin types, Bally & Snelson 1980, Ingersoll & Busby's plate-tectonic classification, Klemme) have **not** been independently corroborated by ArgantaEnergy's own research pass (2026-08-02, two runs, 107 agents). Do not cite specific claims about them as verified fact — including basin-type/geodynamic-context labels used on this platform's own cycle nodes, which are our own generic rift-basin vocabulary (pre-rift → syn-rift → post-rift sag), not a specific external classification.

## Figure sourcing (2026-08-03)
All 49 figures in Doust's booklet have been classified against the complete source PDF: 17 are his own uncited drawings (candidates to ask him about directly), 31 name a specific external author/publisher as the rightsholder (citation, not license — permission runs through them, not Doust), and 1 is compiled from unnamed sources. Two of the 31 ("external") figures actually cite Doust's own earlier co-authored papers (Doust & Sumner 2007; Beglinger et al. 2012), a simpler permission case. Full table: \`docs/arganta-energy/knowledge-base/doust-basin-figures/README.md\` and the master workbook's "Doust Figure Sourcing" tab. No image bytes have been extracted or stored anywhere.

## Licence
Cite the primary papers above for anything attributable to Doust's own thesis. Never reproduce Doust's figures or text — redraw any diagram from primary data in ArgantaEnergy's own visual language.`,
  });

  // ---- shared: standards ----
  STANDARDS.forEach((s) => {
    add({
      id: 'standard:' + s.id, type: 'standard', title: s.title, folder: '08_Standards', tags: ['standard', s.ref.toLowerCase()],
      meta: s.ref, provenance: 'reference', source: 'ArgantaEnergy subsurface standards',
      fm: { ref: s.ref, applies_to: wls(s.appliesTo.map((l) => LIFECYCLES.find((x) => x.id === l)!.title)) },
      body: `# ${s.title}\n\n> Company standard · \`${s.ref}\` · provenance **reference**.\n\n${s.desc}\n\n## Contents\n${s.sections.map((x) => '- ' + x).join('\n')}\n\n## Applies to\n${s.appliesTo.map((l) => '- ' + wl(LIFECYCLES.find((x) => x.id === l)!.title)).join('\n')}`,
    });
    s.appliesTo.forEach((l) => link('lifecycle:' + l, 'standard:' + s.id, 'applies'));
  });

  // ---- shared: lifecycles + outputs (world-class deep) ----
  LIFECYCLES.forEach((lc) => {
    const lid = 'lifecycle:' + lc.id;
    add({
      id: lid, type: 'lifecycle', title: lc.title, folder: '06_Lifecycles', tags: ['lifecycle', lc.id],
      meta: lc.tag, provenance: 'reference', source: 'Industry doctrine (SPE-PRMS · stage-gate · RGS/RM)',
      fm: {
        stage_gate: lc.stages.map((s) => s[0]),
        outputs: wls(lc.outputs), standards: wls(lc.standards),
        consumes: wls(lc.consumes.map((c) => DOMAINS.find((d) => d.id === c)!.title)),
        handoff_out: wl(lc.handoffOut), ...(lc.handoffIn ? { handoff_in: wl(lc.handoffIn) } : {}),
      },
      body: `# ${lc.title}\n\n> Lifecycle workstream · *${lc.tag}* · provenance **reference**.\n\n${lc.mission}\n\n## Stage-gate workflow\n${lc.stages.map(([g, p]) => `- **${g}** — ${p}`).join('\n')}\n\n## Methods\n${lc.methods.map((m) => '- ' + m).join('\n')}\n\n## Decisions\n${lc.decisions.map((d) => '- ' + d).join('\n')}\n\n## KPIs\n${lc.kpis.map((k) => '- ' + k).join('\n')}\n\n## Deliverables (outputs)\n${lc.outputs.map((o) => '- ' + wl(o)).join('\n')}\n\n## Data consumed\n${lc.consumes.map((c) => '- ' + wl(DOMAINS.find((d) => d.id === c)!.title)).join('\n') || '- —'}\n\n## Standards applied\n${lc.standards.map((s) => '- ' + wl(s)).join('\n')}\n\n## Key concepts\n${lc.concepts.map((c) => '- ' + wl(c)).join('\n')}\n\n## Roles\n${lc.roles.map((r) => '- ' + r).join('\n')}\n\n## Hand-offs\n${lc.handoffIn ? `- **In** ← ${wl(lc.handoffIn)}\n` : ''}- **Out** → ${wl(lc.handoffOut)}`,
    });
    lc.consumes.forEach((c) => link(lid, 'domain:' + c, 'consumes'));
    lc.concepts.forEach((c) => link(lid, 'concept:' + slugConcept(c), 'relates'));
    lc.outputs.forEach((o) => {
      const oid = 'output:' + slug(o);
      if (!nodes.some((n) => n.id === oid)) add({
        id: oid, type: 'output', title: o, folder: '07_Outputs', tags: ['output', lc.id], meta: lc.title, provenance: 'derived',
        source: 'Generated deliverable', fm: { lifecycle: wl(lc.title) },
        body: `# ${o}\n\n> Deliverable produced by ${wl(lc.title)} · provenance **derived**.\n\nProduced within the ${wl(lc.title)} workstream. Cites the wells, formations and data domains it is built from; feeds decisions and downstream lifecycles.\n\n## Built from\n${lc.consumes.map((c) => '- ' + wl(DOMAINS.find((d) => d.id === c)!.title)).join('\n') || '- workstream analysis'}\n\n## Governed by\n${lc.standards.map((s) => '- ' + wl(s)).join('\n')}`,
      });
      link(lid, oid, 'produces');
    });
  });

  // ---- shared: analogs ----
  SEED_ANALOGS.forEach((a) => add({
    id: 'analog:' + slug(a.name), type: 'analog', title: a.name, folder: '10_Analogs', tags: ['analog', a.confidence, a.lithology, a.drive],
    meta: `RF ${(a.recoveryFactor * 100).toFixed(0)}% · ${a.confidence}`, provenance: 'reference', source: a.source,
    fm: { lithology: a.lithology, drive: a.drive, recovery_factor: (a.recoveryFactor * 100).toFixed(0) + '%', confidence: a.confidence },
    body: `# ${a.name}\n\n> Reservoir analog · **${a.lithology}** · drive **${a.drive}** · confidence *${a.confidence}*.\n\n- Recovery factor: **${(a.recoveryFactor * 100).toFixed(0)}%**\n${a.porosity ? `- Porosity: ${(a.porosity * 100).toFixed(0)}%\n` : ''}${a.permMd ? `- Permeability: ${a.permMd} mD\n` : ''}${a.depthM ? `- Depth: ~${a.depthM} m\n` : ''}${a.oilAPI ? `- Oil gravity: ${a.oilAPI}° API\n` : ''}\n## Use\nAn analog prior for ${wl('Recovery Factor')} estimation in ${wl('Field Development')}.\n\n## Evidence\nSource: ${a.source} · class *reference*.`,
  }));

  // ---- per-field: field → reservoir/formations → wells → petrophysics → decisions ----
  fields.forEach((f) => {
    const fid = 'field:' + f.id;
    add({
      id: fid, type: 'field', title: f.name, field: f.id, folder: '01_Fields', tags: ['field', f.id],
      aliases: f.aliases, meta: f.basin, provenance: 'measured', source: `${f.operator || ''} field data`,
      fm: { reservoir: wl(f.reservoir), crs: f.crs, datum: f.datum, operator: f.operator || '—', wells: String(f.wells.length), lifecycle: wls(LIFECYCLES.map((l) => l.title)) },
      body: `# ${f.name}\n\n> Field asset · ${f.basin || ''} · operator ${f.operator || '—'} · provenance **measured**.\n\n## Overview\n- CRS: \`${f.crs}\` · datum ${f.datum}\n- Reservoir: ${wl(f.reservoir)} (${f.reservoirAge || ''} ${f.reservoirLith || ''})\n- Drive: ${f.drive || '—'}\n- Wells: **${f.wells.length}** (${f.wells.filter((w) => w.role === 'producer' || w.role === 'both').length} producers · ${f.wells.filter((w) => w.role === 'injector' || w.role === 'both').length} injectors · ${f.wells.filter((w) => w.isExploration).length} exploration)\n\n## Stratigraphy (top → base)\n${f.formations.map((fm) => '- ' + wl(fm)).join('\n')}\n${f.contact ? `\n## Fluid contact\n- ${f.contact.kind} @ **${f.contact.tvdss} m TVDSS** · *${f.contact.nature}*${f.contact.prov ? ` · ${f.contact.prov}` : ''}\n` : ''}${f.pvt ? `\n## PVT\n- Bo ${f.pvt.Bo} · Rs ${f.pvt.Rs} · Pi ${f.pvt.Pi} · Pb ${f.pvt.Pb} bara${f.pvt.T ? ` · T ${f.pvt.T} °C` : ''} → see ${wl('Dynamic Param · PVT')}\n` : ''}\n## Lifecycle context\nRun through all five workstreams: ${LIFECYCLES.map((l) => wl(l.title)).join(' → ')}.\n\n## Evidence\nSource: ${f.operator || 'field'} data · CRS ${f.crs}.`,
    });

    const rid = `reservoir:${f.id}:${slug(f.reservoir)}`;
    add({
      id: rid, type: 'reservoir', title: f.reservoir, field: f.id, folder: '02_Formations', tags: ['reservoir', f.id], meta: f.name,
      provenance: 'interpreted', source: `${f.name} static model`,
      fm: { field: wl(f.name), age: f.reservoirAge || '—', lithology: f.reservoirLith || '—', drive: f.drive || '—' },
      body: `# ${f.reservoir}\n\n> Primary reservoir of ${wl(f.name)} · ${f.reservoirAge || ''} ${f.reservoirLith || ''} · provenance **interpreted**.\n\n${f.contact ? `- ${f.contact.kind} @ **${f.contact.tvdss} m TVDSS**\n` : ''}- Drive mechanism: **${f.drive || '—'}** → ${wl('Waterflood')}\n- Mapped by ${wl('Seismic · Structure Surfaces')}; picked in ${wl('Reservoir · Formation Tops')}; sampled by ${wl('Logs')}.\n- Fluid: ${wl('Dynamic Param · PVT')} · saturation via ${wl('Archie')}.\n\n## Volumetrics\nSTOIIP built per ${wl('Volumetrics (STOIIP)')}; recovery from ${wl('Recovery Factor')} + ${(f.analogRefs || []).map(wl).join(' · ')}.`,
    });
    link(rid, fid, 'contextualizes');

    // ---- basin & basin-cycle tier (optional — real content only where grounded) ----
    if (f.basinModel) {
      const bm = f.basinModel;
      const bid = `basin:${slug(bm.id)}`;
      add({
        id: bid, type: 'basin', title: bm.name, field: f.id, folder: '12_Basins', tags: ['basin', f.id],
        meta: bm.setting, provenance: 'interpreted', source: 'USGS DDS-69 province/TPS/AU + regional stratigraphy',
        fm: { field: wl(f.name), cycles: wls(bm.cycles.map((c) => c.title)) },
        body: `# ${bm.name}\n\n> Basin (geodynamic entity) hosting ${wl(f.name)} · ${bm.setting} · provenance **interpreted**.\n\n` +
          `## USGS lineage (independently verified 2026-08-02 against USGS DDS-69 / ScienceBase)\n` +
          (bm.usgsProvince ? `- Province **${bm.usgsProvince.code}** "${bm.usgsProvince.name}" — a descriptive spatial container (lithology / age / structural style), not itself a basin or a process classification; a province may bundle several genetically-related basins.\n` : '') +
          (bm.usgsTps ? `- Total Petroleum System **${bm.usgsTps.code}** "${bm.usgsTps.name}" — the process/fluid entity: essential elements + generation-migration-accumulation + trap formation, all petroleum from one pod (or related pods) of active source rock; defined only inside assessed provinces.\n` : '') +
          (bm.usgsAu ? `- Assessment Unit **${bm.usgsAu.code}** "${bm.usgsAu.name}" — the populated, on-demand resource-assessment unit.\n` : '') +
          `\n> **Naming note.** The ATLAS spine (\`src/atlas/\`) currently types the province (${bm.usgsProvince?.code}) itself as \`'basin'\`, and names the AU (${bm.usgsAu?.code}) "${bm.usgsAu?.name}" — a shorthand from earlier work. This Knowledge Base introduces the geodynamic **Basin → BasinCycle** tier that verified USGS research shows is genuinely missing (province is a container, not a basin; TPS/AU is a sparse, on-demand layer). Reconciling the ATLAS spine's tier names to match is a separate, not-yet-done refactor — flagged here, not silently changed.\n\n` +
          `## Basin cycles (tectonostratigraphic stack, oldest → youngest)\n${bm.cycles.map((c) => `- ${wl(c.title)} — ${c.stage} (${c.ageMa[0]}–${c.ageMa[1]} Ma)`).join('\n')}\n\n` +
          `## Method\nCycles group the real ${wl(f.name)} stratigraphic column into tectonostratigraphic stages — the comparability argument (cycle, not whole basin, as the unit) follows ${wl('Basin-cycle framework')}; the specific geodynamic-context/stage labels are ArgantaEnergy's own generic rift-basin vocabulary, not a cited external classification.`,
      });
      link(bid, fid, 'contextualizes');

      bm.cycles.forEach((c) => {
        const cid = `basin-cycle:${f.id}:${slug(c.id)}`;
        add({
          id: cid, type: 'basin-cycle', title: c.title, field: f.id, folder: '13_Cycles', tags: ['basin-cycle', f.id, c.geodynamics],
          meta: `${c.ageMa[0]}–${c.ageMa[1]} Ma · ${c.geodynamics}`, provenance: 'interpreted',
          source: 'Regional stratigraphy [PEER Kieft/Milton; OFFICIAL Sodir lithostrat] + ArgantaEnergy cycle grouping',
          fm: { basin: wl(bm.name), units: c.units, geodynamics: c.geodynamics, fill: c.fill, lithology: c.lithology },
          body: `# ${c.title}\n\n> Basin cycle · ${c.stage} · **${c.geodynamics}** · ${c.ageMa[0]}–${c.ageMa[1]} Ma · provenance **interpreted**.\n\n` +
            `## Units in this cycle\n${c.units.map((u) => '- ' + u).join('\n')}\n\n` +
            `## Character\n- Depositional fill: **${c.fill}**\n- Lithology: ${c.lithology}\n- Environment: ${c.env}\n${c.role ? `- Dominant petroleum-system role: **${c.role}**\n` : ''}\n` +
            `## Comparability\nThe cycle — not the whole basin — is the unit ${wl('Basin-cycle framework')} treats as comparable across basins worldwide; a future analogue engine can match on this cycle's signature (geodynamics · stage · fill · lithology) rather than field-level similarity.\n\n` +
            typeSections(c.geodynamics) +
            `## Evidence\nUnit ages/roles: [PEER Kieft/Milton; OFFICIAL Sodir lithostrat]${c.units.includes(f.reservoir) ? ` (see ${wl(f.reservoir)})` : ''}. Cycle grouping: ArgantaEnergy synthesis, method per ${wl('Basin-cycle framework')}.`,
        });
        link(cid, bid, 'contextualizes');
        link(cid, 'concept:basin-cycle-framework', 'applies');
        if (c.units.includes(f.reservoir)) link(cid, rid, 'relates');
      });
    }

    f.formations.forEach((fm) => {
      const fmid = `formation:${f.id}:${slug(fm)}`;
      add({ id: fmid, type: 'formation', title: fm, field: f.id, folder: '02_Formations', tags: ['formation', f.id], meta: f.name, provenance: 'interpreted', source: `${f.name} structure surfaces`, fm: { field: wl(f.name) }, body: `# ${fm}\n\n> Stratigraphic surface / unit in ${wl(f.name)} · provenance **interpreted**.\n\nMapped from ${wl('Seismic · Structure Surfaces')} and picked per well in ${wl('Reservoir · Formation Tops')}. Part of the ${wl(f.name)} stratigraphy.` });
      link(fmid, fid, 'contextualizes');
      link('domain:structure-surfaces', fmid, 'covers');
    });

    f.wells.forEach((w) => {
      const wid = `well:${f.id}:${slug(w.name)}`;
      const roleWord = w.isExploration ? 'exploration' : w.role;
      add({
        id: wid, type: 'well', title: w.name, field: f.id, folder: '03_Wells', tags: ['well', f.id, w.isExploration ? 'exploration' : w.role],
        aliases: w.aliases, meta: `${f.name} · ${roleWord}`, provenance: 'measured', source: `${f.name} WB master`,
        fm: { field: wl(f.name), reservoir: wl(f.reservoir), role: roleWord, ...(w.has.logs ? { petrophysics: wl(`${w.name} · Petrophysics`) } : {}), data: buildDataLinks(w), lifecycle: wls(LIFECYCLES.map((l) => l.title)) },
        body: `# ${w.name}\n\n> Wellbore in ${wl(f.name)} · reservoir ${wl(f.reservoir)} · role **${roleWord}** · provenance **measured**.\n\n## Context\n- Field: ${wl(f.name)} · reservoir ${wl(f.reservoir)}\n- Penetrates: ${f.formations.slice(0, 4).map(wl).join(' · ')}\n\n## Data coverage\n${w.has.logs ? '- ' + wl('Logs') + ' — wireline curves (→ ' + wl(`${w.name} · Petrophysics`) + ')\n' : ''}${w.has.traj ? '- Trajectory — deviation survey\n' : ''}${w.has.production ? '- ' + wl('Production') + ' — monthly history\n' : ''}${w.has.picks ? '- ' + wl('Reservoir · Formation Tops') + ' — formation picks\n' : ''}\n## Lifecycle journey\n${wl('Exploration')} → ${wl('Field Development')} (placement) → ${wl('Drilling')} (slot) → ${wl('Well Delivery')} (drill & complete) → ${wl('Reservoir Management')} (${w.has.production ? 'produce & optimize' : 'monitor'})\n\n## Evidence\nSource: ${f.name} WB master · role ${roleWord}.`,
      });
      link(wid, fid, 'contextualizes');
      link(wid, rid, 'contextualizes');
      if (w.has.logs) link('domain:logs', wid, 'covers');
      if (w.has.production) link('domain:production', wid, 'covers');
      if (w.has.picks) link('domain:formation-tops', wid, 'covers');
      if (w.has.logs) {
        const pid = `petro:${f.id}:${slug(w.name)}`;
        add({ id: pid, type: 'petrophysics', title: `${w.name} · Petrophysics`, field: f.id, folder: '04_Petrophysics', tags: ['petrophysics', f.id], meta: w.name, provenance: 'interpreted', source: `${w.name} logs (${f.name})`, fm: { well: wl(w.name), reservoir: wl(f.reservoir), curves: ['GR', 'RHOB', 'NPHI', 'RT', 'PHIE', 'SWE', 'VSH'] }, body: `# ${w.name} · Petrophysics\n\n> Interpreted rock & fluid properties for ${wl(w.name)} in ${wl(f.reservoir)} · provenance **interpreted**.\n\n## Curves\nGR · RHOB · NPHI · RT · PHIE · SWE · VSH (from ${wl('Logs')}).\n\n## Interpretation\n- **Vsh** from GR; **φ (PHIE)** from density-neutron; **Sw (SWE)** via ${wl('Archie')} (a=${f.petro?.a ?? '—'}, m=${f.petro?.m ?? '—'}, n=${f.petro?.n ?? '—'}).\n- Net pay from φ / Sw / Vsh cut-offs per ${wl('Petrophysical Evaluation Standard')}.\n\n## Feeds\n${wl('Volumetrics (STOIIP)')} in ${wl('Field Development')}.` });
        link(pid, wid, 'contextualizes');
        link('domain:logs', pid, 'evidences');
      }
    });

    // field-level domain coverage
    link('domain:dynamic-pvt', fid, 'covers');
    link('domain:contacts', fid, 'covers');
    link('domain:petrophysics', fid, 'covers');
    LIFECYCLES.forEach((lc) => link('lifecycle:' + lc.id, fid, 'produces'));
    (f.analogRefs || []).forEach((an) => { const aid = 'analog:' + slug(an); if (nodes.some((n) => n.id === aid)) link(rid, aid, 'relates'); });

    // ---- decisions (ADRs) — field-scoped, grounded ----
    const decs: Array<{ t: string; body: string; links: string[] }> = [];
    if (f.contact) decs.push({ t: `ADR — ${f.contact.kind} at ${f.contact.tvdss} m TVDSS (${f.name})`, links: [f.reservoir, 'Contacts'], body: `Adopt **${f.contact.kind} = ${f.contact.tvdss} m TVDSS** for ${wl(f.reservoir)}.\n\n- **Context:** the trap-closing contact sets the hydrocarbon column and STOIIP.\n- **Basis:** *${f.contact.nature}*${f.contact.prov ? ` — ${f.contact.prov}` : ''} → ${wl('Contacts')}.\n- **Consequence:** used in ${wl('Volumetrics (STOIIP)')} and the equilibration model.` });
    if (f.petro) decs.push({ t: `ADR — Archie parameters (${f.name})`, links: ['Archie', 'Petrophysics · Defaults'], body: `Adopt Archie **a=${f.petro.a}, m=${f.petro.m}, n=${f.petro.n}** field-wide.\n\n- **Basis:** core-calibrated (CCAL); default where log-specific values are absent → ${wl('Petrophysics · Defaults')}.\n- **Consequence:** drives SWE in every ${wl('Logs')} interpretation and net-pay cut-offs.` });
    if (f.pvt) decs.push({ t: `ADR — Undersaturated black-oil PVT (${f.name})`, links: ['Dynamic Param · PVT', 'Volumetrics (STOIIP)'], body: `Treat ${wl(f.name)} as **undersaturated** (Pi ${f.pvt.Pi} > Pb ${f.pvt.Pb} bara), Bo ${f.pvt.Bo}, Rs ${f.pvt.Rs}.\n\n- **Consequence:** oil-water physics for volumetrics & simulation; no free gas at initial conditions.` });
    decs.forEach((d) => {
      const did = `decision:${f.id}:${slug(d.t)}`;
      add({ id: did, type: 'decision', title: d.t, field: f.id, folder: '11_Decisions', tags: ['decision', f.id, 'adr'], meta: f.name, provenance: 'interpreted', source: `${f.name} subsurface decision log`, fm: { field: wl(f.name), status: 'accepted', related: wls(d.links) }, body: `# ${d.t}\n\n> Decision record (ADR) · status **accepted** · provenance **interpreted**.\n\n${d.body}` });
      link(did, fid, 'decides');
      d.links.forEach((t) => { const target = nodes.find((n) => n.title === t); if (target) link(did, target.id, 'relates'); });
    });
  });

  return { nodes, edges };
}

function buildDataLinks(w: { has: { logs: boolean; production: boolean; picks: boolean } }): string[] {
  const out: string[] = [];
  if (w.has.logs) out.push(wl('Logs'));
  if (w.has.production) out.push(wl('Production'));
  if (w.has.picks) out.push(wl('Reservoir · Formation Tops'));
  return out;
}
function slugConcept(title: string): string {
  const c = CONCEPTS.find((x) => x.title === title);
  return c ? c.id : slug(title);
}

// ── Obsidian-accurate link index — resolve [[wikilinks]] in body + frontmatter by
// title/alias (case-insensitive), yielding content-derived edges + backlinks + unresolved,
// exactly like Obsidian parses a vault. This is what the in-app graph & backlinks use.
export interface LinkIndex {
  edges: KEdge[];
  outgoing: Map<string, Set<string>>;
  backlinks: Map<string, Set<string>>;
  unresolved: Map<string, Set<string>>;
}
export function buildLinkIndex(nodes: KNode[]): LinkIndex {
  const byTitle = new Map<string, string>();
  for (const n of nodes) {
    byTitle.set(n.title.toLowerCase(), n.id);
    n.aliases?.forEach((a) => { if (!byTitle.has(a.toLowerCase())) byTitle.set(a.toLowerCase(), n.id); });
  }
  const outgoing = new Map<string, Set<string>>();
  const backlinks = new Map<string, Set<string>>();
  const unresolved = new Map<string, Set<string>>();
  const seen = new Set<string>();
  const edges: KEdge[] = [];
  const add = (map: Map<string, Set<string>>, k: string, v: string) => { (map.get(k) || map.set(k, new Set()).get(k)!).add(v); };
  const collect = (id: string, text: string) => {
    const re = /\[\[([^\]]+)\]\]/g; let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const raw = m[1].split('|')[0].split('#')[0].trim();
      const tid = byTitle.get(raw.toLowerCase());
      if (tid && tid !== id) {
        add(outgoing, id, tid); add(backlinks, tid, id);
        const key = id + '>' + tid;
        if (!seen.has(key)) { seen.add(key); edges.push({ from: id, to: tid, kind: 'relates' }); }
      } else if (!tid) { add(unresolved, id, raw); }
    }
  };
  for (const n of nodes) {
    collect(n.id, n.body);
    for (const v of Object.values(n.fm || {})) (Array.isArray(v) ? v : [v]).forEach((s) => collect(n.id, String(s)));
  }
  return { edges, outgoing, backlinks, unresolved };
}

// folder order for the Explorer tree
export const FOLDER_ORDER = [
  '01_Fields', '02_Formations', '03_Wells', '04_Petrophysics', '05_Data',
  '06_Lifecycles', '07_Outputs', '08_Standards', '09_Concepts', '10_Analogs', '11_Decisions',
  '12_Basins', '13_Cycles',
];
