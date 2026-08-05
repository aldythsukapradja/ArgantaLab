// build-gazetteer.mjs — one normalised place graph for the agent (L1).
//
// Run: node scripts/build-gazetteer.mjs   →   public/agent/gazetteer.json
// Requires: node scripts/build-crosswalk.mjs  (country ⇄ province edges)
//
// WHAT THIS FUSES
//   cockpit-search.json        fields · wellbores · companies (the long tail)
//   master-kb-spine.json       basins · petroleum systems · AUs · cycles · formations
//   master-kb-fields.json      field → basin/country/operator
//   crosswalk.json             country ⇄ province, country data extents, regions
//   world/{provinces,aus}.geojson   screening geometry → fly + bbox
//   wb/index.json              Volve well bundle → per-well data availability
//   cockpit-field-detail.json  production / reserves availability
//   cockpit-insights.json      province field counts + resource means
//   basin-figures/manifest.json     figure availability per basin
//
// THE TAXONOMY DECISION (agent gap G4)
// "Kutei Basin" is a USGS *province*. "Viking Graben" is an *assessment unit*
// under province "North Sea Graben" — but the KB also authors it as a *basin*.
// Users say "basin" for all three. Measured in the shipped data:
//   · 179 provinces ⇄ 179 basins, strictly 1:1, no province holds two basins
//   · 178 basins carry their province's name verbatim
//   · 1  basin (province 4025) is named "Viking Graben" instead of "North Sea Graben"
//   · 17 assessment units share a name with a basin
// So: ONE node per province/basin pair, kind `basin`, both native ids retained
// and the alternate name kept as an alias. No duplicate node, no invented tier.
// Where an AU shares its basin's name it is emitted separately (it is a real,
// finer tier) and cross-linked with `sameAs`, so the resolver answers with the
// basin and OFFERS the assessment unit rather than silently picking one.
//
// WHAT IS NOT SHIPPED
// normKeys, trigrams and phonetic codes are derived at load by resolve.ts. They
// would triple the payload to store what a pure function reproduces instantly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_BY_ISO, resolveCountryToken, toIso2 } from './lib/countries.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pub = (...p) => path.join(root, 'public', ...p);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const maybeJson = (p) => (fs.existsSync(p) ? readJson(p) : null);

const search = readJson(pub('osdu', 'cockpit-search.json'));
const spine = readJson(pub('kb', 'master-kb-spine.json'));
const kbFields = readJson(pub('kb', 'master-kb-fields.json')).field;
const crosswalk = readJson(pub('agent', 'crosswalk.json'));
const provincesGeo = readJson(pub('world', 'provinces.geojson'));
const ausGeo = readJson(pub('world', 'aus.geojson'));
const insights = readJson(pub('osdu', 'cockpit-insights.json'));
const scopeFields = readJson(pub('osdu', 'cockpit-scope-fields.json'));
const fieldDetail = readJson(pub('osdu', 'cockpit-field-detail.json'));
const wbIndex = maybeJson(pub('wb', 'index.json'));
const figureManifest = maybeJson(pub('basin-figures', 'manifest.json'));

const nodes = [];
const byId = new Map();
const warn = [];
function add(node) {
  if (byId.has(node.id)) { warn.push(`duplicate id ${node.id}`); return byId.get(node.id); }
  // Keep the payload lean: drop empty collections rather than ship [] 14k times.
  if (node.displayName === node.name) delete node.displayName;
  if (node.aliases && !node.aliases.length) node.aliases = [];
  for (const key of ['children', 'metrics', 'sameAs', 'nativeIds']) {
    const value = node[key];
    if (!value || (Array.isArray(value) ? !value.length : !Object.keys(value).length)) delete node[key];
  }
  nodes.push(node);
  byId.set(node.id, node);
  return node;
}
const edge = (kind, id, confidence, weight) => {
  const e = { kind, id, confidence };
  if (weight !== undefined) e.weight = weight;
  return e;
};

// ── geometry helpers ─────────────────────────────────────────────────────────

/** Bounding box of any GeoJSON geometry, dateline-naive (USGS screening polygons
 *  are already split at ±180 by the upstream normaliser). */
function geometryBbox(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      return;
    }
    for (const child of coords) walk(child);
  };
  if (!geometry?.coordinates) return null;
  walk(geometry.coordinates);
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

