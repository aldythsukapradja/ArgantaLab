import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { emptyManifest, makeOsduId, OSDU_RELEASE, record, recordCount, validateManifest } from './osdu-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
// Manifests are BUILD-ONLY inputs to build-cockpit-spatial.mjs — the client never fetches
// them (only the small derived cockpit-*.geojson/json). Keep them out of public/ so they
// never ship in `dist/` (a 45MB dead-weight deploy artifact otherwise; the 29MB GOGET
// manifest alone is the full licensed dataset re-exposed publicly for no reason).
const publicOsduDir = path.join(publicDir, 'osdu');
const outDir = path.join(root, 'data-energy', 'generated', 'osdu');
const rawDir = path.join(root, 'data-energy', 'raw');
const internalDir = path.join(root, 'data-energy', 'internal');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(publicOsduDir, { recursive: true });

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(outDir, name), JSON.stringify(value));
const writePublic = (name, value) => fs.writeFileSync(path.join(publicOsduDir, name), JSON.stringify(value));
const features = (name) => read(path.join(publicDir, name)).features;
const addMaster = (m, spec) => m.MasterData.push(record(spec));
const sourceFiles = [];

function buildUsgs() {
  const manifest = emptyManifest();
  const source = 'USGS 2012 World Assessment of Undiscovered Oil and Gas Resources';
  const licence = 'Public Domain (US Geological Survey)';
  for (const r of read(path.join(publicDir, 'world', 'regions.json'))) {
    addMaster(manifest, {
      kind: 'osdu:wks:master-data--GeoPoliticalEntity:1.1.0', nativeId: `usgs-region-${r.code}`,
      name: r.name, source, licence, data: { GeoPoliticalEntityType: 'Region', ExtensionProperties: r },
    });
  }
  for (const c of read(path.join(publicDir, 'world', 'countries.json'))) {
    addMaster(manifest, {
      kind: 'osdu:wks:master-data--GeoPoliticalEntity:1.1.0', nativeId: `usgs-country-${c.name}`,
      name: c.name, source, licence, data: { GeoPoliticalEntityType: 'Country', ExtensionProperties: c },
    });
  }
  for (const f of features('world/provinces.geojson')) {
    const p = f.properties;
    addMaster(manifest, {
      kind: 'osdu:wks:master-data--Basin:1.2.0', nativeId: `usgs-basin-${p.prvCode}`,
      name: p.prvName, source, licence, data: { BasinID: p.prvCode, ExtensionProperties: p },
    });
  }
  const petroleumSystems = new Set();
  const assessmentUnits = new Set();
  for (const f of features('world/aus.geojson')) {
    const p = f.properties;
    if (p.tps && !petroleumSystems.has(p.tps)) {
      petroleumSystems.add(p.tps);
      addMaster(manifest, {
        kind: 'arganta:wks:master-data--PetroleumSystem:1.0.0', nativeId: `usgs-tps-${p.tps}`,
        name: p.tps, source, licence, alignment: 'extension',
        data: { ExtensionProperties: { SourceStandard: 'USGS TPS' } },
      });
    }
    if (assessmentUnits.has(p.auCode)) continue;
    assessmentUnits.add(p.auCode);
    addMaster(manifest, {
      kind: 'arganta:wks:master-data--AssessmentUnit:1.0.0', nativeId: `usgs-au-${p.auCode}`,
      name: p.auName, source, licence, alignment: 'extension',
      parents: [makeOsduId('osdu:wks:master-data--Basin:1.2.0', `usgs-basin-${p.prvCode}`)],
      data: { AssessmentUnitID: p.auCode, PetroleumSystemName: p.tps, ExtensionProperties: p },
    });
  }
  return manifest;
}

