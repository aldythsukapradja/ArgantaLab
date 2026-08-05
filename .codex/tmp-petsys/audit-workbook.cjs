const XLSX = require('../../apps/energy/node_modules/xlsx');

const file = 'docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx';
const wb = XLSX.readFile(file, { cellDates: false, cellFormula: true });

function rows(sheetName) {
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: true });
}

function profile(sheetName) {
  const data = rows(sheetName);
  const headers = data.length ? Object.keys(data[0]) : [];
  return {
    rows: data.length,
    fields: Object.fromEntries(headers.map((header) => {
      const values = data.map((row) => row[header]);
      const missing = values.filter((value) => value == null || String(value).trim() === '').length;
      return [header, { missing, populated: values.length - missing, pct: values.length ? Math.round((values.length - missing) / values.length * 1000) / 10 : 0 }];
    })),
  };
}

const targets = [
  'Region', 'Basin Province', 'Petroleum System', 'Assessment Unit', 'Basin Cycle',
  'Stratigraphic Units', 'PS Model', 'PS Elements', 'PS Events', 'PS Gap Ledger',
  'USGS AU Evidence', 'PS Element Candidates', 'PS Process Evidence',
  'USGS Vintage Crosswalk', 'PS Source Coverage', 'PS Batch Plan', 'Citations',
];

const sourceCoverage = rows('PS Source Coverage');
const batch = rows('PS Batch Plan');
const evidence = rows('USGS AU Evidence');
const candidates = rows('PS Element Candidates');
const processes = rows('PS Process Evidence');
const systems = rows('Petroleum System');
const cycles = rows('Basin Cycle');
const strat = rows('Stratigraphic Units');

const statusCounts = (data, field) => Object.fromEntries([...new Set(data.map((row) => row[field] ?? 'blank'))].sort().map((status) => [status, data.filter((row) => (row[field] ?? 'blank') === status).length]));

const report = {
  sheets: Object.fromEntries(targets.filter((name) => wb.SheetNames.includes(name)).map((name) => [name, profile(name)])),
  petroleumSystemNames: {
    unnamed: systems.filter((row) => /^Unnamed/.test(row.name ?? '')).length,
    composite: systems.filter((row) => /Composite/i.test(row.name ?? '')).length,
    namedSpecific: systems.filter((row) => !/^Unnamed/.test(row.name ?? '') && !/Composite/i.test(row.name ?? '')).length,
  },
  sourceCoverage: statusCounts(sourceCoverage, 'source_coverage'),
  evidenceStatus: statusCounts(evidence, 'extraction_status'),
  candidateStatus: statusCounts(candidates, 'candidate_status'),
  processStatus: statusCounts(processes, 'evidence_status'),
  batchStatus: statusCounts(batch, 'workflow_status'),
  geologicalScope: {
    basinsWithCycles: new Set(cycles.map((row) => row.basin_id).filter(Boolean)).size,
    cycleRows: cycles.length,
    stratRows: strat.length,
    modelsWithElements: new Set(rows('PS Elements').map((row) => row.model_id).filter(Boolean)).size,
    modelsWithModelledEvents: new Set(rows('PS Events').filter((row) => row.event_status === 'modelled').map((row) => row.model_id)).size,
  },
};

console.log(JSON.stringify(report, null, 2));
