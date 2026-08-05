import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const root = 'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab';
const source = `${root}/docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx`;
const outputDir = `${root}/outputs/petroleum-system-batch-build`;
const previewDir = `${root}/.codex/tmp-petsys/renders-basin-status`;
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const auEvidence = JSON.parse(await fs.readFile(`${root}/.codex/tmp-petsys/au-evidence.json`, 'utf8'));
const publicationRegistry = JSON.parse(await fs.readFile(`${root}/.codex/tmp-petsys/usgs-publication-registry.json`, 'utf8'));
const currentPublicationEvidence = JSON.parse(await fs.readFile(`${root}/.codex/tmp-petsys/current-publication-evidence.json`, 'utf8'));

const headerFormat = {
  fill: '#1F2937',
  font: { bold: true, color: '#FFFFFF', size: 10, name: 'Arial' },
  verticalAlignment: 'center',
};
const bodyFormat = {
  font: { color: '#172033', size: 9, name: 'Arial' },
  verticalAlignment: 'center',
};
const noteFormat = {
  fill: '#F1F5F9',
  font: { italic: true, color: '#64748B', size: 9, name: 'Arial' },
  wrapText: true,
};

function resetSheet(name) {
  const sheet = workbook.worksheets.getOrAdd(name);
  try {
    for (const table of sheet.tables.items) table.delete();
    sheet.deleteAllDrawings();
    const used = sheet.getUsedRange();
    if (used) used.clear({ applyTo: 'all' });
  } catch {
    // A newly created worksheet has no used range or drawings.
  }
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  return sheet;
}

function writeDataSheet(name, headers, rows, widths, note) {
  const sheet = resetSheet(name);
  const lastCol = columnName(headers.length);
  const safeRows = rows.map((row) => row.map((value) => value == null ? null : value));
  sheet.getRange(`A1:${lastCol}1`).values = [headers];
  sheet.getRange(`A1:${lastCol}1`).format = headerFormat;
  sheet.getRange(`A1:${lastCol}1`).format.rowHeight = 24;
  if (rows.length) {
    sheet.getRange(`A2:${lastCol}${rows.length + 1}`).values = safeRows;
    sheet.getRange(`A2:${lastCol}${rows.length + 1}`).format = bodyFormat;
    sheet.getRange(`A2:${lastCol}${rows.length + 1}`).format.borders = {
      insideHorizontal: { style: 'thin', color: '#E2E8F0' },
    };
  }
  if (note) {
    const noteRow = rows.length + 3;
    sheet.getRange(`A${noteRow}:${lastCol}${noteRow}`).merge();
    sheet.getRange(`A${noteRow}`).values = [[note]];
    sheet.getRange(`A${noteRow}:${lastCol}${noteRow}`).format = noteFormat;
    sheet.getRange(`A${noteRow}:${lastCol}${noteRow}`).format.rowHeight = 34;
  }
  widths.forEach((width, index) => {
    sheet.getRange(`${columnName(index + 1)}:${columnName(index + 1)}`).format.columnWidth = width;
  });
  return sheet;
}