/** Screening-scale zoom from an extent, matching Cockpit.tsx's type-aware ladder. */
function zoomForBbox(bbox) {
  if (!bbox) return 4.5;
  const span = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]);
  if (span > 60) return 2.2;
  if (span > 25) return 3.2;
  if (span > 10) return 4.2;
  if (span > 4) return 5.2;
  if (span > 1.5) return 6.2;
  return 7.2;
}

const flyFromBbox = (bbox) => (bbox
  ? { lon: round((bbox[0] + bbox[2]) / 2, 4), lat: round((bbox[1] + bbox[3]) / 2, 4), zoom: zoomForBbox(bbox) }
  : null);

const round = (n, dp = 4) => (Number.isFinite(n) ? Math.round(n * 10 ** dp) / 10 ** dp : null);
const roundBbox = (b) => (b ? b.map((n) => round(n, 3)) : null);
const slug = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tail = (id) => String(id ?? '').split(':').pop();

// ── 1 · regions ──────────────────────────────────────────────────────────────

for (const region of crosswalk.regions) {
  add({
    id: `gaz:region:${region.code}`,
    kind: 'region',
    name: region.name,
    displayName: `${region.name} (USGS region ${region.code})`,
    aliases: [region.code, `region ${region.code}`],
    parents: [],
    children: [
      { kind: 'basin', count: region.provinces },
      { kind: 'country', count: region.countries.length },
    ],
    fly: null,
    sources: ['USGS'],
    has: { basins: region.provinces, countries: region.countries.length },
    nativeIds: [`atlas:region:usgs:${region.code}`],
  });
}

// ── 2 · countries ────────────────────────────────────────────────────────────
// Every country any source mentions gets a node, including ones with no basin
// and no field. "I have no data for Albania" is a better answer than "no such
// place", and only a node can carry that distinction honestly.

const crosswalkCountry = new Map(crosswalk.countries.map((c) => [c.iso2, c]));
const isoSeen = new Set(crosswalkCountry.keys());
for (const entry of search.entries) {
  if (entry.type === 'country') { const iso = toIso2(entry.name); if (iso) isoSeen.add(iso); }
}
for (const country of spine.country) { const iso = toIso2(country.name); if (iso) isoSeen.add(iso); }

const countryFieldCount = new Map();
for (const field of kbFields) {
  const iso = toIso2(field.country_id);
  if (iso) countryFieldCount.set(iso, (countryFieldCount.get(iso) ?? 0) + 1);
}

for (const iso2 of [...isoSeen].sort()) {
  const meta = COUNTRY_BY_ISO.get(iso2);
  if (!meta) continue;
  const cw = crosswalkCountry.get(iso2) ?? null;
  const basins = cw ? cw.provinces : 0;
  const fields = countryFieldCount.get(iso2) ?? cw?.fields ?? 0;
  add({
    id: `gaz:country:${iso2}`,
    kind: 'country',
    name: meta.name,
    displayName: meta.name,
    aliases: [iso2, ...meta.aliases],
    parents: cw?.primaryRegion ? [edge('region', `gaz:region:${cw.primaryRegion}`, 'membership', cw.fields)] : [],
    children: [
      { kind: 'basin', count: basins },
      { kind: 'field', count: fields },
    ],
    fly: cw?.dataExtent?.fly ?? null,
    bbox: roundBbox(cw?.dataExtent?.bbox ?? null),
    sources: cw ? ['USGS', 'GOGET'] : ['GOGET'],
    has: { basins, fields, extent: !!cw?.dataExtent },
  });
}

// ── 3 · basins (= USGS provinces, fused 1:1) ─────────────────────────────────

const basinRowByProvinceId = new Map(spine.basin.map((b) => [b.province_id, b]));
const completionByBasinId = new Map(spine.basinCompletion.map((c) => [c.basin_id, c]));
const provinceGeoByCode = new Map(provincesGeo.features.map((f) => [String(f.properties.prvCode), f]));

