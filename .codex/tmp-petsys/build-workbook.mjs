import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const root = 'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab';
const source = `${root}/docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx`;
const outputDir = `${root}/outputs/petroleum-system-enrichment`;
const previewDir = `${root}/.codex/tmp-petsys/renders`;
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));

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
  sheet.getRange(`A1:${lastCol}1`).values = [headers];
  sheet.getRange(`A1:${lastCol}1`).format = headerFormat;
  sheet.getRange(`A1:${lastCol}1`).format.rowHeight = 24;
  if (rows.length) {
    sheet.getRange(`A2:${lastCol}${rows.length + 1}`).values = rows;
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
const catalogModels = psValues.map((row) => {
  const [tpsId, code, name, , , , , provenance, citation] = row;
  return [
    `atlas:ps-model:${code}:catalog-v1`, tpsId, 'total-petroleum-system', tpsId,
    `${name} — catalogue baseline`, 'G0', 'ICS 2026/06', 'catalogued',
    'USGS / ArgantaEnergy normalization', null, '1.0.0', today,
    provenance || 'reference', citation || 'C-USGS-DDS69',
    'Identity-level model. Elements and processes remain unmodelled until evidence is reviewed.',
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
const elementRows = stratValues
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
const eventRows = gaps.map(([eventType, label, required], index) => [
  `atlas:ps-event:40250101:${String(index + 1).padStart(2, '0')}`,
  vikingModelId, eventType, label, null, null, 'not-modelled', 'unknown', null, null,
  'gap', null, required,
  'No defensible numerical event interval is stored yet. This row is an explicit work-programme item.',
]);
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

// Document the normalized authoring contract in the workbook's own dictionary.
const dictionary = workbook.worksheets.getItem('Data Dictionary');
dictionary.getRange('A14:D18').values = [
  ['PS Model', 'completeness_grade', 'G0 / G1 / G2 / G3 / G4', 'Catalogue → framework → chart-ready → calibrated → technically reviewed.'],
  ['PS Model', 'scope_type / scope_id', 'TPS / assessment-unit / basin-sector / field', 'Every chart declares its geological and spatial scope; Viking is an AU pilot, not the whole 402501 TPS.'],
  ['PS Elements', 'start_ma / end_ma', 'numeric Ma, oldest → youngest', 'Chart source of truth. Formal age labels are resolved from the declared ICS timescale version.'],
  ['PS Events', 'event_status', 'modelled / partial / not-modelled / disputed', 'Missing process timing is an explicit work-programme record, not an empty decorative row.'],
  ['PS Events', 'critical-moment', 'point or narrow interval in Ma', 'Must be supported by integrated trap, charge and accumulation evidence.'],
];
dictionary.getRange('A14:D18').format = bodyFormat;

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
  ['PS Events', `A1:N${eventRows.length + 3}`, 'ps-events.png'],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.25, format: 'png' });
  await fs.writeFile(`${previewDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}

for (const [sheetId, range] of [
  ['PS Model', `A1:O${modelRows.length + 1}`],
  ['PS Elements', `A1:L${elementRows.length + 1}`],
  ['PS Events', `A1:N${eventRows.length + 1}`],
]) {
  const check = await workbook.inspect({ kind: 'table', sheetId, range, include: 'values,formulas', tableMaxRows: 14, tableMaxCols: 15, maxChars: 18000 });
  console.log(`VERIFY ${sheetId}`);
  console.log(check.ndjson);
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/ArgantaEnergy-Master-KB.xlsx`);
await output.save(source);
console.log(JSON.stringify({ petroleumSystems: psValues.length, models: modelRows.length, elements: elementRows.length, events: eventRows.length }));