function columnName(index) {
  let name = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const psSheet = workbook.worksheets.getItem('Petroleum System');
const psValues = psSheet.getRange('A2:I212').values.filter((row) => row[0]);
const stratSheet = workbook.worksheets.getItem('Stratigraphic Units');
const stratValues = stratSheet.getRange('A2:J12').values.filter((row) => row[0]);
const auSheet = workbook.worksheets.getItem('Assessment Unit');
const auHeaders = auSheet.getRange('A1:J1').values[0];
const rawAuValues = auSheet.getRange('A2:J1000').values.filter((row) => row[0] && row[1]);
const auValues = [...new Map(rawAuValues.map((row) => [String(row[1]), row])).values()];
if (rawAuValues.length !== auValues.length) {
  auSheet.getRange('A2:J1000').clear({ applyTo: 'contents' });
  auSheet.getRange(`A2:J${auValues.length + 1}`).values = auValues;
}
const auRows = auValues.map((row) => Object.fromEntries(auHeaders.map((header, index) => [header, row[index]])));
const authorityByTps = new Map();
for (const record of auEvidence.filter((record) => record.tps_code)) {
  const key = String(record.tps_code);
  authorityByTps.set(key, [...(authorityByTps.get(key) ?? []), record]);
}

const basinSheet = workbook.worksheets.getItem('Basin');
const basinRows = basinSheet.getRange('A2:H180').values.filter((row) => row[0] && row[3]);
const provinceSheet = workbook.worksheets.getItem('Province');
const provinceRows = provinceSheet.getRange('A2:L180').values.filter((row) => row[0] && row[1]);
const provinceById = new Map(provinceRows.map((row) => [row[0], row]));
const basinCycleSheet = workbook.worksheets.getItem('Basin Cycle');
const basinCycleRows = basinCycleSheet.getRange('A2:R1000').values.filter((row) => row[0] && row[2]);
const doustClassifications = new Map([
  ['4025', ['extensional', 'Doust worked example: Jurassic-Cretaceous southern Viking Graben.']],
  ['2019', ['sag', 'Doust worked example: Arabian Basin adjacent to the Arabian Shield.']],
  ['3703', ['extensional', 'Doust worked example: Malay Basin rift-to-postrift section.']],
  ['6099', ['compressional', 'Doust worked example: Maracaibo Basin.']],
  ['6055', ['compressional', 'Doust worked example: Neuquen fold-belt reconstruction.']],
  ['6016', ['sag', 'Doust cited cratonic-basin example: Parnaiba Basin.']],
  ['7303', ['sag', 'Doust worked example: Orange Basin passive-margin profile.']],
  ['3824', ['compressional', 'Doust worked example: Northwest Java synrift, postrift and foreland cycles.']],
  ['3809', ['compressional', 'Doust worked example: East Java forearc stratigraphy.']],
  ['5234', ['multi-cycle', 'Doust describes multiple rift, sag and foreland cycles; one basin-wide class would be misleading.']],
]);
basinSheet.getRange('I1:K1').values = [['classification_status', 'classification_basis', 'classification_citation_id']];
basinSheet.getRange('I1:K1').format = headerFormat;
basinSheet.getRange(`C2:C${basinRows.length + 1}`).values = basinRows.map((row) => {
  const code = String(row[3]).split(':').pop();
  return [[row[2] || doustClassifications.get(code)?.[0] || null][0]];
});
basinSheet.getRange(`I2:K${basinRows.length + 1}`).values = basinRows.map((row) => {
  const code = String(row[3]).split(':').pop();
  const classification = doustClassifications.get(code);
  return classification
    ? ['source-classified', classification[1], 'C-DOUST-01']
    : ['not-classified', 'No reviewed basin-cycle classification is stored. USGS province identity alone is insufficient to infer geodynamics.', null];
});
basinSheet.getRange(`C2:K${basinRows.length + 1}`).format = bodyFormat;
basinSheet.getRange('C:C').format.columnWidth = 24;
basinSheet.getRange('I:I').format.columnWidth = 24;
basinSheet.getRange('J:J').format.columnWidth = 72;
basinSheet.getRange('K:K').format.columnWidth = 26;

// Add the current machine-readable geological timescale authority in the reserved blank citation row.
const citationSheet = workbook.worksheets.getItem('Citations');
citationSheet.getRange('A42:K42').values = [[
  'C-ICS-2026', 'P0', 'International Commission on Stratigraphy', '2026',
  'International Chronostratigraphic Chart 2026/06', 'ICS / IUGS',
  'https://stratigraphy.org/chart/', 'CC-BY-4.0', 'Y',
  'official ICS chart and machine-readable source checked 2026-08-03',
  'Authoritative time vocabulary for PS models; numeric ages remain source-specific interpretations.',
]];
citationSheet.getRange('A42:K42').format = bodyFormat;
citationSheet.getRange('A43:K43').values = [[
  'C-USGS-DDS60-AU', 'P0', 'U.S. Geological Survey World Energy Assessment Team', '2000',
  'World Petroleum Assessment 2000 — regional AU description forms', 'USGS DDS-60',
  'https://pubs.usgs.gov/dds/dds-060/', 'Public Domain', 'Y',
  'Eight regional archives downloaded and AU description forms extracted 2026-08-03.',
  'Authority narrative evidence is preserved by 2000 assessment vintage and never silently substituted for the 2012 inventory.',
]];
citationSheet.getRange('A43:K43').format = bodyFormat;
const publicationServiceUrl = 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/World_Petroleum_Assessments/FeatureServer/3';
citationSheet.getRange('A44:K44').values = [[
  'C-USGS-WORLD-PUBS', 'P0', 'U.S. Geological Survey Energy Resources Program', '2026',
  'World Petroleum Assessments — province-to-publication registry', 'USGS ArcGIS Feature Service',
  publicationServiceUrl, 'Public Domain', 'Y',
  'Official conventional-assessment publication registry queried 2026-08-03.',
  'Links current workbook provinces to USGS assessment publications; publication presence is not itself a reviewed TPS model.',
]];
citationSheet.getRange('A44:K44').format = bodyFormat;

// Expand the N:M cycle bridge to cover every known Viking framework contribution.
const psCycle = workbook.worksheets.getItem('PS x Cycle');
psCycle.getRange('A2:D6').values = [
  ['atlas:petroleum-system:usgs:402501', 'atlas:basin-cycle:atlas:viking-graben-late-synrift', 'source', 'Draupne and Heather source rocks were deposited within this cycle.'],
  ['atlas:petroleum-system:usgs:402501', 'atlas:basin-cycle:atlas:viking-graben-early-climax-synrift', 'reservoir', 'Hugin reservoir charged by this system was deposited within this cycle.'],
  ['atlas:petroleum-system:usgs:402501', 'atlas:basin-cycle:atlas:viking-graben-pre-rift', 'reservoir', 'Skagerrak is retained as a secondary reservoir element in the Viking framework.'],
  ['atlas:petroleum-system:usgs:402501', 'atlas:basin-cycle:atlas:viking-graben-postrift-sag', 'seal/overburden', 'Post-rift units provide overburden, regional seal and secondary reservoir intervals.'],
  ['Explicit N:M join — a Petroleum System spans basin cycles; the relationship is never reduced to one cycle foreign key.', null, null, null],
];
psCycle.getRange('A2:D5').format = bodyFormat;
psCycle.getRange('A6:D6').format = noteFormat;
psCycle.getRange('A6:D6').merge();

const today = '2026-08-03';
const uniqueText = (values) => [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];

// Evidence-derived chart normalization.  These ranges follow the current ICS
// 2026/06 boundaries.  A reported geological-age phrase is promoted only as a
// low/medium-certainty interval; it is never presented as burial-model output.
const ageRanges = new Map(Object.entries({
  'precambrian': [4600, 538.8],
  'cambrian': [538.8, 486.85], 'early cambrian': [538.8, 521], 'lower cambrian': [538.8, 521],
  'middle cambrian': [521, 497], 'late cambrian': [497, 486.85], 'upper cambrian': [497, 486.85],
  'ordovician': [486.85, 443.1], 'early ordovician': [486.85, 470], 'lower ordovician': [486.85, 470],
  'middle ordovician': [470, 458.2], 'late ordovician': [458.2, 443.1], 'upper ordovician': [458.2, 443.1],
  'silurian': [443.1, 419.62], 'early silurian': [443.1, 433.4], 'lower silurian': [443.1, 433.4],
  'middle silurian': [433.4, 427.4], 'late silurian': [427.4, 419.62], 'upper silurian': [427.4, 419.62],
  'devonian': [419.62, 358.86], 'early devonian': [419.62, 393.47], 'lower devonian': [419.62, 393.47],
  'middle devonian': [393.47, 382.31], 'late devonian': [382.31, 358.86], 'upper devonian': [382.31, 358.86],
  'carboniferous': [358.86, 298.9], 'mississippian': [358.86, 323.2], 'lower carboniferous': [358.86, 323.2],
  'early carboniferous': [358.86, 323.2], 'pennsylvanian': [323.2, 298.9], 'upper carboniferous': [323.2, 298.9],
  'late carboniferous': [323.2, 298.9],
  'permian': [298.9, 251.902], 'early permian': [298.9, 273.01], 'lower permian': [298.9, 273.01],
  'middle permian': [273.01, 259.51], 'late permian': [259.51, 251.902], 'upper permian': [259.51, 251.902],
  'triassic': [251.902, 201.4], 'early triassic': [251.902, 247.2], 'lower triassic': [251.902, 247.2],
  'middle triassic': [247.2, 237], 'late triassic': [237, 201.4], 'upper triassic': [237, 201.4],
  'jurassic': [201.4, 143.1], 'early jurassic': [201.4, 174.7], 'lower jurassic': [201.4, 174.7],
  'middle jurassic': [174.7, 161.5], 'late jurassic': [161.5, 143.1], 'upper jurassic': [161.5, 143.1],
  'cretaceous': [143.1, 66], 'early cretaceous': [143.1, 100.5], 'lower cretaceous': [143.1, 100.5],
  'late cretaceous': [100.5, 66], 'upper cretaceous': [100.5, 66],
  'paleogene': [66, 23.04], 'paleocene': [66, 56], 'early paleocene': [66, 61.66], 'lower paleocene': [66, 61.66],
  'late paleocene': [61.66, 56], 'upper paleocene': [61.66, 56],
  'eocene': [56, 33.9], 'early eocene': [56, 47.8], 'lower eocene': [56, 47.8],
  'middle eocene': [47.8, 37.71], 'late eocene': [37.71, 33.9], 'upper eocene': [37.71, 33.9],
  'oligocene': [33.9, 23.04], 'early oligocene': [33.9, 27.3], 'lower oligocene': [33.9, 27.3],
  'middle oligocene': [30.0, 27.3], 'late oligocene': [27.3, 23.04], 'upper oligocene': [27.3, 23.04],
  'neogene': [23.04, 2.58], 'miocene': [23.04, 5.333], 'early miocene': [23.04, 15.98],
  'lower miocene': [23.04, 15.98], 'middle miocene': [15.98, 11.63], 'late miocene': [11.63, 5.333],
  'upper miocene': [11.63, 5.333], 'pliocene': [5.333, 2.58], 'early pliocene': [5.333, 3.6],
  'lower pliocene': [5.333, 3.6], 'middle pliocene': [4.2, 3.2], 'late pliocene': [3.6, 2.58],
  'upper pliocene': [3.6, 2.58], 'quaternary': [2.58, 0], 'pleistocene': [2.58, 0.0117],
  'holocene': [0.0117, 0], 'tertiary': [66, 2.58], 'early tertiary': [66, 33.9],
  'late tertiary': [33.9, 2.58], 'paleozoic': [538.8, 251.902], 'mesozoic': [251.902, 66],
  'cenozoic': [66, 0],
}));
const ageKeys = [...ageRanges.keys()].sort((a, b) => b.length - a.length);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const extractAgeIntervals = (text) => {
  const sourceText = String(text || '').replace(/[–—]/g, '-');
  const lower = sourceText.toLowerCase();
  const hits = [];
  const occupied = [];
  for (const key of ageKeys) {
    const variants = [key];
    if (key.startsWith('late ')) variants.push(`latest ${key.slice(5)}`);
    if (key.startsWith('early ')) variants.push(`earliest ${key.slice(6)}`);
    for (const variant of variants) {
      const re = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'g');
      for (const match of lower.matchAll(re)) {
        const from = match.index ?? 0;
        const to = from + match[0].length;
        if (occupied.some(([a, b]) => from >= a && to <= b)) continue;
        const base = ageRanges.get(key);
        let [start, end] = base;
        if (variant.startsWith('earliest ')) end = start - (start - end) * 0.35;
        if (variant.startsWith('latest ')) start = end + (start - end) * 0.35;
        if (/post[-\s]$/.test(lower.slice(Math.max(0, from - 6), from))) {
          start = end;
          end = 0;
        }
        hits.push({ term: sourceText.slice(from, to), key, start, end });
        occupied.push([from, to]);
      }
    }
  }
  const numeric = /(?:~|about|approximately|around|ca\.?|circa)?\s*(\d+(?:\.\d+)?)\s*(?:ma|m\.y\.|million years?)/gi;
  for (const match of sourceText.matchAll(numeric)) {
    const age = Number(match[1]);
    if (age > 0 && age <= 4600) hits.push({ term: match[0].trim(), key: `numeric-${age}`, start: age + 0.5, end: Math.max(0, age - 0.5), exact: true });
  }
  return [...new Map(hits.map((hit) => [`${hit.key}:${hit.start}:${hit.end}`, hit])).values()];
};
const relevantSentences = (texts, pattern) => texts.flatMap((text) => String(text || '').split(/(?<=[.!?])\s+/)).filter((sentence) => pattern.test(sentence));
const intervalFromSentences = (sentences, fallback = []) => {
  const hits = sentences.flatMap(extractAgeIntervals);
  const resolved = hits.length ? hits : fallback;
  if (!resolved.length) return null;
  const start = Math.max(...resolved.map((hit) => hit.start));
  const continuousToPresent = /present day|present-day|to (?:the )?present|continu(?:e|es|ed|ing)[^.]{0,80}present|currently|today/i.test(sentences.join(' '));
  const end = continuousToPresent ? 0 : Math.min(...resolved.map((hit) => hit.end));
  return { start, end, terms: uniqueText(resolved.map((hit) => hit.term)), exact: resolved.some((hit) => hit.exact) };
};
const recordsForTps = (tpsCode) => authorityByTps.get(String(tpsCode)) ?? [];
const catalogModels = psValues.map((row) => {
  const [tpsId, code, name, , , , , provenance, citation] = row;
  const hasNarrative = recordsForTps(code).some((record) => record.source_rocks || record.reservoir_rocks || record.maturation || record.migration);
  return [
    `atlas:ps-model:${code}:catalog-v1`, tpsId, 'total-petroleum-system', tpsId,
    `${name} — ${hasNarrative ? 'evidence-derived framework' : 'catalogue baseline'}`, hasNarrative ? 'G1' : 'G0', 'ICS 2026/06', hasNarrative ? 'draft' : 'catalogued',
    'USGS / ArgantaEnergy normalization', null, '1.0.0', today,
    hasNarrative ? 'evidence-derived' : (provenance || 'reference'), hasNarrative ? 'C-USGS-DDS60-AU' : (citation || 'C-USGS-DDS69'),
    hasNarrative
      ? 'Timed from authority age phrases using ICS 2026/06 boundaries. Evidence-derived intervals require geological review and are not burial-model calibration.'
      : 'Identity-level model. Elements and processes remain unmodelled until evidence is reviewed.',
  ];
});
const vikingModelId = 'atlas:ps-model:402501:40250101:v1';
const vikingModel = [
  vikingModelId, 'atlas:petroleum-system:usgs:402501', 'assessment-unit',
  'atlas:assessment-unit:usgs:40250101', 'Kimmeridgian Shales — Viking Graben AU',
  'G1', 'ICS 2026/06', 'draft', 'ArgantaEnergy', null, '1.0.0', today,
  'interpreted', 'C-USGS-03',
  'Workbook-backed pilot. Essential elements are modelled; process timing and critical moment remain explicit gaps.',
];
const modelRows = [...catalogModels, vikingModel];
const modelSheet = writeDataSheet('PS Model', [
  'model_id', 'tps_id', 'scope_type', 'scope_id', 'title', 'completeness_grade',
  'timescale_version', 'status', 'author', 'reviewer', 'version', 'valid_from',
  'provenance', 'source_citation_id', 'notes',
], modelRows, [32, 31, 20, 32, 36, 20, 18, 14, 28, 20, 12, 14, 15, 20, 55],
'Completeness grades: G0 catalogued · G1 framework · G2 chart-ready · G3 calibrated · G4 technically reviewed. A model scope may be TPS-wide, AU-specific, basin-sector-specific or a field calibration case.');
modelSheet.getRange(`F2:F${modelRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['G0', 'G1', 'G2', 'G3', 'G4'] } };
modelSheet.getRange(`H2:H${modelRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['catalogued', 'draft', 'in-review', 'approved', 'retired'] } };
modelSheet.getRange(`L2:L${modelRows.length + 1}`).format.numberFormat = 'yyyy-mm-dd';
modelSheet.getRange(`A${modelRows.length + 1}:O${modelRows.length + 1}`).format.fill = '#ECFEFF';

const roleEffectiveness = (roleNote) => {
  const note = String(roleNote || '').toLowerCase();
  if (note.includes('primary')) return 'primary';
  if (note.includes('secondary')) return 'secondary';
  if (note.includes('regional')) return 'regional';
  return 'not-assessed';
};
const vikingElementRows = stratValues
  .filter((row) => row[5] && row[5] !== 'none')
  .map((row, index) => {
    const [unitName, , ageTop, ageBase, , role, roleNote, cycleId, provenance, citation] = row;
    return [
      `atlas:ps-element:40250101:${String(index + 1).padStart(2, '0')}`,
      vikingModelId, unitName, role,
      Math.max(Number(ageTop), Number(ageBase)), Math.min(Number(ageTop), Number(ageBase)),
      roleEffectiveness(roleNote), 'medium', cycleId, provenance || 'interpreted', citation,
      roleNote || 'Role inherited from the reviewed Viking stratigraphic framework.',
    ];
  });
