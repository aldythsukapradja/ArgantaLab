// build-northsea.mjs — North Sea Reference (NSR) open-data ingestion.
// Pulls authoritative, openly-licensed boundaries + headers for BOTH sectors and
// normalises them into one canonical schema (src/nsr/types.ts), keyed by `sector`
// (NO | UK) + native regulator id. Emits public/nsr/*.json (GeoJSON-per-entity + a
// manifest). Sources & licences: see docs/arganta-energy/DATA-LICENSES.md.
//   Norway — Sodir FactMaps (NLOD 2.0)  · https://factmaps.sodir.no
//   UK     — NSTA ArcGIS Online (NSTA Open User Licence) · services-eu1.arcgis.com
// Geometry ingested in WGS84 (EPSG:4326); the app reprojects to ED50/UTM31N on the
// client. Polygon layers (quadrants/blocks/licences/fields/discoveries) pull in full
// for the North Sea; wellbores are bbox-scoped (full UK+NO wellbores = 100k+ points,
// too large for a client asset) — the manifest logs exactly what was clipped.
// Deterministic, no LLM. Node 18+ (global fetch). Skips if fresh unless --force.
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..');
const OUT = join(APP, 'public', 'nsr');

const force = process.argv.includes('--force');
if (!force && existsSync(join(OUT, 'index.json'))) {
  console.log('[nsr] index.json exists — skipping (use --force to rebuild)');
  process.exit(0);
}

// ── North Sea area of interest (WGS84 lon/lat). Polygons clipped to AOI_POLY, wellbores
// to the tighter AOI_WELL around Volve + the median line (both sectors' neighbours). ──
const AOI_POLY = { xmin: -4.0, ymin: 55.0, xmax: 7.0, ymax: 62.5 };   // greater North Sea
const AOI_WELL = { xmin: 0.5, ymin: 57.8, xmax: 3.2, ymax: 59.6 };    // Volve + neighbours
const bboxArg = process.argv.find((a) => a.startsWith('--well-bbox='));
if (bboxArg) {
  const [xmin, ymin, xmax, ymax] = bboxArg.split('=')[1].split(',').map(Number);
  Object.assign(AOI_WELL, { xmin, ymin, xmax, ymax });
}

const round = (n, d = 5) => (typeof n === 'number' && isFinite(n) ? +n.toFixed(d) : n);
const clean = (s) => (typeof s === 'string' ? s.trim() : s);
// pick first present property whose key matches any candidate (case-insensitive exact,
// then loose contains) — resilient to per-layer schema differences across regulators.
function pick(props, cands) {
  const keys = Object.keys(props);
  for (const c of cands) {
    const k = keys.find((x) => x.toLowerCase() === c.toLowerCase());
    if (k != null && props[k] != null && props[k] !== '') return props[k];
  }
  for (const c of cands) {
    const k = keys.find((x) => x.toLowerCase().includes(c.toLowerCase()));
    if (k != null && props[k] != null && props[k] !== '') return props[k];
  }
  return undefined;
}
function roundGeom(g) {
  if (!g) return g;
  const r = (c) => Array.isArray(c[0]) ? c.map(r) : [round(c[0]), round(c[1])];
  return { type: g.type, coordinates: r(g.coordinates) };
}