const tpsByProvinceId = new Map();
for (const tps of spine.petroleumSystem) {
  if (!tpsByProvinceId.has(tps.province_id)) tpsByProvinceId.set(tps.province_id, []);
  tpsByProvinceId.get(tps.province_id).push(tps);
}
const auByTpsId = new Map();
for (const au of spine.assessmentUnit) {
  if (!auByTpsId.has(au.tps_id)) auByTpsId.set(au.tps_id, []);
  auByTpsId.get(au.tps_id).push(au);
}
const cyclesByBasinId = new Map();
for (const cycle of spine.basinCycle) {
  if (!cyclesByBasinId.has(cycle.basin_id)) cyclesByBasinId.set(cycle.basin_id, []);
  cyclesByBasinId.get(cycle.basin_id).push(cycle);
}
const figuresByBasinId = new Map();
for (const link of spine.figureLinks) {
  if (link.entity_type !== 'basin') continue;
  figuresByBasinId.set(link.entity_id, (figuresByBasinId.get(link.entity_id) ?? 0) + 1);
}
const openFiguresByBasinId = new Map();
if (figureManifest?.figures) {
  for (const figure of figureManifest.figures) {
    if (figure.restricted) continue;
    const key = figure.basin_id;
    openFiguresByBasinId.set(key, (openFiguresByBasinId.get(key) ?? 0) + 1);
  }
}
const psModelCountByTps = new Map();
for (const model of spine.psModel) psModelCountByTps.set(model.tps_id, (psModelCountByTps.get(model.tps_id) ?? 0) + 1);

const crosswalkProvince = new Map(crosswalk.provinces.map((p) => [p.code, p]));
const basinIdByCode = new Map();

for (const feature of provincesGeo.features) {
  const code = String(feature.properties.prvCode);
  const provinceName = feature.properties.prvName;
  const provinceId = `atlas:province:usgs:${code}`;
  const basinRow = basinRowByProvinceId.get(provinceId) ?? null;
  const cw = crosswalkProvince.get(code) ?? null;

  // 178 of 179 basins carry the province's own name. The one that does not
  // (4025 → "Viking Graben") is the KB deliberately naming the basin inside the
  // container; that name leads, and the province name becomes an alias.
  const basinName = basinRow?.name ?? provinceName;
  const renamed = basinName !== provinceName;
  const aliases = [code, `province ${code}`];
  if (renamed) aliases.push(provinceName);

  const tpsList = tpsByProvinceId.get(provinceId) ?? [];
  const auCount = tpsList.reduce((sum, tps) => sum + (auByTpsId.get(tps.tps_id)?.length ?? 0), 0);
  const cycles = basinRow ? (cyclesByBasinId.get(basinRow.basin_id)?.length ?? 0) : 0;
  const figures = basinRow ? (figuresByBasinId.get(basinRow.basin_id) ?? 0) : 0;
  const openFigures = basinRow ? (openFiguresByBasinId.get(basinRow.basin_id) ?? 0) : 0;
  const psModels = tpsList.reduce((sum, tps) => sum + (psModelCountByTps.get(tps.tps_id) ?? 0), 0);
  const completion = basinRow ? completionByBasinId.get(basinRow.basin_id) ?? null : null;
  const memberFields = (scopeFields.provinces[code] ?? []).length;

  const bbox = roundBbox(geometryBbox(feature.geometry));
  const id = `gaz:basin:${code}`;
  basinIdByCode.set(code, id);

  const countries = cw?.countries ?? [];
  const parents = countries.map((c) => edge('country', `gaz:country:${c.country}`, c.confidence, c.fields));
  parents.push(edge('region', `gaz:region:${code[0]}`, 'authoritative'));

  add({
    id,
    kind: 'basin',
    name: basinName,
    displayName: renamed
      ? `${basinName} — USGS ${provinceName} province`
      : (countries.length ? `${basinName} (${countries.slice(0, 2).map((c) => COUNTRY_BY_ISO.get(c.country)?.name ?? c.country).join(', ')}${countries.length > 2 ? ' +' : ''})` : basinName),
    aliases,
    parents,
    children: [
      { kind: 'petroleum-system', count: tpsList.length },
      { kind: 'assessment-unit', count: auCount },
      { kind: 'basin-cycle', count: cycles },
      { kind: 'field', count: memberFields },
    ],
    fly: flyFromBbox(bbox),
    bbox,
    sources: ['USGS', ...(basinRow?.classification_status === 'source-classified' ? ['Arganta'] : [])],
    has: {
      polygon: true,
      fields: memberFields,
      countries: countries.length,
      petroleumSystems: tpsList.length,
      assessmentUnits: auCount,
      cycles,
      figures,
      openFigures,
      psModels,
      classified: !!basinRow?.classification_status && basinRow.classification_status !== 'unclassified',
      completionPct: completion ? completion.completion_pct : 0,
    },
    metrics: {
      oilMean_mmbbl: feature.properties.oilMean ?? null,
      gasMean_bcf: feature.properties.gasMean ?? null,
      boeMean_mmboe: feature.properties.boeMean ?? null,
      fieldCount: insights.provinceFields?.[code] ?? memberFields,
    },
    nativeIds: [provinceId, basinRow?.basin_id].filter(Boolean),
  });
}

