import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const source = 'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab/docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx';
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));

const table = (sheetName, range) => workbook.worksheets.getItem(sheetName).getRange(range).values;
const ps = table('Petroleum System', 'A1:I240');
const [headers, ...body] = ps;
const rows = body.filter((r) => r[0]).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
const aus = table('Assessment Unit', 'A1:I380');
const auRows = aus.slice(1).filter((r) => r[0]);
const citations = table('Citations', 'A1:K80').slice(1).filter((r) => r[0]);
const strat = table('Stratigraphic Units', 'A1:J80').slice(1).filter((r) => r[0]);
const cycles = table('Basin Cycle', 'A1:M80').slice(1).filter((r) => r[0]);

const populated = (key) => rows.filter((r) => r[key] != null && String(r[key]).trim()).length;
const tpsAu = new Map();
for (const a of auRows) tpsAu.set(a[3], (tpsAu.get(a[3]) ?? 0) + 1);
const sourceValues = rows.map((r) => String(r.source_rock_formation ?? '').trim()).filter(Boolean);
const sourceTokens = sourceValues.filter((v) => !/unknown|composite|not available|none/i.test(v));

console.log(JSON.stringify({
  assessmentUnitHeaders: aus[0],
  petroleumSystems: rows.length,
  fields: Object.fromEntries(headers.map((h) => [h, populated(h)])),
  withAssessmentUnits: rows.filter((r) => tpsAu.has(r.tps_id)).length,
  assessmentUnits: auRows.length,
  sourceRockNamed: sourceTokens.length,
  uniqueCitations: citations.length,
  stratigraphicUnits: strat.length,
  basinCycles: cycles.length,
  sample: rows.slice(0, 12),
}, null, 2));