function buildNorthSea() {
  const manifest = emptyManifest();
  const companyIds = new Map();
  const licenceIds = new Set();
  const fieldIds = new Set();
  const company = (name, sector, source, licence) => {
    if (!name) return undefined;
    const key = cleanCompany(name);
    if (!companyIds.has(key)) {
      const r = record({
        kind: 'osdu:wks:master-data--Organisation:1.2.0', nativeId: `${sector}-${key}`,
        name, source, licence, countries: [sector === 'NO' ? 'NO' : 'GB'],
        data: { OrganisationID: `${sector}:${key}` },
      });
      manifest.MasterData.push(r);
      companyIds.set(key, r.id);
    }
    return companyIds.get(key);
  };
  for (const p of features('nsr/nsr-licences.json').map((x) => x.properties)) {
    if (licenceIds.has(p.id)) continue;
    licenceIds.add(p.id);
    const operatorId = company(p.operator, p.sector, p.source, p.licence);
    addMaster(manifest, {
      kind: 'osdu:wks:master-data--Agreement:1.1.0', nativeId: p.id,
      name: p.name, source: p.source, licence: p.licence,
      countries: [p.sector === 'NO' ? 'NO' : 'GB'],
      data: { AgreementID: p.id, OperatorOrganisationID: operatorId, ExtensionProperties: p },
    });
  }
  for (const f of features('nsr/nsr-fields.json')) {
    const p = f.properties;
    if (fieldIds.has(p.id)) continue;
    fieldIds.add(p.id);
    const operatorId = company(p.operator, p.sector, p.source, p.licence);
    addMaster(manifest, {
      kind: 'osdu:wks:master-data--Field:1.1.0', nativeId: p.id,
      name: p.name, source: p.source, licence: p.licence,
      countries: [p.sector === 'NO' ? 'NO' : 'GB'],
      data: {
        FieldID: p.id, FieldName: p.name, SpatialLocation: f.geometry,
        ExtensionProperties: { ...p, OperatorOrganisationID: operatorId },
      },
    });
  }
  const wells = new Set();
  for (const f of features('nsr/nsr-wellbores.json')) {
    const p = f.properties;
    const wellNative = `${p.sector}:well:${p.parentWell || p.name}`;
    const wellId = makeOsduId('osdu:wks:master-data--Well:1.4.0', wellNative);
    if (!wells.has(wellId)) {
      wells.add(wellId);
      addMaster(manifest, {
        kind: 'osdu:wks:master-data--Well:1.4.0', nativeId: wellNative,
        name: p.parentWell || p.name, source: p.source, licence: p.licence,
        countries: [p.sector === 'NO' ? 'NO' : 'GB'], data: { FacilityName: p.parentWell || p.name },
      });
    }
    addMaster(manifest, {
      kind: 'osdu:wks:master-data--Wellbore:1.5.1', nativeId: p.id,
      name: p.name, source: p.source, licence: p.licence, parents: [wellId],
      countries: [p.sector === 'NO' ? 'NO' : 'GB'],
      data: { FacilityName: p.name, WellID: wellId, SpatialLocation: f.geometry, ExtensionProperties: p },
    });
  }
  return manifest;
}

const cleanCompany = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const text = (v) => v == null ? undefined : String(v).trim() || undefined;
const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const find = (row, aliases) => {
  const wanted = new Set(aliases.map(key));
  const hit = Object.keys(row).find((x) => wanted.has(key(x)));
  return hit ? row[hit] : undefined;
};

