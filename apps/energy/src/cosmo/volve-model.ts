// volve-model.ts — the ArgantaEnergy data model for the Volve field, adapted from the
// UC116/WellAion "Data Model" reference but grounded 1:1 in OUR real Volve assets
// (public/wb/*). Rebranded: no Cosmo / Al Shaheen / NOC / vendor-agent names — neutral
// geoscience domains. Row counts are REAL (computed from the wb data assets). Star
// schema on Wells (Equinor Volve, ED50 / UTM 31N, Sleipner area, North Sea).
//
// Real counts (build-verified from public/wb):
//   Wells 24 · Surfaces 6 · Contacts 1 · Formation-top picks 409 · Log samples 570,580
//   (20 wells) · Trajectory stations 1,694 (15 wells) · Production months 526 (7 wells) +
//   field 112 · PVT 1 · petrophysical defaults 1.

export type DType = 'str' | 'num' | 'date' | 'bool';
export type Column = { name: string; dtype: DType; pk?: boolean; fk_to?: string };
export type ModelTable = {
  id: string; name: string; group: GroupId; role: string; rows: number;
  source: string; nature: DataNature; desc: string; columns: Column[];
};
export type Relationship = { id: string; from: string; to: string; cardinality: string };
export type GroupId = 'CORE' | 'STRUCTURE' | 'STRAT' | 'PETRO' | 'DYNAMIC' | 'FLUID';
export type DataNature = 'measured' | 'interpreted' | 'derived' | 'reference';

export const GROUP_COLOR: Record<GroupId, string> = {
  CORE: '#0FB5A6', STRUCTURE: '#7c3aed', STRAT: '#f59e0b', PETRO: '#e11d74', DYNAMIC: '#2563eb', FLUID: '#22d3ee',
};
export const GROUP_LABEL: Record<GroupId, string> = {
  CORE: 'Core', STRUCTURE: 'Structure', STRAT: 'Stratigraphy', PETRO: 'Petrophysics', DYNAMIC: 'Dynamic', FLUID: 'Fluid',
};
export const NATURE_LABEL: Record<DataNature, string> = {
  measured: 'MEASURED', interpreted: 'INTERPRETED', derived: 'DERIVED', reference: 'REFERENCE',
};

