import fs from 'node:fs';
import path from 'node:path';
import { datelineSafe, hasDatelineDefect } from './lib/antimeridian.mjs';
import { resolveIdentities } from './lib/identity-resolve.mjs';

const root = process.cwd();
const osduDir = path.join(root, 'public', 'osdu');
const index = JSON.parse(fs.readFileSync(path.join(osduDir, 'index.json'), 'utf8'));
const ready = index.manifests.filter((item) => item.status === 'ready' && item.path);

let points = [];
let polygons = [];
let recordCount = 0;
const recordById = new Map();          // id -> { record, source } — every kind, for enrichment + search
const wellbores = [];                  // search-index candidates (not rendered as map features today)
const organisations = [];
const geoEntities = [];

const rounded = (value) => Math.round(value * 1e5) / 1e5;
const compactRing = (ring) => {
  if (!Array.isArray(ring) || ring.length < 4) return ring;
  const step = Math.max(1, Math.ceil(ring.length / 180));
  const sampled = ring.filter((_, index) => index % step === 0).map(([x, y]) => [rounded(x), rounded(y)]);
  const first = sampled[0];
  const last = sampled.at(-1);
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) sampled.push(first);
  return sampled;
};

function compactGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point') return { type: 'Point', coordinates: geometry.coordinates.map(rounded) };
  // §4 dateline gate FIRST — split any ±180° crossing before antimeridian-blind decimation.
  const safe = datelineSafe(geometry);
  if (!safe) return null;
  if (safe.type === 'Polygon') return { type: 'Polygon', coordinates: safe.coordinates.map(compactRing) };
  if (safe.type === 'MultiPolygon') return {
    type: 'MultiPolygon',
    coordinates: safe.coordinates.map((polygon) => polygon.map(compactRing)),
  };
  return null;
}

// number-or-null: NEVER `|| null` — a genuine reported 0 must render as 0, not "Not reported".
const numOrNull = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// "latest reported" per product (handoff §6/§9: label as latest, never a fabricated series)
function latestByProduct(observations, valueKeys) {
  if (!Array.isArray(observations) || !observations.length) return [];
  const byFuel = new Map();
  for (const o of observations) {
    const fuel = o['Fuel description'] ?? o.Product ?? 'unspecified';
    const year = numOrNull(o['Data Year']) ?? 0;
    const prev = byFuel.get(fuel);
    if (!prev || year >= prev.year) byFuel.set(fuel, { ...o, year });
  }
  return [...byFuel.values()].map((o) => ({
    product: o['Fuel description'] ?? o.Product ?? 'unspecified',
    year: o.year || null,
    classification: o['Reserves classification'] ?? null,
    value: numOrNull(o[valueKeys.raw]),
    unit: valueKeys.rawUnit ? o[valueKeys.rawUnit] ?? null : null,
    valueConverted: numOrNull(o[valueKeys.converted]),
    unitConverted: o[valueKeys.convertedUnit] ?? null,
  })).sort((a, b) => (b.year || 0) - (a.year || 0));
}

const N = (v) => (v == null || v === '' ? null : v);
const EMPTY_ENRICHMENT = {
  fuelType: null, onshoreOffshore: null, productionType: null, status: null, statusDetail: null,
  discoveryYear: null, fidYear: null, productionStartYear: null, operator: null, owners: null,
  parents: null, block: null, basin: null, accuracy: null, reserves: [], production: [],
};
function enrichFromGoget(mainRow, ext) {
  if (!mainRow) return { ...EMPTY_ENRICHMENT };
  return {
    fuelType: N(mainRow['Fuel type']),
    onshoreOffshore: N(mainRow['Onshore/Offshore']),
    productionType: N(mainRow['Production Type']),
    status: N(mainRow.Status),
    statusDetail: N(mainRow['Status detail']),
    discoveryYear: N(mainRow['Discovery year']),
    fidYear: N(mainRow['FID Year']),
    productionStartYear: N(mainRow['Production start year']),
    operator: N(mainRow.Operator),
    owners: N(mainRow['Owner(s)']),
    parents: N(mainRow['Parent(s)']),
    block: N(mainRow['Block(s)']),
    basin: N(mainRow.Basin),
    accuracy: N(mainRow['Location accuracy']),
    reserves: latestByProduct(ext.ReservesObservations, { raw: 'Quantity', rawUnit: 'Units', converted: 'Quantity (converted)', convertedUnit: 'Units (converted)' }),
    production: latestByProduct(ext.ProductionObservations, { raw: 'Quantity (original)', rawUnit: 'Units (original)', converted: 'Quantity (converted)', convertedUnit: 'Units (converted)' }),
  };
}

