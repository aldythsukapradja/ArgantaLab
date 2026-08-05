// build-crosswalk.mjs — the country ⇄ basin/province link that does not exist
// anywhere in the source data (agent gap G3).
//
// Run: node scripts/build-crosswalk.mjs   →   public/agent/crosswalk.json
//
// WHY THIS EXISTS
// The USGS spine parents a province to a REGION and never to a country
// (master-kb-spine.json `province` rows carry region_id, no country_id), and
// `world/countries.json` is undiscovered-resource aggregates with no province
// list. So "give me insight about Indonesia" has no path to a basin today.
//
// The link is recoverable because FIELDS know both: cockpit-scope-fields.json
// lists each province's spatially-matched member fields, and each of those
// fields carries a country tag. Province ⊃ fields ⊃ countries.
//
// EVERY EDGE CARRIES ITS CONFIDENCE. Nothing here is authoritative — a province
// is a geological container that genuinely crosses borders (the North Sea Graben
// spans NO/UK/DK), so this is a membership statistic, not a boundary fact, and
// the UI must say so. Two independent derivations are run and compared:
//
//   spatial     — cockpit-scope-fields.json: field centroid ∩ province polygon,
//                 field's own country tag. The primary path.
//   membership  — master-kb-fields.json: field.basin_id + field.country_id,
//                 joined by name upstream.
//
// Measured outcome: membership reaches NO province the spatial path missed — it
// is pure corroboration (186 of 191 edges). Kept because an edge two independent
// derivations agree on is worth distinguishing from one only a single pass saw,
// and because a future non-spatial source would enter through it.
//
// Provinces that neither path reaches are emitted as `orphans` with their
// region, never quietly dropped. Measured outcome: all 48 have ZERO member
// fields, which is why no country-boundary layer was added — a polygon test
// could only label containers that have nothing inside them.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COUNTRIES, COUNTRY_BY_ISO, USGS_REGIONS, resolveCountryToken,
} from './lib/countries.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pub = (...p) => path.join(root, 'public', ...p);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const scopeFields = readJson(pub('osdu', 'cockpit-scope-fields.json'));
const insights = readJson(pub('osdu', 'cockpit-insights.json'));
const spine = readJson(pub('kb', 'master-kb-spine.json'));
const kbFields = readJson(pub('kb', 'master-kb-fields.json')).field;
const provincesGeo = readJson(pub('world', 'provinces.geojson'));

// ── province registry ────────────────────────────────────────────────────────
// The province polygon layer is the authority on which provinces exist (179);
// the KB spine adds the basin twin and the classification.

const basinByProvinceId = new Map(spine.basin.map((b) => [b.province_id, b]));
const provinces = new Map();
for (const feature of provincesGeo.features) {
  const code = String(feature.properties.prvCode);
  const provinceId = `atlas:province:usgs:${code}`;
  const basin = basinByProvinceId.get(provinceId) ?? null;
  provinces.set(code, {
    code,
    name: feature.properties.prvName,
    regionCode: code[0],
    provinceId,
    basinId: basin?.basin_id ?? null,
    basinSetting: basin?.setting ?? null,
    oilMean: feature.properties.oilMean ?? null,
    gasMean: feature.properties.gasMean ?? null,
    boeMean: feature.properties.boeMean ?? null,
  });
}

// ── pass 1 · spatial membership ──────────────────────────────────────────────

const unknownTokens = new Map();
const noteUnknown = (token, where) => {
  const key = String(token);
  if (!unknownTokens.has(key)) unknownTokens.set(key, { token: key, where, count: 0 });
  unknownTokens.get(key).count += 1;
};

/** provinceCode → iso2 → field count */
const spatial = new Map();
/** iso2 → [lon, lat][] — member-field centroids, for country geometry (below). */
const countryPoints = new Map();
let spatialFields = 0;
for (const [code, members] of Object.entries(scopeFields.provinces)) {
  if (!provinces.has(code)) continue;
  for (const field of members) {
    const verdict = resolveCountryToken(field.country);
    if (verdict.kind === 'unknown') { noteUnknown(field.country, 'cockpit-scope-fields'); continue; }
    if (verdict.kind !== 'country') continue;   // region / none — not a country claim
    if (!spatial.has(code)) spatial.set(code, new Map());
    const tally = spatial.get(code);
    tally.set(verdict.iso2, (tally.get(verdict.iso2) ?? 0) + 1);
    spatialFields += 1;
    if (field.fly && Number.isFinite(field.fly.lon) && Number.isFinite(field.fly.lat)) {
      (countryPoints.get(verdict.iso2) ?? countryPoints.set(verdict.iso2, []).get(verdict.iso2))
        .push([field.fly.lon, field.fly.lat]);
    }
  }
}

// ── pass 2 · KB membership (corroboration + reach) ───────────────────────────

