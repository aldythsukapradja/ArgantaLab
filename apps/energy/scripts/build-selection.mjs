// Build selection.json deterministically from inventory.json per the Gate-1 decision.
// Founder approval 2026-07-21: full exploration-log scope; depth horizons; defer EDM;
// trajectories chosen at parse time (mirror all tiny XMLs).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..', '..');
const inv = JSON.parse(readFileSync(join(REPO, 'data-energy', 'manifest', 'inventory.json'), 'utf8'));
const files = inv.filter((e) => !e.is_directory);

// Hard seismic guard (also enforced in mirror): whole heavyweight folders + raw seismic ext.
const HARD_DENY_TOP = new Set([
  'Seismic', 'GeoScience_OW_Archive', 'Reservoir_Model-RMS_model',
  'Reservoir_Model-Eclipse_model', 'PI System Manager Sleipner',
]);
const HARD_DENY_EXT = /\.(sgy|segy)$/i;

// Exploration-relevant log types (drop LWD/production/integrity/div-report dev-phase bulk + VSP).
const LOG_KEEP = [
  '01.MUD_LOG', '03.PRESSURE', '04.COMPOSITE', '05.PETROPHYSICAL INTERPRETATION',
  '06.LFP', '07.IMAGE', '09.CORE', '12.BIOSTRAT', '13.GEOCHEM',
];

function selected(p) {
  const top = p.split('/')[0];
  if (HARD_DENY_TOP.has(top)) return false;
  if (HARD_DENY_EXT.test(p)) return false;
  if (p.startsWith('Production_data/')) return true;
  if (p.startsWith('Reports/')) return true;
  if (p === 'HRS and Terms and conditions for license to data - Volve.pdf') return true;
  if (/\/trajectory\//i.test(p)) return true;                     // all tiny WITSML trajectory objects
  if (p.startsWith('Well_technical_data/WellWellbore/')) return true; // well/wellbore masters
  if (p.startsWith('Geophysical_Interpretations/') && /Horizons_DEPTH/i.test(p)) return true; // depth horizons only
  if (p.startsWith('Geophysical_Interpretations/Wells/')) return true; // formation tops / well picks (P1 gap-fill)
  if (p.startsWith('Well_logs_pr_WELL/')) {                        // exploration log types, all wells
    const type = p.split('/')[2] || '';
    return LOG_KEEP.includes(type);
  }
  return false;
}

const picked = files.filter((f) => selected(f.path));
const total = picked.reduce((a, b) => a + b.size, 0);

const byGroup = {};
for (const f of picked) {
  const g = f.path.split('/')[0];
  byGroup[g] = byGroup[g] || { n: 0, b: 0 };
  byGroup[g].n++; byGroup[g].b += f.size;
}

writeFileSync(
  join(REPO, 'data-energy', 'manifest', 'selection.json'),
  JSON.stringify({
    decidedAt: '2026-07-21', decision: 'Gate1: full exploration logs + depth horizons + all trajectories + masters',
    fileCount: picked.length, totalBytes: total,
    files: picked.map((f) => ({ path: f.path, size: f.size, last_modified: f.last_modified })),
  }, null, 2),
);

console.log('=== selection by top folder ===');
for (const [g, d] of Object.entries(byGroup).sort((a, b) => b[1].b - a[1].b))
  console.log(`  ${(d.b / 1e6).toFixed(1).padStart(9)}MB  ${String(d.n).padStart(5)}f  ${g}`);
console.log(`\n  ${picked.length} files, ${(total / 1e9).toFixed(2)} GB total -> selection.json`);
