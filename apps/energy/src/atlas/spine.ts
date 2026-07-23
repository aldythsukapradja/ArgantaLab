// atlas/spine.ts — THE STRONG SPINE. The canonical entity registry for world petroleum,
// as data + a callable/updateable API. This is the single source of truth: add an entity
// type or attribute by editing SPINE (or calling registerEntityType/extendEntityType at
// runtime). Everything downstream (KB, DB schema, cockpit) reads the spine — never hardcodes.
// Two axes (geologic + commercial) + the well axis converge at Field/Well. See types.ts.
import type { EntityType, RelDef, AtlasId, EntityInstance, PrmsClass, PrmsCategory, ProductType } from './types';

export const ATLAS_VERSION = '1.0.0';

// ── the canonical spine (14 geologic/well tiers + commercial axis) ──
// tiers 1–10 geologic · 11–15 well · 16–18 commercial (clean 1..18). Ordering is by `tier`.
export const SPINE: EntityType[] = [
  { id: 'world', tier: 1, axis: 'geologic', name: 'World', ktype: 'world', aligned: ['ATLAS'],
    keyAttrs: [{ name: 'name', dtype: 'string', required: true }],
    desc: 'Root of the catalogue.' },
  { id: 'region', tier: 2, axis: 'geologic', name: 'Region', osdu: 'GeoPoliticalEntity', ktype: 'region', parent: 'world',
    aligned: ['USGS', 'WoodMac'],
    keyAttrs: [{ name: 'code', dtype: 'string' }, { name: 'name', dtype: 'string', required: true }],
    desc: 'Top-level geographic grouping (USGS 9-region / WoodMac region).' },
  { id: 'country', tier: 3, axis: 'geologic', name: 'Country', osdu: 'GeoPoliticalEntity', ktype: 'country', parent: 'region',
    aligned: ['OSDU', 'UN'],
    keyAttrs: [{ name: 'iso', dtype: 'string' }, { name: 'name', dtype: 'string', required: true }, { name: 'fiscalRegime', dtype: 'string' }],
    desc: 'Sovereign/administrative area (UN name). Political axis.' },
  { id: 'basin', tier: 4, axis: 'geologic', name: 'Basin', osdu: 'Basin', ktype: 'basin', parent: 'region',
    aligned: ['OSDU', 'USGS', 'Robertson'],
    keyAttrs: [{ name: 'code', dtype: 'string' }, { name: 'name', dtype: 'string', required: true }, { name: 'setting', dtype: 'string' }],
    desc: 'Sedimentary basin / USGS province. Geologic axis (crosses countries).' },
  { id: 'petroleum-system', tier: 5, axis: 'geologic', name: 'Petroleum System', ktype: 'petroleum-system', parent: 'basin',
    aligned: ['USGS', 'IHS'],
    keyAttrs: [{ name: 'code', dtype: 'string' }, { name: 'name', dtype: 'string', required: true }, { name: 'sourceRock', dtype: 'string' }],
    desc: 'USGS Total Petroleum System — genetic source system + related accumulations.' },
  { id: 'assessment-unit', tier: 6, axis: 'geologic', name: 'Assessment Unit', ktype: 'assessment-unit', parent: 'petroleum-system',
    aligned: ['USGS'],
    keyAttrs: [{ name: 'code', dtype: 'string' }, { name: 'name', dtype: 'string', required: true }, { name: 'status', dtype: 'enum', enumVals: ['Assessed', 'Not assessed'] }],
    desc: 'USGS Assessment Unit — the volumetric-assessment container (Play ⊂ AU ⊂ TPS).' },
  { id: 'play', tier: 7, axis: 'geologic', name: 'Play', osdu: 'Play', ktype: 'play', parent: 'assessment-unit',
    aligned: ['OSDU', 'IHS', 'WoodMac'],
    keyAttrs: [{ name: 'name', dtype: 'string', required: true }, { name: 'reservoirAge', dtype: 'string' }, { name: 'reservoirLith', dtype: 'string' }],
    desc: 'A set of accumulations sharing geology — the exploration play.' },
  { id: 'prospect', tier: 8, axis: 'geologic', name: 'Prospect / Lead', osdu: 'Prospect', ktype: 'prospect', parent: 'play',
    aligned: ['OSDU', 'PRMS'],
    keyAttrs: [{ name: 'name', dtype: 'string', required: true }, { name: 'gcos', dtype: 'number', desc: 'geological chance of success 0–1' }],
    desc: 'An undrilled opportunity (Prospective Resources).' },
  { id: 'field', tier: 9, axis: 'geologic', name: 'Field', osdu: 'Field', ktype: 'field', parent: 'play',
    aligned: ['OSDU', 'PPDM', 'IHS', 'USGS-Accumulation'],
    keyAttrs: [
      { name: 'name', dtype: 'string', required: true },
      { name: 'operator', dtype: 'string' }, { name: 'status', dtype: 'string' },
      { name: 'hcType', dtype: 'enum', enumVals: ['OIL', 'GAS', 'OIL/GAS'] },
      { name: 'discoveryYear', dtype: 'number' }, { name: 'discoveryWell', dtype: 'string' },
      { name: 'conventional', dtype: 'bool' }, { name: 'shoreStatus', dtype: 'string' },
      { name: 'lat', dtype: 'number', unit: '°' }, { name: 'lon', dtype: 'number', unit: '°' },
    ],
    desc: 'A discovered accumulation exploited for commercial purposes (= USGS Accumulation).' },
  { id: 'reservoir', tier: 10, axis: 'geologic', name: 'Reservoir', osdu: 'Reservoir', ktype: 'reservoir', parent: 'field',
    aligned: ['OSDU', 'PPDM-Pool'],
    keyAttrs: [{ name: 'name', dtype: 'string', required: true }, { name: 'formation', dtype: 'string' }, { name: 'owcTvdss', dtype: 'number', unit: 'm' }],
    desc: 'Geologic reservoir body (distinct from a regulatory Pool).' },

  // ── well axis (PPDM, universally agreed) ──
  { id: 'well', tier: 11, axis: 'well', name: 'Well', osdu: 'Well', ktype: 'well', parent: 'field',
    aligned: ['PPDM', 'OSDU'],
    keyAttrs: [{ name: 'name', dtype: 'string', required: true }, { name: 'purpose', dtype: 'string' }, { name: 'role', dtype: 'enum', enumVals: ['producer', 'injector', 'both', 'none'] }],
    desc: 'Regulatory/intent object — a proposed or actual hole exchanging fluids with a reservoir.' },
  { id: 'wellbore', tier: 12, axis: 'well', name: 'Wellbore', osdu: 'Wellbore', ktype: 'wellbore', parent: 'well',
    aligned: ['PPDM', 'OSDU'],
    keyAttrs: [{ name: 'name', dtype: 'string', required: true }, { name: 'tdMd', dtype: 'number', unit: 'm' }, { name: 'tdTvd', dtype: 'number', unit: 'm' }],
    desc: 'Physical drilled path from origin to terminus (1 Well → N Wellbores).' },
  { id: 'wellbore-segment', tier: 13, axis: 'well', name: 'Wellbore Segment', ktype: 'wellbore', parent: 'wellbore',
    aligned: ['PPDM'],
    keyAttrs: [{ name: 'name', dtype: 'string' }, { name: 'kind', dtype: 'enum', enumVals: ['original', 'sidetrack'] }],
    desc: 'A unique drilled interval — original hole or a sidetrack.' },
  { id: 'contact-interval', tier: 14, axis: 'well', name: 'Contact Interval', ktype: 'completion', parent: 'wellbore-segment',
    aligned: ['PPDM'],
    keyAttrs: [{ name: 'topMd', dtype: 'number', unit: 'm' }, { name: 'baseMd', dtype: 'number', unit: 'm' }, { name: 'zone', dtype: 'string' }],
    desc: 'MD range contacting a stratigraphic zone for production/injection.' },
  { id: 'completion', tier: 15, axis: 'well', name: 'Completion', ktype: 'completion', parent: 'wellbore',
    aligned: ['PPDM'],
    keyAttrs: [{ name: 'name', dtype: 'string' }, { name: 'type', dtype: 'string' }, { name: 'status', dtype: 'string' }],
    desc: 'A set of contact intervals functioning as one producing/injecting unit.' },

  // ── commercial / fiscal axis (Wood Mackenzie); joins at Field/Well ──
  { id: 'company', tier: 16, axis: 'commercial', name: 'Company', osdu: 'Organisation', ktype: 'company',
    aligned: ['OSDU', 'WoodMac'],
    keyAttrs: [{ name: 'name', dtype: 'string', required: true }, { name: 'kind', dtype: 'string' }],
    desc: 'Operator/licensee organisation.' },
  { id: 'licence', tier: 17, axis: 'commercial', name: 'Licence / Block', ktype: 'licence', parent: 'country',
    aligned: ['IHS', 'Sodir', 'NSTA', 'WoodMac'],
    keyAttrs: [
      { name: 'name', dtype: 'string', required: true }, { name: 'block', dtype: 'string' },
      { name: 'status', dtype: 'string' }, { name: 'contractType', dtype: 'string' }, { name: 'operator', dtype: 'ref', ref: 'company' },
    ],
    desc: 'A licensing-authority area for exploration/production (concession/contract).' },
  { id: 'asset', tier: 18, axis: 'commercial', name: 'Asset', ktype: 'asset', parent: 'field',
    aligned: ['WoodMac'],
    keyAttrs: [{ name: 'name', dtype: 'string', required: true }, { name: 'operator', dtype: 'ref', ref: 'company' }, { name: 'fiscalRegime', dtype: 'string' }],
    desc: 'Commercial wrapper of a field/field-group under a fiscal/licence regime (WoodMac). Distinct from the geologic Field.' },
];