const provinceCodeByBasinId = new Map();
for (const province of provinces.values()) {
  if (province.basinId) provinceCodeByBasinId.set(province.basinId, province.code);
}
// The KB also carries atlas-authored basins (Viking Graben) that are not 1:1
// with a province; those resolve through their own province_id when present.
for (const basin of spine.basin) {
  if (provinceCodeByBasinId.has(basin.basin_id)) continue;
  const code = String(basin.province_id ?? '').split(':').pop();
  if (provinces.has(code)) provinceCodeByBasinId.set(basin.basin_id, code);
}

const membership = new Map();
let membershipFields = 0;
for (const field of kbFields) {
  if (!field.basin_id || !field.country_id) continue;
  const code = provinceCodeByBasinId.get(field.basin_id);
  if (!code) continue;
  const verdict = resolveCountryToken(field.country_id);
  if (verdict.kind === 'unknown') { noteUnknown(field.country_id, 'master-kb-fields'); continue; }
  if (verdict.kind !== 'country') continue;
  if (!membership.has(code)) membership.set(code, new Map());
  const tally = membership.get(code);
  tally.set(verdict.iso2, (tally.get(verdict.iso2) ?? 0) + 1);
  membershipFields += 1;
}

// ── fuse ─────────────────────────────────────────────────────────────────────
// An edge confirmed by BOTH derivations is stronger than one seen by either
// alone, but neither makes it authoritative — the confidence vocabulary tops out
// at 'spatial' for exactly that reason.

const edges = [];
for (const code of provinces.keys()) {
  const s = spatial.get(code) ?? new Map();
  const m = membership.get(code) ?? new Map();
  const isos = new Set([...s.keys(), ...m.keys()]);
  for (const iso2 of isos) {
    const spatialCount = s.get(iso2) ?? 0;
    const membershipCount = m.get(iso2) ?? 0;
    edges.push({
      province: code,
      country: iso2,
      fields: Math.max(spatialCount, membershipCount),
      spatialFields: spatialCount,
      membershipFields: membershipCount,
      confidence: spatialCount > 0 ? 'spatial' : 'membership',
      corroborated: spatialCount > 0 && membershipCount > 0,
    });
  }
}
edges.sort((a, b) => (a.province === b.province ? b.fields - a.fields : a.province.localeCompare(b.province)));

// Share of a province's member fields that sit in each country — this is what
// lets the agent say "mostly Indonesia" instead of implying containment.
const totalByProvince = new Map();
for (const edge of edges) totalByProvince.set(edge.province, (totalByProvince.get(edge.province) ?? 0) + edge.fields);
for (const edge of edges) {
  const total = totalByProvince.get(edge.province) || 1;
  edge.share = Math.round((edge.fields / total) * 1000) / 1000;
}

// ── country → region (derived, never asserted) ───────────────────────────────
// A country's USGS region is the region of the provinces its fields sit in,
// weighted by field count. Countries that straddle two regions keep both.

const countryRegions = new Map();
for (const edge of edges) {
  const region = provinces.get(edge.province).regionCode;
  if (!countryRegions.has(edge.country)) countryRegions.set(edge.country, new Map());
  const tally = countryRegions.get(edge.country);
  tally.set(region, (tally.get(region) ?? 0) + edge.fields);
}

// ── country geometry, derived from member fields ─────────────────────────────
// The repo ships no country polygons (world/countries.json is resource
// aggregates), and adding a boundary layer would buy nothing for drill-down:
// every province without a country has ZERO member fields, so a polygon test
// could only label containers with nothing inside them. What "fly to Indonesia"
// actually needs is where its known fields are — which is derivable here, and
// is honest about being an extent of DATA, not of territory.

/** Dateline-safe extent. Russia/US member fields straddle ±180; a naive bbox
 *  would return the whole globe and fly the map to the middle of the Atlantic. */
function extentOf(points) {
  if (!points.length) return null;
  const lats = points.map((p) => p[1]);
  const raw = points.map((p) => p[0]);
  const plain = Math.max(...raw) - Math.min(...raw);
  // Re-express as 0..360 and keep whichever framing is tighter.
  const shifted = raw.map((lon) => (lon < 0 ? lon + 360 : lon));
  const shiftedSpan = Math.max(...shifted) - Math.min(...shifted);
  const useShifted = shiftedSpan < plain;
  const lons = useShifted ? shifted : raw;
  const norm = (lon) => ((lon + 540) % 360) - 180;

  const sorted = [...lons].sort((a, b) => a - b);
  const sortedLat = [...lats].sort((a, b) => a - b);
  const median = (arr) => arr[Math.floor(arr.length / 2)];
  const span = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats));
  // Screening-scale zoom ladder, matching Cockpit.tsx's type-aware zooms.
  const zoom = span > 60 ? 2.2 : span > 25 ? 3.2 : span > 10 ? 4.2 : span > 4 ? 5.2 : 6.2;
  return {
    bbox: [norm(Math.min(...lons)), Math.min(...lats), norm(Math.max(...lons)), Math.max(...lats)],
    fly: { lon: norm(median(sorted)), lat: median(sortedLat), zoom },
    points: points.length,
  };
}