// ── 4 · petroleum systems ────────────────────────────────────────────────────

const tpsIdToGaz = new Map();
for (const tps of spine.petroleumSystem) {
  const provinceCode = tail(tps.province_id);
  const basinId = basinIdByCode.get(provinceCode);
  const id = `gaz:petroleum-system:${tps.code}`;
  tpsIdToGaz.set(tps.tps_id, id);
  const aus = auByTpsId.get(tps.tps_id) ?? [];
  add({
    id,
    kind: 'petroleum-system',
    name: tps.name,
    displayName: basinId ? `${tps.name} — ${byId.get(basinId)?.name ?? ''} TPS` : tps.name,
    aliases: [tps.code],
    parents: basinId ? [edge('basin', basinId, 'authoritative')] : [],
    children: [{ kind: 'assessment-unit', count: aus.length }],
    fly: basinId ? byId.get(basinId)?.fly ?? null : null,
    sources: ['USGS'],
    has: {
      assessmentUnits: aus.length,
      psModels: psModelCountByTps.get(tps.tps_id) ?? 0,
      sourceRock: !!tps.source_rock_formation,
      evidence: !!tps.essential_elements_note,
    },
    nativeIds: [tps.tps_id],
  });
}

// ── 5 · assessment units ─────────────────────────────────────────────────────

const auGeoByCode = new Map(ausGeo.features.map((f) => [String(f.properties.auCode ?? f.properties.AU_CODE ?? f.properties.code), f]));
const basinNameToId = new Map();
for (const node of nodes) if (node.kind === 'basin') basinNameToId.set(node.name.toLowerCase(), node.id);

const auSameAs = [];
for (const au of spine.assessmentUnit) {
  const tpsGaz = tpsIdToGaz.get(au.tps_id);
  const provinceCode = String(au.code).slice(0, 4);
  const basinId = basinIdByCode.get(provinceCode);
  const geo = auGeoByCode.get(String(au.code));
  const bbox = geo ? roundBbox(geometryBbox(geo.geometry)) : null;
  const id = `gaz:assessment-unit:${au.code}`;

  // An AU that shares its basin's name is the SAME geography at a finer tier —
  // cross-link both ways so the resolver can answer with one and offer the other.
  const twin = basinNameToId.get(au.name.toLowerCase());
  const sameAs = twin && byId.get(twin) && String(twin) === String(basinId) ? [twin] : [];
  if (sameAs.length) auSameAs.push([twin, id]);

  add({
    id,
    kind: 'assessment-unit',
    name: au.name,
    displayName: basinId ? `${au.name} — assessment unit in ${byId.get(basinId)?.name ?? ''}` : au.name,
    aliases: [String(au.code)],
    parents: [
      ...(tpsGaz ? [edge('petroleum-system', tpsGaz, 'authoritative')] : []),
      ...(basinId ? [edge('basin', basinId, 'authoritative')] : []),
    ],
    fly: bbox ? flyFromBbox(bbox) : (basinId ? byId.get(basinId)?.fly ?? null : null),
    bbox,
    sources: ['USGS'],
    has: {
      polygon: !!bbox,
      assessed: au.status === 'Assessed',
      fields: (scopeFields.assessmentUnits[String(au.code)] ?? []).length,
    },
    metrics: {
      oilMean_mmbbl: au.oilMean_mmbbl ?? null,
      gasMean_bcf: au.gasMean_bcf ?? null,
    },
    sameAs,
    nativeIds: [au.au_id],
  });
}
// Back-link the basin side of every twin.
for (const [basinId, auId] of auSameAs) {
  const basin = byId.get(basinId);
  if (!basin) continue;
  basin.sameAs = [...(basin.sameAs ?? []), auId];
}

// ── 6 · basin cycles ─────────────────────────────────────────────────────────

