import type { SearchEntry } from '../../cosmo/cockpit-search';
import { loadFieldDetail, type FieldDetail, type ObservationRow } from '../../cosmo/cockpit-field-detail';
import { loadWorldAUs, loadWorldManifest, loadWorldProvinces } from '../../world/load';
import type { GeoFeature, WorldAUProps, WorldProvinceProps } from '../../world/types';
import { BBL_PER_SM3, SCF_PER_SM3 } from '../../engine/volumetrics';

const base = import.meta.env.BASE_URL || '/';

type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];

const pointInRing = ([x, y]: Position, ring: Ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi) inside = !inside;
  }
  return inside;
};

const polygonContains = (point: Position, polygon: Polygon) => pointInRing(point, polygon[0])
  && !polygon.slice(1).some((hole) => pointInRing(point, hole));

function contains(feature: GeoFeature<unknown>, point: Position): boolean {
  if (!feature.geometry) return false;
  if (feature.geometry.type === 'Polygon') return polygonContains(point, feature.geometry.coordinates as Polygon);
  if (feature.geometry.type === 'MultiPolygon') return (feature.geometry.coordinates as Polygon[]).some((polygon) => polygonContains(point, polygon));
  return false;
}

type OsduIndex = {
  standard: string;
  dataDefinitions?: { release?: string };
  manifests: Array<{ source: string; records: number; status: string }>;
};

export type KnowledgeContext = {
  detail: FieldDetail | null;
  province: WorldProvinceProps | null;
  au: WorldAUProps | null;
  hierarchy: Array<{ label: string; value: string; source: string }>;
  osdu: OsduIndex | null;
  worldCounts: { provinces: number; aus: number } | null;
  isVolve: boolean;
};

const named = (value: unknown) => value == null || value === '' ? 'Not linked' : String(value);

export async function loadKnowledgeContext(field: SearchEntry): Promise<KnowledgeContext> {
  const [detail, aus, provinces, manifest, osdu] = await Promise.all([
    loadFieldDetail(field.id), loadWorldAUs(), loadWorldProvinces(), loadWorldManifest(),
    fetch(`${base}osdu/index.json`).then((response) => response.ok ? response.json() as Promise<OsduIndex> : null).catch(() => null),
  ]);
  const point: Position | null = field.fly ? [field.fly.lon, field.fly.lat] : null;
  const isVolve = field.name.toUpperCase() === 'VOLVE';
  const auFeature = isVolve
    ? aus.features.find((item) => item.properties.auCode === '40250101')
    : point ? aus.features.find((item) => contains(item, point)) : undefined;
  const provinceFeature = auFeature
    ? provinces.features.find((item) => item.properties.prvCode === auFeature.properties.prvCode)
    : isVolve
      ? provinces.features.find((item) => item.properties.prvCode === '4025')
      : point ? provinces.features.find((item) => contains(item, point)) : undefined;

  const province = provinceFeature?.properties ?? null;
  const au = auFeature?.properties ?? null;
  const hierarchy = [
    { label: 'Basin / province', value: named(detail?.basin ?? province?.prvName), source: detail?.basin ? 'GOGET' : province ? 'USGS' : '—' },
    { label: 'Petroleum system', value: named(au?.tps), source: au?.tps ? 'USGS TPS' : '—' },
    { label: 'Assessment unit', value: named(au?.auName), source: au ? `USGS ${au.auCode}` : '—' },
    { label: 'Field', value: field.name, source: isVolve ? 'Sodir / Equinor' : field.source },
    { label: 'Formation / reservoir', value: isVolve ? 'Hugin Formation' : 'Not linked', source: isVolve ? 'Equinor Volve' : 'Client enrichment slot' },
  ];
  return { detail, province, au, hierarchy, osdu, worldCounts: manifest.counts, isVolve };
}

const lower = (value: string | null) => value?.toLowerCase() ?? '';
const compact = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: value >= 100 ? 0 : 1 });

/** GOGET converted liquids are million bbl and gas is million m³. Display in field units. */
export function formatFieldObservation(row: ObservationRow): { label: string; value: string; meta: string } {
  const product = lower(row.product);
  const convertedUnit = lower(row.unitConverted);
  const converted = row.valueConverted;
  let value = 'Not reported';
  if (converted != null && convertedUnit.includes('million bbl')) value = `${compact(converted)} MMSTB`;
  else if (converted != null && convertedUnit.includes('million m³')) value = `${compact(converted * 1e6 * SCF_PER_SM3 / 1e9)} BSCF`;
  else if (row.value != null && lower(row.unit).includes('bcf')) value = `${compact(row.value)} BSCF`;
  else if (row.value != null) value = `${compact(row.value)} ${row.unit ?? ''}`.trim();
  return {
    label: product.includes('gas') ? 'Gas reserves' : `${row.product} reserves`,
    value,
    meta: [row.classification, row.year].filter((item) => item != null && item !== '').join(' · ') || 'GOGET reported',
  };
}

export const volveVolumes = () => [
  { label: 'STOIIP', value: `${compact(142.3 * BBL_PER_SM3)} MMSTB`, meta: 'screening upper bound · modeled' },
  { label: 'GIIP', value: `${compact(40.5 * 1e9 * SCF_PER_SM3 / 1e9)} BSCF`, meta: 'modeled · Volve bundle' },
];

export function sourceRecordCount(context: KnowledgeContext | null, source: string): number | null {
  return context?.osdu?.manifests.find((item) => item.source === source)?.records ?? null;
}