function feature(record, source) {
  const data = record.data ?? {};
  const ext = data.ExtensionProperties ?? {};
  const geometry = compactGeometry(data.SpatialLocation);
  if (!geometry) return null;
  const type = record.kind?.match(/--([^:]+)/)?.[1] ?? 'SpatialObject';
  return {
    type: 'Feature',
    id: record.id,
    geometry,
    properties: {
      id: record.id,
      name: data.Name ?? data.FacilityName ?? record.id,
      type,
      source,
      country: ext.CountryArea ?? ext.Country ?? record.legal?.otherRelevantDataCountries?.[0] ?? '',
      basin: ext.NOM_BACIA ?? ext.Basin ?? '',
      operator: ext.Operator ?? ext.OPERADOR_C ?? '',
      status: ext.Status ?? ext.ETAPA ?? '',
      accuracy: ext['Location accuracy'] ?? '',
    },
  };
}

for (const entry of ready) {
  // entry.path is now a build-only location (data-energy/generated/osdu/…) — never public/.
  const manifest = JSON.parse(fs.readFileSync(path.join(root, entry.path), 'utf8'));
  const records = [
    ...(manifest.MasterData ?? []),
    ...(manifest.Data?.WorkProductComponents ?? []),
    ...(manifest.Data?.Datasets ?? []),
  ];
  recordCount += records.length;
  for (const record of records) {
    recordById.set(record.id, { record, source: entry.source });
    if (/--Wellbore:/.test(record.kind)) wellbores.push({ record, source: entry.source });
    else if (/--Organisation:/.test(record.kind)) organisations.push({ record, source: entry.source });
    else if (/--GeoPoliticalEntity:/.test(record.kind)) geoEntities.push({ record, source: entry.source });
    const next = feature(record, entry.source);
    if (!next) continue;
    if (next.geometry.type === 'Point') points.push(next);
    else polygons.push(next);
  }
}

// ── Stream A: cross-source identity resolution (dedup GOGET ↔ regulator/ANP twins) ──
const centroidOf = (g) => {
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0]?.[0];
  if (!ring?.length) return null;
  const s = ring.reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0]);
  return [s[0] / ring.length, s[1] / ring.length];
};
const fieldItems = [...points, ...polygons].filter((f) => f.properties.type === 'Field')
  .map((f) => ({ id: f.properties.id, name: f.properties.name, source: f.properties.source, country: f.properties.country, centroid: centroidOf(f.geometry) }));
const identity = resolveIdentities(fieldItems);
const aliasMeta = new Map();  // canonicalId -> { aliases:[nativeId], sources:[srcName] }
for (const c of identity.clusters) {
  aliasMeta.set(c.canonicalId, {
    aliases: c.sources.filter((s) => s.id !== c.canonicalId).map((s) => s.id),
    sources: [...new Set(c.sources.map((s) => s.source))],
  });
}