function buildGoget(file) {
  const manifest = emptyManifest();
  const workbook = XLSX.readFile(file);
  const sheetRows = (wanted) => {
    const sheetName = workbook.SheetNames.find((name) => name.trim() === wanted);
    if (!sheetName) throw new Error(`GOGET: missing worksheet "${wanted}"`);
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null })
      .map((row, index) => ({ row, sourceSheet: sheetName, sourceRow: index + 2 }));
  };
  const sets = [
    { level: 'field', type: 'main', rows: sheetRows('Field-level main data') },
    { level: 'field', type: 'reserves', rows: sheetRows('Field-level reserves data') },
    { level: 'field', type: 'production', rows: sheetRows('Field-level production data') },
    { level: 'project', type: 'main', rows: sheetRows('Project-level main data') },
    { level: 'project', type: 'reserves', rows: sheetRows('Project-level reserves data') },
    { level: 'project', type: 'production', rows: sheetRows('Project-level production data') },
  ];
  const units = new Map();
  for (const set of sets) {
    for (const item of set.rows) {
      const nativeId = text(find(item.row, ['GEM Unit ID', 'GEM ID', 'GOGET ID', 'Unit ID', 'Project ID']));
      if (!nativeId) continue;
      const name = text(find(item.row, ['Unit Name', 'Project Name', 'Field Name', 'Name']));
      const unit = units.get(nativeId) ?? {
        nativeId, name, country: text(find(item.row, ['Country/Area', 'Country'])),
        levels: new Set(), main: [], reserves: [], production: [],
      };
      unit.levels.add(set.level);
      if (!unit.name && name) unit.name = name;
      if (!unit.country) unit.country = text(find(item.row, ['Country/Area', 'Country']));
      if (set.type === 'main') unit.main.push(item);
      else unit[set.type].push({ ...item.row, SourceSheet: item.sourceSheet, SourceRow: item.sourceRow });
      units.set(nativeId, unit);
    }
  }
  for (const unit of units.values()) {
    if (!unit.name) continue;
    const primaryMain = unit.main[0]?.row ?? {};
    const rawLatitude = text(find(primaryMain, ['Latitude', 'Latitude (°)']));
    const rawLongitude = text(find(primaryMain, ['Longitude', 'Longitude (°)']));
    const latitude = rawLatitude == null ? NaN : Number(rawLatitude);
    const longitude = rawLongitude == null ? NaN : Number(rawLongitude);
    const spatialLocation = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { type: 'Point', coordinates: [longitude, latitude] } : undefined;
    addMaster(manifest, {
      kind: 'osdu:wks:master-data--Field:1.1.0', nativeId: `goget-${unit.nativeId}`,
      name: unit.name, source: 'Global Energy Monitor · Global Oil and Gas Extraction Tracker',
      licence: 'CC BY 4.0',
      data: {
        FieldID: unit.nativeId, FieldName: unit.name, SpatialLocation: spatialLocation,
        ExtensionProperties: {
          UnitLevels: [...unit.levels],
          CountryArea: unit.country,
          SourceRelease: path.basename(file),
          MainData: unit.main.map((item) => ({
            ...item.row, SourceSheet: item.sourceSheet, SourceRow: item.sourceRow,
          })),
          ReservesObservations: unit.reserves,
          ProductionObservations: unit.production,
        },
      },
    });
  }
  return manifest;
}

function buildVolve() {
  const manifest = emptyManifest();
  const wb = read(path.join(publicDir, 'wb', 'index.json'));
  const source = 'Equinor Volve field dataset';
  const licence = 'Equinor Open Data Licence';
  const field = record({
    kind: 'osdu:wks:master-data--Field:1.1.0', nativeId: 'sodir-field-3420717',
    name: 'Volve', source, licence, countries: ['NO'],
    data: { FieldID: '3420717', FieldName: 'Volve' },
  });
  manifest.MasterData.push(field);
  const wells = new Map();
  for (const item of wb.wells ?? []) {
    if (!wells.has(item.well)) {
      const well = record({
        kind: 'osdu:wks:master-data--Well:1.4.0', nativeId: `volve-well-${item.well}`,
        name: item.well, source, licence, countries: ['NO'], parents: [field.id],
        data: { FacilityName: item.well, FieldID: field.id },
      });
      wells.set(item.well, well);
      manifest.MasterData.push(well);
    }
    const well = wells.get(item.well);
    const wellbore = record({
      kind: 'osdu:wks:master-data--Wellbore:1.5.1', nativeId: `volve-wellbore-${item.name}`,
      name: item.name, source, licence, countries: ['NO'], parents: [well.id],
      data: { FacilityName: item.name, WellID: well.id, ExtensionProperties: item },
    });
    manifest.MasterData.push(wellbore);
    const addWpc = (kind, suffix, data) => manifest.Data.WorkProductComponents.push(record({
      kind, nativeId: `volve-${suffix}-${item.name}`, name: `${item.name} ${suffix}`,
      source, licence, countries: ['NO'], parents: [wellbore.id], data,
    }));
    if (item.has?.logs) addWpc('osdu:wks:work-product-component--WellLog:1.5.0', 'logs', { WellboreID: wellbore.id });
    if (item.has?.traj) addWpc('osdu:wks:work-product-component--WellboreTrajectory:1.4.0', 'trajectory', { WellboreID: wellbore.id });
    if (item.has?.picks) addWpc('osdu:wks:work-product-component--WellboreMarkerSet:1.5.1', 'markers', { WellboreID: wellbore.id });
    if (item.has?.production) addWpc('osdu:wks:work-product-component--ProductionValues:2.0.0', 'production', { WellboreID: wellbore.id });
  }
  for (const surface of wb.surfaces ?? []) {
    manifest.Data.WorkProductComponents.push(record({
      kind: 'arganta:wks:work-product-component--GridSurface:1.0.0',
      nativeId: `volve-surface-${surface.id}`, name: surface.name, source, licence,
      countries: ['NO'], parents: [field.id], alignment: 'extension',
      dataNature: 'interpreted', data: { FieldID: field.id, ExtensionProperties: surface },
    }));
  }
  for (const [i, contact] of (wb.contacts ?? []).entries()) {
    manifest.Data.WorkProductComponents.push(record({
      kind: 'osdu:wks:work-product-component--WellboreIntervalSet:1.3.1',
      nativeId: `volve-contact-${i}`, name: `Volve ${contact.kind}`, source, licence,
      countries: ['NO'], parents: [field.id], dataNature: contact.dataNature ?? 'interpreted',
      data: { FieldID: field.id, ExtensionProperties: contact },
    }));
  }
  return manifest;
}