const elementEvidenceSpecs = [
  ['source', 'source_rocks', 'source_age_terms', 'source_unit_candidates', /source|organic|kerogen|matur/i],
  ['reservoir', 'reservoir_rocks', 'reservoir_age_terms', 'reservoir_unit_candidates', /reservoir|porosity|permeab/i],
  ['seal', 'traps_seals', null, 'seal_unit_candidates', /seal|cap rock|evaporite|salt|shale|mudstone|chalk/i],
  ['overburden', 'traps_seals', null, null, /overburden|overlain|blanket|deeply bur|burial|molasse/i],
];
const evidenceElementRows = catalogModels.flatMap((model) => {
  const modelId = model[0];
  const tpsCode = String(model[1]).split(':').pop();
  const records = recordsForTps(tpsCode);
  const rows = [];
  for (const record of records) {
    for (const [role, textField, ageField, unitField, sentencePattern] of elementEvidenceSpecs) {
      const evidenceText = record[textField];
      if (!evidenceText) continue;
      const selectedText = ageField ? evidenceText : relevantSentences([evidenceText], sentencePattern).join(' ');
      const ages = ageField
        ? uniqueText(record[ageField] ?? []).flatMap((term) => extractAgeIntervals(term))
        : extractAgeIntervals(selectedText);
      if (!ages.length) continue;
      const units = uniqueText(record[unitField] ?? []);
      for (const age of ages) {
        const unitName = units.length ? units.slice(0, 3).join(' / ') : `${age.term} ${role} interval`;
        rows.push([
          null, modelId, unitName, role, age.start, age.end,
          'not-assessed', units.length ? 'medium' : 'low', null, 'evidence-derived', 'C-USGS-DDS60-AU',
          `AU ${record.au_code}: ${String(evidenceText).slice(0, 1200)} | Age phrase normalized to ICS 2026/06; geological review pending.`,
        ]);
      }
    }
  }
  const deduped = [...new Map(rows.map((row) => [`${row[1]}|${row[3]}|${row[4]}|${row[5]}|${row[2]}`, row])).values()];
  return deduped.map((row, index) => {
    row[0] = `atlas:ps-element:${tpsCode}:evidence:${String(index + 1).padStart(3, '0')}`;
    return row;
  });
});
const elementRows = [...vikingElementRows, ...evidenceElementRows];
const elementSheet = writeDataSheet('PS Elements', [
  'element_id', 'model_id', 'unit_name', 'element_role', 'start_ma', 'end_ma',
  'effectiveness', 'confidence', 'basin_cycle_id', 'provenance', 'source_citation_id', 'notes',
], elementRows, [33, 36, 24, 18, 12, 12, 17, 14, 40, 15, 20, 55],
'One row is one formation-role interpretation within one model. Numerical ages drive the chart; text-only geological ages are display labels, not the temporal source of truth.');
elementSheet.getRange(`D2:D${elementRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['source', 'reservoir', 'seal', 'overburden', 'carrier', 'underburden'] } };
elementSheet.getRange(`H2:H${elementRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['high', 'medium', 'low', 'unknown'] } };
elementSheet.getRange(`E2:F${elementRows.length + 1}`).format.numberFormat = '0.0';

const gaps = [
  ['trap-formation', 'Trap formation', 'structural restoration and trap chronology'],
  ['generation', 'Hydrocarbon generation', 'burial and thermal maturity model'],
  ['expulsion', 'Source-rock expulsion', 'kinetics and expulsion calibration'],
  ['migration', 'Migration', 'kitchen and migration-path interpretation'],
  ['accumulation', 'Accumulation', 'charge-to-trap timing and discovery calibration'],
  ['preservation', 'Preservation', 'uplift, breach and remigration analysis'],
  ['critical-moment', 'Critical moment', 'integrated charge, trap and accumulation timing'],
];
const eventRows = modelRows.flatMap((model) => {
  const modelId = model[0];
  const tpsCode = String(model[1]).split(':').pop();
  const scopeKey = modelId === vikingModelId ? '40250101' : tpsCode;
  const records = modelId === vikingModelId
    ? auEvidence.filter((record) => String(record.au_code) === '40250101')
    : recordsForTps(tpsCode);
  const sources = records.map((record) => record.source_rocks);
  const maturations = records.map((record) => record.maturation);
  const migrations = records.map((record) => record.migration);
  const traps = records.map((record) => record.traps_seals);
  const descriptions = records.map((record) => record.description);
  const generationFallback = records.flatMap((record) => uniqueText(record.maturation_age_terms ?? []).flatMap((term) => extractAgeIntervals(term)));
  const processSpecs = new Map([
    ['trap-formation', relevantSentences([...traps, ...descriptions], /formed|formation|fault|fold|rift|uplift|tecton|structur|compression|inversion/i)],
    ['generation', relevantSentences(maturations, /matur|generation|oil window|gas window|thermal/i)],
    ['expulsion', relevantSentences([...maturations, ...sources], /expuls/i)],
    ['migration', relevantSentences([...migrations, ...maturations], /migrat|available to traps/i)],
    ['accumulation', relevantSentences([...traps, ...maturations, ...migrations], /effective entrap|entrapment occurred|charg|available to traps|accumulation form/i)],
    ['preservation', relevantSentences([...descriptions, ...traps, ...maturations, ...migrations], /preserv|uplift|erosion|remigr|loss|breach|biodegrad|escape|leak/i)],
    ['critical-moment', relevantSentences([...maturations, ...descriptions], /peak|critical moment|maximum generation/i)],
  ]);
  return gaps.map(([eventType, label, required], index) => {
    const sentences = processSpecs.get(eventType) ?? [];
    const mayUseGenerationFallback = eventType === 'generation'
      || ((eventType === 'migration' || eventType === 'accumulation') && sentences.some((sentence) => /contempor|continu|available to traps/i.test(sentence)));
    const interval = intervalFromSentences(sentences, mayUseGenerationFallback ? generationFallback : []);
    const relatedRoles = eventType === 'generation' || eventType === 'expulsion' ? new Set(['source'])
      : eventType === 'accumulation' ? new Set(['reservoir'])
        : eventType === 'preservation' ? new Set(['seal', 'overburden'])
          : new Set(['source', 'reservoir', 'seal', 'overburden']);
    const relatedIds = elementRows.filter((row) => row[1] === modelId && relatedRoles.has(row[3])).map((row) => row[0]).join('; ') || null;
    const evidenceNote = uniqueText(sentences).join(' ').slice(0, 1800);
    return interval ? [
      `atlas:ps-event:${scopeKey}:${String(index + 1).padStart(2, '0')}`,
      modelId, eventType, eventType === 'critical-moment' ? 'Critical-moment proxy' : label,
      interval.start, interval.end, 'modelled', interval.exact ? 'medium' : sentences.flatMap(extractAgeIntervals).length ? 'medium' : 'low',
      null, relatedIds, 'evidence-derived', 'C-USGS-DDS60-AU', required,
      `${evidenceNote || 'Timing inherited from the reported generation interval.'} | Normalized terms: ${interval.terms.join('; ')}. Evidence-derived interval; burial/thermal calibration and geological review remain required.`,
    ] : [
      `atlas:ps-event:${scopeKey}:${String(index + 1).padStart(2, '0')}`,
      modelId, eventType, label, null, null, 'not-modelled', 'unknown', null, relatedIds,
      'gap', null, required,
      records.length
        ? 'Authority narrative is present, but it does not contain a defensible numerical or geological-age interval for this process.'
        : 'No defensible numerical event interval is stored yet. This row is an explicit work-programme item.',
    ];
  });
});
const eventSheet = writeDataSheet('PS Events', [
  'event_id', 'model_id', 'event_type', 'label', 'start_ma', 'end_ma', 'event_status',
  'certainty', 'basin_cycle_id', 'related_element_ids', 'provenance', 'source_citation_id',
  'evidence_required', 'notes',
], eventRows, [34, 36, 22, 25, 12, 12, 18, 14, 40, 42, 14, 20, 44, 58],
'USGS event convention: trap formation · generation · migration · accumulation · preservation · critical moment. Unknown timing remains a governed gap, never an inferred bar.');
eventSheet.getRange(`C2:C${eventRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['trap-formation', 'generation', 'expulsion', 'migration', 'accumulation', 'preservation', 'breach-remigration', 'critical-moment'] } };
eventSheet.getRange(`G2:G${eventRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['modelled', 'partial', 'not-modelled', 'disputed'] } };
eventSheet.getRange(`H2:H${eventRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['high', 'medium', 'low', 'unknown'] } };
eventSheet.getRange(`E2:F${eventRows.length + 1}`).format.numberFormat = '0.0';

const essentialGaps = [
  ['source', 'Source rock', 'reviewed source-rock formation, age, richness and maturity evidence'],
  ['reservoir', 'Reservoir rock', 'reviewed reservoir formation, age, facies and effectiveness evidence'],
  ['seal', 'Seal rock', 'reviewed regional/top-seal formation, age and integrity evidence'],
  ['overburden', 'Overburden rock', 'reviewed burial-stratigraphy and overburden history'],
];
const vikingRoles = new Set(elementRows.filter((row) => row[1] === vikingModelId).map((row) => row[3]));
const hasAuthorityEvidence = (tpsId, gapType) => {
  const tpsCode = String(tpsId).split(':').pop();
  const records = authorityByTps.get(tpsCode) ?? [];
  if (gapType === 'source') return records.some((record) => record.source_rocks);
  if (gapType === 'reservoir') return records.some((record) => record.reservoir_rocks);
  if (gapType === 'seal') return records.some((record) => record.traps_seals);
  if (gapType === 'generation') return records.some((record) => record.maturation);
  if (gapType === 'migration') return records.some((record) => record.migration);
  return false;
};
const gapRows = modelRows.flatMap((model) => {
  const [modelId, tpsId, scopeType, scopeId, title, grade] = model;
  const elementGaps = essentialGaps.filter(([role]) => modelId !== vikingModelId || !vikingRoles.has(role));
  const allGaps = [
    ...elementGaps.map(([key, label, evidence]) => ['essential-element', key, label, evidence]),
    ...gaps.map(([key, label, evidence]) => ['process-event', key, label, evidence]),
  ];
  return allGaps.map(([gapClass, gapType, label, evidence], index) => {
    const located = hasAuthorityEvidence(tpsId, gapType);
    const completed = gapClass === 'essential-element'
      ? elementRows.some((row) => row[1] === modelId && row[3] === gapType)
      : eventRows.some((row) => row[1] === modelId && row[2] === gapType && row[6] === 'modelled');
    return [
      `atlas:ps-gap:${String(scopeId).split(':').pop()}:${String(index + 1).padStart(2, '0')}`,
      modelId, tpsId, scopeType, scopeId, gapClass, gapType, label,
      completed ? 'closed' : located ? 'in-progress' : 'open', completed ? 'low' : located ? 'medium' : 'high', evidence,
      completed ? 'GEOLOGICAL-REVIEW' : located ? 'NORMALIZE-DDS60' : grade === 'G0' ? 'BATCH-QUEUE' : 'VIKING-PILOT', null,
      completed
        ? 'Evidence-derived interval populated with source citation. Geological review and calibration can promote the model beyond G1.'
        : located
        ? 'Authority narrative is loaded. Normalize formations and numerical ages, then complete geological review.'
        : grade === 'G0'
          ? 'Catalogue identity is present; reviewed geological evidence is still required.'
          : 'Framework exists; calibration evidence is still required.',
    ];
  });
});
const gapSheet = writeDataSheet('PS Gap Ledger', [
  'gap_id', 'model_id', 'tps_id', 'scope_type', 'scope_id', 'gap_class', 'gap_type',
  'label', 'status', 'priority', 'evidence_required', 'work_package', 'owner', 'notes',
], gapRows, [35, 36, 31, 20, 34, 20, 22, 25, 14, 13, 48, 20, 20, 58],
'Every absent element or process is an explicit, assignable evidence gap. Closing a row requires a source citation and reviewed model update; blank timing is never treated as zero.');
gapSheet.getRange(`I2:I${gapRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['open', 'in-progress', 'blocked', 'closed', 'disputed'] } };
gapSheet.getRange(`J2:J${gapRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['critical', 'high', 'medium', 'low'] } };

const sourceRef = (record) => record.source_archive_url
  ? `${record.source_archive_url} :: ${record.source_member_path}` : record.source_member_path ?? null;
const evidenceRows = auEvidence.map((record, index) => [
  `atlas:usgs-evidence:dds60:${String(index + 1).padStart(4, '0')}`, 'DDS-60 / 2000',
  record.au_code, record.au_name_reported, record.tps_code, record.tps_name_reported,
  record.province_code, record.province_name_reported, record.assessment_geologist,
  record.extraction_status, record.description, record.source_rocks, record.maturation,
  record.migration, record.reservoir_rocks, record.traps_seals,
  [...(record.source_age_terms ?? []), ...(record.maturation_age_terms ?? []), ...(record.reservoir_age_terms ?? [])].filter((v, i, a) => a.indexOf(v) === i).join('; '),
  sourceRef(record), 'C-USGS-DDS60-AU',
]);
const evidenceSheet = writeDataSheet('USGS AU Evidence', [
  'evidence_id', 'source_vintage', 'au_code', 'au_name_reported', 'tps_code', 'tps_name_reported',
  'province_code', 'province_name_reported', 'assessment_geologist', 'extraction_status',
  'description', 'source_rocks', 'maturation', 'migration', 'reservoir_rocks', 'traps_seals',
  'reported_age_terms', 'source_reference', 'source_citation_id',
], evidenceRows, [35, 18, 14, 28, 14, 34, 16, 30, 24, 18, 58, 68, 58, 58, 68, 68, 45, 72, 22],
'Raw authority evidence by assessment vintage. These narratives are preserved before normalization; they are not chart bars until formation, role and age interpretations are reviewed.');
evidenceSheet.getRange(`C2:C${evidenceRows.length + 1}`).format.numberFormat = '@';
evidenceSheet.getRange(`E2:E${evidenceRows.length + 1}`).format.numberFormat = '@';
evidenceSheet.getRange(`G2:G${evidenceRows.length + 1}`).format.numberFormat = '@';
evidenceSheet.getRange(`J2:J${evidenceRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['parsed', 'partial', 'error'] } };

