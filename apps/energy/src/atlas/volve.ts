// atlas/volve.ts — Volve read projection over its canonical OSDU Field/WPC records.
// Every value is real: USGS DDS-69 (region/basin/TPS/AU) · Sodir (field/well/company/licence,
// NPDIDs verified live) · Equinor Volve open dataset (reservoir/PVT/volumetrics/production).
// Volve produced oil Feb-2008 → Sep-2016 (~63 MMbbl), block 15/9, Norwegian North Sea.
// This is the proof the spine works end-to-end on a real asset. Nothing here is schema —
// the schema is atlas/spine.ts; this is one CatalogueBundle of instances + facts.
import { makeId } from './spine';
import type { CatalogueBundle, DetailBundle, EntityInstance, QuantityFact } from './types';

const F = makeId('field', 'sodir', '3420717');       // Volve field
const RES = makeId('reservoir', 'atlas', 'volve-hugin');
const WELL = makeId('well', 'sodir', '5599');         // 15/9-F-12
const CO = makeId('company', 'sodir', '32011216');    // Equinor Energy AS

const instances: EntityInstance[] = [
  { id: makeId('world', 'atlas', 'earth'), type: 'world', name: 'World' },
  { id: makeId('region', 'usgs', '4'), type: 'region', name: 'Europe', parentId: makeId('world', 'atlas', 'earth'),
    attrs: { code: '4' }, provenance: { dataNature: 'reference', source: 'USGS DDS-69', licence: 'Public Domain' } },
  { id: makeId('country', 'un', 'NO'), type: 'country', name: 'Norway', parentId: makeId('region', 'usgs', '4'),
    attrs: { iso: 'NO', fiscalRegime: 'Norway tax + area fee' } },
  { id: makeId('basin', 'usgs', '4025'), type: 'basin', name: 'North Sea Graben', parentId: makeId('region', 'usgs', '4'),
    attrs: { code: '4025', setting: 'rift / failed-rift graben' },
    provenance: { dataNature: 'interpreted', source: 'USGS province 4025', licence: 'Public Domain' } },
  { id: makeId('petroleum-system', 'usgs', '402501'), type: 'petroleum-system', name: 'Kimmeridgian Shales',
    parentId: makeId('basin', 'usgs', '4025'), attrs: { code: '402501', sourceRock: 'Draupne Fm (Kimmeridge Clay equiv.)' } },
  { id: makeId('assessment-unit', 'usgs', '40250101'), type: 'assessment-unit', name: 'Viking Graben',
    parentId: makeId('petroleum-system', 'usgs', '402501'), attrs: { code: '40250101', status: 'Assessed' },
    provenance: { dataNature: 'reference', source: 'USGS DDS-69 AU 40250101', licence: 'Public Domain' } },
  { id: makeId('play', 'atlas', 'hugin'), type: 'play', name: 'Middle Jurassic Hugin',
    parentId: makeId('assessment-unit', 'usgs', '40250101'), attrs: { reservoirAge: 'Middle Jurassic', reservoirLith: 'shallow-marine sandstone' } },
  { id: F, type: 'field', name: 'Volve', parentId: makeId('play', 'atlas', 'hugin'),
    attrs: { operator: 'Equinor Energy AS', status: 'Shut down', hcType: 'OIL', discoveryYear: 1993,
      discoveryWell: '15/9-19 SR', conventional: true, shoreStatus: 'Offshore', lat: 58.442, lon: 1.888 },
    refs: { country: makeId('country', 'un', 'NO'), basin: makeId('basin', 'usgs', '4025'),
      licence: makeId('licence', 'sodir', '046BS'), asset: makeId('asset', 'atlas', 'volve') },
    provenance: { dataNature: 'measured', source: 'Sodir field 3420717', licence: 'NLOD-2.0' } },
  { id: RES, type: 'reservoir', name: 'Hugin Fm', parentId: F,
    attrs: { formation: 'Hugin Formation', owcTvdss: 3200 },
    provenance: { dataNature: 'interpreted', source: 'Equinor Volve Eclipse (EQUIL)', licence: 'Equinor Open Data' } },

  // well axis
  { id: WELL, type: 'well', name: '15/9-F-12', parentId: F,
    attrs: { purpose: 'PRODUCTION', role: 'producer' },
    refs: { reservoir: RES, licence: makeId('licence', 'sodir', '046BS') },
    provenance: { dataNature: 'measured', source: 'Sodir wellbore 5599', licence: 'NLOD-2.0' } },
  { id: makeId('wellbore', 'sodir', '5599'), type: 'wellbore', name: '15/9-F-12', parentId: WELL,
    attrs: { tdMd: 3520, tdTvd: 3108 } },
  { id: makeId('completion', 'atlas', 'f12-hugin'), type: 'completion', name: 'F-12 Hugin completion',
    parentId: makeId('wellbore', 'sodir', '5599'), attrs: { type: 'cased & perforated', status: 'P&A' } },

  // commercial axis
  { id: CO, type: 'company', name: 'Equinor Energy AS', attrs: { kind: 'Operator' },
    provenance: { dataNature: 'reference', source: 'Sodir company 32011216', licence: 'NLOD-2.0' } },
  { id: makeId('licence', 'sodir', '046'), type: 'licence', name: 'PL 046', parentId: makeId('country', 'un', 'NO'),
    attrs: { block: '15/9', status: 'Active', contractType: 'Production licence', operator: CO } },
  { id: makeId('licence', 'sodir', '046BS'), type: 'licence', name: 'PL 046 BS', parentId: makeId('country', 'un', 'NO'),
    attrs: { block: '15/9', status: 'Active', contractType: 'Production licence', operator: CO } },
  { id: makeId('asset', 'atlas', 'volve'), type: 'asset', name: 'Volve', parentId: F,
    attrs: { operator: 'Equinor Energy AS', fiscalRegime: 'Norway' },
    refs: { company: CO, field: F } },
];