// ── ArcGIS/GeoJSON fetch with paging (works for Sodir FactMaps + NSTA ArcGIS Online) ──
async function fetchLayer(url, { where = '1=1', bbox = null, outFields = '*', pageSize = 1000 } = {}) {
  const feats = [];
  let offset = 0;
  for (let guard = 0; guard < 200; guard++) {
    const p = new URLSearchParams({
      where, outFields, f: 'geojson', returnGeometry: 'true',
      outSR: '4326', resultOffset: String(offset), resultRecordCount: String(pageSize),
    });
    if (bbox) {
      p.set('geometry', `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}`);
      p.set('geometryType', 'esriGeometryEnvelope');
      p.set('inSR', '4326');
      p.set('spatialRel', 'esriSpatialRelIntersects');
    }
    const full = `${url}/query?${p.toString()}`;
    let json;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(full, { headers: { Accept: 'application/geo+json,application/json' } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        json = await r.json();
        break;
      } catch (e) {
        if (attempt === 2) throw new Error(`fetch failed: ${full} — ${e.message}`);
        await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
      }
    }
    const batch = json.features || [];
    feats.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return feats;
}

// ── source registry ─────────────────────────────────────────────────────────────
const SODIR = 'https://factmaps.sodir.no/api/rest/services/Factmaps/FactMapsWGS84/FeatureServer';
const NSTA = 'https://services-eu1.arcgis.com/OZMfUznmLTnWccBc/arcgis/rest/services';
const nstaSvc = (name, layer = 0) => `${NSTA}/${encodeURIComponent(name)}/FeatureServer/${layer}`;

// canonical id: {sector}:{type}:{nativeId}
const cid = (sector, type, id) => `${sector}:${type}:${id}`;
// parse "quadrant/block-well[ suffix]" → components (sector-scoped namespaces)
function parseWellName(name) {
  const m = /^\s*(\d+)\s*\/\s*(\w+)\s*-\s*(.+?)\s*$/.exec(String(name || ''));
  if (!m) return { quadrant: null, block: null, wellNo: null };
  return { quadrant: m[1], block: `${m[1]}/${m[2]}`, wellNo: m[3] };
}

async function ingest() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const manifest = {
    version: '1.0.0', generatedAt: new Date().toISOString(),
    crs: 'WGS84 (EPSG:4326)', aoiPolygons: AOI_POLY, aoiWellbores: AOI_WELL,
    sources: {
      NO: { name: 'Norwegian Offshore Directorate (Sodir)', licence: 'NLOD-2.0', attribution: 'Contains data under the Norwegian licence for Open Government data (NLOD) distributed by the Norwegian Offshore Directorate (Sokkeldirektoratet).' },
      UK: { name: 'North Sea Transition Authority (NSTA)', licence: 'NSTA Open User Licence', attribution: 'North Sea Transition Authority' },
    },
    counts: {},
  };

  const out = { quadrants: [], blocks: [], licences: [], fields: [], discoveries: [], wellbores: [] };
  const feat = (rec, geom) => ({ type: 'Feature', properties: rec, geometry: roundGeom(geom) });

  // ---- NORWAY (Sodir FactMaps) ----
  console.log('[nsr] Norway · Sodir FactMaps …');
  // quadrants 803 · blocks 802 · fields 502 · discoveries 504 · licences 612 · wellbores 201
  const noQuad = await fetchLayer(`${SODIR}/803`, { bbox: AOI_POLY });
  for (const f of noQuad) {
    const p = f.properties || {}; const name = clean(pick(p, ['qadName', 'quadrant', 'name']));
    if (!name) continue;
    out.quadrants.push(feat({ id: cid('NO', 'quadrant', name.trim()), sector: 'NO', name: name.trim(),
      native: { qadName: name }, source: 'Sodir', licence: 'NLOD-2.0' }, f.geometry));
  }
  const noBlock = await fetchLayer(`${SODIR}/802`, { bbox: AOI_POLY });
  for (const f of noBlock) {
    const p = f.properties || {}; const name = clean(pick(p, ['blcName', 'block', 'name']));
    if (!name) continue;
    out.blocks.push(feat({ id: cid('NO', 'block', name), sector: 'NO', name,
      quadrant: clean(pick(p, ['qadName']))?.trim() || name.split('/')[0],
      npdid: pick(p, ['blcNpdidBlock']), source: 'Sodir', licence: 'NLOD-2.0' }, f.geometry));
  }
  const noField = await fetchLayer(`${SODIR}/502`, { bbox: AOI_POLY });
  for (const f of noField) {
    const p = f.properties || {}; const name = clean(pick(p, ['fldName', 'field', 'name']));
    if (!name) continue;
    out.fields.push(feat({ id: cid('NO', 'field', pick(p, ['fldNpdidField']) ?? name), sector: 'NO', name,
      operator: clean(pick(p, ['cmpLongName', 'operator'])), status: clean(pick(p, ['fldCurrentActivitySatus', 'status'])),
      hcType: clean(pick(p, ['fldHcType'])), discoveryYear: pick(p, ['fldDiscoveryYear']),
      discoveryWellbore: clean(pick(p, ['wlbName'])), npdid: pick(p, ['fldNpdidField']),
      source: 'Sodir', licence: 'NLOD-2.0' }, f.geometry));
  }
  const noDisc = await fetchLayer(`${SODIR}/504`, { bbox: AOI_POLY });
  for (const f of noDisc) {
    const p = f.properties || {}; const name = clean(pick(p, ['dscName', 'discovery', 'name']));
    if (!name) continue;
    out.discoveries.push(feat({ id: cid('NO', 'discovery', pick(p, ['dscNpdidDiscovery']) ?? name), sector: 'NO', name,
      year: pick(p, ['dscDiscoveryYear']), field: clean(pick(p, ['fldName'])),
      npdid: pick(p, ['dscNpdidDiscovery']), source: 'Sodir', licence: 'NLOD-2.0' }, f.geometry));
  }
  const noLic = await fetchLayer(`${SODIR}/612`, { bbox: AOI_POLY });
  for (const f of noLic) {
    const p = f.properties || {}; const name = clean(pick(p, ['prlName', 'licence', 'name']));
    if (!name) continue;
    out.licences.push(feat({ id: cid('NO', 'licence', pick(p, ['prlNpdidLicence']) ?? name), sector: 'NO', name,
      operator: clean(pick(p, ['cmpLongName', 'operator'])), status: clean(pick(p, ['prlStatus', 'status'])),
      npdid: pick(p, ['prlNpdidLicence']), source: 'Sodir', licence: 'NLOD-2.0' }, f.geometry));
  }
  const noWell = await fetchLayer(`${SODIR}/201`, { bbox: AOI_WELL });
  for (const f of noWell) {
    const p = f.properties || {}; const name = clean(pick(p, ['wlbWellboreName', 'wellbore', 'name']));
    if (!name) continue;
    const parsed = parseWellName(name);
    out.wellbores.push(feat({ id: cid('NO', 'wellbore', pick(p, ['wlbNpdidWellbore']) ?? name), sector: 'NO', name,
      parentWell: clean(pick(p, ['wlbWell'])), quadrant: parsed.quadrant, block: parsed.block,
      operator: clean(pick(p, ['wlbDrillingOperator', 'operator'])), purpose: clean(pick(p, ['wlbPurpose'])),
      status: clean(pick(p, ['wlbStatus'])), content: clean(pick(p, ['wlbContent'])),
      licenceRef: clean(pick(p, ['wlbProductionLicence'])), field: clean(pick(p, ['wlbField'])),
      completion: clean(pick(p, ['wlbCompletionDate'])), tdMd: pick(p, ['wlbTotalDepth']),
      waterDepth: pick(p, ['wlbWaterDepth']), utmZone: pick(p, ['wlbUtmZone']),
      datum: clean(pick(p, ['wlbGeodeticDatum'])), npdid: pick(p, ['wlbNpdidWellbore']),
      source: 'Sodir', licence: 'NLOD-2.0' }, f.geometry));
  }

  // ---- UK (NSTA ArcGIS Online) ----
  console.log('[nsr] UK · NSTA ArcGIS Online …');
  const ukQuad = await fetchLayer(nstaSvc('UKCS_quadrants_(WGS84)'), { bbox: AOI_POLY });
  for (const f of ukQuad) {
    const p = f.properties || {}; const name = String(clean(pick(p, ['QUAD_NO', 'QUADRANT', 'quadrant', 'name'])) ?? '').trim();
    if (!name) continue;
    out.quadrants.push(feat({ id: cid('UK', 'quadrant', name), sector: 'UK', name,
      source: 'NSTA', licence: 'NSTA Open User Licence' }, f.geometry));
  }
  const ukBlock = await fetchLayer(nstaSvc('UKCS offshore petroleum licence blocks WGS84'), { bbox: AOI_POLY });
  for (const f of ukBlock) {
    const p = f.properties || {}; const name = clean(pick(p, ['BLOCKREF', 'BLOCK', 'block', 'name']));
    if (!name) continue;
    out.blocks.push(feat({ id: cid('UK', 'block', name), sector: 'UK', name: String(name),
      quadrant: String(clean(pick(p, ['QUADNO', 'QUAD_NO', 'quadrant'])) ?? '').trim() || undefined,
      licenceRef: clean(pick(p, ['LICREF', 'LICENCE', 'licence'])), status: clean(pick(p, ['LICSTATUS', 'status'])),
      source: 'NSTA', licence: 'NSTA Open User Licence' }, f.geometry));
  }
  const ukLic = await fetchLayer(nstaSvc('UKCS offshore petroleum licences WGS84'), { bbox: AOI_POLY });
  for (const f of ukLic) {
    const p = f.properties || {}; const name = clean(pick(p, ['LICREF', 'LICNO', 'licence', 'name']));
    if (!name) continue;
    out.licences.push(feat({ id: cid('UK', 'licence', name), sector: 'UK', name: String(name),
      operator: clean(pick(p, ['LICORG', 'OPERATOR', 'operator'])), status: clean(pick(p, ['LICSTATUS', 'status'])),
      round: clean(pick(p, ['RNDNO', 'ROUND'])), type: clean(pick(p, ['LICTYPE'])),
      source: 'NSTA', licence: 'NSTA Open User Licence' }, f.geometry));
  }
  const ukField = await fetchLayer(nstaSvc('Petroleum_field_determinations_(WGS84)'), { bbox: AOI_POLY });
  for (const f of ukField) {
    const p = f.properties || {}; const name = clean(pick(p, ['FIELDNAME', 'FIELD_NAME', 'field', 'name']));
    if (!name) continue;
    out.fields.push(feat({ id: cid('UK', 'field', pick(p, ['FIELD_NO', 'OBJECTID']) ?? name), sector: 'UK', name,
      status: clean(pick(p, ['FD_STAT', 'status'])), nativeNo: clean(pick(p, ['FIELD_NO'])),
      source: 'NSTA', licence: 'NSTA Open User Licence' }, f.geometry));
  }
  const ukWell = await fetchLayer(nstaSvc('UKCS offshore petroleum wells bottom holes WGS84'), { bbox: AOI_WELL });
  for (const f of ukWell) {
    const p = f.properties || {}; const name = clean(pick(p, ['WELLREGNO', 'NAME', 'well']));
    if (!name) continue;
    const parsed = parseWellName(name);
    out.wellbores.push(feat({ id: cid('UK', 'wellbore', pick(p, ['OBJECTID']) ?? name), sector: 'UK', name: String(name),
      parentWell: clean(pick(p, ['PARENTWELL'])), quadrant: parsed.quadrant, block: parsed.block,
      operator: clean(pick(p, ['TDOPERATOR', 'OPERATOR', 'operator'])), purpose: clean(pick(p, ['ORIGINTENT'])),
      status: clean(pick(p, ['WELLOPSTAT', 'CURRWELLIN', 'STATUS'])), licenceRef: clean(pick(p, ['LICREF', 'LICNO'])),
      field: clean(pick(p, ['TARGETFLD'])), tdMd: pick(p, ['TDMDDEPM']), waterDepth: pick(p, ['WATDEP_M']),
      source: 'NSTA', licence: 'NSTA Open User Licence' }, f.geometry));
  }

  // ---- write per-entity FeatureCollections + manifest ----
  const write = (name, features) => {
    writeFileSync(join(OUT, name), JSON.stringify({ type: 'FeatureCollection', features }));
  };
  write('nsr-quadrants.json', out.quadrants);
  write('nsr-blocks.json', out.blocks);
  write('nsr-licences.json', out.licences);
  write('nsr-fields.json', out.fields);
  write('nsr-discoveries.json', out.discoveries);
  write('nsr-wellbores.json', out.wellbores);

  const bySector = (arr) => ({ NO: arr.filter((f) => f.properties.sector === 'NO').length, UK: arr.filter((f) => f.properties.sector === 'UK').length });
  manifest.counts = {
    quadrants: bySector(out.quadrants), blocks: bySector(out.blocks), licences: bySector(out.licences),
    fields: bySector(out.fields), discoveries: bySector(out.discoveries), wellbores: bySector(out.wellbores),
  };
  // Volve anchor sanity check (verified live from Sodir)
  const volve = out.fields.find((f) => /^volve$/i.test(f.properties.name || ''));
  manifest.volveAnchor = volve ? { found: true, npdid: volve.properties.npdid, operator: volve.properties.operator,
    status: volve.properties.status, discoveryYear: volve.properties.discoveryYear, discoveryWellbore: volve.properties.discoveryWellbore }
    : { found: false, note: 'VOLVE field not in AOI result — check AOI_POLY or Sodir layer 502' };
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(manifest, null, 2));

  console.log('[nsr] done →', OUT);
  for (const [k, v] of Object.entries(manifest.counts)) console.log(`  ${k.padEnd(12)} NO ${String(v.NO).padStart(5)} · UK ${String(v.UK).padStart(5)}`);
  console.log('[nsr] Volve anchor:', JSON.stringify(manifest.volveAnchor));
}

ingest().catch((e) => { console.error('[nsr] FAILED:', e.message); process.exit(1); });