const elementCandidateRows = auEvidence.flatMap((record, recordIndex) => [
  ['source', record.source_unit_candidates, record.source_age_terms, record.source_rocks],
  ['reservoir', record.reservoir_unit_candidates, record.reservoir_age_terms, record.reservoir_rocks],
  ['seal', record.seal_unit_candidates, [], record.traps_seals],
].filter(([, , , text]) => text).map(([role, units, ages, text], roleIndex) => [
  `atlas:ps-candidate:${record.au_code ?? `unknown-${recordIndex + 1}`}:${roleIndex + 1}`,
  'DDS-60 / 2000', record.au_code, record.tps_code, role, (units ?? []).join('; '),
  (ages ?? []).join('; '), text, 'candidate', 'authority-text / normalization-pending',
  sourceRef(record), 'C-USGS-DDS60-AU',
  'Confirm formation names, split multi-unit narratives and assign numerical ages before promotion to PS Elements.',
]));
const candidateSheet = writeDataSheet('PS Element Candidates', [
  'candidate_id', 'source_vintage', 'au_code', 'tps_code', 'element_role', 'unit_candidates',
  'reported_age_terms', 'authority_evidence', 'candidate_status', 'confidence',
  'source_reference', 'source_citation_id', 'review_action',
], elementCandidateRows, [38, 18, 14, 14, 18, 48, 38, 76, 18, 34, 72, 22, 68],
'Candidate rows preserve what the authority report says. They do not enter the petroleum-system chart until reviewed numerical ages and model scope are supplied.');
candidateSheet.getRange(`E2:E${elementCandidateRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['source', 'reservoir', 'seal', 'overburden', 'carrier', 'underburden'] } };
candidateSheet.getRange(`I2:I${elementCandidateRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['candidate', 'in-review', 'accepted', 'rejected', 'superseded'] } };

const processEvidenceRows = auEvidence.flatMap((record, recordIndex) => [
  ['generation-maturation', record.maturation_age_terms, record.maturation],
  ['migration', [], record.migration],
].filter(([, , text]) => text).map(([eventType, ages, text], eventIndex) => [
  `atlas:ps-process-evidence:${record.au_code ?? `unknown-${recordIndex + 1}`}:${eventIndex + 1}`,
  'DDS-60 / 2000', record.au_code, record.tps_code, eventType, (ages ?? []).join('; '),
  text, 'evidence-text', 'not-calibrated', sourceRef(record), 'C-USGS-DDS60-AU',
  'Translate reported geological timing into a reviewed numerical interval; calibrate against burial and thermal evidence.',
]));
const processEvidenceSheet = writeDataSheet('PS Process Evidence', [
  'process_evidence_id', 'source_vintage', 'au_code', 'tps_code', 'event_type',
  'reported_age_terms', 'authority_evidence', 'evidence_status', 'certainty',
  'source_reference', 'source_citation_id', 'review_action',
], processEvidenceRows, [42, 18, 14, 14, 24, 40, 78, 18, 20, 72, 22, 68],
'Process narratives are evidence inputs, not event bars. Numerical generation, migration and critical-moment timing requires interpretation and calibration.');

const publicationRows = publicationRegistry.rows.map((row) => [
  row.registry_id, row.province_code, row.publication_id, row.ip_number, row.title, row.authors,
  row.publication_date, row.series, row.usgs_series, row.url, row.abstract, row.keywords,
  row.resource_scope, row.include_web, row.source_service, 'C-USGS-WORLD-PUBS',
]);
const publicationSheet = writeDataSheet('USGS Publication Registry', [
  'registry_id', 'province_code', 'publication_id', 'ip_number', 'title', 'authors',
  'publication_date', 'series', 'usgs_series', 'url', 'abstract', 'keywords',
  'resource_scope', 'include_web', 'source_service', 'source_citation_id',
], publicationRows, [28, 16, 18, 18, 68, 56, 18, 46, 20, 64, 76, 46, 24, 14, 72, 24],
'Official USGS province-to-publication links from the World Petroleum Assessments map service. Duplicate publication IDs are retained when one publication applies to multiple provinces.');
publicationSheet.getRange(`B2:B${publicationRows.length + 1}`).format.numberFormat = '@';
publicationSheet.getRange(`G2:G${publicationRows.length + 1}`).format.numberFormat = 'yyyy-mm-dd';
const publicationsByProvince = new Map();
for (const row of publicationRegistry.rows) {
  publicationsByProvince.set(row.province_code, [...(publicationsByProvince.get(row.province_code) ?? []), row]);
}
const currentEvidenceRows = currentPublicationEvidence.records.map((record, index) => [
  `atlas:usgs-current-evidence:${String(index + 1).padStart(4, '0')}`,
  record.publication_id, record.publication_title, record.publication_series,
  record.page_count, record.pages_extracted, record.extraction_status,
  (record.tps_mentions ?? []).map((item) => `${item.code ?? ''} ${item.name ?? ''}`.trim()).join('; '),
  (record.au_mentions ?? []).map((item) => `${item.code ?? ''} ${item.name ?? ''}`.trim()).join('; '),
  (record.reported_age_terms ?? []).join('; '), (record.unit_candidates ?? []).join('; '),
  record.source_evidence, record.reservoir_evidence, record.trap_seal_evidence,
  record.generation_migration_evidence, record.geologic_framework_evidence,
  record.source_url, record.pdf_url, 'C-USGS-WORLD-PUBS',
  'Current-publication evidence is linked at publication/province scope unless an explicit TPS or AU code is present. Do not force it into a TPS model by proximity alone.',
]);
const currentEvidenceSheet = writeDataSheet('USGS Current Evidence', [
  'current_evidence_id', 'publication_id', 'publication_title', 'publication_series',
  'page_count', 'pages_extracted', 'extraction_status', 'reported_tps_mentions',
  'reported_au_mentions', 'reported_age_terms', 'unit_candidates', 'source_evidence',
  'reservoir_evidence', 'trap_seal_evidence', 'generation_migration_evidence',
  'geologic_framework_evidence', 'publication_url', 'pdf_url', 'source_citation_id', 'scope_rule',
], currentEvidenceRows, [38, 18, 68, 22, 14, 16, 18, 58, 58, 38, 56, 72, 72, 72, 72, 72, 64, 68, 24, 72],
'Evidence sentences and named-unit candidates extracted from current USGS publications. This is a raw evidence layer; promotion to TPS elements or numerical events requires explicit scope resolution and geological review.');
currentEvidenceSheet.getRange(`E2:F${currentEvidenceRows.length + 1}`).format.numberFormat = '#,##0';
const currentEvidenceByPublication = new Map();
for (const record of currentPublicationEvidence.records) {
  const key = String(record.publication_id ?? '');
  currentEvidenceByPublication.set(key, [...(currentEvidenceByPublication.get(key) ?? []), record]);
}

const currentAuByCode = new Map(auRows.map((row) => [String(row.code), row]));
const preferredEvidence = new Map();
for (const record of auEvidence.filter((r) => r.au_code)) {
  const current = preferredEvidence.get(String(record.au_code));
  if (!current || record.extraction_status === 'parsed' && current.extraction_status !== 'parsed' || (record.evidence_chars ?? 0) > (current.evidence_chars ?? 0)) {
    preferredEvidence.set(String(record.au_code), record);
  }
}
const crosswalkRows = [];
for (const row of auRows) {
  const code = String(row.code);
  const record = preferredEvidence.get(code);
  crosswalkRows.push([
    `atlas:usgs-crosswalk:current:${code}`, record ? 'exact-code' : 'current-only',
    code, row.name, row.tps_id, 'DDS-69 / 2012 inventory',
    record?.au_code ?? null, record?.au_name_reported ?? null, record?.tps_code ?? null,
    record?.tps_name_reported ?? null, record?.extraction_status ?? 'not-in-dds60-form-corpus',
    record ? sourceRef(record) : null, record ? 'C-USGS-DDS60-AU' : 'C-USGS-DDS69',
    record ? 'Same eight-digit AU code across vintages; names and boundaries may still require review.' : 'No exact 2000-form code match. Do not infer equivalence from province proximity.',
  ]);
}
for (const [code, record] of preferredEvidence) {
  if (currentAuByCode.has(code)) continue;
  crosswalkRows.push([
    `atlas:usgs-crosswalk:historical:${code}`, 'historical-only', null, null, null,
    'DDS-69 / 2012 inventory', code, record.au_name_reported, record.tps_code,
    record.tps_name_reported, record.extraction_status, sourceRef(record), 'C-USGS-DDS60-AU',
    '2000 assessment identity has no exact code in the current workbook. Preserve as a historical model until a reviewed supersession is established.',
  ]);
}
const crosswalkSheet = writeDataSheet('USGS Vintage Crosswalk', [
  'crosswalk_id', 'relationship', 'current_au_code', 'current_au_name', 'current_tps_id',
  'current_vintage', 'dds60_au_code', 'dds60_au_name', 'dds60_tps_code', 'dds60_tps_name',
  'source_status', 'source_reference', 'source_citation_id', 'notes',
], crosswalkRows, [40, 20, 18, 30, 34, 24, 18, 30, 18, 34, 22, 72, 22, 68],
'Crosswalk rule: exact code is a candidate identity bridge, not proof of unchanged boundary or interpretation. Historical-only records remain versioned and are never forced into the 2012 hierarchy.');
crosswalkSheet.getRange(`B2:B${crosswalkRows.length + 1}`).dataValidation = { rule: { type: 'list', values: ['exact-code', 'current-only', 'historical-only', 'reviewed-supersession'] } };