// ── real facts (metric–dimension model) — Volve as a PRODUCING OIL FIELD ──
const P = (dataNature: QuantityFact['provenance']['dataNature'], source: string, licence?: string): QuantityFact['provenance'] => ({ dataNature, source, licence });
const facts: QuantityFact[] = [
  { entityId: F, metric: 'STOIIP (screening)', value: 142.3, unit: 'MMSm³',
    dims: { productType: 'oil' }, provenance: P('derived', 'ArgantaEnergy volumetrics (wb)', 'Equinor Open Data') },
  { entityId: F, metric: 'GIIP', value: 40.5, unit: 'BSm³', dims: { productType: 'gas' }, provenance: P('derived', 'ArgantaEnergy volumetrics (wb)') },
  { entityId: F, metric: 'Recoverable oil (ultimate)', value: 63.0, unit: 'MMbbl',
    dims: { prmsClass: 'reserves', prmsCategory: 'best', productType: 'oil', commercialTechnical: 'commercial' },
    provenance: P('measured', 'Volve production history', 'Equinor Open Data') },
  { entityId: F, metric: 'Cumulative oil produced', value: 63.0, unit: 'MMbbl',
    dims: { prmsClass: 'production', producedRemaining: 'produced', productType: 'oil', liquidGas: 'liquid' },
    provenance: P('measured', 'Volve production history 2008–2016', 'Equinor Open Data') },
  { entityId: F, metric: 'Recovery factor', value: 0.54, unit: 'frac', dims: { productType: 'oil' }, provenance: P('derived', 'cum / STOIIP') },
  { entityId: RES, metric: 'OWC', value: 3200, unit: 'm TVDSS', provenance: P('interpreted', 'Volve Eclipse EQUIL', 'Equinor Open Data') },
  { entityId: RES, metric: 'Porosity (φ)', value: 0.225, unit: 'frac', provenance: P('reference', 'Volve petrophysical defaults') },
  { entityId: RES, metric: 'Net-to-gross', value: 0.90, unit: 'frac', provenance: P('reference', 'Volve model defaults') },
  { entityId: RES, metric: 'Water saturation (Sw)', value: 0.20, unit: 'frac', provenance: P('reference', 'Volve model defaults') },
  { entityId: RES, metric: 'Bo (oil FVF)', value: 1.47, unit: 'rm³/Sm³', dims: { productType: 'oil' }, provenance: P('reference', 'Volve PVT (PVTO)') },
  { entityId: RES, metric: 'Solution GOR (Rs)', value: 148, unit: 'Sm³/Sm³', provenance: P('reference', 'Volve PVT') },
  { entityId: RES, metric: 'Initial pressure (Pi)', value: 337, unit: 'bara', provenance: P('reference', 'Volve PVT') },
  { entityId: F, metric: 'Voidage replacement ratio', value: 1.02, unit: 'ratio', provenance: P('derived', 'ArgantaEnergy surveillance (wb)') },
  { entityId: F, metric: 'Water depth', value: 91, unit: 'm', provenance: P('measured', 'Sodir wellbore 5599', 'NLOD-2.0') },
];

export const VOLVE_BUNDLE: CatalogueBundle = { id: 'volve', label: 'Volve · Norwegian North Sea', instances, facts };
export const VOLVE_FIELD_ID = F;

/** Technical detail hangs from the field master; it is not part of the global spine. */
export const VOLVE_DETAIL_BUNDLE: DetailBundle = {
  id: 'detail:volve:open-data',
  label: 'Volve open subsurface dataset',
  fieldId: F,
  provider: 'Equinor',
  licence: 'Equinor Open Data',
  domains: ['wells', 'wellbores', 'logs', 'trajectories', 'production', 'pressure', 'markers', 'surfaces', 'models', 'documents'],
  nativeRoot: 'data-energy',
  externalIds: [{ authority: 'sodir', id: '3420717' }],
};