// ── relationships (the graph; a strict tree is not enough) ──
export const RELATIONSHIPS: RelDef[] = [
  { id: 'R1', from: 'field', to: 'play', kind: 'located-in', cardinality: '*-1', desc: 'a field sits in a play' },
  { id: 'R2', from: 'field', to: 'country', kind: 'located-in', cardinality: '*-1', desc: 'geographic containment' },
  { id: 'R3', from: 'field', to: 'basin', kind: 'located-in', cardinality: '*-1', desc: 'geologic containment' },
  { id: 'R4', from: 'field', to: 'licence', kind: 'held-under', cardinality: '*-*', desc: 'field produced under licence(s)' },
  { id: 'R5', from: 'asset', to: 'company', kind: 'operated-by', cardinality: '*-1', desc: 'asset operated by a company' },
  { id: 'R6', from: 'asset', to: 'field', kind: 'contains', cardinality: '1-*', desc: 'commercial wrapper of field(s)' },
  { id: 'R7', from: 'well', to: 'reservoir', kind: 'penetrates', cardinality: '*-*', desc: 'well targets reservoir(s)' },
  { id: 'R8', from: 'prospect', to: 'field', kind: 'matures-to', cardinality: '1-1', desc: 'discovery matures a prospect into a field' },
  { id: 'R9', from: 'well', to: 'field', kind: 'located-in', cardinality: '*-1', desc: 'well drilled in a field' },
  { id: 'R10', from: 'well', to: 'licence', kind: 'held-under', cardinality: '*-1', desc: 'well drilled under a licence' },
  { id: 'R11', from: 'assessment-unit', to: 'field', kind: 'produces', cardinality: '1-*', desc: 'AU resource realises as fields' },
];

