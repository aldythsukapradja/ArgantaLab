const XLSX = require('../../apps/energy/node_modules/xlsx');
const path = 'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab/docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx';
const wb = XLSX.readFile(path);
const rows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name]).filter((r) => Object.values(r).some((v) => v !== ''));
const models = rows('PS Model').filter((r) => r.model_id && r.tps_id);
const events = rows('PS Events').filter((r) => r.event_id && r.model_id);
const gaps = rows('PS Gap Ledger').filter((r) => r.gap_id && r.model_id);
const batches = rows('PS Batch Plan').filter((r) => r.tps_id);
const unique = (list, key) => new Set(list.map((r) => r[key])).size === list.length;
const viking = batches.find((r) => String(r.tps_code) === '402501');
const batchIds = [...new Set(batches.map((r) => r.batch_id))].sort();
const batchSummary = batchIds.map((id) => {
  const members = batches.filter((r) => r.batch_id === id).sort((a, b) => Number(a.priority_rank) - Number(b.priority_rank));
  return { id, systems: members.length, first: members.slice(0, 3).map((r) => `${r.tps_code} ${r.tps_name}`) };
});
const modelIds = new Set(models.map((r) => r.model_id));
console.log(JSON.stringify({
  models: models.length, events: events.length, gaps: gaps.length, systemsInPlan: batches.length,
  uniqueModelIds: unique(models, 'model_id'), uniqueEventIds: unique(events, 'event_id'), uniqueGapIds: unique(gaps, 'gap_id'),
  orphanEvents: events.filter((r) => !modelIds.has(r.model_id)).length,
  orphanGaps: gaps.filter((r) => !modelIds.has(r.model_id)).length,
  batchIds, batchSummary,
  viking: viking && { batch: viking.batch_id, model: viking.working_model_id, target: viking.target_grade, status: viking.workflow_status, elementRows: viking.element_rows, openGaps: viking.open_gaps },
}, null, 2));