// ── Stream E data: enrich each surviving Field with real GOGET attributes/observations —
// its own MainData if it IS a GOGET record, else BORROWED from its identity-resolved GOGET
// alias (Stream A gives us the crosswalk). Never fabricated; "Not reported" is the caller's job.
function enrichField(props) {
  const own = recordById.get(props.id);
  const ownExt = own?.record.data?.ExtensionProperties ?? {};
  const ownMain = ownExt.MainData?.[0];
  let enriched = enrichFromGoget(ownMain, ownExt);
  let enrichedFrom = ownMain ? null : null;
  if (!ownMain) {
    const meta = aliasMeta.get(props.id);
    const gogetAliasId = meta?.aliases.find((id) => recordById.get(id)?.source === 'GOGET');
    if (gogetAliasId) {
      const alias = recordById.get(gogetAliasId);
      const aliasExt = alias.record.data?.ExtensionProperties ?? {};
      enriched = enrichFromGoget(aliasExt.MainData?.[0], aliasExt);
      enrichedFrom = 'GOGET (' + gogetAliasId + ')';
    }
  }
  return { ...enriched, enrichedFrom };
}
// dossier detail is HEAVY (owners/parents strings + dated reserves/production arrays) and is
// only needed once a field is CLICKED — keep it OUT of the render-critical points/polygons
// payload (§13 perf budget) and serve it as a separate map, fetched lazily by the UI.
const fieldDetail = {};
// §10 reserve towers: a COMPACT per-field metric (not the full dossier detail) so the 3D
// column layer can render immediately without pulling the 5.8MB detail blob. Gas reserves
// (million m³) are converted to an oil-equivalent using the standard 6,000 scf/boe ≈ 164.3
// m³/boe factor — the same convention GOGET's own "converted" units already use elsewhere.
// Only fields with a real reported reserve value are emitted; fields with none stay as the
// plain neutral beacons already drawn by the point/cluster layer (never a fabricated 0-tower).
const M3_PER_BOE = 164.3;
const towers = [];
function towerMetric(reserves) {
  const val = (product) => { const r = reserves.find((x) => x.product === product); return r?.valueConverted ?? 0; };
  const oil = val('oil');
  const cap = val('condensate') + val('NGL');
  const gas = val('gas') / M3_PER_BOE;
  const total = oil + cap + gas;
  return total > 0 ? { oil, gas, cap, total } : null;
}
const dedupe = (arr) => arr
  .filter((f) => !identity.aliasToCanonical.has(f.properties.id))   // drop claimed duplicates
  .map((f) => {
    const m = aliasMeta.get(f.properties.id);
    if (m) { f.properties.aliases = m.aliases; f.properties.sources = m.sources; }
    if (f.properties.type === 'Field') {
      const detail = enrichField(f.properties);
      if (detail.fuelType || detail.reserves.length || detail.production.length || detail.enrichedFrom) fieldDetail[f.properties.id] = detail;
      const metric = towerMetric(detail.reserves);
      if (metric) {
        const c = centroidOf(f.geometry);
        if (c) towers.push({ id: f.properties.id, name: f.properties.name, lon: c[0], lat: c[1], ...metric });
      }
    }
    return f;
  });
const rawPoints = points.length, rawPolys = polygons.length;
points = dedupe(points);
polygons = dedupe(polygons);
fs.writeFileSync(path.join(osduDir, 'cockpit-identity.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: 'Directional cross-source resolution: each regulator/ANP field claims its single best GOGET twin by spatial proximity (≤15 km, country-gated) corroborated by name; never merged on name alone; native IDs retained as reviewed aliases.',
  stats: identity.stats,
  clusters: identity.clusters,
}));
console.log(`[identity] ${identity.stats.duplicatesCollapsed} duplicates collapsed → ${identity.stats.identities} identities (points ${rawPoints}→${points.length}, polygons ${rawPolys}→${polygons.length})`);
console.log(`[enrich] ${Object.keys(fieldDetail).length} field(s) carry GOGET fuel/lifecycle/reserves/production attributes (own or borrowed via identity alias) → cockpit-field-detail.json`);

// §4 spatial quality gate — normalize the USGS world layers in place so every renderer
// (globe / leaflet / mesh) reads dateline-safe geometry. Re-emit provinces + AUs.
function normalizeWorldLayer(rel) {
  const abs = path.join(root, 'public', 'world', rel);
  if (!fs.existsSync(abs)) return null;
  const fc = JSON.parse(fs.readFileSync(abs, 'utf8'));
  let before = 0, after = 0;
  for (const f of fc.features) {
    if (hasDatelineDefect(f.geometry)) before += 1;
    const safe = datelineSafe(f.geometry);
    f.geometry = safe ?? f.geometry;
    if (!safe || hasDatelineDefect(f.geometry)) after += 1;
  }
  fs.writeFileSync(abs, JSON.stringify(fc));
  console.log(`[antimeridian] ${rel}: ${before} defect(s) → ${after} remaining`);
  return fc;
}
const provinces = normalizeWorldLayer('provinces.geojson')
  ?? JSON.parse(fs.readFileSync(path.join(root, 'public', 'world', 'provinces.geojson'), 'utf8'));