const basinIdByAtlasBasin = new Map();
for (const node of nodes) {
  if (node.kind !== 'basin') continue;
  for (const native of node.nativeIds ?? []) basinIdByAtlasBasin.set(native, node.id);
}
for (const cycle of spine.basinCycle) {
  const basinId = basinIdByAtlasBasin.get(cycle.basin_id);
  add({
    id: `gaz:basin-cycle:${slug(tail(cycle.cycle_id))}`,
    kind: 'basin-cycle',
    name: cycle.title,
    displayName: basinId ? `${cycle.title} — ${byId.get(basinId)?.name ?? ''}` : cycle.title,
    aliases: [cycle.stage].filter(Boolean),
    parents: basinId ? [edge('basin', basinId, 'authoritative')] : [],
    fly: basinId ? byId.get(basinId)?.fly ?? null : null,
    sources: ['Arganta'],
    has: {
      timed: Number.isFinite(cycle.age_top_ma) && Number.isFinite(cycle.age_base_ma),
      cited: cycle.citation_status === 'cited',
    },
    metrics: { ageTopMa: cycle.age_top_ma ?? null, ageBaseMa: cycle.age_base_ma ?? null },
    nativeIds: [cycle.cycle_id],
  });
}

// ── 7 · formations ───────────────────────────────────────────────────────────

for (const formation of spine.formation) {
  const basinIds = String(formation.basin_ids ?? '').split(';').map((s) => s.trim()).filter(Boolean);
  const parents = basinIds.map((b) => basinIdByAtlasBasin.get(b)).filter(Boolean)
    .map((id) => edge('basin', id, 'authoritative'));
  add({
    id: `gaz:formation:${slug(tail(formation.formation_id))}`,
    kind: 'formation',
    name: formation.canonical_name,
    displayName: formation.canonical_name,
    aliases: String(formation.aliases ?? '').split(';').map((s) => s.trim()).filter(Boolean),
    parents,
    fly: parents.length ? byId.get(parents[0].id)?.fly ?? null : null,
    sources: ['USGS', 'Arganta'],
    has: { basins: parents.length, occurrences: formation.occurrence_count ?? 0 },
    nativeIds: [formation.formation_id],
  });
}

// ── 8 · fields (the long tail) ───────────────────────────────────────────────

// 359 of the 8,033 KB field rows are GOGET records with no name at all
// ("noid-row7673"). They still count as fields for a country, but they cannot be
// name-joined to a search entry, so they simply never match.
const kbFieldByName = new Map();
let namelessKbFields = 0;
for (const field of kbFields) {
  if (!field.name) { namelessKbFields += 1; continue; }
  kbFieldByName.set(field.name.toLowerCase(), field);
}

/** provinceCode for a field id, from the spatial membership index. */
const provinceCodeByFieldId = new Map();
for (const [code, members] of Object.entries(scopeFields.provinces)) {
  for (const member of members) provinceCodeByFieldId.set(member.id, code);
}

// The one field with a deep bundle. `cockpit-field-detail.json` carries NO Volve
// record — a known upstream gap — so reading availability from that file alone
// would have the agent claim the flagship field has no production, while
// public/wb/prod-*.json sits right there. Bundle coverage is folded in below.
const bundleFieldShort = wbIndex?.official?.fieldNpdid ? `no-field-${wbIndex.official.fieldNpdid}` : null;
const bundleFiles = fs.existsSync(pub('wb')) ? fs.readdirSync(pub('wb')) : [];
const bundleHas = {
  wells: wbIndex?.wells?.length ?? 0,
  logs: bundleFiles.some((f) => f.startsWith('logs-')),
  trajectory: bundleFiles.some((f) => f.startsWith('traj-')),
  drilling: bundleFiles.some((f) => f.startsWith('drill-')),
  pressure: bundleFiles.some((f) => f.startsWith('press-')),
  production: bundleFiles.some((f) => f.startsWith('prod-')),
  surfaces: wbIndex?.surfaces?.length ?? 0,
  picks: bundleFiles.includes('picks.json'),
};