function buildAnp() {
  const manifest = emptyManifest();
  const sourceMeta = read(path.join(rawDir, 'anp', 'source.json'));
  const fields = read(path.join(rawDir, 'anp', 'fields.geojson')).features;
  const blocks = read(path.join(rawDir, 'anp', 'blocks.geojson')).features;
  const source = sourceMeta.authority;
  const licence = sourceMeta.licence;
  const basins = new Map();
  const organisations = new Map();
  const basinFor = (name) => {
    if (!name) return undefined;
    const candidateId = makeOsduId('osdu:wks:master-data--Basin:1.2.0', `anp-basin-${name}`);
    if (!basins.has(candidateId)) {
      const basin = record({
        kind: 'osdu:wks:master-data--Basin:1.2.0', nativeId: `anp-basin-${name}`,
        name, source, licence, countries: ['BR'], data: { BasinID: `ANP:${name}` },
      });
      basins.set(candidateId, basin.id);
      manifest.MasterData.push(basin);
    }
    return basins.get(candidateId);
  };
  const organisationFor = (name) => {
    if (!name) return undefined;
    const candidateId = makeOsduId('osdu:wks:master-data--Organisation:1.2.0', `anp-organisation-${name}`);
    if (!organisations.has(candidateId)) {
      const organisation = record({
        kind: 'osdu:wks:master-data--Organisation:1.2.0', nativeId: `anp-organisation-${name}`,
        name, source, licence, countries: ['BR'], data: { OrganisationID: `ANP:${name}` },
      });
      organisations.set(candidateId, organisation.id);
      manifest.MasterData.push(organisation);
    }
    return organisations.get(candidateId);
  };
  for (const feature of fields) {
    const p = feature.properties ?? {};
    const basinId = basinFor(p.NOM_BACIA);
    const operatorId = organisationFor(p.OPERADOR_C);
    addMaster(manifest, {
      kind: 'osdu:wks:master-data--Field:1.1.0', nativeId: `anp-field-${p.COD_CAMPO ?? p.ID}`,
      name: p.NOM_CAMPO ?? p.SIG_CAMPO, source, licence, countries: ['BR'],
      parents: basinId ? [basinId] : [],
      data: {
        FieldID: String(p.COD_CAMPO ?? p.ID), FieldName: p.NOM_CAMPO,
        SpatialLocation: feature.geometry,
        ExtensionProperties: { ...p, OperatorOrganisationID: operatorId },
      },
    });
  }
  for (const feature of blocks) {
    const p = feature.properties ?? {};
    const basinId = basinFor(p.NOM_BACIA);
    const operatorId = organisationFor(p.OPERADOR_C);
    addMaster(manifest, {
      kind: 'osdu:wks:master-data--Agreement:1.1.0',
      nativeId: `anp-agreement-${p.NUM_CONTRA ?? 'no-contract'}-${p.COD_BLOCO ?? p.NOM_BLOCO}`,
      name: p.NOM_BLOCO ?? p.NOM_FANTAS, source, licence, countries: ['BR'],
      parents: basinId ? [basinId] : [],
      data: {
        AgreementID: String(p.NUM_CONTRA ?? p.COD_BLOCO),
        SpatialLocation: feature.geometry,
        ExtensionProperties: { ...p, OperatorOrganisationID: operatorId },
      },
    });
  }
  return manifest;
}