const aus = normalizeWorldLayer('aus.geojson')
  ?? JSON.parse(fs.readFileSync(path.join(root, 'public', 'world', 'aus.geojson'), 'utf8'));

const pointInRing = ([x, y], ring) => {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const crosses = ((yi > y) !== (yj > y))
      && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
};
const polygonContains = (point, polygon) => pointInRing(point, polygon[0])
  && !polygon.slice(1).some((hole) => pointInRing(point, hole));
const geometryContains = (geometry, point) => {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return polygonContains(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((polygon) => polygonContains(point, polygon));
  return false;
};

const fieldLocations = [
  ...points.filter((item) => item.properties.type === 'Field').map((item) => item.geometry.coordinates),
  ...polygons.filter((item) => item.properties.type === 'Field').map((item) => centroidOf(item.geometry)).filter(Boolean),
];
const provinceFields = Object.fromEntries(provinces.features.map((item) => [item.properties.prvCode, 0]));
let matchedFields = 0;
for (const location of fieldLocations) {
  const match = provinces.features.find((item) => geometryContains(item.geometry, location));
  if (!match) continue;
  provinceFields[match.properties.prvCode] += 1;
  matchedFields += 1;
}
const topProvinces = provinces.features
  .map(({ properties }) => ({ prvCode: properties.prvCode, prvName: properties.prvName, fieldCount: provinceFields[properties.prvCode], boeMean: properties.boeMean }))
  .filter((item) => item.fieldCount > 0)
  .sort((a, b) => b.fieldCount - a.fieldCount);

fs.writeFileSync(path.join(osduDir, 'cockpit-insights.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  methodology: 'OSDU Field spatial centroids intersected with USGS World Petroleum Assessment province polygons in WGS84 (EPSG:4326).',
  totals: {
    osduRecords: recordCount,
    spatialFields: fieldLocations.length,
    matchedFields,
    assessedProvinces: provinces.features.length,
    matchRate: fieldLocations.length ? Math.round(matchedFields / fieldLocations.length * 1000) / 10 : 0,
  },
  topProvinces,
  provinceFields,
}));

const write = (name, obj) => {
  const target = path.join(osduDir, name);
  fs.writeFileSync(target, JSON.stringify(obj));
  return Math.round(fs.statSync(target).size / 1024);
};
const pointKb = write('cockpit-points.geojson', { type: 'FeatureCollection', features: points });
const polygonKb = write('cockpit-polygons.geojson', { type: 'FeatureCollection', features: polygons });
const detailKb = write('cockpit-field-detail.json', fieldDetail);

// §10 3D reserve towers — percentiles computed over the FULL real distribution at build time
// so the client's log/percentile-clamped height scale (and its legend) is stable and honest,
// never re-derived from whatever happens to be in the current viewport.
const sortedTotals = towers.map((t) => t.total).sort((a, b) => a - b);
const pctl = (p) => sortedTotals[Math.min(sortedTotals.length - 1, Math.floor(p * sortedTotals.length))];
const towerKb = write('cockpit-reserve-towers.json', {
  generatedAt: new Date().toISOString(),
  method: 'Reported reserves per field (oil + condensate + NGL, million bbl; gas converted at 164.3 m³/boe), summed to one MMBOE-equivalent per field. Height uses log10(1+MMBOE), clamped at the p99 percentile so a few in-place/giant outliers cannot flatten the rest of the world. Raw per-product values and their source classification are preserved in cockpit-field-detail.json.',
  unit: 'MMBOE-equivalent (oil + gas-as-boe + condensate/NGL)',
  percentiles: { p50: pctl(0.5), p90: pctl(0.9), p95: pctl(0.95), p99: pctl(0.99), max: sortedTotals.at(-1) ?? 0 },
  count: towers.length,
  towers,
});
console.log(`[cockpit-spatial] ${points.length} points (${pointKb}kb), ${polygons.length} polygons (${polygonKb}kb), field detail (${detailKb}kb), reserve towers ${towers.length} (${towerKb}kb)`);
console.log(`[cockpit-insights] ${matchedFields}/${fieldLocations.length} spatial fields matched to ${provinces.features.length} USGS provinces`);

