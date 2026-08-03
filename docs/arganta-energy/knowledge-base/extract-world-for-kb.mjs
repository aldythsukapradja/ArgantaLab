// extract-world-for-kb.mjs — one-off extraction pulling REAL, already-ingested
// world-scale USGS DDS-69 (2012) + GOGET (GEM, CC-BY-4.0) data into a compact,
// clean intermediate JSON for the ArgantaEnergy Master KB workbook. Reads only;
// writes nothing back into the app. IDs follow src/atlas/spine.ts's makeId()
// convention (atlas:{entity}:{authority}:{nativeId}) so they drop into the same
// scheme already used for Volve.
import { readFileSync, writeFileSync } from 'node:fs';

const regions = JSON.parse(readFileSync('public/world/regions.json', 'utf8'));
const countriesAgg = JSON.parse(readFileSync('public/world/countries.json', 'utf8'));
const provincesGeo = JSON.parse(readFileSync('public/world/provinces.geojson', 'utf8')).features.map((f) => f.properties);
const ausGeo = JSON.parse(readFileSync('public/world/aus.geojson', 'utf8')).features.map((f) => f.properties);
const crosswalk = JSON.parse(readFileSync('public/osdu/cockpit-scope-fields.json', 'utf8'));
const goget = JSON.parse(readFileSync('data-energy/generated/osdu/goget.manifest.json', 'utf8'));

// ── province -> region (derived from aus.geojson; flag any inconsistency) ──────
const provRegion = {};
const provRegionConflicts = [];
const normReg = (s) => String(s).replace(/^0+(?=\d)/, ''); // '00' and '0' both -> '0'
for (const a of ausGeo) {
  const norm = normReg(a.regCode);
  const cur = provRegion[a.prvCode];
  if (!cur) provRegion[a.prvCode] = { regCode: norm, regName: a.regName };
  else if (cur.regCode !== norm) provRegionConflicts.push({ prvCode: a.prvCode, seen: cur.regCode, also: norm });
}

// ── provinces (179) ─────────────────────────────────────────────────────────
const provinces = provincesGeo.map((p) => ({
  prvCode: p.prvCode, prvName: p.prvName,
  regCode: provRegion[p.prvCode]?.regCode ?? null, regName: provRegion[p.prvCode]?.regName ?? null,
  oilMean: p.oilMean, gasMean: p.gasMean, boeMean: p.boeMean,
}));

// ── assessment units (340) + dedup petroleum systems, keyed by the DERIVED
// numeric code (prvCode + digits[5:6] of the AU code) — the authoritative key per
// USGS's own 8-digit scheme (verified 2026-08-02). Grouping by name alone
// collides where the raw name is null (9 of 198 groups); the code never does. ──
const assessmentUnits = ausGeo.map((a) => ({
  auCode: a.auCode, auName: a.auName, tps: a.tps, prvCode: a.prvCode, prvName: a.prvName,
  regCode: a.regCode, oilMean: a.oilMean, gasMean: a.gasMean, boeMean: a.boeMean,
}));
const psMap = new Map();
for (const a of ausGeo) {
  const tpsCode = a.prvCode + a.auCode.slice(4, 6); // e.g. 4025 + '01' = '402501'
  if (!psMap.has(tpsCode)) psMap.set(tpsCode, { tpsCode, prvCode: a.prvCode, prvName: a.prvName, tpsNames: new Set(), auCodes: [] });
  const g = psMap.get(tpsCode);
  if (a.tps) g.tpsNames.add(a.tps);
  g.auCodes.push(a.auCode);
}
const petroleumSystems = [...psMap.values()].map((g) => ({
  tpsCode: g.tpsCode, prvCode: g.prvCode, prvName: g.prvName,
  tps: g.tpsNames.size ? [...g.tpsNames].join(' / ') : null, auCodes: g.auCodes,
}));

// ── countries: real GOGET Country/Area strings (what fields actually FK into),
// left-joined to the aggregate resource stats in countries.json by exact name ──
const countryAggByName = new Map(countriesAgg.map((c) => [c.name, c]));
const gogetCountryNames = new Set();
for (const rec of goget.MasterData) {
  const m = rec.data?.ExtensionProperties?.MainData?.[0];
  if (m?.['Country/Area']) gogetCountryNames.add(m['Country/Area']);
}
const countries = [...gogetCountryNames].sort().map((name) => {
  const agg = countryAggByName.get(name);
  return { name, oilMean: agg?.oilMean ?? null, gasMean: agg?.gasMean ?? null, boeMean: agg?.boeMean ?? null, hasAggregate: !!agg };
});