const fieldGazByOsduId = new Map();
for (const entry of search.entries) {
  if (entry.type !== 'field') continue;
  const short = tail(entry.id);
  const id = `gaz:field:${short}`;
  const detail = fieldDetail[entry.id] ?? null;
  const kb = kbFieldByName.get(entry.name.toLowerCase()) ?? null;
  const provinceCode = provinceCodeByFieldId.get(entry.id) ?? null;
  const basinId = provinceCode ? basinIdByCode.get(provinceCode) : null;
  const countryVerdict = resolveCountryToken(entry.parent);
  const countryId = countryVerdict.kind === 'country' ? `gaz:country:${countryVerdict.iso2}` : null;

  const parents = [];
  if (basinId) parents.push(edge('basin', basinId, 'spatial'));
  if (countryId && byId.has(countryId)) parents.push(edge('country', countryId, 'authoritative'));

  const bundled = bundleFieldShort !== null && short === bundleFieldShort;
  const production = (Array.isArray(detail?.production) && detail.production.length > 0)
    || (bundled && bundleHas.production);
  const reserves = Array.isArray(detail?.reserves) && detail.reserves.length > 0;

  fieldGazByOsduId.set(entry.id, id);
  add({
    id,
    kind: 'field',
    name: entry.name,
    displayName: entry.name,
    aliases: entry.aliases ?? [],
    parents,
    fly: entry.fly ? { ...entry.fly, zoom: 9.5 } : null,
    sources: [entry.source, ...(bundled ? ['Volve'] : [])].filter(Boolean),
    has: {
      detail: !!detail,
      production,
      reserves,
      kb: !!kb,
      operator: !!(detail?.operator || kb?.operator),
      discoveryYear: !!(detail?.discoveryYear || kb?.discovery_year),
      point: !!entry.fly,
      // Deep-bundle flags. Only ever true for the one field that has a bundle;
      // every other field reports a measured false, which is what lets the agent
      // decline "show me the logs" with a reason instead of a shrug.
      bundle: bundled,
      logs: bundled && bundleHas.logs,
      trajectory: bundled && bundleHas.trajectory,
      drilling: bundled && bundleHas.drilling,
      pressure: bundled && bundleHas.pressure,
      picks: bundled && bundleHas.picks,
      wells: bundled ? bundleHas.wells : 0,
      surfaces: bundled ? bundleHas.surfaces : 0,
    },
    nativeIds: [entry.id, kb?.field_id].filter(Boolean),
  });
}

// ── 9 · wells and wellbores ──────────────────────────────────────────────────
// The only field with a well bundle is Volve. Every other wellbore in the search
// index is a name and a location — the availability flags say exactly that, so
// the agent can refuse "show me the logs" for Badak with a reason.

const volveFieldGaz = fieldGazByOsduId.get('arganta:master-data--Field:no-field-3420717')
  ?? [...byId.values()].find((n) => n.kind === 'field' && n.name.toUpperCase() === 'VOLVE')?.id
  ?? null;

const volveWellHas = new Map();
if (wbIndex?.wells) {
  for (const well of wbIndex.wells) volveWellHas.set(well.name.toUpperCase(), well.has ?? {});
}

for (const entry of search.entries) {
  if (entry.type !== 'wellbore') continue;
  const short = tail(entry.id);
  const has = volveWellHas.get(String(entry.name).toUpperCase()) ?? null;
  add({
    id: `gaz:wellbore:${short}`,
    kind: 'wellbore',
    name: entry.name,
    displayName: entry.name,
    aliases: entry.aliases ?? [],
    parents: [],
    fly: entry.fly ? { ...entry.fly, zoom: 12 } : null,
    sources: [entry.source].filter(Boolean),
    has: {
      point: !!entry.fly,
      bundle: !!has,
      logs: !!has?.logs,
      trajectory: !!has?.traj,
      picks: !!has?.picks,
      drilling: !!has?.drilling,
      pressure: !!has?.pressure,
      production: !!has?.production,
    },
    nativeIds: [entry.id],
  });
}

// Volve bundle wells that the search index does not carry (F-series sidetracks).
if (wbIndex?.wells) {
  for (const well of wbIndex.wells) {
    const id = `gaz:well:volve-${slug(well.name)}`;
    if (byId.has(id)) continue;
    add({
      id,
      kind: 'well',
      name: well.name,
      displayName: `${well.name} — Volve`,
      aliases: [well.well, well.npdid ? String(well.npdid) : null].filter(Boolean),
      parents: volveFieldGaz ? [edge('field', volveFieldGaz, 'authoritative')] : [],
      fly: null,
      sources: ['Volve', 'Sodir'],
      has: {
        bundle: true,
        logs: !!well.has?.logs,
        trajectory: !!well.has?.traj,
        picks: !!well.has?.picks,
        drilling: !!well.has?.drilling,
        pressure: !!well.has?.pressure,
        production: !!well.has?.production,
      },
      metrics: { tdMd: well.td_md ?? null, tdTvd: well.td_tvd ?? null },
    });
  }
}

// ── 10 · companies ───────────────────────────────────────────────────────────

for (const entry of search.entries) {
  if (entry.type !== 'company') continue;
  add({
    id: `gaz:company:${tail(entry.id)}`,
    kind: 'company',
    name: entry.name,
    displayName: entry.name,
    aliases: entry.aliases ?? [],
    parents: [],
    fly: null,
    sources: [entry.source].filter(Boolean),
    has: {},
    nativeIds: [entry.id],
  });
}

