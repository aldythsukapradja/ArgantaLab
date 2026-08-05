const fs = require('fs');
const XLSX = require('../../apps/energy/node_modules/xlsx');
const root = 'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab';
const evidence = JSON.parse(fs.readFileSync(`${root}/.codex/tmp-petsys/au-evidence.json`, 'utf8'));
const wb = XLSX.readFile(`${root}/docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx`);
const rows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name]);
const aus = rows('Assessment Unit').filter((r) => r.au_id && r.code);
const tps = rows('Petroleum System').filter((r) => r.tps_id && r.code);
const plans = rows('PS Batch Plan').filter((r) => r.tps_id);
const valid = evidence.filter((r) => r.au_code);
const byAu = new Map(valid.map((r) => [String(r.au_code), r]));
const coveredTps = new Set(valid.map((r) => String(r.tps_code)));
const region = {};
for (const r of evidence) {
  const key = String(r.archive_region ?? 'unknown');
  region[key] ??= { files: 0, parsed: 0, uniqueTps: new Set() };
  region[key].files += 1;
  region[key].parsed += Number(r.extraction_status === 'parsed');
  if (r.tps_code) region[key].uniqueTps.add(r.tps_code);
}
const batchCoverage = [...new Set(plans.map((r) => r.batch_id))].sort().map((batch) => {
  const members = plans.filter((r) => r.batch_id === batch);
  return { batch, systems: members.length, withAuthorityForms: members.filter((r) => coveredTps.has(String(r.tps_code))).length };
});
console.log(JSON.stringify({
  workbook: { petroleumSystems: tps.length, assessmentUnits: aus.length },
  evidence: {
    files: evidence.length, parsed: evidence.filter((r) => r.extraction_status === 'parsed').length,
    partial: evidence.filter((r) => r.extraction_status === 'partial').length,
    errors: evidence.filter((r) => r.extraction_status === 'error').length,
    matchedAssessmentUnits: aus.filter((a) => byAu.has(String(a.code))).length,
    coveredPetroleumSystems: tps.filter((t) => coveredTps.has(String(t.code))).length,
  },
  regions: Object.fromEntries(Object.entries(region).map(([k, v]) => [k, { files: v.files, parsed: v.parsed, uniqueTps: v.uniqueTps.size }])),
  batchCoverage,
  unresolved: evidence.filter((r) => r.extraction_status !== 'parsed').map((r) => ({ path: r.source_member_path, status: r.extraction_status, code: r.au_code, error: r.error })).slice(0, 30),
}, null, 2));