// ── Stream D: OSDU-grounded search index (handoff §11) ──
// Grouped by entity type; each entry carries name + aliases + parent context + a fly-to
// target (lon/lat) when geometry exists, so selecting a result flies + opens the real dossier.
const norm = (s) => String(s || '').toLowerCase();
const searchEntries = [];
const fieldFly = (f) => {
  const c = f.geometry.type === 'Point' ? f.geometry.coordinates : centroidOf(f.geometry);
  return c ? { lon: c[0], lat: c[1] } : null;
};
for (const f of [...points, ...polygons].filter((x) => x.properties.type === 'Field')) {
  const p = f.properties;
  const aliasNames = (p.aliases || []).map((id) => recordById.get(id)?.record?.data?.Name).filter(Boolean);
  searchEntries.push({
    id: p.id, type: 'field', name: p.name, aliases: aliasNames,
    parent: [p.country, p.basin].filter(Boolean).join(' · '),
    source: p.source, fly: fieldFly(f),
    tokens: norm([p.name, ...aliasNames, p.country, p.basin, p.operator].join(' ')),
  });
}
for (const f of provinces.features) {
  searchEntries.push({
    id: `province:${f.properties.prvCode}`, type: 'province', name: f.properties.prvName, aliases: [f.properties.prvCode],
    parent: 'USGS petroleum province', source: 'USGS World Petroleum Assessment', fly: (() => { const c = centroidOf(f.geometry); return c ? { lon: c[0], lat: c[1] } : null; })(),
    tokens: norm(`${f.properties.prvName} ${f.properties.prvCode}`),
  });
}
for (const f of aus.features) {
  searchEntries.push({
    id: `au:${f.properties.auCode}`, type: 'assessment-unit', name: f.properties.auName, aliases: [f.properties.auCode],
    parent: f.properties.prvName || 'USGS assessment unit', source: 'USGS World Petroleum Assessment',
    fly: (() => { const c = centroidOf(f.geometry); return c ? { lon: c[0], lat: c[1] } : null; })(),
    tokens: norm(`${f.properties.auName} ${f.properties.auCode} ${f.properties.prvName || ''}`),
  });
}
for (const { record, source } of wellbores) {
  const d = record.data ?? {}; const ext = d.ExtensionProperties ?? {};
  const geom = d.SpatialLocation;
  const c = geom?.type === 'Point' ? geom.coordinates : null;
  const name = d.Name ?? d.WellboreName ?? record.id;
  searchEntries.push({
    id: record.id, type: 'wellbore', name, aliases: [],
    parent: [ext.FieldName ?? ext.Field, ext.CountryArea ?? ext.Country].filter(Boolean).join(' · '),
    source, fly: c ? { lon: c[0], lat: c[1] } : null,
    tokens: norm(`${name} ${ext.FieldName ?? ''} ${ext.CountryArea ?? ''}`),
  });
}
for (const { record, source } of organisations) {
  const name = record.data?.Name ?? record.id;
  searchEntries.push({ id: record.id, type: 'company', name, aliases: [], parent: 'Organisation', source, fly: null, tokens: norm(name) });
}
for (const { record, source } of geoEntities) {
  const name = record.data?.Name ?? record.id;
  searchEntries.push({ id: record.id, type: 'country', name, aliases: [], parent: 'Country / geopolitical entity', source, fly: null, tokens: norm(name) });
}
write('cockpit-search.json', {
  generatedAt: new Date().toISOString(),
  counts: searchEntries.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {}),
  entries: searchEntries,
});
console.log(`[search] ${searchEntries.length} indexed entries across ${new Set(searchEntries.map((e) => e.type)).size} entity types → cockpit-search.json`);