// ── field -> province (invert the real spatial crosswalk), keyed by GOGET unit id ──
const fieldToProvince = new Map(); // 'l100000317196' (lowercased Unit ID) -> prvCode
for (const [prvCode, list] of Object.entries(crosswalk.provinces)) {
  for (const entry of list) {
    const m = /goget-(.+)$/.exec(entry.id);
    if (m) fieldToProvince.set(m[1], prvCode);
  }
}

// ── fields (8032 GOGET) ───────────────────────────────────────────────────────
const fields = [];
const provinceFieldBasinNames = {}; // prvCode -> Set of native GOGET Basin names (supplementary evidence)
let noUnitId = 0;
for (const [idx, rec] of goget.MasterData.entries()) {
  const m = rec.data?.ExtensionProperties?.MainData?.[0];
  if (!m) continue;
  // ~359 of 8032 raw records have no 'Unit ID' in the source workbook at all — a real
  // gap in GOGET's own data, not something we introduce. Give those a clearly-flagged
  // synthetic fallback key so the real name/country/operator data isn't silently
  // dropped, rather than fabricating a plausible-looking Unit ID.
  const hasRealId = m['Unit ID'] != null && m['Unit ID'] !== '';
  if (!hasRealId) noUnitId++;
  const unitId = hasRealId ? m['Unit ID'] : `NOID-ROW${idx}`;
  const key = String(unitId).toLowerCase();
  const prvCode = fieldToProvince.get(key) ?? null;
  if (prvCode && m['Basin']) {
    (provinceFieldBasinNames[prvCode] ??= new Set()).add(m['Basin']);
  }
  fields.push({
    unitId, hasRealId, name: m['Unit Name'] ?? null, country: m['Country/Area'] ?? null,
    fuelType: m['Fuel type'] ?? null, status: m['Status'] ?? null, statusYear: m['Status year'] ?? null,
    discoveryYear: m['Discovery year'] ?? null, productionStartYear: m['Production start year'] ?? null,
    operator: m['Operator'] ?? null, lat: m['Latitude'] ?? null, lon: m['Longitude'] ?? null,
    onshoreOffshore: m['Onshore/Offshore'] ?? null, nativeBasinName: m['Basin'] ?? null,
    block: m['Block(s)'] ?? null, prvCode,
  });
}
const provinceBasinNames = Object.fromEntries(
  Object.entries(provinceFieldBasinNames).map(([k, v]) => [k, [...v].sort()]),
);

const out = {
  meta: {
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: {
      usgsWorld: 'apps/energy/public/world/* — USGS 2012 World Assessment of Undiscovered Oil and Gas Resources (DDS-69), Public Domain',
      goget: 'apps/energy/data-energy/generated/osdu/goget.manifest.json — GEM Global Oil and Gas Extraction Tracker, CC-BY-4.0 (built from data-energy/raw/goget/*.xlsx)',
      crosswalk: 'apps/energy/public/osdu/cockpit-scope-fields.json — real spatial (point-in-polygon) join of GOGET field centroids against USGS province/AU polygons',
    },
    counts: {
      regions: regions.length, countries: countries.length, provinces: provinces.length,
      assessmentUnits: assessmentUnits.length, petroleumSystems: petroleumSystems.length,
      fields: fields.length, fieldsWithProvince: fields.filter((f) => f.prvCode).length,
      fieldsWithoutRealUnitId: noUnitId,
    },
    provinceRegionConflicts: provRegionConflicts,
  },
  regions, countries, provinces, assessmentUnits, petroleumSystems, fields, provinceBasinNames,
};

const OUT_PATH = String.raw`C:\Users\aldhy\AppData\Local\Temp\claude\C--Users-aldhy-OneDrive-Documents-GitHub-ArgantaLab\3d65e7cb-77e7-40b1-91c7-498b0b57e202\scratchpad\world-kb.json`;
writeFileSync(OUT_PATH, JSON.stringify(out));
console.log('wrote', OUT_PATH, '—', JSON.stringify(out.meta.counts));
if (provRegionConflicts.length) console.log('province/region conflicts:', provRegionConflicts);