// ── children counts for countries, from the graph itself ─────────────────────

const childTally = new Map();
for (const node of nodes) {
  for (const parent of node.parents ?? []) {
    if (!childTally.has(parent.id)) childTally.set(parent.id, new Map());
    const tally = childTally.get(parent.id);
    tally.set(node.kind, (tally.get(node.kind) ?? 0) + 1);
  }
}
for (const [parentId, tally] of childTally) {
  const parent = byId.get(parentId);
  if (!parent) continue;
  const existing = new Map((parent.children ?? []).map((c) => [c.kind, c.count]));
  for (const [kind, count] of tally) if (!existing.has(kind) || existing.get(kind) === 0) existing.set(kind, count);
  const children = [...existing.entries()].filter(([, count]) => count > 0).map(([kind, count]) => ({ kind, count }));
  if (children.length) parent.children = children; else delete parent.children;
}

// ── integrity ────────────────────────────────────────────────────────────────

const dangling = [];
for (const node of nodes) {
  for (const parent of node.parents ?? []) if (!byId.has(parent.id)) dangling.push(`${node.id} → ${parent.id}`);
  for (const same of node.sameAs ?? []) if (!byId.has(same)) dangling.push(`${node.id} sameAs ${same}`);
}

const counts = {};
for (const node of nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;

// ── emit · core + tail ───────────────────────────────────────────────────────
// Fields and wellbores are 11,669 of the 14,069 nodes and 83% of the bytes, but
// they are the SHALLOWEST nodes: a name, a point, one or two parents and a
// handful of flags. Shipping them in the same verbose shape as a basin costs
// 5 MB to say almost nothing, and blocks the first answer behind a 6.5 MB fetch.
//
// So the payload splits:
//   gazetteer.json       containers — regions, countries, basins, TPS, AUs,
//                        cycles, formations, wells, companies. Loaded eagerly;
//                        answers "kutei basin", "indonesia", "viking graben".
//   gazetteer-tail.json  fields + wellbores in a COMPACT ROW FORM described by
//                        its own header. Loaded in parallel; the resolver simply
//                        has a smaller haystack until it lands.
//
// The tail's row form is documented in `encoding` and expanded by exactly one
// function (expandTailRow in src/agent/gazetteer.ts), which the truth-lock test
// checks round-trips to the same GazNode shape the core file ships directly.

const TAIL_KINDS = new Set(['field', 'wellbore']);
const ID_PREFIX = {
  field: 'arganta:master-data--Field:',
  wellbore: 'arganta:master-data--Wellbore:',
};
// One char per availability flag, in a fixed order. Absent = false; every flag
// listed here IS assessed for every row, so absence means "no", not "unknown".
const TAIL_FLAGS = {
  field: {
    d: 'detail', p: 'production', r: 'reserves', k: 'kb', o: 'operator', y: 'discoveryYear', P: 'point',
    B: 'bundle', l: 'logs', t: 'trajectory', g: 'drilling', s: 'pressure', c: 'picks',
  },
  wellbore: { P: 'point', b: 'bundle', l: 'logs', t: 'trajectory', c: 'picks', g: 'drilling', s: 'pressure', p: 'production' },
};
// Counts that only exist for a node carrying the deep bundle. Kept out of the
// flag string (which is boolean-only) and applied on expansion.
const BUNDLE_COUNTS = { wells: bundleHas.wells, surfaces: bundleHas.surfaces };
const TAIL_COLUMNS = {
  field: ['id', 'name', 'lon', 'lat', 'basin', 'country', 'source', 'flags'],
  wellbore: ['id', 'name', 'lon', 'lat', 'source', 'flags'],
};

const sourceList = [...new Set(nodes.filter((n) => TAIL_KINDS.has(n.kind)).flatMap((n) => n.sources))].sort();
const sourceIdx = new Map(sourceList.map((s, i) => [s, i]));
const packFlags = (kind, has) => Object.entries(TAIL_FLAGS[kind])
  .filter(([, name]) => !!has[name]).map(([char]) => char).join('');

const coreNodes = nodes.filter((n) => !TAIL_KINDS.has(n.kind));
const tailRows = { field: [], wellbore: [] };
for (const node of nodes) {
  if (!TAIL_KINDS.has(node.kind)) continue;
  const short = node.id.slice(`gaz:${node.kind}:`.length);
  const lon = node.fly ? node.fly.lon : null;
  const lat = node.fly ? node.fly.lat : null;
  const src = sourceIdx.get(node.sources[0]) ?? -1;
  if (node.kind === 'field') {
    const basin = node.parents.find((p) => p.kind === 'basin');
    const country = node.parents.find((p) => p.kind === 'country');
    tailRows.field.push([
      short, node.name, lon, lat,
      basin ? basin.id.slice('gaz:basin:'.length) : null,
      country ? country.id.slice('gaz:country:'.length) : null,
      src, packFlags('field', node.has),
    ]);
  } else {
    tailRows.wellbore.push([short, node.name, lon, lat, src, packFlags('wellbore', node.has)]);
  }
}

// Aliases are rare in the tail (911 of 12,562 entries) — ship them as a sparse
// side-map rather than an empty array on every row.
const tailAliases = {};
for (const node of nodes) {
  if (!TAIL_KINDS.has(node.kind) || !node.aliases?.length) continue;
  tailAliases[node.id.slice(`gaz:${node.kind}:`.length)] = node.aliases;
}

const METHOD = [
  'One node per real-world place, fused across cockpit-search, master-kb-spine, the country⇄province crosswalk and the USGS screening polygons.',
  'USGS province and KB basin are 1:1 in the shipped data and are emitted as ONE node of kind `basin`, retaining both native ids.',
  'An assessment unit sharing its basin name is emitted separately and cross-linked with sameAs — the finer tier is real and is offered, never silently merged.',
  'Match keys, trigrams and phonetic codes are derived at load, not shipped.',
  '`has` records measured data availability only. In the core file an absent key means not-assessed; in the tail every flag in `encoding.flags` is assessed for every row, so absent means false.',
].join(' ');

const core = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  method: METHOD,
  counts: { ...counts, total: nodes.length, core: coreNodes.length, tail: nodes.length - coreNodes.length, danglingEdges: dangling.length },
  tailFile: 'gazetteer-tail.json',
  nodes: coreNodes,
};