const evidenceByTps = new Map();
const evidenceByProvince = new Map();
for (const record of auEvidence) {
  if (record.tps_code) evidenceByTps.set(String(record.tps_code), [...(evidenceByTps.get(String(record.tps_code)) ?? []), record]);
  if (record.province_code) evidenceByProvince.set(String(record.province_code), [...(evidenceByProvince.get(String(record.province_code)) ?? []), record]);
}
const coverageRows = psValues.map((row) => {
  const [tpsId, code, name, provinceId] = row;
  const codeText = String(code);
  const provinceCode = String(provinceId).split(':').pop();
  const exact = evidenceByTps.get(codeText) ?? [];
  const provinceEvidence = evidenceByProvince.get(provinceCode) ?? [];
  const currentPublications = publicationsByProvince.get(provinceCode) ?? [];
  const currentEvidencePdfCount = new Set(currentPublications.flatMap((publication) => currentEvidenceByPublication.get(String(publication.publication_id ?? '')) ?? []).map((record) => record.local_path).filter(Boolean)).size;
  const latestPublication = [...currentPublications].sort((a, b) => String(b.publication_date ?? '').localeCompare(String(a.publication_date ?? '')))[0];
  const currentAus = auRows.filter((a) => a.tps_id === tpsId);
  const exactCurrentAu = currentAus.filter((a) => preferredEvidence.has(String(a.code))).length;
  const status = exact.length ? 'dds60-exact-vintage' : provinceEvidence.length ? 'dds60-province-context-only' : 'current-inventory-only';
  const route = exact.length && currentPublications.length
    ? 'Normalize DDS-60 AU candidates, then reconcile them against the linked newer USGS province publication.'
    : exact.length
      ? 'Normalize AU candidates; review formations and numerical ages against current literature.'
      : currentPublications.length
        ? 'Open the linked USGS publication; extract current TPS elements, numerical ages and assessment-vintage relationships.'
        : provinceEvidence.length
          ? 'Establish vintage supersession before using 2000 province evidence; locate current TPS report.'
          : 'Locate current USGS assessment or national survey report; no DDS-60 AU narrative is available.';
  return [
    `atlas:ps-source-coverage:${codeText}`, tpsId, codeText, name, provinceId,
    currentAus.length, exact.length, exact.filter((r) => r.extraction_status === 'parsed').length,
    exactCurrentAu, provinceEvidence.length, status,
    exact[0]?.source_archive_url ?? provinceEvidence[0]?.source_archive_url ?? null,
    route, exact.length ? 'C-USGS-DDS60-AU' : currentPublications.length ? 'C-USGS-WORLD-PUBS' : 'C-USGS-DDS69',
    currentPublications.length, latestPublication?.publication_date ?? null, latestPublication?.url ?? null,
    currentPublications.length ? 'current-publication-located' : 'not-in-current-publication-registry',
    currentEvidencePdfCount,
  ];
});
const sourceCoverageSheet = writeDataSheet('PS Source Coverage', [
  'coverage_id', 'tps_id', 'tps_code', 'tps_name', 'province_id', 'current_au_count',
  'dds60_form_count', 'parsed_form_count', 'exact_current_au_matches', 'province_form_count',
  'source_coverage', 'primary_archive_url', 'research_route', 'source_citation_id',
  'current_publication_count', 'latest_publication_date', 'latest_publication_url', 'current_publication_status',
  'current_evidence_pdf_count',
], coverageRows, [38, 31, 14, 38, 31, 18, 18, 18, 24, 20, 30, 64, 72, 22, 24, 22, 68, 34, 26],
'Coverage is vintage-aware. “Province context” is not treated as TPS evidence, and an exact code still requires geological review before promotion.');
const coverageByTps = new Map(coverageRows.map((row) => [row[1], row]));

const boundedNarrative = (records, fields, limit = 30000) => {
  const parts = [];
  for (const record of records) {
    const body = fields.map(([label, field]) => record[field] ? `${label}: ${record[field]}` : null).filter(Boolean).join(' | ');
    if (body) parts.push(`[AU ${record.au_code ?? 'not reported'}] ${body}`);
  }
  return uniqueText(parts).join('\n\n').slice(0, limit) || null;
};
const psEnrichmentRows = psValues.map((row) => {
  const [tpsId, code, , , currentSource, currentElements, currentProcesses] = row;
  const records = authorityByTps.get(String(code)) ?? [];
  const currentCoverage = coverageByTps.get(tpsId);
  const currentPublicationUrl = currentCoverage?.[16] ?? null;
  const sourceUnits = uniqueText(records.flatMap((record) => record.source_unit_candidates ?? [])).join('; ') || null;
  const essential = boundedNarrative(records, [['Source', 'source_rocks'], ['Reservoir', 'reservoir_rocks'], ['Traps/seals', 'traps_seals']]);
  const processes = boundedNarrative(records, [['Maturation', 'maturation'], ['Migration', 'migration']]);
  const refs = uniqueText([
    ...records.map((record) => record.source_archive_url && record.source_member_path
      ? `${record.source_archive_url} :: ${record.source_member_path}` : record.source_member_path),
    currentPublicationUrl,
  ]).join('\n').slice(0, 30000) || null;
  const fullNarrative = records.some((record) => record.source_rocks && record.reservoir_rocks && record.traps_seals);
  return [
    currentSource || sourceUnits, currentElements || essential, currentProcesses || processes,
    records.length
      ? currentPublicationUrl ? 'DDS-60 / 2000 authority narrative; newer USGS publication located; DDS-69 / 2012 current inventory' : 'DDS-60 / 2000 authority narrative; DDS-69 / 2012 current inventory'
      : currentPublicationUrl ? 'Newer USGS publication located; DDS-69 / 2012 current inventory' : 'DDS-69 / 2012 current inventory',
    records.length ? fullNarrative ? 'authority-narrative-loaded' : 'authority-description-only' : currentPublicationUrl ? 'current-publication-located' : 'current-source-required',
    records.length ? 'C-USGS-DDS60-AU' : currentPublicationUrl ? 'C-USGS-WORLD-PUBS' : 'C-USGS-DDS69', refs,
  ];
});
psSheet.getRange('J1:M1').values = [['evidence_vintage', 'evidence_status', 'element_evidence_citation_id', 'evidence_source_reference']];
psSheet.getRange('J1:M1').format = headerFormat;
psSheet.getRange('E2:G212').values = psEnrichmentRows.map((row) => row.slice(0, 3));
psSheet.getRange('J2:M212').values = psEnrichmentRows.map((row) => row.slice(3));
psSheet.getRange('E2:M212').format = bodyFormat;
['E:E', 'F:F', 'G:G', 'J:J', 'K:K', 'L:L', 'M:M'].forEach((col, index) => {
  psSheet.getRange(col).format.columnWidth = [34, 68, 68, 40, 30, 28, 72][index];
});

auSheet.getRange('K1:L1').values = [['resource_data_status', 'resource_note']];
auSheet.getRange('K1:L1').format = headerFormat;
auSheet.getRange(`K2:L${auValues.length + 1}`).values = auRows.map((row) => {
  const reported = row.oilMean_mmbbl != null || row.gasMean_bcf != null || row.boeMean_mmboe != null;
  return reported
    ? ['reported-in-DDS69-summary', 'Undiscovered mean resource values are reported by the DDS-69 AU summary.']
    : ['not-reported-in-DDS69-summary', 'Assessment-unit identity is valid; a mean resource value is not present in the DDS-69 summary and is not imputed as zero.'];
});
auSheet.getRange(`K2:L${auValues.length + 1}`).format = bodyFormat;
auSheet.getRange('K:K').format.columnWidth = 34;
auSheet.getRange('L:L').format.columnWidth = 72;

const auByTps = new Map();
for (const row of auRows) {
  const current = auByTps.get(row.tps_id) ?? { count: 0, oil: 0, gas: 0 };
  current.count += 1;
  current.oil += Number(row.oilMean_mmbbl ?? 0);
  current.gas += Number(row.gasMean_bcf ?? 0);
  auByTps.set(row.tps_id, current);
}
const rankedSystems = psValues.map((row) => {
  const [tpsId, code, name, provinceId, , , , , citation] = row;
  const resource = auByTps.get(tpsId) ?? { count: 0, oil: 0, gas: 0 };
  return { tpsId, code, name, provinceId, citation, resource, boe: resource.oil + resource.gas / 6 };
}).sort((a, b) => b.boe - a.boe || String(a.code).localeCompare(String(b.code)));
const rankByTps = new Map(rankedSystems.map((row, index) => [row.tpsId, index + 1]));
const batchRows = psValues.map((row) => {
  const [tpsId, code, name, provinceId, , , , , citation] = row;
  const rank = rankByTps.get(tpsId);
  const isViking = String(code) === '402501';
  const batchNumber = Math.ceil(rank / 20);
  const sourceCoverage = coverageByTps.get(tpsId);
  const hasAuthorityNarrative = Number(sourceCoverage?.[6] ?? 0) > 0;
  return [
    isViking ? 'B00' : `B${String(batchNumber).padStart(2, '0')}`,
    tpsId, String(code), name, provinceId, isViking ? vikingModelId : `atlas:ps-model:${code}:catalog-v1`, rank,
    null, null, null, null, isViking || hasAuthorityNarrative ? 'G2' : 'G1', isViking ? 'pilot-complete' : hasAuthorityNarrative ? 'authoring' : 'queued', null, null, null,
    isViking || hasAuthorityNarrative ? 'Review evidence-derived intervals; fill remaining element/process rows and calibrate the critical moment.' : 'Review authority report; identify source, reservoir, seal and overburden with numerical ages.',
    citation || 'C-USGS-DDS69', sourceCoverage?.[6] ?? 0, sourceCoverage?.[10] ?? 'current-inventory-only',
    sourceCoverage?.[10] === 'dds60-exact-vintage' ? 'exact historical-code candidate; review against current model' : 'no exact historical TPS form match',
    sourceCoverage?.[12] ?? 'Locate and review the current authority report.',
    sourceCoverage?.[14] ?? 0, sourceCoverage?.[16] ?? null, sourceCoverage?.[18] ?? 0,
  ];
});
const batchSheet = writeDataSheet('PS Batch Plan', [
  'batch_id', 'tps_id', 'tps_code', 'tps_name', 'province_id', 'working_model_id', 'priority_rank',
  'assessment_unit_count', 'oil_mean_mmbbl', 'gas_mean_bcf', 'boe_mean_mmboe', 'target_grade',
  'workflow_status', 'element_rows', 'modelled_event_rows', 'open_gaps', 'next_action', 'source_citation_id',
  'authority_form_count', 'source_coverage', 'vintage_alignment', 'research_route',
  'current_publication_count', 'current_publication_url', 'current_evidence_pdf_count',
], batchRows, [12, 31, 13, 38, 31, 37, 14, 19, 17, 16, 18, 14, 20, 14, 21, 14, 58, 22, 20, 30, 42, 72, 24, 68, 26],
'Batch method: B00 is the Viking pilot. B01 onward contain up to 20 TPS each, prioritized by summed AU mean BOE (oil mean + gas mean / 6). Ranking is a screening queue, not a geological prospectivity verdict.');
const batchLast = batchRows.length + 1;
const auLast = auValues.length + 1;
const auTpsCol = columnName(auHeaders.indexOf('tps_id') + 1);
const auOilCol = columnName(auHeaders.indexOf('oilMean_mmbbl') + 1);
const auGasCol = columnName(auHeaders.indexOf('gasMean_bcf') + 1);
for (let row = 2; row <= batchLast; row += 1) {
  batchSheet.getRange(`H${row}:K${row}`).formulas = [[
    `=COUNTIF('Assessment Unit'!$${auTpsCol}$2:$${auTpsCol}$${auLast},B${row})`,
    `=SUMIF('Assessment Unit'!$${auTpsCol}$2:$${auTpsCol}$${auLast},B${row},'Assessment Unit'!$${auOilCol}$2:$${auOilCol}$${auLast})`,
    `=SUMIF('Assessment Unit'!$${auTpsCol}$2:$${auTpsCol}$${auLast},B${row},'Assessment Unit'!$${auGasCol}$2:$${auGasCol}$${auLast})`,
    `=I${row}+J${row}/6`,
  ]];
  batchSheet.getRange(`N${row}:P${row}`).formulas = [[
    `=COUNTIF('PS Elements'!$B$2:$B$${elementRows.length + 1},F${row})`,
    `=COUNTIFS('PS Events'!$B$2:$B$${eventRows.length + 1},F${row},'PS Events'!$G$2:$G$${eventRows.length + 1},"modelled")`,
    `=COUNTIFS('PS Gap Ledger'!$B$2:$B$${gapRows.length + 1},F${row},'PS Gap Ledger'!$I$2:$I$${gapRows.length + 1},"<>closed")`,
  ]];
}
batchSheet.getRange(`G2:G${batchLast}`).format.numberFormat = '0';
batchSheet.getRange(`H2:H${batchLast}`).format.numberFormat = '0';
batchSheet.getRange(`I2:K${batchLast}`).format.numberFormat = '#,##0.0';
batchSheet.getRange(`L2:L${batchLast}`).dataValidation = { rule: { type: 'list', values: ['G1', 'G2', 'G3', 'G4'] } };
batchSheet.getRange(`M2:M${batchLast}`).dataValidation = { rule: { type: 'list', values: ['queued', 'researching', 'authoring', 'in-review', 'pilot-complete', 'approved', 'blocked'] } };