const countryGeometry = new Map();
for (const [iso2, points] of countryPoints) countryGeometry.set(iso2, extentOf(points));

// ── assemble ─────────────────────────────────────────────────────────────────

const provinceCountries = {};
const countryProvinces = {};
for (const edge of edges) {
  (provinceCountries[edge.province] ??= []).push(edge);
  (countryProvinces[edge.country] ??= []).push(edge);
}
for (const list of Object.values(countryProvinces)) list.sort((a, b) => b.fields - a.fields);

const orphans = [...provinces.values()]
  .filter((p) => !provinceCountries[p.code])
  .map((p) => ({
    code: p.code,
    name: p.name,
    region: p.regionCode,
    memberFields: (scopeFields.provinces[p.code] ?? []).length,
    reason: (scopeFields.provinces[p.code] ?? []).length === 0
      ? 'no field matched this province polygon'
      : 'member fields carry no resolvable country tag',
  }));

const countries = COUNTRIES
  .filter((c) => countryProvinces[c.iso2])
  .map((c) => {
    const tally = countryRegions.get(c.iso2) ?? new Map();
    const regions = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
    const geometry = countryGeometry.get(c.iso2) ?? null;
    return {
      iso2: c.iso2,
      name: c.name,
      aliases: c.aliases,
      provinces: countryProvinces[c.iso2].length,
      fields: countryProvinces[c.iso2].reduce((sum, e) => sum + e.fields, 0),
      regions,
      primaryRegion: regions[0] ?? null,
      // Extent of KNOWN FIELDS, not of territory. Named so no caller mistakes it
      // for a boundary — the app has no country boundary data and does not fake one.
      dataExtent: geometry ? { bbox: geometry.bbox, fly: geometry.fly, fromFields: geometry.points } : null,
    };
  })
  .sort((a, b) => b.fields - a.fields);

const out = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  method: [
    'Country ⇄ province edges derived from member-field country tags — the source data has no such link.',
    'spatial: cockpit-scope-fields.json (field centroid ∩ USGS province polygon, WGS84).',
    'membership: master-kb-fields.json (field.basin_id + field.country_id).',
    'A province is a geological container that legitimately crosses borders; `share` is a membership statistic, never containment.',
  ].join(' '),
  counts: {
    provinces: provinces.size,
    provincesWithCountry: Object.keys(provinceCountries).length,
    orphanProvinces: orphans.length,
    countries: countries.length,
    edges: edges.length,
    corroboratedEdges: edges.filter((e) => e.corroborated).length,
    spatialFieldsUsed: spatialFields,
    membershipFieldsUsed: membershipFields,
  },
  regions: USGS_REGIONS.map((region) => ({
    ...region,
    provinces: [...provinces.values()].filter((p) => p.regionCode === region.code).length,
    countries: countries.filter((c) => c.regions.includes(region.code)).map((c) => c.iso2),
  })),
  countries,
  provinces: [...provinces.values()].map((p) => ({
    ...p,
    countries: (provinceCountries[p.code] ?? []).map((e) => ({
      country: e.country, fields: e.fields, share: e.share, confidence: e.confidence,
    })),
    fieldCount: insights.provinceFields?.[p.code] ?? 0,
  })),
  edges,
  orphans,
  unknownCountryTokens: [...unknownTokens.values()],
};

const outDir = pub('agent');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'crosswalk.json');
fs.writeFileSync(outPath, JSON.stringify(out));
const kb = Math.round(fs.statSync(outPath).size / 1024);

console.log(`[crosswalk] ${out.counts.provincesWithCountry}/${out.counts.provinces} provinces linked to a country`);
console.log(`[crosswalk] ${out.counts.countries} countries · ${out.counts.edges} edges (${out.counts.corroboratedEdges} corroborated by both derivations)`);
const membershipOnly = edges.filter((e) => e.confidence === 'membership').length;
console.log(`[crosswalk] membership derivation added ${membershipOnly} province(s) the spatial pass missed`);
const orphansWithFields = orphans.filter((o) => o.memberFields > 0).length;
console.log(`[crosswalk] ${out.counts.orphanProvinces} orphan provinces retained with reasons (${orphansWithFields} of them hold member fields)`);
if (out.unknownCountryTokens.length) {
  console.log(`[crosswalk] WARNING ${out.unknownCountryTokens.length} unresolved country tokens:`);
  for (const u of out.unknownCountryTokens) console.log(`             "${u.token}" ×${u.count} (${u.where})`);
}
console.log(`[crosswalk] wrote public/agent/crosswalk.json (${kb} kB)`);
