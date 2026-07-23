// GOGET ingestion boundary — source rows in, ATLAS field masters + observations out.
// The March-2026 workbook is delivered as XLS and its headings may drift between
// releases, so aliases are explicit and unknown columns remain in the raw landing
// layer rather than leaking into the canonical schema.
import { makeId } from './spine';
import type { FieldMasterRecord, FieldObservation, ProductType } from './types';

export type GogetRow = Record<string, unknown>;
export interface GogetImport {
  fields: FieldMasterRecord[];
  observations: FieldObservation[];
  rejected: Array<{ row: number; reason: string; raw: GogetRow }>;
}

const RELEASE = 'March 2026';
const SOURCE = 'Global Energy Monitor · Global Oil and Gas Extraction Tracker';
const LICENCE = 'CC BY 4.0';

const aliases: Record<string, string[]> = {
  id: ['GEM Unit ID', 'GEM ID', 'GOGET ID', 'Unit ID', 'Project ID'],
  name: ['Unit Name', 'Project Name', 'Field Name', 'Name'],
  unitType: ['Unit Type', 'Project Type', 'Type'],
  parentId: ['Parent GEM Unit ID', 'Parent ID', 'Project GEM Unit ID'],
  country: ['Country/Area', 'Country'],
  region: ['Region'],
  operator: ['Operator'],
  owners: ['Owner(s)', 'Owners', 'Owner'],
  status: ['Status'],
  statusDetail: ['Status Detail', 'Substatus', 'Status subcategory'],
  fuel: ['Fuel Type', 'Fuel'],
  productionType: ['Production Type', 'Conventional/Unconventional'],
  shore: ['Onshore/Offshore', 'Shore Status'],
  discoveryYear: ['Discovery Year', 'Year Discovered'],
  fidYear: ['FID Year', 'Final Investment Decision Year'],
  startYear: ['Production Start Year', 'Start Year'],
  lat: ['Latitude', 'Latitude (°)'],
  lon: ['Longitude', 'Longitude (°)'],
  accuracy: ['Location Accuracy'],
  wiki: ['Wiki URL', 'Wiki page', 'GEM.wiki page'],
  prod: ['Production', 'Production (most recent)', 'Annual Production'],
  prodUnit: ['Production Unit', 'Production units'],
  prodYear: ['Production Year', 'Production data year'],
  reserves: ['Reserves', 'Reserves (most recent)'],
  reservesUnit: ['Reserves Unit', 'Reserves units'],
  reservesYear: ['Reserves Year', 'Reserves data year'],
  reservesClass: ['Reserves Classification', 'Reserve Classification', 'Reserves Type'],
};

const cleanKey = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
function get(row: GogetRow, key: keyof typeof aliases): unknown {
  const wanted = new Set(aliases[key].map(cleanKey));
  const hit = Object.keys(row).find((k) => wanted.has(cleanKey(k)));
  return hit == null ? undefined : row[hit];
}
const text = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s && !/^(not found|n\/a|na|null|-)$/i.test(s) ? s : undefined;
};
const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = text(v)?.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0];
  const n = s == null ? NaN : Number(s);
  return Number.isFinite(n) ? n : undefined;
};
const year = (v: unknown): number | undefined => {
  const n = num(v);
  return n && n >= 1800 && n <= 2200 ? Math.trunc(n) : undefined;
};
const split = (v: unknown): string[] | undefined => {
  const s = text(v);
  return s ? s.split(/\s*[;|]\s*/).filter(Boolean) : undefined;
};
const unitType = (v: unknown): FieldMasterRecord['unitType'] => {
  const s = text(v)?.toLowerCase() ?? '';
  return (['field', 'asset', 'project', 'phase', 'pool', 'block'] as const).find((x) => s.includes(x)) ?? 'unknown';
};
const shore = (v: unknown): FieldMasterRecord['shoreStatus'] => {
  const s = text(v)?.toLowerCase();
  return s?.includes('offshore') ? 'offshore' : s?.includes('onshore') ? 'onshore' : 'unknown';
};
const productionType = (v: unknown): FieldMasterRecord['productionType'] => {
  const s = text(v)?.toLowerCase();
  return s?.includes('unconventional') ? 'unconventional' : s?.includes('conventional') ? 'conventional' : 'unknown';
};
const product = (v: unknown): ProductType | 'hydrocarbons' | undefined => {
  const s = text(v)?.toLowerCase() ?? '';
  if (s.includes('condensate')) return 'condensate';
  if (s.includes('ngl')) return 'ngl';
  if (s === 'oil' || s.includes(' oil')) return 'oil';
  if (s === 'gas' || s.includes(' gas')) return 'gas';
  if (s) return 'hydrocarbons';
  return undefined;
};

export function importGogetRows(rows: GogetRow[], release = RELEASE): GogetImport {
  const out: GogetImport = { fields: [], observations: [], rejected: [] };
  rows.forEach((raw, index) => {
    const row = index + 2; // workbook heading is row 1
    const nativeId = text(get(raw, 'id'));
    const name = text(get(raw, 'name'));
    if (!nativeId || !name) {
      out.rejected.push({ row, reason: !nativeId ? 'missing GOGET id' : 'missing unit name', raw });
      return;
    }
    const fieldId = makeId('field', 'goget', nativeId);
    const common = { dataNature: 'reference' as const, source: SOURCE, licence: LICENCE, release, sourceRow: row };
    const parentNative = text(get(raw, 'parentId'));
    out.fields.push({
      id: fieldId,
      name,
      unitType: unitType(get(raw, 'unitType')),
      parentId: parentNative ? makeId('field', 'goget', parentNative) : undefined,
      countryArea: text(get(raw, 'country')),
      region: text(get(raw, 'region')),
      operator: text(get(raw, 'operator')),
      owners: split(get(raw, 'owners')),
      status: text(get(raw, 'status')),
      statusDetail: text(get(raw, 'statusDetail')),
      fuelType: text(get(raw, 'fuel')),
      productionType: productionType(get(raw, 'productionType')),
      shoreStatus: shore(get(raw, 'shore')),
      discoveryYear: year(get(raw, 'discoveryYear')),
      fidYear: year(get(raw, 'fidYear')),
      startYear: year(get(raw, 'startYear')),
      latitude: num(get(raw, 'lat')),
      longitude: num(get(raw, 'lon')),
      locationAccuracy: text(get(raw, 'accuracy')),
      wikiUrl: text(get(raw, 'wiki')),
      externalIds: [{ authority: 'goget', id: nativeId, release }],
      provenance: common,
    });
    const addObservation = (metric: 'production' | 'reserves', valueKey: 'prod' | 'reserves',
      unitKey: 'prodUnit' | 'reservesUnit', yearKey: 'prodYear' | 'reservesYear') => {
      const value = num(get(raw, valueKey));
      const unit = text(get(raw, unitKey));
      if (value == null || !unit) return;
      out.observations.push({
        fieldId, metric, value, unit, year: year(get(raw, yearKey)),
        productType: product(get(raw, 'fuel')),
        classification: metric === 'reserves' ? text(get(raw, 'reservesClass')) : undefined,
        originalValue: value, originalUnit: unit, provenance: common,
      });
    };
    addObservation('production', 'prod', 'prodUnit', 'prodYear');
    addObservation('reserves', 'reserves', 'reservesUnit', 'reservesYear');
  });
  return out;
}