const psEnrichmentByTps = new Map(psValues.map((row, index) => [row[0], psEnrichmentRows[index]]));
const timedModelIds = new Set(elementRows.map((row) => row[1]));
const timedProcessModelIds = new Set(eventRows.filter((row) => row[6] === 'modelled').map((row) => row[1]));
const basinCompletionRows = basinRows.map((basin) => {
  const [basinId, basinName, existingSetting, provinceId] = basin;
  const province = provinceById.get(provinceId);
  const provinceCode = String(province?.[1] ?? provinceId).split(':').pop().padStart(4, '0');
  const provinceName = province?.[2] ?? null;
  const basinTps = psValues.filter((row) => row[3] === provinceId);
  const basinTpsIds = new Set(basinTps.map((row) => row[0]));
  const basinAus = auRows.filter((row) => basinTpsIds.has(row.tps_id));
  const sourceRows = coverageRows.filter((row) => basinTpsIds.has(row[1]));
  const publications = publicationsByProvince.get(provinceCode) ?? [];
  const uniquePublicationIds = new Set(publications.map((row) => String(row.publication_id ?? row.url ?? row.title)));
  const extractedPdfs = new Set(publications.flatMap((row) => currentEvidenceByPublication.get(String(row.publication_id ?? '')) ?? []).map((row) => row.local_path).filter(Boolean));
  const narrativeTps = basinTps.filter((row) => psEnrichmentByTps.get(row[0])?.[1]).length;
  const formationTps = basinTps.filter((row) => psEnrichmentByTps.get(row[0])?.[0]).length;
  const basinModels = modelRows.filter((row) => basinTpsIds.has(row[1]));
  const timedModels = basinModels.filter((row) => timedModelIds.has(row[0])).length;
  const eventModels = basinModels.filter((row) => timedProcessModelIds.has(row[0])).length;
  const cycleCount = basinCycleRows.filter((row) => row[2] === basinId).length;
  const classified = Boolean(existingSetting || doustClassifications.has(provinceCode));
  const sourceConnected = publications.length > 0 || sourceRows.some((row) => row[6] > 0);
  const denominatorTps = Math.max(basinTps.length, 1);
  const denominatorModels = Math.max(basinModels.length, 1);
  const completion = Math.round((
    (sourceConnected ? 20 : 0)
    + 20 * narrativeTps / denominatorTps
    + 15 * formationTps / denominatorTps
    + (classified ? 10 : 0)
    + (cycleCount > 0 ? 10 : 0)
    + 15 * timedModels / denominatorModels
    + 10 * eventModels / denominatorModels
  ) * 10) / 1000;
  const stage = eventModels > 0 && eventModels === basinModels.length
    ? 'evidence-timed-framework'
    : timedModels > 0
      ? 'timed-element-framework'
      : cycleCount > 0 || classified
        ? 'basin-framework'
        : narrativeTps > 0
          ? 'narrative-loaded'
          : sourceConnected
            ? 'source-connected'
            : 'catalogue-only';
  const primaryGap = !sourceConnected ? 'official-source-route'
    : narrativeTps < basinTps.length ? 'TPS narrative extraction'
      : formationTps < basinTps.length ? 'formation normalization'
        : !classified ? 'basin classification'
          : cycleCount === 0 ? 'basin-cycle interpretation'
            : timedModels < basinModels.length ? 'timed essential elements'
              : 'timed process events';
  const nextAction = primaryGap === 'official-source-route'
    ? 'Locate USGS reassessment or national geological-survey publication.'
    : primaryGap === 'TPS narrative extraction'
      ? 'Resolve publication evidence to explicit TPS scope and extract essential elements.'
      : primaryGap === 'formation normalization'
        ? 'Normalize named source, reservoir and seal units and assign numerical ages.'
        : primaryGap === 'basin classification'
          ? 'Review a basin-evolution study and assign a defensible geodynamic classification.'
          : primaryGap === 'basin-cycle interpretation'
            ? 'Build ordered tectonostratigraphic cycles with numerical boundaries and evidence.'
            : primaryGap === 'timed essential elements'
              ? 'Promote reviewed formations into PS Elements with numerical ages.'
              : 'Complete evidence-derived generation, migration, trap, accumulation, preservation and critical-moment intervals; then calibrate.';
  return [
    basinId, basinName, provinceCode, provinceName, basinTps.length, basinAus.length,
    uniquePublicationIds.size, extractedPdfs.size, sourceRows.reduce((sum, row) => sum + Number(row[6] ?? 0), 0),
    narrativeTps, formationTps, classified ? 'source-classified' : 'not-classified', cycleCount,
    basinModels.length, timedModels, eventModels, sourceConnected ? 'Y' : 'N', stage,
    completion, primaryGap, nextAction,
    uniqueText([sourceRows.some((row) => row[6] > 0) ? 'C-USGS-DDS60-AU' : null, publications.length ? 'C-USGS-WORLD-PUBS' : null, classified ? 'C-DOUST-01' : null]).join('; '),
  ];
}).sort((a, b) => b[18] - a[18] || String(a[1]).localeCompare(String(b[1])));
const basinCompletionSheet = writeDataSheet('Basin Completion', [
  'basin_id', 'basin_name', 'province_code', 'province_name', 'tps_count', 'au_count',
  'current_publication_count', 'extracted_current_pdf_count', 'dds60_form_count',
  'tps_with_narratives', 'tps_with_source_formation', 'classification_status', 'cycle_count',
  'model_count', 'timed_element_model_count', 'timed_process_model_count', 'source_connected',
  'completion_stage', 'completion_pct', 'primary_gap', 'next_action', 'source_citation_ids',
], basinCompletionRows, [34, 34, 15, 34, 13, 13, 24, 26, 18, 21, 27, 24, 15, 15, 25, 28, 18, 28, 18, 30, 72, 34],
'Completion is evidence-weighted, not a subjective prospectivity score: official source 20%; TPS narratives 20%; normalized source formations 15%; reviewed basin classification 10%; basin-cycle model 10%; timed elements 15%; evidence-derived timed processes 10%.');
basinCompletionSheet.getRange(`C2:C${basinCompletionRows.length + 1}`).format.numberFormat = '@';
basinCompletionSheet.getRange(`E2:P${basinCompletionRows.length + 1}`).format.numberFormat = '#,##0';
basinCompletionSheet.getRange(`S2:S${basinCompletionRows.length + 1}`).format.numberFormat = '0.0%';
basinCompletionSheet.getRange(`S2:S${basinCompletionRows.length + 1}`).conditionalFormats.add('colorScale', {
  colors: ['#FEE2E2', '#FEF3C7', '#CCFBF1'], thresholds: ['min', '50%', 'max'],
});
const completionRuleRows = [
  ['official-source-connected', 0.20, 'At least one official current publication link or DDS-60 AU authority form for the basin.'],
  ['TPS-narrative-loaded', 0.20, 'Prorated by TPS count with essential-element narrative loaded.'],
  ['source-formation-normalized', 0.15, 'Prorated by TPS count with a named source-formation field.'],
  ['basin-classified', 0.10, 'Reviewed whole-basin geodynamic classification exists.'],
  ['basin-cycle-modelled', 0.10, 'At least one ordered basin-cycle record exists.'],
  ['timed-elements-modelled', 0.15, 'Prorated by basin model count with numerical PS Element rows.'],
  ['process-events-timed', 0.10, 'Prorated by basin model count with evidence-derived process intervals. Calibration and technical review remain separate.'],
];
const completionRulesSheet = writeDataSheet('Basin Completion Rules', ['milestone', 'weight', 'completion_test'], completionRuleRows, [38, 16, 88],
'Weights measure data/model readiness only. They do not rank basin prospectivity, commercial attractiveness or geological quality.');
completionRulesSheet.getRange(`B2:B${completionRuleRows.length + 1}`).format.numberFormat = '0%';

const psById = new Map(psValues.map((row) => [row[0], row]));
const chartCompletionRows = modelRows.map((model) => {
  const [modelId, tpsId, scopeType, scopeId, title, grade] = model;
  const ps = psById.get(tpsId);
  const provinceId = ps?.[3] ?? null;
  const basin = basinRows.find((row) => row[3] === provinceId);
  const elements = elementRows.filter((row) => row[1] === modelId);
  const events = eventRows.filter((row) => row[1] === modelId);
  const roles = new Set(elements.map((row) => row[3]));
  const timedEvents = events.filter((row) => row[6] === 'modelled');
  const eventTypes = new Set(timedEvents.map((row) => row[2]));
  const completedRows = roles.size + eventTypes.size;
  const missingRoles = essentialGaps.filter(([role]) => !roles.has(role)).map(([, label]) => label);
  const missingEvents = gaps.filter(([type]) => !eventTypes.has(type)).map(([, label]) => label);
  const nextGap = [...missingRoles, ...missingEvents][0] ?? 'technical review and calibration';
  return [
    modelId, tpsId, ps?.[1] ?? null, ps?.[2] ?? null, basin?.[0] ?? null, basin?.[1] ?? null,
    scopeType, scopeId, title, grade, elements.length, roles.size, timedEvents.length,
    eventTypes.has('critical-moment') ? 'evidence-derived' : 'not-modelled', completedRows / 11,
    11 - completedRows, nextGap, uniqueText([...elements.map((row) => row[10]), ...timedEvents.map((row) => row[11])]).join('; '),
    grade === 'G0' ? 'source research' : 'geological review',
  ];
}).sort((a, b) => b[14] - a[14] || String(a[5] ?? '').localeCompare(String(b[5] ?? '')) || String(a[3] ?? '').localeCompare(String(b[3] ?? '')));
const chartCompletionSheet = writeDataSheet('PS Chart Completion', [
  'model_id', 'tps_id', 'tps_code', 'tps_name', 'basin_id', 'basin_name', 'scope_type', 'scope_id',
  'chart_title', 'model_grade', 'element_bar_count', 'element_role_count', 'timed_process_count',
  'critical_moment_status', 'chart_row_completion_pct', 'remaining_chart_rows', 'next_gap',
  'source_citation_ids', 'review_stage',
], chartCompletionRows, [38, 32, 14, 38, 34, 34, 20, 34, 42, 16, 20, 20, 20, 28, 26, 22, 34, 34, 22],
'Chart-row completion measures four essential-element roles plus seven process rows. Evidence-derived timing is review pending and is not equivalent to a calibrated burial-history model.');
chartCompletionSheet.getRange(`K2:P${chartCompletionRows.length + 1}`).format.numberFormat = '#,##0';
chartCompletionSheet.getRange(`O2:O${chartCompletionRows.length + 1}`).format.numberFormat = '0.0%';
chartCompletionSheet.getRange(`O2:O${chartCompletionRows.length + 1}`).conditionalFormats.add('colorScale', {
  colors: ['#FEE2E2', '#FEF3C7', '#CCFBF1'], thresholds: ['min', '50%', 'max'],
});