export const TABLES: ModelTable[] = [
  {
    id: 'VOLVE_WELLS', name: 'Wells', group: 'CORE', role: 'hub', rows: 24,
    source: 'Volve WB master (Equinor)', nature: 'measured',
    desc: 'Star centre. Every subsurface fact joins here on Well. 24 wellbores across the Hugin reservoir.',
    columns: [
      { name: 'Well', dtype: 'str', pk: true }, { name: 'WellGroup', dtype: 'str' },
      { name: 'X', dtype: 'num' }, { name: 'Y', dtype: 'num' },
      { name: 'TD_MD', dtype: 'num' }, { name: 'TD_TVD', dtype: 'num' },
      { name: 'KB', dtype: 'str' }, { name: 'Role', dtype: 'str' }, { name: 'IsExploration', dtype: 'bool' },
    ],
  },
  {
    id: 'VOLVE_LOGS', name: 'Well Logs', group: 'PETRO', role: 'fact', rows: 570580,
    source: 'Volve WLC / composite LAS', nature: 'measured',
    desc: 'Depth-registered wireline curves — GR · RHOB · NPHI · RT · PHIE · SWE · VSH · DT · CALI. 20 wells, 570,580 samples.',
    columns: [
      { name: 'Well', dtype: 'str', fk_to: 'VOLVE_WELLS.Well' }, { name: 'MD', dtype: 'num' },
      { name: 'GR', dtype: 'num' }, { name: 'RHOB', dtype: 'num' }, { name: 'NPHI', dtype: 'num' },
      { name: 'RT', dtype: 'num' }, { name: 'PHIE', dtype: 'num' }, { name: 'SWE', dtype: 'num' }, { name: 'VSH', dtype: 'num' },
    ],
  },
  {
    id: 'VOLVE_TRAJ', name: 'Trajectories', group: 'PETRO', role: 'gis', rows: 1694,
    source: 'Volve deviation surveys', nature: 'measured',
    desc: 'Directional survey stations (MD · TVD · inclination · azimuth · N/E displacement). 15 wells, 1,694 stations.',
    columns: [
      { name: 'Well', dtype: 'str', fk_to: 'VOLVE_WELLS.Well' }, { name: 'MD', dtype: 'num' },
      { name: 'TVD', dtype: 'num' }, { name: 'Incl', dtype: 'num' }, { name: 'Azi', dtype: 'num' },
      { name: 'DispNS', dtype: 'num' }, { name: 'DispEW', dtype: 'num' },
    ],
  },
  {
    id: 'VOLVE_TOPS', name: 'Formation Tops', group: 'STRAT', role: 'fact', rows: 409,
    source: 'Volve well picks', nature: 'interpreted',
    desc: 'Stratigraphic marker picks per well, tied to structure surfaces. 409 picks (MD + TVDSS).',
    columns: [
      { name: 'Well', dtype: 'str', fk_to: 'VOLVE_WELLS.Well' },
      { name: 'Surface', dtype: 'str', fk_to: 'VOLVE_SURFACES.Surface' },
      { name: 'MD', dtype: 'num' }, { name: 'TVDSS', dtype: 'num' },
    ],
  },
  {
    id: 'VOLVE_SURFACES', name: 'Structure Surfaces', group: 'STRUCTURE', role: 'grid', rows: 6,
    source: 'Volve depth grids (EarthVision)', nature: 'interpreted',
    desc: 'Gridded depth surfaces — Hugin Fm Top/Base · BCU · Ty Fm Top · Shetland Gp Top · Seabed.',
    columns: [
      { name: 'Surface', dtype: 'str', pk: true }, { name: 'nx', dtype: 'num' }, { name: 'ny', dtype: 'num' },
      { name: 'cell', dtype: 'num' }, { name: 'Zmin', dtype: 'num' }, { name: 'Zmax', dtype: 'num' }, { name: 'Points', dtype: 'num' },
    ],
  },
  {
    id: 'VOLVE_CONTACTS', name: 'Fluid Contacts', group: 'STRUCTURE', role: 'fact', rows: 1,
    source: 'Volve Eclipse deck (EQUIL)', nature: 'interpreted',
    desc: 'Fluid contacts from the reservoir model. OWC at 3200 m TVDSS (main structure).',
    columns: [
      { name: 'Kind', dtype: 'str', pk: true }, { name: 'TVDSS', dtype: 'num' }, { name: 'DataNature', dtype: 'str' },
    ],
  },
  {
    id: 'VOLVE_PRODUCTION', name: 'Production', group: 'DYNAMIC', role: 'fact', rows: 526,
    source: 'Volve production history', nature: 'measured',
    desc: 'Monthly oil / gas / water production and water injection per well (Sm³ as sourced). 526 well-months + 112 field-months.',
    columns: [
      { name: 'Well', dtype: 'str', fk_to: 'VOLVE_WELLS.Well' }, { name: 'YearMonth', dtype: 'date' },
      { name: 'Oil', dtype: 'num' }, { name: 'Gas', dtype: 'num' }, { name: 'Water', dtype: 'num' }, { name: 'WaterInj', dtype: 'num' },
    ],
  },
  {
    id: 'VOLVE_PVT', name: 'PVT', group: 'FLUID', role: 'reference', rows: 1,
    source: 'Volve Eclipse deck (PVTO/PVDG)', nature: 'reference',
    desc: 'Black-oil fluid properties at datum. Undersaturated: Bo 1.47 · Rs 148 · Pi 337 · Pb 256 bara · T 110 °C.',
    columns: [
      { name: 'Bo', dtype: 'num' }, { name: 'Rs', dtype: 'num' }, { name: 'Pi', dtype: 'num' },
      { name: 'Pb', dtype: 'num' }, { name: 'T', dtype: 'num' }, { name: 'Datum', dtype: 'num' },
    ],
  },
  {
    id: 'VOLVE_PETRO_DEFAULTS', name: 'Petro Defaults', group: 'FLUID', role: 'reference', rows: 1,
    source: 'Volve model defaults', nature: 'reference',
    desc: 'Reservoir-wide petrophysical defaults & Archie parameters (φ · NTG · Sw · a/m/n · Bo · recovery factor).',
    columns: [
      { name: 'Phi', dtype: 'num' }, { name: 'NTG', dtype: 'num' }, { name: 'Sw', dtype: 'num' },
      { name: 'Archie_a', dtype: 'num' }, { name: 'Archie_m', dtype: 'num' }, { name: 'Archie_n', dtype: 'num' }, { name: 'RF', dtype: 'num' },
    ],
  },
];

export const RELATIONSHIPS: Relationship[] = [
  { id: 'FK1', from: 'VOLVE_LOGS.Well', to: 'VOLVE_WELLS.Well', cardinality: '*-1' },
  { id: 'FK2', from: 'VOLVE_TRAJ.Well', to: 'VOLVE_WELLS.Well', cardinality: '*-1' },
  { id: 'FK3', from: 'VOLVE_TOPS.Well', to: 'VOLVE_WELLS.Well', cardinality: '*-1' },
  { id: 'FK4', from: 'VOLVE_TOPS.Surface', to: 'VOLVE_SURFACES.Surface', cardinality: '*-1' },
  { id: 'FK5', from: 'VOLVE_PRODUCTION.Well', to: 'VOLVE_WELLS.Well', cardinality: '*-1' },
];

// Card geometry + star-schema layout (Wells at centre, others on a ring around it).
export const CARD_W = 190;
export const cardHeight = (t: ModelTable) => 34 + t.columns.length * 20 + 10;

export function starLayout(): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const cx = 470, cy = 430;
  pos['VOLVE_WELLS'] = { x: cx - CARD_W / 2, y: cy - 90 };
  const ring = TABLES.filter((t) => t.id !== 'VOLVE_WELLS');
  const R = 340, Ry = 300;
  ring.forEach((t, i) => {
    const a = -Math.PI / 2 + (i / ring.length) * Math.PI * 2;
    pos[t.id] = { x: cx + Math.cos(a) * R - CARD_W / 2, y: cy + Math.sin(a) * Ry - cardHeight(t) / 2 };
  });
  return pos;
}