const tailPayload = {
  version: '1.0.0',
  generatedAt: core.generatedAt,
  note: 'Compact row form for the field/wellbore long tail. Expand with expandTailRow() in src/agent/gazetteer.ts — never read these rows directly.',
  encoding: {
    columns: TAIL_COLUMNS,
    flags: TAIL_FLAGS,
    idPrefix: ID_PREFIX,
    gazPrefix: { field: 'gaz:field:', wellbore: 'gaz:wellbore:' },
    zoom: { field: 9.5, wellbore: 12 },
    parentConfidence: { basin: 'spatial', country: 'authoritative' },
    bundleCounts: BUNDLE_COUNTS,
    sources: sourceList,
  },
  counts: { field: tailRows.field.length, wellbore: tailRows.wellbore.length },
  aliases: tailAliases,
  rows: tailRows,
};

fs.writeFileSync(pub('agent', 'gazetteer.json'), JSON.stringify(core));
fs.writeFileSync(pub('agent', 'gazetteer-tail.json'), JSON.stringify(tailPayload));
const mb = (p) => fs.statSync(pub('agent', p)).size / 1024 / 1024;
const coreMb = mb('gazetteer.json');
const tailMb = mb('gazetteer-tail.json');

console.log('[gazetteer] nodes by kind:');
for (const [kind, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`             ${String(count).padStart(6)}  ${kind}`);
console.log(`[gazetteer] ${nodes.length} nodes total (${coreNodes.length} core · ${nodes.length - coreNodes.length} tail)`);
console.log(`[gazetteer] ${namelessKbFields} KB field rows carry no name and cannot be joined`);
console.log(`[gazetteer] ${dangling.length} dangling edges${dangling.length ? `: ${dangling.slice(0, 5).join(', ')}` : ''}`);
if (warn.length) console.log(`[gazetteer] WARNING ${warn.length}: ${warn.slice(0, 5).join(', ')}`);
console.log(`[gazetteer] wrote gazetteer.json ${coreMb.toFixed(2)} MB + gazetteer-tail.json ${tailMb.toFixed(2)} MB = ${(coreMb + tailMb).toFixed(2)} MB`);
if (coreMb > 1.5) console.log('[gazetteer] WARNING core over the 1.5 MB eager-load budget');
if (coreMb + tailMb > 2.5) console.log('[gazetteer] WARNING total over the 2.5 MB payload budget');