const completenessRows = [
  ['Catalogue', 'Current TPS identities', psValues.length, psValues.length, 0, 'complete', 'DDS-69 inventory', 'No further identity fill required.'],
  ['Catalogue', 'Unique current AU identities', auValues.length, auValues.length, 0, 'complete', 'DDS-69 inventory', rawAuValues.length === auValues.length ? 'No duplicates detected.' : `${rawAuValues.length - auValues.length} duplicate identity row removed.`],
  ['Authority corpus', 'DDS-60 AU forms parsed', auEvidence.length, auEvidence.filter((record) => record.extraction_status === 'parsed').length, auEvidence.filter((record) => record.extraction_status !== 'parsed').length, 'source-gap', 'DDS-60 AU forms', 'One form contains description/probability content but no full element sections.'],
  ['TPS geology', 'TPS with exact DDS-60 narratives', psValues.length, coverageRows.filter((row) => row[10] === 'dds60-exact-vintage').length, coverageRows.filter((row) => row[10] !== 'dds60-exact-vintage').length, 'source-gap', 'DDS-60 / DDS-69 vintage crosswalk', 'Remaining systems require newer assessment reports or reviewed national-survey literature.'],
  ['TPS geology', 'TPS with current USGS publication link', psValues.length, coverageRows.filter((row) => row[14] > 0).length, coverageRows.filter((row) => !(row[14] > 0)).length, 'source-located', 'USGS World Petroleum Assessments publication registry', 'Open and extract the linked publication; a province-level publication link is an authority route, not a completed TPS model.'],
  ['Authority corpus', 'Current USGS publications with extracted PDF evidence', publicationRegistry.summary.unique_publications, new Set(currentPublicationEvidence.records.map((record) => String(record.publication_id))).size, publicationRegistry.summary.unique_publications - new Set(currentPublicationEvidence.records.map((record) => String(record.publication_id))).size, 'source-gap', 'USGS linked publication PDFs', 'Resolve the remaining publication pages without usable PDF links; extracted evidence remains publication/province scoped until explicit TPS resolution.'],
  ['TPS geology', 'Source-formation field populated', psValues.length, psEnrichmentRows.filter((row) => row[0]).length, psEnrichmentRows.filter((row) => !row[0]).length, 'normalization-gap', 'Authority AU narratives', 'Blank means the source unit was not named or has not been normalized; it is never inferred from the TPS title.'],
  ['TPS geology', 'Essential-element narrative populated', psValues.length, psEnrichmentRows.filter((row) => row[1]).length, psEnrichmentRows.filter((row) => !row[1]).length, 'source-gap', 'Authority AU narratives', 'Narrative evidence is loaded but still requires formation-role and numerical-age review.'],
  ['TPS geology', 'Generation/migration narrative populated', psValues.length, psEnrichmentRows.filter((row) => row[2]).length, psEnrichmentRows.filter((row) => !row[2]).length, 'source-gap', 'Authority AU narratives', 'Narrative timing is not a calibrated event interval.'],
  ['Resources', 'AUs with reported mean resources', auValues.length, auRows.filter((row) => row.oilMean_mmbbl != null || row.gasMean_bcf != null || row.boeMean_mmboe != null).length, auRows.filter((row) => row.oilMean_mmbbl == null && row.gasMean_bcf == null && row.boeMean_mmboe == null).length, 'source-gap', 'DDS-69 AU summary', 'Unreported resource values remain blank, with an explicit status; they are not converted to zero.'],
  ['Basin framework', 'Basins with reviewed whole-basin class', basinRows.length, basinRows.filter((row) => row[2] || doustClassifications.has(String(row[3]).split(':').pop())).length, basinRows.filter((row) => !row[2] && !doustClassifications.has(String(row[3]).split(':').pop())).length, 'interpretation-gap', 'Doust worked examples / reviewed basin studies', 'Province names do not provide a defensible basin classification.'],
  ['Basin framework', 'Basins with cycle models', basinRows.length, new Set(stratValues.map((row) => row[7]).filter(Boolean).map(() => 'atlas:basin:atlas:viking-graben')).size, basinRows.length - 1, 'interpretation-gap', 'Basin-specific tectonostratigraphic studies', 'Cycle boundaries, numerical ages and facies attributes require basin-by-basin interpretation.'],
  ['PS models', 'Models with timed essential elements', modelRows.length, new Set(elementRows.map((row) => row[1])).size, modelRows.length - new Set(elementRows.map((row) => row[1])).size, 'interpretation-gap', 'USGS AU narratives + reviewed Viking stratigraphy', 'Evidence-derived intervals use explicit authority age phrases and ICS boundaries; technical review is still required.'],
  ['PS models', 'Models with evidence-derived timed processes', modelRows.length, new Set(eventRows.filter((row) => row[6] === 'modelled').map((row) => row[1])).size, modelRows.length - new Set(eventRows.filter((row) => row[6] === 'modelled').map((row) => row[1])).size, 'interpretation-gap', 'USGS maturation, migration, trap and preservation narratives', 'Timed rows are evidence-derived, not burial-model calibrated; critical moments remain blank unless peak timing is explicit.'],
  ['Work programme', 'Evidence gaps closed by timed chart rows', gapRows.length, gapRows.filter((row) => row[8] === 'closed').length, gapRows.filter((row) => row[8] !== 'closed').length, 'active', 'Gap ledger', 'Closed means a cited evidence-derived chart interval exists; calibration and review remain governed by model grade.'],
  ['Governance', 'Models with named reviewer', modelRows.length, modelRows.filter((row) => row[9]).length, modelRows.filter((row) => !row[9]).length, 'governance-gap', 'Technical review workflow', 'Reviewer must be a real accountable person; no placeholder is inserted.'],
];
const completenessSheet = writeDataSheet('Data Completeness', [
  'domain', 'metric', 'total_records', 'filled_or_located', 'remaining', 'gap_class', 'authority_or_rule', 'required_action',
], completenessRows, [22, 42, 16, 18, 14, 22, 48, 76],
'“Remaining” is not automatically bad data. It distinguishes missing authority evidence, normalization work, geological interpretation and governance sign-off so the platform never fills uncertainty with invented values.');
completenessSheet.getRange(`C2:E${completenessRows.length + 1}`).format.numberFormat = '#,##0';

const coverageSheet = resetSheet('PS Coverage');
coverageSheet.getRange('A1:H1').merge();
coverageSheet.getRange('A1').values = [['Petroleum-System Enrichment Control']];
coverageSheet.getRange('A1:H1').format = { ...headerFormat, font: { ...headerFormat.font, size: 16 }, rowHeight: 34 };
coverageSheet.getRange('A3:B16').values = [
  ['Metric', 'Value'], ['Petroleum systems', null], ['Versioned models', null], ['G1+ frameworks', null],
  ['Timed element rows', null], ['Modelled process events', null], ['Open evidence gaps', null], ['Systems queued after pilot', null],
  ['Authority AU forms', null], ['Parsed authority narratives', null], ['Current AUs with exact historical code', null],
  ['Current TPS with exact DDS-60 forms', null], ['TPS with province context only', null], ['TPS with current USGS publication link', null],
];
coverageSheet.getRange('A3:B3').format = headerFormat;
coverageSheet.getRange('A4:A16').format = { ...bodyFormat, font: { ...bodyFormat.font, bold: true } };
coverageSheet.getRange('B4:B16').formulas = [
  [`=COUNTA('Petroleum System'!$B$2:$B$${psValues.length + 1})`],
  [`=COUNTA('PS Model'!$A$2:$A$${modelRows.length + 1})`],
  [`=COUNTIF('PS Model'!$F$2:$F$${modelRows.length + 1},"<>G0")`],
  [`=COUNTA('PS Elements'!$A$2:$A$${elementRows.length + 1})`],
  [`=COUNTIF('PS Events'!$G$2:$G$${eventRows.length + 1},"modelled")`],
  [`=COUNTIF('PS Gap Ledger'!$I$2:$I$${gapRows.length + 1},"open")`],
  [`=COUNTA('PS Batch Plan'!$A$2:$A$${batchLast})-COUNTIF('PS Batch Plan'!$A$2:$A$${batchLast},"B00")`],
  [`=COUNTA('USGS AU Evidence'!$A$2:$A$${evidenceRows.length + 1})`],
  [`=COUNTIF('USGS AU Evidence'!$J$2:$J$${evidenceRows.length + 1},"parsed")`],
  [`=COUNTIF('USGS Vintage Crosswalk'!$B$2:$B$${crosswalkRows.length + 1},"exact-code")`],
  [`=COUNTIF('PS Source Coverage'!$K$2:$K$${coverageRows.length + 1},"dds60-exact-vintage")`],
  [`=COUNTIF('PS Source Coverage'!$K$2:$K$${coverageRows.length + 1},"dds60-province-context-only")`],
  [`=COUNTIF('PS Source Coverage'!$O$2:$O$${coverageRows.length + 1},">0")`],
];
// Artifact-tool does not currently recalculate this cross-sheet text COUNTIF reliably.
// Store the extraction-run result so the control dashboard remains complete.
coverageSheet.getRange('B12').values = [[auEvidence.filter((record) => record.extraction_status === 'parsed').length]];
coverageSheet.getRange('B4:B16').format = { fill: '#ECFEFF', font: { bold: true, color: '#0F766E', size: 12, name: 'Arial' }, numberFormat: '#,##0' };
coverageSheet.getRange('D3:H3').values = [['Grade', 'Meaning', 'Minimum evidence', 'Review state', 'Chart behavior']];
coverageSheet.getRange('D3:H3').format = headerFormat;
coverageSheet.getRange('D4:H8').values = [
  ['G0', 'Catalogued', 'Authority identity and scope', 'Not reviewed', 'Identity only'],
  ['G1', 'Framework', 'Timed essential elements', 'Draft / interpreted', 'Element bars + governed process gaps'],
  ['G2', 'Chart-ready', 'Trap and charge intervals', 'Peer checked', 'Full event chart'],
  ['G3', 'Calibrated', 'Burial/thermal and well calibration', 'Technical review', 'Confidence-qualified timing'],
  ['G4', 'Approved', 'Integrated evidence and sign-off', 'Approved', 'Enterprise reference model'],
];
coverageSheet.getRange('D4:H8').format = bodyFormat;
coverageSheet.getRange('A18:H18').merge();
coverageSheet.getRange('A18').values = [['CONTROL RULE · No system advances a grade because a cell was filled. It advances only when required evidence, numerical ages, provenance and review status are present.']];
coverageSheet.getRange('A18:H18').format = noteFormat;
['A:A','B:B','C:C','D:D','E:E','F:F','G:G','H:H'].forEach((col, index) => { coverageSheet.getRange(col).format.columnWidth = [30,18,4,14,24,36,20,30][index]; });