function buildInternal(file) {
  const manifest = emptyManifest();
  const input = read(file);
  for (const item of input.records ?? []) {
    const type = item.type ?? 'Field';
    const category = item.category ?? 'master-data';
    const kind = item.kind ?? `arganta:wks:${category}--${type}:1.0.0`;
    const r = record({
      kind, nativeId: item.id, name: item.name, source: item.source ?? 'Arganta internal',
      licence: item.licence ?? 'Internal', dataClass: 'internal',
      dataNature: item.dataNature ?? 'interpreted', parents: item.parents ?? [],
      countries: item.countries ?? [], alignment: kind.startsWith('osdu:') ? 'standard' : 'extension',
      data: { ...(item.data ?? {}), ExtensionProperties: item.extensionProperties ?? {} },
    });
    if (category === 'work-product-component') manifest.Data.WorkProductComponents.push(r);
    else if (category === 'dataset') manifest.Data.Datasets.push(r);
    else manifest.MasterData.push(r);
  }
  return manifest;
}

function persist(source, dataClass, filename, manifest) {
  const result = validateManifest(manifest, dataClass);
  if (!result.valid) throw new Error(`${source} OSDU validation failed:\n${result.errors.slice(0, 20).join('\n')}`);
  write(filename, manifest);
  sourceFiles.push({ source, dataClass, path: `data-energy/generated/osdu/${filename}`, records: recordCount(manifest), status: 'ready' });
}

persist('USGS', 'public', 'usgs.manifest.json', buildUsgs());
persist('North Sea regulators', 'public', 'north-sea.manifest.json', buildNorthSea());
persist('Volve', 'public', 'volve.manifest.json', buildVolve());
const anpSource = path.join(rawDir, 'anp', 'source.json');
if (fs.existsSync(anpSource)) {
  persist('Brazil ANP', 'public', 'anp.manifest.json', buildAnp());
} else {
  sourceFiles.push({ source: 'Brazil ANP', dataClass: 'public', path: 'data-energy/generated/osdu/anp.manifest.json', records: 0, status: 'awaiting-source' });
}

const gogetCandidates = fs.existsSync(path.join(rawDir, 'goget'))
  ? fs.readdirSync(path.join(rawDir, 'goget')).filter((x) => /\.xlsx?$/i.test(x)) : [];
if (gogetCandidates.length) {
  const file = path.join(rawDir, 'goget', gogetCandidates.sort().at(-1));
  persist('GOGET', 'public', 'goget.manifest.json', buildGoget(file));
} else {
  sourceFiles.push({ source: 'GOGET', dataClass: 'public', path: 'data-energy/generated/osdu/goget.manifest.json', records: 0, status: 'awaiting-source' });
}

const internalFile = path.join(internalDir, 'osdu-input.json');
if (fs.existsSync(internalFile)) {
  persist('Arganta internal', 'internal', 'internal.manifest.json', buildInternal(internalFile));
} else {
  sourceFiles.push({ source: 'Arganta internal', dataClass: 'internal', path: 'data-energy/generated/osdu/internal.manifest.json', records: 0, status: 'awaiting-source' });
}

sourceFiles.push(
  { source: 'US BOEM', dataClass: 'public', path: 'data-energy/generated/osdu/boem.manifest.json', records: 0, status: 'planned' },
  { source: 'Australia NOPIMS', dataClass: 'public', path: 'data-energy/generated/osdu/nopims.manifest.json', records: 0, status: 'planned' },
  { source: 'Canada regulator open data', dataClass: 'public', path: 'data-energy/generated/osdu/canada.manifest.json', records: 0, status: 'planned' },
);

writePublic('index.json', {
  standard: 'OSDU R3', dataDefinitions: OSDU_RELEASE,
  generatedAt: new Date().toISOString(), manifests: sourceFiles,
});
console.log(`OSDU: ${sourceFiles.filter((x) => x.status === 'ready').length} manifests, ${sourceFiles.reduce((n, x) => n + x.records, 0)} records`);