// ── controlled vocabularies (SPE-PRMS + product) ──
export const PRMS_CLASS: Array<{ id: PrmsClass; label: string; color: string }> = [
  { id: 'prospective', label: 'Prospective', color: '#e11d74' },
  { id: 'contingent', label: 'Contingent', color: '#f59e0b' },
  { id: 'reserves', label: 'Reserves', color: '#10b981' },
  { id: 'production', label: 'Production', color: '#2563eb' },
  { id: 'unrecoverable', label: 'Unrecoverable', color: '#64748b' },
];
export const PRMS_CATEGORY: Array<{ id: PrmsCategory; label: string; pfrac: string }> = [
  { id: 'low', label: 'Low (1)', pfrac: 'P90 / 1P / 1C / 1U' },
  { id: 'best', label: 'Best (2)', pfrac: 'P50 / 2P / 2C / 2U' },
  { id: 'high', label: 'High (3)', pfrac: 'P10 / 3P / 3C / 3U' },
];
export const PRODUCT_TYPE: ProductType[] = ['oil', 'condensate', 'ngl', 'gas'];

export const AXIS_LABEL: Record<string, string> = {
  geologic: 'Geologic / exploration', well: 'Well (PPDM)', commercial: 'Commercial / fiscal',
};
export const AXIS_COLOR: Record<string, string> = { geologic: '#0FB5A6', well: '#7c3aed', commercial: '#f59e0b' };