const timeRows = [
  ['ICS 2026/06', 'period', 'quaternary', 'Quaternary', 2.58, 0, 'Cenozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'neogene', 'Neogene', 23.04, 2.58, 'Cenozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'paleogene', 'Paleogene', 66.0, 23.04, 'Cenozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'cretaceous', 'Cretaceous', 143.1, 66.0, 'Mesozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'jurassic', 'Jurassic', 201.4, 143.1, 'Mesozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'triassic', 'Triassic', 251.902, 201.4, 'Mesozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'permian', 'Permian', 298.9, 251.902, 'Paleozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'carboniferous', 'Carboniferous', 358.86, 298.9, 'Paleozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'devonian', 'Devonian', 419.62, 358.86, 'Paleozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'silurian', 'Silurian', 443.1, 419.62, 'Paleozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'ordovician', 'Ordovician', 486.85, 443.1, 'Paleozoic', 'C-ICS-2026'],
  ['ICS 2026/06', 'period', 'cambrian', 'Cambrian', 538.8, 486.85, 'Paleozoic', 'C-ICS-2026'],
];
const timeSheet = writeDataSheet('Geologic Timescale', [
  'timescale_version', 'rank', 'unit_id', 'name', 'start_ma', 'end_ma', 'parent_name', 'source_citation_id',
], timeRows, [20, 13, 18, 22, 14, 14, 18, 22],
'Period-level ICS time vocabulary used to orient petroleum-system charts. Detailed model ages remain explicit numeric interpretations in PS Elements and PS Events.');
timeSheet.getRange(`E2:F${timeRows.length + 1}`).format.numberFormat = '0.000';

// Document the normalized authoring contract in the workbook's own dictionary.
const dictionary = workbook.worksheets.getItem('Data Dictionary');
dictionary.getRange('A14:D19').values = [
  ['PS Model', 'completeness_grade', 'G0 / G1 / G2 / G3 / G4', 'Catalogue → framework → chart-ready → calibrated → technically reviewed.'],
  ['PS Model', 'scope_type / scope_id', 'TPS / assessment-unit / basin-sector / field', 'Every chart declares its geological and spatial scope; Viking is an AU pilot, not the whole 402501 TPS.'],
  ['PS Elements', 'start_ma / end_ma', 'numeric Ma, oldest → youngest', 'Chart source of truth. Formal age labels are resolved from the declared ICS timescale version.'],
  ['PS Events', 'event_status', 'modelled / partial / not-modelled / disputed', 'Missing process timing is an explicit work-programme record, not an empty decorative row.'],
  ['PS Events', 'critical-moment', 'point or narrow interval in Ma', 'Must be supported by integrated trap, charge and accumulation evidence.'],
  ['Geologic Timescale', 'start_ma / end_ma', 'official ICS period boundaries', 'Versioned time vocabulary for chart orientation; never a substitute for interpreted model ages.'],
];
dictionary.getRange('A14:D19').format = bodyFormat;
dictionary.getRange('A20:D27').values = [
  ['PS Gap Ledger', 'status / evidence_required', 'open work item', 'Every missing element or process is explicit, assignable and closed only with reviewed evidence.'],
  ['PS Batch Plan', 'batch_id / priority_rank', 'B00 pilot; B01+ resource-ranked groups', 'Controls research sequencing; ranking is not a prospectivity judgment.'],
  ['PS Coverage', 'grade metrics', 'formula-driven control dashboard', 'Shows model maturity and evidence coverage directly from governed authoring sheets.'],
  ['USGS AU Evidence', 'source_vintage / authority narratives', 'raw DDS-60 AU report evidence', 'Preserves source, maturation, migration, reservoir, trap and seal narrative before normalization.'],
  ['PS Element Candidates', 'element_role / unit_candidates', 'candidate only', 'Authority-text candidates require formation normalization, numerical ages and geological review before promotion.'],
  ['PS Process Evidence', 'event_type / reported_age_terms', 'not calibrated', 'Narrative maturation and migration evidence is never treated as a numerical event bar without interpretation.'],
  ['USGS Vintage Crosswalk', 'relationship', 'exact-code / current-only / historical-only / reviewed-supersession', 'Prevents historical DDS-60 identities from silently overwriting the current DDS-69 inventory.'],
  ['PS Source Coverage', 'source_coverage / research_route', 'vintage-aware evidence status', 'Routes each current TPS to exact-form review, province-context supersession work, or new authority research.'],
];
dictionary.getRange('A20:D27').format = bodyFormat;
dictionary.getRange('A28:D28').values = [[
  'Data Completeness', 'filled_or_located / remaining / gap_class', 'data-completeness control', 'Separates catalogue, source, normalization, geological-interpretation and governance gaps; never treats all blanks as equivalent.',
]];
dictionary.getRange('A28:D28').format = bodyFormat;
dictionary.getRange('A29:D29').values = [[
  'USGS Publication Registry', 'province_code / publication_id / URL', 'official authority route', 'Maps current province identities to USGS conventional-assessment publications; publication links are preserved by province and not assumed to resolve TPS vintage changes.',
]];
dictionary.getRange('A29:D29').format = bodyFormat;
dictionary.getRange('A30:D32').values = [
  ['USGS Current Evidence', 'publication_id / evidence excerpts / scope_rule', 'raw current-publication evidence', 'Preserves source, reservoir, trap/seal, process and geologic-framework evidence extracted from linked official PDFs; scope must be resolved before promotion.'],
  ['Basin Completion', 'completion_stage / completion_pct / primary_gap', 'evidence-weighted readiness register', 'One row per basin with source, narrative, formation, classification, cycle, timed-element and evidence-derived-process milestones.'],
  ['Basin Completion Rules', 'milestone / weight / completion_test', 'auditable scoring contract', 'Weights measure data/model readiness and never prospectivity or commercial quality.'],
];
dictionary.getRange('A30:D32').format = bodyFormat;
dictionary.getRange('A33:D33').values = [[
  'PS Chart Completion', 'chart_row_completion_pct / next_gap', 'model-by-model chart register', 'Measures four essential-element roles plus seven process rows and keeps calibration/review status separate from evidence-derived timing.',
]];
dictionary.getRange('A33:D33').format = bodyFormat;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const errors = await workbook.inspect({
  kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 200 }, maxChars: 8000,
  summary: 'petroleum-system workbook formula error scan',
});
console.log('ERROR_SCAN');
console.log(errors.ndjson);

for (const [sheetName, range, fileName] of [
  ['PS Model', `A1:O8`, 'ps-model.png'],
  ['PS Elements', `A1:L${elementRows.length + 3}`, 'ps-elements.png'],
  ['Geologic Timescale', `A1:H${timeRows.length + 3}`, 'geologic-timescale.png'],
  ['Basin Completion', 'A1:V15', 'basin-completion.png'],
  ['Basin Completion Rules', `A1:C${completionRuleRows.length + 3}`, 'basin-completion-rules.png'],
  ['PS Chart Completion', 'A1:S16', 'ps-chart-completion.png'],
  ['Data Completeness', `A1:H${completenessRows.length + 3}`, 'data-completeness.png'],
  ['PS Coverage', 'A1:H18', 'ps-coverage.png'],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.25, format: 'png' });
  await fs.writeFile(`${previewDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}

for (const [sheetId, range] of [
  ['PS Model', `A1:O${modelRows.length + 1}`],
  ['PS Elements', `A1:L${elementRows.length + 1}`],
  ['PS Events', `A1:N${eventRows.length + 1}`],
  ['Geologic Timescale', `A1:H${timeRows.length + 1}`],
  ['PS Gap Ledger', `A1:N${gapRows.length + 1}`],
  ['PS Batch Plan', `A1:Y${batchRows.length + 1}`],
  ['USGS AU Evidence', 'A1:J10'],
  ['PS Element Candidates', 'A1:M10'],
  ['PS Process Evidence', 'A1:L10'],
  ['USGS Vintage Crosswalk', 'A1:N10'],
  ['PS Source Coverage', 'A1:S15'],
  ['USGS Publication Registry', 'A1:P12'],
  ['USGS Current Evidence', 'A1:T12'],
  ['Basin Completion', 'A1:V18'],
  ['Basin Completion Rules', `A1:C${completionRuleRows.length + 3}`],
  ['PS Chart Completion', 'A1:S18'],
  ['Data Completeness', `A1:H${completenessRows.length + 3}`],
  ['PS Coverage', 'A1:H18'],
]) {
  const check = await workbook.inspect({ kind: 'table', sheetId, range, include: 'values,formulas', tableMaxRows: 14, tableMaxCols: 15, maxChars: 18000 });
  console.log(`VERIFY ${sheetId}`);
  console.log(check.ndjson);
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/ArgantaEnergy-Master-KB.xlsx`);
await output.save(source);
console.log(JSON.stringify({ petroleumSystems: psValues.length, uniqueAssessmentUnits: auValues.length, duplicateAssessmentUnitsRemoved: rawAuValues.length - auValues.length, models: modelRows.length, elements: elementRows.length, timedElementModels: timedModelIds.size, events: eventRows.length, modelledEvidenceEvents: eventRows.filter((row) => row[6] === 'modelled').length, timedProcessModels: timedProcessModelIds.size, criticalMomentModels: new Set(eventRows.filter((row) => row[2] === 'critical-moment' && row[6] === 'modelled').map((row) => row[1])).size, chartReadyRowModels: chartCompletionRows.filter((row) => row[14] === 1).length, gaps: gapRows.length, closedChartGaps: gapRows.filter((r) => r[8] === 'closed').length, authorityLocatedGaps: gapRows.filter((r) => r[8] === 'in-progress').length, batches: new Set(batchRows.map((r) => r[0])).size, authorityForms: evidenceRows.length, parsedNarratives: auEvidence.filter((r) => r.extraction_status === 'parsed').length, elementCandidates: elementCandidateRows.length, processEvidence: processEvidenceRows.length, publicationLinks: publicationRows.length, uniquePublications: publicationRegistry.summary.unique_publications, currentEvidencePdfs: currentEvidenceRows.length, currentEvidencePublications: new Set(currentPublicationEvidence.records.map((record) => String(record.publication_id))).size, tpsWithCurrentPublication: coverageRows.filter((r) => r[14] > 0).length, sourceConnectedBasins: basinCompletionRows.filter((row) => row[16] === 'Y').length, averageBasinCompletionPct: Math.round(basinCompletionRows.reduce((sum, row) => sum + row[18], 0) / basinCompletionRows.length * 1000) / 10, basinStages: Object.fromEntries([...new Set(basinCompletionRows.map((row) => row[17]))].map((stage) => [stage, basinCompletionRows.filter((row) => row[17] === stage).length])), vintageCrosswalks: crosswalkRows.length, exactCurrentAuMatches: crosswalkRows.filter((r) => r[1] === 'exact-code').length, exactTpsFormCoverage: coverageRows.filter((r) => r[10] === 'dds60-exact-vintage').length, sourceFormationFields: psEnrichmentRows.filter((r) => r[0]).length, essentialNarrativeFields: psEnrichmentRows.filter((r) => r[1]).length, processNarrativeFields: psEnrichmentRows.filter((r) => r[2]).length, sourceClassifiedBasins: basinRows.filter((row) => row[2] || doustClassifications.has(String(row[3]).split(':').pop())).length, timeUnits: timeRows.length }));
