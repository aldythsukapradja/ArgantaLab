// The Exploration Suite's canonical ten-stage study spine.
// Source: docs/arganta-energy/EXPLORATION-SUITE-CONCEPT.md, Part 1.
// S0 intentionally wires navigation only. Analysis stays in Legacy until each
// deterministic engine can emit a typed, lineage-bearing study artifact.
export type StudyPhase = 'Frame' | 'Model' | 'System' | 'Decide' | 'Output';
export type StudyStatus = 'untouched' | 'draft' | 'settled' | 'stale' | 'superseded';

export interface StudyStage {
  id: string;
  name: string;
  shortName: string;
  phase: StudyPhase;
  clones: string;
  produces: string;
  blurb: string;
  status: StudyStatus;
}

export const STUDY_STAGES: StudyStage[] = [
  { id: 'atlas', name: 'Atlas', shortName: 'Atlas', phase: 'Frame', clones: 'IHS/S&P · WoodMac · Rystad · USGS', produces: 'BasinStats · CreamingCurve · YTFBaseline', blurb: 'Frame the opportunity from world basin evidence and define the study scope.', status: 'untouched' },
  { id: 'data-room', name: 'Data Room', shortName: 'Data Room', phase: 'Frame', clones: 'Petrel · GIS', produces: 'DataInventory', blurb: 'Inventory seismic, wells and GIS coverage with vintage and quality visible.', status: 'untouched' },
  { id: 'basin-framework', name: 'Basin Framework', shortName: 'Basin', phase: 'Model', clones: 'Neftex · Petrel', produces: 'StratColumn · MegaSequence[] · WheelerDiagram', blurb: 'Build the tectonostratigraphic framework that every downstream interpretation references.', status: 'untouched' },
  { id: 'seismic-structure', name: 'Seismic & Structure', shortName: 'Structure', phase: 'Model', clones: 'Petrel · PaleoScan · 2D/3D MOVE', produces: 'Horizon[] · Fault[] · VelocityModel · Closure[]', blurb: 'Interpret horizons and faults, depth-convert them and identify closures.', status: 'untouched' },
  { id: 'petrophysics', name: 'Petrophysics', shortName: 'Petrophysics', phase: 'Model', clones: 'Techlog', produces: 'ReservoirParameters', blurb: 'Derive evidence-backed PHIE, SWE and NTG distributions by interval.', status: 'untouched' },
  { id: 'gde', name: 'GDE', shortName: 'GDE', phase: 'Model', clones: 'Neftex · SAFARI', produces: 'GDEMap[]', blurb: 'Map depositional environments by mega-sequence and expose the basis for each interpretation.', status: 'untouched' },
  { id: 'basin-modeling', name: 'Basin Modeling', shortName: 'Basin Model', phase: 'System', clones: 'ZetaWare Trinity/T3 · PetroMod · KINEX', produces: 'MaturityMap · MigrationMap · ChargeTiming · PSEChart', blurb: 'Model burial, maturity, charge timing and screening-grade migration before risking a play.', status: 'untouched' },
  { id: 'play-fairway', name: 'Play Fairway & CRS', shortName: 'Play Fairway', phase: 'System', clones: 'GeoX · Play Chaser · PBE', produces: 'PlayDefinition · PDARecord · CRSMap · CCRSMap', blurb: 'Combine charge, reservoir and seal evidence into calibrated play-common risk.', status: 'untouched' },
  { id: 'prospect-risk', name: 'Prospect & Risk', shortName: 'Prospect', phase: 'Decide', clones: 'GeoX · Merak Peep', produces: 'Opportunity[] · VolumetricCase · GCFAssessment · Ranking', blurb: 'Turn mapped closures into ranked, probabilistic drill-or-drop decisions.', status: 'untouched' },
  { id: 'deliverables', name: 'Deliverables', shortName: 'Deliverables', phase: 'Output', clones: 'ARWANA report · presentation', produces: 'StudyReport · StudyPresentation', blurb: 'Compose the approved artifact graph into an auditable report and presentation.', status: 'untouched' },
];

export const LEGACY_TAB_NAMES = [
  'Overview', 'Basemap', 'Seismic', 'Wells', 'Interpretation',
  'Plays & Prospects', 'Volumetrics', 'Risk & Uncertainty',
] as const;