// ── callable API (the spine is queryable + updateable) ──
const _index = new Map<string, EntityType>(SPINE.map((e) => [e.id, e]));

export const getEntityType = (id: string): EntityType | undefined => _index.get(id);
export const spineOrdered = (): EntityType[] => [...SPINE].sort((a, b) => a.tier - b.tier);
export const axisTypes = (axis: string): EntityType[] => spineOrdered().filter((e) => e.axis === axis);
export const childrenOf = (id: string): EntityType[] => SPINE.filter((e) => e.parent === id);
export const parentOf = (id: string): EntityType | undefined => { const e = _index.get(id); return e?.parent ? _index.get(e.parent) : undefined; };
/** the canonical container chain from an entity type up to the root. */
export function ancestryOf(id: string): EntityType[] {
  const chain: EntityType[] = []; let cur = _index.get(id);
  while (cur) { chain.push(cur); cur = cur.parent ? _index.get(cur.parent) : undefined; }
  return chain.reverse();
}
export const relationsOf = (id: string): RelDef[] => RELATIONSHIPS.filter((r) => r.from === id || r.to === id);

// ── canonical id helpers: atlas:{entity}:{authority}:{nativeId} ──
export const makeId = (entity: string, authority: string, nativeId: string | number): string => `atlas:${entity}:${authority}:${nativeId}`;
export function parseId(id: string): AtlasId | null {
  const p = id.split(':');
  if (p.length < 4 || p[0] !== 'atlas') return null;
  return { entity: p[1], authority: p[2], nativeId: p.slice(3).join(':') };
}

// ── updateable API (extend the schema at runtime without editing this file) ──
export function registerEntityType(e: EntityType): void { _index.set(e.id, e); const i = SPINE.findIndex((x) => x.id === e.id); if (i >= 0) SPINE[i] = e; else SPINE.push(e); }
export function extendEntityType(id: string, attrs: EntityType['keyAttrs']): boolean {
  const e = _index.get(id); if (!e) return false;
  const names = new Set(e.keyAttrs.map((a) => a.name));
  e.keyAttrs.push(...attrs.filter((a) => !names.has(a.name))); return true;
}

// ── instance validation against the spine (data-quality gate) ──
export function validateInstance(inst: EntityInstance): string[] {
  const errs: string[] = [];
  const t = _index.get(inst.type);
  if (!t) { errs.push(`unknown entity type "${inst.type}"`); return errs; }
  if (!parseId(inst.id)) errs.push(`id "${inst.id}" is not atlas:{entity}:{authority}:{nativeId}`);
  for (const a of t.keyAttrs) {
    if (a.required && (inst.attrs?.[a.name] == null) && a.name !== 'name') errs.push(`missing required attr "${a.name}"`);
  }
  if (!inst.name) errs.push('missing name');
  return errs;
}

/** Given a bundle's instances, return the spine-ordered lineage for a target instance id. */
export function lineage(instances: EntityInstance[], targetId: string): EntityInstance[] {
  const byId = new Map(instances.map((i) => [i.id, i]));
  const out: EntityInstance[] = []; let cur = byId.get(targetId);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) { out.push(cur); guard.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
  return out.reverse();
}
